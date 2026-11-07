import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/current-user.decorator";
import { AuditService } from "./audit.service";
import { QueryAuditLogsDto } from "./dto/query-audit-logs.dto";

/** Consulta da trilha (a propria consulta tambem fica auditada pelo AuditInterceptor). */
@ApiTags("admin")
@ApiBearerAuth()
@Controller("admin/audit-logs")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: "Lista a trilha de auditoria com filtros (categoria, acao, quem, alvo, periodo)" })
  list(@Query() query: QueryAuditLogsDto) {
    return this.audit.list(query);
  }
}
