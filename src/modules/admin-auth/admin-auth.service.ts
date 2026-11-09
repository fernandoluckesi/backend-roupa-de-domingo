import { HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AdminUser, AuditActorType, AuditCategory, AuditOutcome } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomInt, timingSafeEqual } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { MailService } from "../mail/mail.service";
import { hashIdentifier, sha256 } from "../../common/utils/crypto.util";
import { maskEmail } from "../../common/utils/privacy.util";
import type { AdminLoginDto } from "./dto/admin-auth.dto";

const CODE_TTL_MS = 15 * 60 * 1000;
/** Tentativas erradas antes de invalidar o codigo */
const CODE_MAX_ATTEMPTS = 5;
/** Intervalo minimo entre dois envios automaticos de codigo */
const CODE_RESEND_MS = 60 * 1000;
const INVALID_CODE = "Código incorreto ou expirado. Confira o e-mail ou peça um novo código.";

export interface AdminSession {
  accessToken: string;
  admin: { id: string; email: string; name: string };
}

/**
 * Login do backoffice (tabela admin_users, separada dos clientes):
 * e-mail + senha e, em seguida, codigo de 6 digitos enviado por e-mail.
 */
@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  private track(action: string, admin: { id: string; email: string } | null, failure = false, data?: Record<string, unknown>) {
    this.audit.record({
      category: AuditCategory.AUTH,
      action,
      outcome: failure ? AuditOutcome.FAILURE : AuditOutcome.SUCCESS,
      actor: admin ? { type: AuditActorType.ADMIN, id: admin.id, email: admin.email } : undefined,
      target: admin ? { type: "admin_user", id: admin.id } : undefined,
      data,
    });
  }

  private get codeRequired(): boolean {
    return this.config.get<boolean>("security.adminLoginCodeRequired", true);
  }

  async login(dto: AdminLoginDto): Promise<AdminSession> {
    const email = dto.email.toLowerCase().trim();
    const admin = await this.prisma.adminUser.findUnique({ where: { email } });
    const maxFailed = this.config.get<number>("security.maxFailedLogins", 5);
    const lockMinutes = this.config.get<number>("security.lockMinutes", 15);

    if (admin?.lockedUntil && admin.lockedUntil > new Date()) {
      this.track("admin.login.failed", admin, true, { reason: "account_locked" });
      throw new HttpException(
        `Muitas tentativas. O acesso foi bloqueado por ${lockMinutes} minutos por segurança.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const valid = admin && admin.isActive && (await bcrypt.compare(dto.password, admin.passwordHash));
    if (!valid || !admin) {
      if (admin) {
        const failed = admin.failedLoginCount + 1;
        const lock = failed >= maxFailed;
        await this.prisma.adminUser.update({
          where: { id: admin.id },
          data: {
            failedLoginCount: lock ? 0 : failed,
            lockedUntil: lock ? new Date(Date.now() + lockMinutes * 60_000) : null,
          },
        });
        if (lock) this.track("admin.account.locked", admin, true, { failedAttempts: maxFailed, lockMinutes });
      }
      this.track("admin.login.failed", admin ?? null, true, {
        reason: admin && !admin.isActive ? "inactive" : "invalid_credentials",
        knownAccount: Boolean(admin),
        identifierHash: hashIdentifier(email),
      });
      throw new UnauthorizedException({ message: "E-mail ou senha incorretos.", error: "INVALID_CREDENTIALS" });
    }

    if (this.codeRequired) {
      if (!dto.code) {
        await this.sendCode(admin, dto.resendCode === true);
        const consoleOnly =
          this.config.get<string>("mail.driver") !== "smtp" && this.config.get<string>("nodeEnv") !== "production";
        throw new UnauthorizedException({
          message:
            `Enviamos um código de 6 dígitos para ${maskEmail(admin.email)}. Ele vale por 15 minutos.` +
            (consoleOnly ? " (Ambiente local sem SMTP: o código aparece no terminal da API, não no e-mail.)" : ""),
          error: "LOGIN_CODE_REQUIRED",
        });
      }
      await this.consumeCode(admin, dto.code);
    }

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    this.track("admin.login.success", admin, false, { loginCode: this.codeRequired });
    return this.buildSession(admin);
  }

  async me(adminId: string) {
    return this.prisma.adminUser.findUniqueOrThrow({
      where: { id: adminId },
      select: { id: true, email: true, name: true, lastLoginAt: true },
    });
  }

  /** Sai de todos os dispositivos (revoga todas as sessoes do admin). */
  async revokeAllSessions(adminId: string) {
    await this.prisma.adminUser.update({ where: { id: adminId }, data: { tokenVersion: { increment: 1 } } });
  }

  private buildSession(admin: AdminUser): AdminSession {
    const accessToken = this.jwt.sign({ sub: admin.id, typ: "admin", tv: admin.tokenVersion });
    return { accessToken, admin: { id: admin.id, email: admin.email, name: admin.name } };
  }

  private codeHash(adminId: string, code: string) {
    return sha256(`admin-login:${adminId}:${code}`);
  }

  private async sendCode(admin: AdminUser, force: boolean) {
    if (!force) {
      const recent = await this.prisma.adminLoginCode.findFirst({
        where: { adminUserId: admin.id, usedAt: null, createdAt: { gt: new Date(Date.now() - CODE_RESEND_MS) } },
      });
      if (recent) return;
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await this.prisma.adminLoginCode.deleteMany({ where: { adminUserId: admin.id, usedAt: null } });
    await this.prisma.adminLoginCode.create({
      data: { adminUserId: admin.id, codeHash: this.codeHash(admin.id, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) },
    });
    await this.mail.sendVerificationCode(admin.email, admin.name, code, "login");
    this.track("admin.login.code_sent", admin);
  }

  private async consumeCode(admin: AdminUser, code: string) {
    const fail = (message: string) => {
      this.track("admin.login.failed", admin, true, { reason: "login_code_invalid" });
      return new UnauthorizedException({ message, error: "LOGIN_CODE_INVALID" });
    };
    const record = await this.prisma.adminLoginCode.findFirst({
      where: { adminUserId: admin.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!record || record.attempts >= CODE_MAX_ATTEMPTS) throw fail(INVALID_CODE);

    const expected = Buffer.from(record.codeHash, "hex");
    const received = Buffer.from(this.codeHash(admin.id, code), "hex");
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      const attempts = record.attempts + 1;
      await this.prisma.adminLoginCode.update({ where: { id: record.id }, data: { attempts } });
      throw fail(attempts >= CODE_MAX_ATTEMPTS ? "Muitas tentativas erradas. Peça um novo código." : INVALID_CODE);
    }
    // updateMany com usedAt null evita usar o mesmo codigo duas vezes em paralelo
    const used = await this.prisma.adminLoginCode.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (used.count === 0) throw fail(INVALID_CODE);
    this.logger.log(`Login de admin confirmado com codigo (${maskEmail(admin.email)}).`);
  }
}
