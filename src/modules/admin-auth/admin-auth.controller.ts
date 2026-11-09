import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { CookieOptions, Response } from "express";
import { AdminAuthGuard } from "../../common/guards/admin-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AdminAuthService } from "./admin-auth.service";
import { AdminLoginDto } from "./dto/admin-auth.dto";

const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;

@ApiTags("admin-auth")
@Controller("admin/auth")
export class AdminAuthController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly config: ConfigService,
  ) {}

  private get cookieName() {
    return this.config.get<string>("security.adminSessionCookie", "rd_admin_session");
  }

  /** Cookie httpOnly proprio do backoffice: nao se mistura com a sessao de cliente da loja. */
  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get<boolean>("security.cookieSecure", false),
      sameSite: "lax",
      path: "/",
      maxAge: ADMIN_SESSION_MS,
    };
  }

  @Post("login")
  @HttpCode(200)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @ApiOperation({ summary: "Login do backoffice: senha e depois o codigo enviado por e-mail" })
  async login(@Body() dto: AdminLoginDto, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.login(dto);
    res.cookie(this.cookieName, session.accessToken, this.cookieOptions());
    return session;
  }

  @Post("logout")
  @HttpCode(200)
  @ApiOperation({ summary: "Encerra a sessao do backoffice neste navegador" })
  logout(@Res({ passthrough: true }) res: Response) {
    const { maxAge: _maxAge, ...options } = this.cookieOptions();
    res.clearCookie(this.cookieName, options);
    return { loggedOut: true };
  }

  @Post("logout-all")
  @HttpCode(200)
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Revoga todas as sessoes deste admin" })
  async logoutAll(@CurrentUser("id") adminId: string, @Res({ passthrough: true }) res: Response) {
    await this.auth.revokeAllSessions(adminId);
    return this.logout(res);
  }

  @Get("me")
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Admin da sessao atual" })
  me(@CurrentUser("id") adminId: string) {
    return this.auth.me(adminId);
  }
}
