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
    // Area admin exige sessao aberta com o codigo de login enviado por e-mail
    if (
      required.includes(Role.ADMIN) &&
      this.config.get<boolean>("security.adminLoginCodeRequired", true) &&
      !user.loginCodeVerified
    ) {
      throw new ForbiddenException({
        message: "Entre de novo pelo backoffice para confirmar o código enviado ao seu e-mail.",
        error: "LOGIN_CODE_REQUIRED",
      });
    }
    return true;
  }
}
