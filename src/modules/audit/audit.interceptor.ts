import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "@prisma/client";
import { Observable, catchError, tap, throwError } from "rxjs";
import { PrismaService } from "../../prisma/prisma.service";
import { ROLES_KEY } from "../../common/decorators/current-user.decorator";
import { hashIdentifier } from "../../common/utils/crypto.util";
import { redact } from "../../common/utils/privacy.util";

/**
 * Trilha de auditoria: toda chamada a rota @Roles(ADMIN) vira um AuditLog
 * (quem, o que, quando, resultado), com o corpo mascarado. Leituras de dados
 * pessoais (GET) tambem entram, porque acesso a dado pessoal e tratamento.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!roles?.includes(Role.ADMIN)) return next.handle();

    const req = context.switchToHttp().getRequest();
    const action = `${context.getClass().name}.${context.getHandler().name}`;

    const write = (statusCode: number) => {
      const user = req.user as { id?: string; email?: string } | undefined;
      void this.prisma.auditLog
        .create({
          data: {
            actorId: user?.id ?? null,
            actorEmail: user?.email ?? null,
            action,
            method: req.method,
            path: String(req.originalUrl ?? req.url).slice(0, 300),
            statusCode,
            targetId: (req.params?.id ?? req.params?.number ?? req.params?.protocol ?? null) as string | null,
            payload: req.body && Object.keys(req.body).length ? (redact(req.body) as object) : undefined,
            ipHash: hashIdentifier(req.ip),
          },
        })
        .catch((error: Error) => this.logger.error(`AuditLog falhou: ${error.message}`));
    };

    return next.handle().pipe(
      tap(() => write(context.switchToHttp().getResponse().statusCode ?? 200)),
      catchError((error) => {
        write(error instanceof HttpException ? error.getStatus() : 500);
        return throwError(() => error);
      }),
    );
  }
}
