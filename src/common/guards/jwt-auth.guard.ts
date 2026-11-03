import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}

/**
 * Autentica se houver token valido, mas nao bloqueia requisicoes anonimas.
 * Usado no carrinho, checkout de convidado e easter eggs.
 */
@Injectable()
export class OptionalJwtGuard extends AuthGuard("jwt") {
  handleRequest(_err: unknown, user: unknown): any {
    return user || undefined;
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context) as any;
  }
}
