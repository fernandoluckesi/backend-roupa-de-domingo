import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { Role } from "@prisma/client";
import { ROLES_KEY } from "../decorators/current-user.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException(
        "Area restrita. Nem todo mundo precisa ver como a salsicha e feita.",
      );
    }
    // Painel admin exige 2FA ativo (POST /auth/2fa/setup + /auth/2fa/enable)
    if (
      required.includes(Role.ADMIN) &&
      this.config.get<boolean>("security.adminTwoFactorRequired", true) &&
      !user.twoFactorEnabled
    ) {
      throw new ForbiddenException(
        "Ative a verificacao em duas etapas (2FA) para acessar a area administrativa.",
      );
    }
    return true;
  }
}
