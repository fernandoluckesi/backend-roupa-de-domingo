import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AdminOnly } from "../../common/guards/admin-auth.guard";
import { AuditService } from "./audit.service";
import { QueryAuditLogsDto } from "./dto/query-audit-logs.dto";

/** Consulta da trilha (a propria consulta tambem fica auditada pelo AuditInterceptor). */
@ApiTags("admin")
@ApiBearerAuth()
@Controller("admin/audit-logs")
@AdminOnly()
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: "Lista a trilha de auditoria com filtros (categoria, acao, quem, alvo, periodo)" })
  list(@Query() query: QueryAuditLogsDto) {
    return this.audit.list(query);
  }
}
