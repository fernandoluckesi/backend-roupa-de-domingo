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
import { AuthTokenType } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import { PrismaService } from "../../prisma/prisma.service";
import { CartService } from "../cart/cart.service";
import { MailService } from "../mail/mail.service";
import { ConsentService } from "../privacy/consent.service";
import { randomToken, sha256 } from "../../common/utils/crypto.util";
import { maskEmail } from "../../common/utils/privacy.util";
import {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from "./dto/auth.dto";

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

const EMAIL_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const BCRYPT_COST = 12;

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
  ) {}

  async register(dto: RegisterDto, meta: RequestMeta = {}) {
    const email = dto.email.toLowerCase().trim();

    const exists = await this.prisma.user.findUnique({ where: { email } });
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

    if (dto.sessionId) {
      await this.cart.mergeSessionCartIntoUser(dto.sessionId, user.id);
    }

    await this.sendEmailVerification(user.id);
    return this.buildSession(user);
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const maxFailed = this.config.get<number>("security.maxFailedLogins", 5);
    const lockMinutes = this.config.get<number>("security.lockMinutes", 15);

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
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
        }
      }
      throw new UnauthorizedException("E-mail ou senha incorretos.");
    }

    if (user.twoFactorEnabled) {
      if (!dto.otp) {
        throw new UnauthorizedException({
          message: "Digite o código do seu aplicativo autenticador.",
          error: "OTP_REQUIRED",
        });
      }
      if (!user.twoFactorSecret || !authenticator.check(dto.otp, user.twoFactorSecret)) {
        throw new UnauthorizedException({ message: "Código de verificação inválido.", error: "OTP_INVALID" });
      }
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

    return this.buildSession(user);
  }

  /** Revoga todas as sessoes do usuario (logout em todos os dispositivos). */
  async revokeAllSessions(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
    return { revoked: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException("A senha atual não confere.");
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_COST),
        tokenVersion: { increment: 1 },
      },
    });
    void this.mail.sendPasswordChanged(user.email, user.name);
    // Novo token para a sessao atual continuar ativa
    return this.buildSession(updated);
  }

  // ---------------------------------------------------------------- e-mail

  async sendEmailVerification(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.emailVerifiedAt) return { sent: false, alreadyVerified: true };

    const { token, hash } = randomToken();
    await this.prisma.authToken.deleteMany({
      where: { userId, type: AuthTokenType.EMAIL_VERIFICATION, usedAt: null },
    });
    await this.prisma.authToken.create({
      data: {
        userId,
        type: AuthTokenType.EMAIL_VERIFICATION,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
      },
    });
    await this.mail.sendEmailVerification(user.email, user.name, token);
    return { sent: true };
  }

  async verifyEmail(token: string) {
    const record = await this.consumeToken(token, AuthTokenType.EMAIL_VERIFICATION);
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    });
    return { verified: true };
  }

  /** Sempre responde igual, exista ou nao a conta (evita enumeracao de e-mails). */
  async forgotPassword(emailInput: string) {
    const email = emailInput.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.deletedAt) {
      const { token, hash } = randomToken();
      await this.prisma.authToken.deleteMany({
        where: { userId: user.id, type: AuthTokenType.PASSWORD_RESET, usedAt: null },
      });
      await this.prisma.authToken.create({
        data: {
          userId: user.id,
          type: AuthTokenType.PASSWORD_RESET,
          tokenHash: hash,
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });
      await this.mail.sendPasswordReset(user.email, user.name, token);
    }
    return {
      message: "Se existir uma conta com esse e-mail, enviamos um link para redefinir a senha.",
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const record = await this.consumeToken(dto.token, AuthTokenType.PASSWORD_RESET);
    const current = await this.prisma.user.findUniqueOrThrow({ where: { id: record.userId } });
    const user = await this.prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_COST),
        tokenVersion: { increment: 1 },
        failedLoginCount: 0,
        lockedUntil: null,
        // Quem recebeu o link no e-mail provou ser dono dele
        emailVerifiedAt: current.emailVerifiedAt ?? new Date(),
      },
    });
    void this.mail.sendPasswordChanged(user.email, user.name);
    return { reset: true };
  }

  private async consumeToken(token: string, type: AuthTokenType) {
    const record = await this.prisma.authToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException("Link inválido ou expirado. Peça um novo.");
    }
    await this.prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    return record;
  }

  // ---------------------------------------------------------------- 2FA (TOTP)

  async setupTwoFactor(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.twoFactorEnabled) {
      throw new ConflictException("O 2FA já está ativo. Desative antes de gerar um novo segredo.");
    }
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });
    return {
      secret,
      otpauthUrl: authenticator.keyuri(user.email, "Roupa de Domingo", secret),
    };
  }

  async enableTwoFactor(userId: string, otp: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorSecret || !authenticator.check(otp, user.twoFactorSecret)) {
      throw new BadRequestException("Código inválido. Confira o horário do celular e tente de novo.");
    }
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
    return { enabled: true };
  }

  async disableTwoFactor(userId: string, otp: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorEnabled || !user.twoFactorSecret || !authenticator.check(otp, user.twoFactorSecret)) {
      throw new ForbiddenException("Código inválido.");
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null, tokenVersion: { increment: 1 } },
    });
    return { enabled: false };
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
        twoFactorEnabled: true,
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
