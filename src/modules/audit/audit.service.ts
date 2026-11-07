import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuditActorType, AuditCategory, AuditOutcome, Prisma, Role } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { currentRequestContext } from "../../common/request-context";
import { hashIdentifier } from "../../common/utils/crypto.util";
import { redact } from "../../common/utils/privacy.util";
import type { QueryAuditLogsDto } from "./dto/query-audit-logs.dto";

export interface AuditEvent {
  category: AuditCategory;
  /** dominio.acao, ex.: auth.login.failed, order.created, payment.status_changed */
  action: string;
  outcome?: AuditOutcome;
  /** Sem actor, vem do usuario autenticado da requisicao (ou ANONYMOUS / SYSTEM) */
  actor?: { type: AuditActorType; id?: string | null; email?: string | null };
  target?: { type: string; id?: string | null };
  /** Detalhes do evento; passam por redact() antes de gravar */
  data?: Record<string, unknown>;
  statusCode?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Marco Civil da Internet, art. 15: registros de acesso a aplicacao por no minimo 6 meses */
const MIN_RETENTION_DAYS = 183;

/**
 * Grava a trilha de auditoria. Nunca lanca erro nem atrasa a operacao
 * principal: a gravacao e assincrona e falhas so viram log.
 */
@Injectable()
export class AuditService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditService.name);
  private purgeTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Dispara e esquece: use nos fluxos de negocio. */
  record(event: AuditEvent): void {
    void this.write(event);
  }

  async write(event: AuditEvent): Promise<void> {
    try {
      const ctx = currentRequestContext();
      const req = ctx?.req as (Record<string, any> & { user?: { id: string; email: string; role: Role } }) | undefined;
      const actor = event.actor ?? this.actorFromRequest(req);
      const userAgent = req?.headers?.["user-agent"];

      await this.prisma.auditLog.create({
        data: {
          category: event.category,
          action: event.action,
          outcome: event.outcome ?? AuditOutcome.SUCCESS,
          actorType: actor.type,
          actorId: actor.id ?? null,
          // E-mail so de quem e da equipe; cliente fica pseudonimizado pelo id
          actorEmail: actor.type === AuditActorType.ADMIN ? actor.email ?? null : null,
          targetType: event.target?.type ?? null,
          targetId: event.target?.id ?? null,
          method: req?.method ?? null,
          path: req ? String(req.originalUrl ?? req.url ?? "").split("?")[0].slice(0, 300) : null,
          statusCode: event.statusCode ?? null,
          payload: event.data && Object.keys(event.data).length ? (redact(event.data) as Prisma.InputJsonValue) : undefined,
          ipHash: hashIdentifier(req?.ip),
          userAgent: typeof userAgent === "string" ? userAgent.slice(0, 200) : null,
          requestId: ctx?.requestId ?? null,
        },
      });
    } catch (error) {
      this.logger.error(`Falha ao gravar auditoria ${event.action}: ${(error as Error).message}`);
    }
  }

  private actorFromRequest(req?: {
    user?: { id: string; email: string; role: Role };
    originalUrl?: string;
    url?: string;
  }): NonNullable<AuditEvent["actor"]> {
    if (!req) return { type: AuditActorType.SYSTEM };
    const user = req.user;
    if (!user) {
      // Sem login numa rota de webhook = chamada de parceiro (pagamento, estamparia)
      const path = String(req.originalUrl ?? req.url ?? "").split("?")[0];
      return /\/webhooks?(\/|$)/.test(path) ? { type: AuditActorType.PROVIDER } : { type: AuditActorType.ANONYMOUS };
    }
    return user.role === Role.ADMIN
      ? { type: AuditActorType.ADMIN, id: user.id, email: user.email }
      : { type: AuditActorType.CUSTOMER, id: user.id };
  }

  // ---------------------------------------------------------------- consulta (admin)

  async list(query: QueryAuditLogsDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 50, 200);
    const where: Prisma.AuditLogWhereInput = {
      category: query.category,
      outcome: query.outcome,
      actorType: query.actorType,
      actorId: query.actorId,
      targetType: query.targetType,
      targetId: query.targetId,
      requestId: query.requestId,
      action: query.action ? { startsWith: query.action } : undefined,
      createdAt: query.from || query.to ? { gte: query.from, lte: query.to } : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  // ---------------------------------------------------------------- retencao

  get retentionDays(): number {
    const configured = this.config.get<number>("security.auditRetentionDays", 1825);
    return Math.max(Number.isFinite(configured) ? configured : 1825, MIN_RETENTION_DAYS);
  }

  /** Apaga o que passou do prazo de retencao (LGPD: nao guardar alem do necessario). */
  async purgeExpired(): Promise<number> {
    const cutoff = new Date(Date.now() - this.retentionDays * DAY_MS);
    const { count } = await this.prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    if (count > 0) {
      this.logger.log(`Retencao: ${count} registro(s) de auditoria anteriores a ${cutoff.toISOString()} apagados.`);
      await this.write({
        category: AuditCategory.SYSTEM,
        action: "audit.retention.purged",
        actor: { type: AuditActorType.SYSTEM },
        data: { deleted: count, before: cutoff.toISOString(), retentionDays: this.retentionDays },
      });
    }
    return count;
  }

  onModuleInit() {
    if (process.env.NODE_ENV === "test") return;
    const run = () => this.purgeExpired().catch((e: Error) => this.logger.error(`Retencao falhou: ${e.message}`));
    // Primeira limpeza 1 min depois de subir; depois, uma vez por dia
    this.purgeTimer = setTimeout(() => {
      void run();
      this.purgeTimer = setInterval(run, DAY_MS);
      this.purgeTimer.unref();
    }, 60_000);
    this.purgeTimer.unref();
  }

  onModuleDestroy() {
    if (this.purgeTimer) clearTimeout(this.purgeTimer);
  }
}
