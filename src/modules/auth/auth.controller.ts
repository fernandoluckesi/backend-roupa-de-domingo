import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { CookieOptions, Request, Response } from "express";
import { AuthService } from "./auth.service";
import {
  ChangePasswordDto,
  ConfirmRegistrationDto,
  EmailChangeCodeDto,
  EmailChangeDto,
  EmailDto,
  LoginDto,
  OtpDto,
  PasswordCodeDto,
  RegisterDto,
  ResetPasswordDto,
  TokenDto,
} from "./dto/auth.dto";
import { JwtAuthGuard, OptionalJwtGuard } from "../../common/guards/jwt-auth.guard";
import { AuditCategory } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  /** Sessao em cookie httpOnly + SameSite=Lax: o JavaScript da pagina nunca ve o token (mitiga XSS). */
  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get<boolean>("security.cookieSecure", false),
      sameSite: "lax",
      path: "/",
      maxAge: SEVEN_DAYS_MS,
    };
  }

  private setSession(res: Response, session: { accessToken: string; user: unknown }) {
    res.cookie(this.config.get<string>("security.sessionCookie", "rd_session"), session.accessToken, this.cookieOptions());
    // O token tambem volta no corpo para clientes de API (Swagger, admin via Bearer); o site ignora
    return session;
  }

  @Post("register")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Cria a conta (com aceite dos termos) e envia o codigo de confirmacao por e-mail" })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, { ip: req.ip, userAgent: req.headers["user-agent"] });
  }

  @Post("register/confirm")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @ApiOperation({ summary: "Confirma o cadastro com o codigo de 6 digitos e abre a sessao" })
  async confirmRegistration(@Body() dto: ConfirmRegistrationDto, @Res({ passthrough: true }) res: Response) {
    return this.setSession(res, await this.auth.confirmRegistration(dto));
  }

  @Post("register/resend")
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  @ApiOperation({ summary: "Reenvia o codigo de confirmacao do cadastro" })
  resendRegistrationCode(@Body() dto: EmailDto) {
    return this.auth.resendRegistrationCode(dto.email);
  }

  @Post("login")
  @HttpCode(200)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @ApiOperation({ summary: "Autentica e abre sessao (cookie httpOnly)" })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.setSession(res, await this.auth.login(dto));
  }

  @Post("logout")
  @HttpCode(200)
  @UseGuards(OptionalJwtGuard)
  @ApiOperation({ summary: "Encerra a sessao deste navegador" })
  logout(@Res({ passthrough: true }) res: Response, @CurrentUser("id") userId?: string) {
    if (userId) this.audit.record({ category: AuditCategory.AUTH, action: "auth.logout", target: { type: "user", id: userId } });
    const { maxAge: _maxAge, ...options } = this.cookieOptions();
    res.clearCookie(this.config.get<string>("security.sessionCookie", "rd_session"), options);
    return { loggedOut: true };
  }

  @Post("logout-all")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Revoga todas as sessoes, em todos os dispositivos" })
  async logoutAll(@CurrentUser("id") userId: string, @Res({ passthrough: true }) res: Response) {
    await this.auth.revokeAllSessions(userId);
    return this.logout(res);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Dados do usuario autenticado" })
  me(@CurrentUser("id") userId: string) {
    return this.auth.me(userId);
  }

  @Post("password/code")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: "Confere a senha atual e envia o codigo para trocar a senha" })
  requestPasswordChangeCode(@CurrentUser("id") userId: string, @Body() dto: PasswordCodeDto) {
    return this.auth.requestPasswordChangeCode(userId, dto.currentPassword);
  }

  @Post("password")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: "Troca a senha com o codigo do e-mail (revoga as outras sessoes)" })
  async changePassword(
    @CurrentUser("id") userId: string,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.setSession(res, await this.auth.changePassword(userId, dto));
  }

  @Post("email/verification")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: "Reenvia o codigo de confirmacao do e-mail" })
  resendVerification(@CurrentUser("id") userId: string) {
    return this.auth.sendEmailVerification(userId);
  }

  @Post("email/change/code")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: "Confere a senha atual e envia o codigo para o e-mail novo" })
  requestEmailChangeCode(@CurrentUser("id") userId: string, @Body() dto: EmailChangeCodeDto) {
    return this.auth.requestEmailChangeCode(userId, dto.newEmail, dto.currentPassword);
  }

  @Post("email/change")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: "Troca o e-mail com o codigo recebido no endereco novo (revoga as outras sessoes)" })
  async changeEmail(
    @CurrentUser("id") userId: string,
    @Body() dto: EmailChangeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.setSession(res, await this.auth.changeEmail(userId, dto.code));
  }

  @Post("email/verify")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @ApiOperation({ summary: "Confirma o e-mail com o token dos links antigos" })
  verifyEmail(@Body() dto: TokenDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Post("password/forgot")
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  @ApiOperation({ summary: "Envia o codigo de redefinicao de senha" })
  forgotPassword(@Body() dto: EmailDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Post("password/reset")
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @ApiOperation({ summary: "Redefine a senha com e-mail + codigo (ou token dos links antigos)" })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Post("2fa/setup")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Gera o segredo TOTP (mostre o otpauthUrl como QR code)" })
  setupTwoFactor(@CurrentUser("id") userId: string) {
    return this.auth.setupTwoFactor(userId);
  }

  @Post("2fa/enable")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: "Ativa o 2FA confirmando um codigo" })
  enableTwoFactor(@CurrentUser("id") userId: string, @Body() dto: OtpDto) {
    return this.auth.enableTwoFactor(userId, dto.otp);
  }

  @Post("2fa/disable")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: "Desativa o 2FA (exige um codigo valido)" })
  disableTwoFactor(@CurrentUser("id") userId: string, @Body() dto: OtpDto) {
    return this.auth.disableTwoFactor(userId, dto.otp);
  }
}
