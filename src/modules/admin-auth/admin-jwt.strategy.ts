import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Role } from "@prisma/client";
import type { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../../common/decorators/current-user.decorator";

interface AdminJwtPayload {
  sub: string;
  typ?: string;
  tv?: number;
}

export const ADMIN_JWT_STRATEGY = "admin-jwt";

/** Sessao do backoffice: cookie proprio (rd_admin_session) ou Bearer, sempre com typ "admin". */
@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, ADMIN_JWT_STRATEGY) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const cookieName = config.get<string>("security.adminSessionCookie", "rd_admin_session");
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => (req?.cookies?.[cookieName] as string | undefined) ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("jwt.secret") ?? "domingo-dev-secret",
    });
  }

  async validate(payload: AdminJwtPayload): Promise<AuthUser> {
    if (payload.typ !== "admin") throw new UnauthorizedException("Sessão do backoffice inválida.");
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, isActive: true, tokenVersion: true },
    });
    if (!admin || !admin.isActive || (payload.tv ?? 0) !== admin.tokenVersion) {
      throw new UnauthorizedException("Sessão do backoffice inválida. Entre de novo.");
    }
    // role ADMIN: a trilha de auditoria grava o admin (id + e-mail) como autor
    return { id: admin.id, email: admin.email, name: admin.name, role: Role.ADMIN, isAdmin: true };
  }
}
