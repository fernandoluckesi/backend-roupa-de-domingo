import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AuditActorType, AuditCategory, AuditOutcome, AuthTokenType, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";
import { CartService } from "../cart/cart.service";
import { MailService } from "../mail/mail.service";
import { ConsentService } from "../privacy/consent.service";
import { randomInt, timingSafeEqual } from "crypto";
import { hashIdentifier, sha256 } from "../../common/utils/crypto.util";
import { AuditService } from "../audit/audit.service";
import { maskEmail } from "../../common/utils/privacy.util";
import {
  ChangePasswordDto,
  ConfirmRegistrationDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from "./dto/auth.dto";

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

const CODE_TTL_MS = 15 * 60 * 1000;
/** Tentativas erradas antes de invalidar o codigo (1 em 1 milhao por tentativa) */
const CODE_MAX_ATTEMPTS = 5;
/** Intervalo minimo entre dois envios automaticos de codigo para a mesma conta */
const CODE_RESEND_MS = 60 * 1000;
const BCRYPT_COST = 12;

type CodePurpose = "register" | "email-change" | "password-change" | "password-reset";
const CODE_TYPE: Record<CodePurpose, AuthTokenType> = {
  register: AuthTokenType.EMAIL_VERIFICATION,
  "email-change": AuthTokenType.EMAIL_CHANGE,
  "password-change": AuthTokenType.PASSWORD_CHANGE,
  "password-reset": AuthTokenType.PASSWORD_RESET,
};

const INVALID_CODE = "Código incorreto ou expirado. Confira o e-mail ou peça um novo código.";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly cart: CartService,
    private readonly mail: MailService,
    private readonly consents: ConsentService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Evento de seguranca na trilha de auditoria. `asUser` grava a propria conta
   * como autora (login, cadastro: a requisicao ainda nao tem usuario autenticado).
   */
  private track(
    action: string,
    user: { id: string; role?: Role; email?: string } | null,
    options: { failure?: boolean; asUser?: boolean; data?: Record<string, unknown> } = {},
  ) {
    const asUser = options.asUser && user;
    this.audit.record({
      category: AuditCategory.AUTH,
      action,
      outcome: options.failure ? AuditOutcome.FAILURE : AuditOutcome.SUCCESS,
      actor: asUser
        ? user.role === Role.ADMIN
          ? { type: AuditActorType.ADMIN, id: user.id, email: user.email }
          : { type: AuditActorType.CUSTOMER, id: user.id }
        : undefined,
      target: user ? { type: "user", id: user.id } : undefined,
      data: options.data,
    });
  }

  async register(dto: RegisterDto, meta: RequestMeta = {}) {
    const email = dto.email.toLowerCase().trim();

    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists && !exists.deletedAt && !exists.emailVerifiedAt) {
      throw new ConflictException({
        message: "Esse e-mail já foi cadastrado, mas ainda não foi confirmado. Entre com a sua senha para receber um novo código.",
        error: "EMAIL_NOT_VERIFIED",
      });
    }
    if (exists) {
      throw new ConflictException(
        "Esse e-mail ja esta cadastrado. Tente lembrar a senha antes de tentar esquecer o problema.",
      );
    }

    const now = new Date();
    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        phone: dto.phone,
        document: dto.document ? dto.document.replace(/\D/g, "") : undefined,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_COST),
        termsAcceptedAt: now,
        termsVersion: dto.termsVersion,
        privacyVersion: dto.privacyVersion,
        marketingOptIn: dto.marketingOptIn === true,
        marketingConsentAt: dto.marketingOptIn ? now : null,
      },
    });

    // Prova do aceite (LGPD art. 8o par. 2o): versao, data e origem
    await this.consents.record({
      userId: user.id,
      sessionId: dto.sessionId,
      kind: "terms",
      version: dto.termsVersion,
      granted: true,
      ...meta,
    });
    await this.consents.record({
      userId: user.id,
      sessionId: dto.sessionId,
      kind: "privacy",
      version: dto.privacyVersion,
      granted: true,
      ...meta,
    });
    await this.consents.record({
      userId: user.id,
      kind: "marketing",
      version: dto.privacyVersion,
      granted: dto.marketingOptIn === true,
      ...meta,
    });

    // A conta so abre sessao depois de confirmar o codigo enviado por e-mail
    // (o carrinho de convidado e migrado na confirmacao).
    this.track("auth.register", user, {
      asUser: true,
      data: { marketingOptIn: dto.marketingOptIn === true, termsVersion: dto.termsVersion },
    });
    await this.sendCode(user, "register");
    return { email, verificationRequired: true };
  }

  /** Confirma o cadastro com o codigo do e-mail e abre a sessao. */
  async confirmRegistration(dto: ConfirmRegistrationDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt) throw new BadRequestException(INVALID_CODE);
    if (user.emailVerifiedAt) {
      throw new ConflictException("Esse cadastro já foi confirmado. É só entrar com e-mail e senha.");
    }

    await this.consumeCode(user.id, "register", dto.code);
    const verified = await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });
    if (dto.sessionId) {
      await this.cart.mergeSessionCartIntoUser(dto.sessionId, user.id);
    }
    this.track("auth.register.confirmed", verified, { asUser: true });
    return this.buildSession(verified);
  }

  /** Reenvia o codigo de cadastro. Responde igual exista ou nao a conta. */
  async resendRegistrationCode(emailInput: string) {
    const email = emailInput.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.deletedAt && !user.emailVerifiedAt) {
      await this.sendCode(user, "register", { force: true });
    }
    return { message: "Se houver um cadastro pendente com esse e-mail, enviamos um novo código." };
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const maxFailed = this.config.get<number>("security.maxFailedLogins", 5);
    const lockMinutes = this.config.get<number>("security.lockMinutes", 15);

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      this.track("auth.login.failed", user, { failure: true, data: { reason: "account_locked" } });
      throw new HttpException(
        `Muitas tentativas. A conta foi bloqueada por ${lockMinutes} minutos por segurança. Tente de novo mais tarde ou redefina a senha.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const valid =
      user && !user.deletedAt && (await bcrypt.compare(dto.password, user.passwordHash));

    if (!valid || !user) {
      if (user && !user.deletedAt) {
        const failed = user.failedLoginCount + 1;
        const lock = failed >= maxFailed;
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount: lock ? 0 : failed,
            lockedUntil: lock ? new Date(Date.now() + lockMinutes * 60_000) : null,
          },
        });
        if (lock) {
          this.logger.warn(`Conta ${maskEmail(user.email)} bloqueada por ${lockMinutes} min apos ${maxFailed} falhas.`);
          this.track("auth.account.locked", user, { failure: true, data: { failedAttempts: maxFailed, lockMinutes } });
        }
      }
      // identifierHash: permite achar ataque de lista de senhas sem guardar o e-mail digitado
      const known = Boolean(user && !user.deletedAt);
      this.track("auth.login.failed", known ? user : null, {
        failure: true,
        data: { reason: "invalid_credentials", knownAccount: known, identifierHash: hashIdentifier(email) },
      });
      throw new UnauthorizedException("E-mail ou senha incorretos.");
    }

    if (!user.emailVerifiedAt) {
      // Senha certa, mas o cadastro nao foi confirmado: manda (ou reaproveita) o codigo
      this.track("auth.login.failed", user, { failure: true, data: { reason: "email_not_verified" } });
      await this.sendCode(user, "register");
      throw new ForbiddenException({
        message: "Confirme o seu cadastro com o código que enviamos para o seu e-mail.",
        error: "EMAIL_NOT_VERIFIED",
      });
    }

    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
    }

    if (dto.sessionId) {
      await this.cart.mergeSessionCartIntoUser(dto.sessionId, user.id);
    }

    this.track("auth.login.success", user, { asUser: true });
    return this.buildSession(user);
  }

  /** Revoga todas as sessoes do usuario (logout em todos os dispositivos). */
  async revokeAllSessions(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
    this.track("auth.sessions.revoked", { id: userId });
    return { revoked: true };
  }

  /** Passo 1 da troca de senha: confere a senha atual e envia o codigo por e-mail. */
  async requestPasswordChangeCode(userId: string, currentPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      this.track("auth.password.change_failed", user, { failure: true, data: { reason: "wrong_current_password" } });
      throw new BadRequestException("A senha atual não confere.");
    }
    this.track("auth.password.change_requested", user);
    await this.sendCode(user, "password-change", { force: true });
    return { sent: true, email: maskEmail(user.email) };
  }

  /** Passo 2: senha atual + senha nova + codigo do e-mail. */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      this.track("auth.password.change_failed", user, { failure: true, data: { reason: "wrong_current_password" } });
      throw new BadRequestException("A senha atual não confere.");
    }
    await this.consumeCode(user.id, "password-change", dto.code);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_COST),
        tokenVersion: { increment: 1 },
      },
    });
    void this.mail.sendPasswordChanged(user.email, user.name);
    this.track("auth.password.changed", user, { data: { otherSessionsRevoked: true } });
    // Novo token para a sessao atual continuar ativa
    return this.buildSession(updated);
  }

  /**
   * Passo 1 da troca de e-mail: confere a senha atual e manda o codigo para o
   * endereco NOVO (prova que a pessoa e dona dele). Nada muda ate a confirmacao.
   */
  async requestEmailChangeCode(userId: string, newEmailInput: string, currentPassword: string) {
    const newEmail = newEmailInput.toLowerCase().trim();
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      this.track("auth.email.change_failed", user, { failure: true, data: { reason: "wrong_current_password" } });
      throw new BadRequestException("A senha atual não confere.");
    }
    if (newEmail === user.email) {
      throw new BadRequestException("Esse já é o e-mail da sua conta.");
    }
    if (await this.prisma.user.findUnique({ where: { email: newEmail } })) {
      throw new ConflictException("Esse e-mail já está em uso por outra conta.");
    }
    this.track("auth.email.change_requested", user, { data: { newEmail } });
    await this.sendCode(user, "email-change", { force: true, to: newEmail, newEmail });
    return { sent: true, email: maskEmail(newEmail) };
  }

  /** Passo 2: codigo recebido no endereco novo. Encerra as outras sessoes. */
  async changeEmail(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const record = await this.consumeCode(user.id, "email-change", code);
    const newEmail = record.newEmail;
    if (!newEmail) throw new BadRequestException(INVALID_CODE);
    // O endereco pode ter sido cadastrado por outra conta enquanto o codigo estava pendente
    if (await this.prisma.user.findUnique({ where: { email: newEmail } })) {
      throw new ConflictException("Esse e-mail já está em uso por outra conta.");
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { email: newEmail, emailVerifiedAt: new Date(), tokenVersion: { increment: 1 } },
    });
    void this.mail.sendEmailChanged(user.email, user.name, newEmail);
    this.track("auth.email.changed", user, {
      data: { previousEmail: user.email, newEmail, otherSessionsRevoked: true },
    });
    // Novo token para a sessao atual continuar ativa
    return this.buildSession(updated);
  }

  // ---------------------------------------------------------------- codigos por e-mail

  /** Reenvio pedido pela area da conta (sessoes abertas antes da confirmacao obrigatoria). */
  async sendEmailVerification(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.emailVerifiedAt) return { sent: false, alreadyVerified: true };
    await this.sendCode(user, "register", { force: true });
    return { sent: true };
  }

  /** Links antigos de confirmacao (enviados antes do codigo) continuam valendo. */
  async verifyEmail(token: string) {
    const record = await this.consumeLegacyToken(token, AuthTokenType.EMAIL_VERIFICATION);
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    });
    this.track("auth.email.verified", { id: record.userId }, { data: { method: "legacy_link" } });
    return { verified: true };
  }

  /** Sempre responde igual, exista ou nao a conta (evita enumeracao de e-mails). */
  async forgotPassword(emailInput: string) {
    const email = emailInput.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const known = Boolean(user && !user.deletedAt);
    this.track("auth.password.reset_requested", known ? user : null, {
      data: { knownAccount: known, identifierHash: hashIdentifier(email) },
    });
    if (user && known) {
      await this.sendCode(user, "password-reset", { force: true });
    }
    return {
      message: "Se existir uma conta com esse e-mail, enviamos um código para redefinir a senha.",
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    let userId: string;
    if (dto.email && dto.code) {
      const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase().trim() } });
      if (!user || user.deletedAt) throw new BadRequestException(INVALID_CODE);
      await this.consumeCode(user.id, "password-reset", dto.code);
      userId = user.id;
    } else if (dto.token) {
      userId = (await this.consumeLegacyToken(dto.token, AuthTokenType.PASSWORD_RESET)).userId;
    } else {
      throw new BadRequestException("Informe o e-mail e o código recebido.");
    }

    const current = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_COST),
        tokenVersion: { increment: 1 },
        failedLoginCount: 0,
        lockedUntil: null,
        // Quem recebeu o codigo no e-mail provou ser dono dele
        emailVerifiedAt: current.emailVerifiedAt ?? new Date(),
      },
    });
    void this.mail.sendPasswordChanged(user.email, user.name);
    this.track("auth.password.reset", user, {
      data: { method: dto.token && !dto.code ? "legacy_link" : "email_code", otherSessionsRevoked: true },
    });
    return { reset: true };
  }

  /**
   * Gera e envia um codigo de 6 digitos. Sem force, nao reenvia se outro
   * codigo foi enviado ha menos de 1 minuto (ex.: varias tentativas de login).
   */
  private async sendCode(
    user: { id: string; email: string; name: string },
    purpose: CodePurpose,
    options: { force?: boolean; to?: string; newEmail?: string } = {},
  ) {
    const type = CODE_TYPE[purpose];
    if (!options.force) {
      const recent = await this.prisma.authToken.findFirst({
        where: { userId: user.id, type, usedAt: null, createdAt: { gt: new Date(Date.now() - CODE_RESEND_MS) } },
      });
      if (recent) return;
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await this.prisma.authToken.deleteMany({ where: { userId: user.id, type, usedAt: null } });
    await this.prisma.authToken.create({
      data: {
        userId: user.id,
        type,
        tokenHash: this.codeHash(user.id, type, code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
        newEmail: options.newEmail,
      },
    });
    await this.mail.sendVerificationCode(options.to ?? user.email, user.name, code, purpose);
    this.track("auth.code.sent", { id: user.id }, { data: { purpose } });
  }

  /** Confere o codigo mais recente da conta; erro conta tentativa e invalida no limite. */
  private async consumeCode(userId: string, purpose: CodePurpose, code: string) {
    const type = CODE_TYPE[purpose];
    const record = await this.prisma.authToken.findFirst({
      where: { userId, type, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!record || record.attempts >= CODE_MAX_ATTEMPTS) throw new BadRequestException(INVALID_CODE);

    const expected = Buffer.from(record.tokenHash, "hex");
    const received = Buffer.from(this.codeHash(userId, type, code), "hex");
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      const attempts = record.attempts + 1;
      await this.prisma.authToken.update({ where: { id: record.id }, data: { attempts } });
      this.track(attempts >= CODE_MAX_ATTEMPTS ? "auth.code.locked" : "auth.code.failed", { id: userId }, {
        failure: true,
        data: { purpose, attempts, maxAttempts: CODE_MAX_ATTEMPTS },
      });
      if (attempts >= CODE_MAX_ATTEMPTS) {
        throw new BadRequestException("Muitas tentativas erradas. Peça um novo código.");
      }
      throw new BadRequestException(INVALID_CODE);
    }

    // updateMany com usedAt null evita usar o mesmo codigo duas vezes em paralelo
    const used = await this.prisma.authToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (used.count === 0) throw new BadRequestException(INVALID_CODE);
    return record;
  }

  /** Hash por conta e finalidade: o mesmo codigo em contas diferentes nao colide no indice unico. */
  private codeHash(userId: string, type: AuthTokenType, code: string) {
    return sha256(`code:${type}:${userId}:${code}`);
  }

  private async consumeLegacyToken(token: string, type: AuthTokenType) {
    const record = await this.prisma.authToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException("Link inválido ou expirado. Peça um novo.");
    }
    await this.prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    return record;
  }

  // ---------------------------------------------------------------- perfil

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        document: true,
        role: true,
        humorLevel: true,
        createdAt: true,
        emailVerifiedAt: true,
        marketingOptIn: true,
        termsVersion: true,
        privacyVersion: true,
        addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
        _count: { select: { orders: true, discoveries: true } },
      },
    });

    return {
      ...user,
      stats: {
        orders: user._count.orders,
        easterEggsFound: user._count.discoveries,
      },
      _count: undefined,
    };
  }

  /** Sessao com o perfil completo. O token vai num cookie httpOnly (o controller grava). */
  private async buildSession(user: { id: string; email: string; tokenVersion: number }) {
    const accessToken = this.jwt.sign({ sub: user.id, email: user.email, tv: user.tokenVersion });
    return { accessToken, user: await this.me(user.id) };
  }
}
