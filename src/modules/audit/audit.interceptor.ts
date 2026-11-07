import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuditCategory, AuditOutcome, Role } from "@prisma/client";
import { Observable, catchError, tap, throwError } from "rxjs";
import { ROLES_KEY } from "../../common/decorators/current-user.decorator";
import { AuditService } from "./audit.service";

/**
 * Toda chamada a rota @Roles(ADMIN) vira um registro ADMIN (quem, o que,
 * quando, resultado), com o corpo mascarado. Leituras (GET) tambem entram,
 * porque acesso a dado pessoal e tratamento.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!roles?.includes(Role.ADMIN)) return next.handle();

    const req = context.switchToHttp().getRequest();
    const action = `admin.${context.getClass().name.replace(/Controller$/, "")}.${context.getHandler().name}`;
    const targetId = (req.params?.id ?? req.params?.number ?? req.params?.protocol ?? null) as string | null;

    const write = (statusCode: number) =>
      this.audit.record({
        category: AuditCategory.ADMIN,
        action,
        outcome: statusCode >= 400 ? AuditOutcome.FAILURE : AuditOutcome.SUCCESS,
        target: targetId ? { type: "route", id: targetId } : undefined,
        data: req.body && Object.keys(req.body).length ? { body: req.body } : undefined,
        statusCode,
      });

    return next.handle().pipe(
      tap(() => write(context.switchToHttp().getResponse().statusCode ?? 200)),
      catchError((error) => {
        write(error instanceof HttpException ? error.getStatus() : 500);
        return throwError(() => error);
      }),
    );
  }
}
