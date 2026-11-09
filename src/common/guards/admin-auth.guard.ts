import { applyDecorators, Injectable, SetMetadata, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { ROLES_KEY } from "../decorators/current-user.decorator";

/** Exige sessao do backoffice (tabela admin_users), nunca sessao de cliente. */
@Injectable()
export class AdminAuthGuard extends AuthGuard("admin-jwt") {}

/**
 * Rota do backoffice. A marca ROLES_KEY=[ADMIN] faz o AuditInterceptor
 * registrar toda chamada (inclusive leituras) na trilha de auditoria.
 */
export function AdminOnly() {
  return applyDecorators(SetMetadata(ROLES_KEY, [Role.ADMIN]), UseGuards(AdminAuthGuard), ApiBearerAuth());
}
