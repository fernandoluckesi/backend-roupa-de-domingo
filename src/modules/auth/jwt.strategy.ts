import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import type { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthUser } from "../../common/decorators/current-user.decorator";

interface JwtPayload {
  sub: string;
  email: string;
  /** tokenVersion do usuario quando o token foi emitido */
  tv?: number;
  /** Login confirmado com o codigo do e-mail */
  lcv?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const cookieName = config.get<string>("security.sessionCookie", "rd_session");
    super({
      // Site: cookie httpOnly. Clientes de API (Swagger, scripts de admin): Bearer.
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => (req?.cookies?.[cookieName] as string | undefined) ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("jwt.secret") ?? "domingo-dev-secret",
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tokenVersion: true,
        deletedAt: true,
      },
    });

    // Conta excluida ou sessao revogada (troca de senha, "sair de todos os dispositivos")
    if (!user || user.deletedAt || (payload.tv ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException("Sessao invalida. Faca login novamente.");
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      loginCodeVerified: payload.lcv === true,
    };
  }
}
