import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { DAY_MS, ENGAGED_SQL, parseRange, SOLD_SQL } from "./analytics.shared";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { hashIdentifier } from "../../common/utils/crypto.util";
import { AnalyticsRangeDto, CollectDto } from "./dto/analytics.dto";
import { GeoService } from "./geo.service";
import { classifyVisit, cleanPath, deviceOf, isBot, parseUserAgent, SOCIAL_CHANNELS } from "./channel.util";

/** Janela de atribuicao: a venda conta para a ultima origem nao direta dos ultimos 30 dias. */
const ATTRIBUTION_DAYS = 30;
/** Sessao termina depois de 30 min sem atividade (padrao do Google Analytics). */
export const SESSION_TIMEOUT_MIN = 30;

export interface CollectContext {
  sessionId?: string;
  userAgent?: string;
  ip?: string;
  headers: Record<string, unknown>;
}

/** Termo de busca: minusculo e sem espacos sobrando (agrupa "Feminista " e "feminista"). */
function slugless(value: string | undefined) {
  return value?.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80) || null;
}

export interface Attribution {
  visitId: string;
  attributionChannel: string;
  attributionSource: string;
  attributionCampaign: string | null;
  attributionContent: string | null;
}

interface Row {
  channel: string;
  source?: string;
  campaign?: string | null;
  content?: string | null;
  visits?: number;
  visitors?: number;
  orders?: number;
  sales?: number;
  revenue?: number;
  engaged?: number;
  engagedMs?: number;
}

@Injectable()
export class AnalyticsService {
  private readonly siteHosts: string[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeoService,
    config: ConfigService,
  ) {
    const hosts = new Set(["roupadedomingo.com.br", "localhost", "127.0.0.1"]);
    try {
      hosts.add(new URL(config.get<string>("frontendUrl", "")).hostname.replace(/^www\./, ""));
    } catch {
      /* FRONTEND_URL invalida: fica com os padroes */
    }
    this.siteHosts = [...hosts];
  }

  private visitorHash(sessionId: string | undefined) {
    return hashIdentifier(sessionId ? `visitor:${sessionId}` : `visitor:anon:${randomUUID()}`)!;
  }

  /** Coleta da loja: pagina vista, tempo na pagina ou evento. Robos e pre-visualizacao de link nao contam. */
  async collect(dto: CollectDto, ctx: CollectContext) {
    if (isBot(ctx.userAgent)) return { tracked: false as const };
    const visitorHash = this.visitorHash(ctx.sessionId);
    if (dto.type === "engagement") return this.engagement(dto, visitorHash);
    if (dto.type === "event") return this.event(dto, visitorHash);
    return this.pageView(dto, visitorHash, ctx);
  }

  /** Sessao aberta deste navegador (atividade nos ultimos 30 min), se houver. */
  private activeSession(visitorHash: string) {
    return this.prisma.trafficVisit.findFirst({
      where: { visitorHash, lastSeenAt: { gte: new Date(Date.now() - SESSION_TIMEOUT_MIN * 60_000) } },
      orderBy: { lastSeenAt: "desc" },
    });
  }

  private async pageView(dto: CollectDto, visitorHash: string, ctx: CollectContext) {
    const origin = classifyVisit(dto, this.siteHosts);
    const path = cleanPath(dto.path);
    const active = await this.activeSession(visitorHash);

    // Mesma sessao: dentro de 30 min e sem chegar por outra origem (como no Google Analytics)
    const sameOrigin =
      active &&
      (origin.channel === "direto" ||
        (active.channel === origin.channel &&
          active.source === origin.source &&
          active.campaign === origin.campaign &&
          active.content === origin.content));

    let session = sameOrigin ? active : null;
    if (!session) {
      const returning = await this.prisma.trafficVisit.findFirst({ where: { visitorHash }, select: { id: true } });
      const minimal = dto.minimal === true;
      const geo = minimal ? null : this.geo.locate(ctx.headers, ctx.ip);
      const { os, browser } = parseUserAgent(ctx.userAgent);
      session = await this.prisma.trafficVisit.create({
        data: {
          visitorHash,
          channel: origin.channel,
          source: origin.source,
          medium: origin.medium,
          campaign: origin.campaign,
          content: origin.content,
          landingPath: path,
          referrerHost: origin.referrerHost,
          device: deviceOf(ctx.userAgent),
          os,
          browser,
          screen: minimal ? null : (dto.screen?.match(/^\d{2,5}x\d{2,5}$/)?.[0] ?? null),
          language: minimal ? null : (dto.language?.slice(0, 20) ?? null),
          country: geo?.country ?? null,
          region: geo?.region ?? null,
          city: geo?.city ?? null,
          isNewVisitor: !returning,
          minimal,
        },
      });
    }

    // Quem recusou "Estatisticas" conta so como visita (origem), sem paginas nem tempo
    if (session.minimal || dto.minimal) {
      await this.prisma.trafficVisit.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
      return { tracked: true as const, visitId: session.id, channel: session.channel };
    }

    const [pageView] = await this.prisma.$transaction([
      this.prisma.pageView.create({
        data: { visitId: session.id, path, title: dto.title?.slice(0, 200), seq: session.pageviews + 1 },
        select: { id: true },
      }),
      this.prisma.trafficVisit.update({
        where: { id: session.id },
        data: { pageviews: { increment: 1 }, lastSeenAt: new Date() },
      }),
    ]);
    return { tracked: true as const, visitId: session.id, channel: session.channel, pageviewId: pageView.id };
  }

  private async engagement(dto: CollectDto, visitorHash: string) {
    const ms = Math.min(Math.max(dto.ms ?? 0, 0), 30 * 60_000);
    if (!dto.pageviewId || ms === 0) return { tracked: false as const };
    const pageView = await this.prisma.pageView.findFirst({
      where: { id: dto.pageviewId, visit: { visitorHash } },
      select: { id: true, visitId: true },
    });
    if (!pageView) return { tracked: false as const };
    await this.prisma.$transaction([
      this.prisma.pageView.update({ where: { id: pageView.id }, data: { engagedMs: { increment: ms } } }),
      this.prisma.trafficVisit.update({
        where: { id: pageView.visitId },
        data: { engagedMs: { increment: ms }, lastSeenAt: new Date() },
      }),
    ]);
    return { tracked: true as const };
  }

  private async event(dto: CollectDto, visitorHash: string) {
    if (!dto.name) return { tracked: false as const };
    const session = await this.activeSession(visitorHash);
    if (!session || session.minimal) return { tracked: false as const };
    const label = dto.name === "search" ? slugless(dto.label) : dto.label?.slice(0, 120);
    await this.prisma.$transaction([
      this.prisma.analyticsEvent.create({
        data: { visitId: session.id, name: dto.name, label, valueCents: dto.valueCents, path: dto.path ? cleanPath(dto.path) : null },
      }),
      this.prisma.trafficVisit.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }),
    ]);
    return { tracked: true as const };
  }

  /** Pedido fechado no checkout: entra no funil da sessao atual deste navegador. */
  async recordOrder(sessionId: string | undefined, orderNumber: string, totalCents: number) {
    if (!sessionId) return;
    const session = await this.activeSession(this.visitorHash(sessionId));
    if (!session) return;
    await this.prisma.analyticsEvent.create({
      data: { visitId: session.id, name: "order_created", label: orderNumber, valueCents: totalCents, path: "/checkout" },
    });
  }

  /**
   * Origem de um pedido: a ultima visita nao direta deste navegador nos ultimos 30 dias
   * (quem escaneou o QR, saiu e voltou digitando o endereco continua contando para o QR).
   * Decidido no servidor pelo id anonimo da sessao: o navegador nao escolhe a propria origem.
   */
  async resolveAttribution(sessionId: string | undefined): Promise<Attribution | null> {
    if (!sessionId) return null;
    const since = new Date(Date.now() - ATTRIBUTION_DAYS * DAY_MS);
    const where = { visitorHash: this.visitorHash(sessionId), createdAt: { gte: since } };
    const visit =
      (await this.prisma.trafficVisit.findFirst({
        where: { ...where, channel: { not: "direto" } },
        orderBy: { createdAt: "desc" },
      })) ?? (await this.prisma.trafficVisit.findFirst({ where, orderBy: { createdAt: "desc" } }));
    if (!visit) return null;
    return {
      visitId: visit.id,
      attributionChannel: visit.channel,
      attributionSource: visit.source,
      attributionCampaign: visit.campaign,
      attributionContent: visit.content,
    };
  }

  // ---------------------------------------------------------------- painel

  async summary(dto: AnalyticsRangeDto) {
    const { from, to } = parseRange(dto);
    const sold = SOLD_SQL;

    const [visitsByChannel, ordersByChannel, campaigns, campaignOrders, qrPlaces, qrPlaceOrders, daily, totals, devices] =
      await Promise.all([
        this.prisma.$queryRaw<Row[]>`
          SELECT channel, COUNT(*)::int AS visits, COUNT(DISTINCT "visitorHash")::int AS visitors,
                 (COUNT(*) FILTER (WHERE ${ENGAGED_SQL}))::int AS engaged,
                 COALESCE(SUM("engagedMs"), 0)::float8 AS "engagedMs"
          FROM traffic_visits WHERE "createdAt" >= ${from} AND "createdAt" < ${to}
          GROUP BY channel`,
        this.prisma.$queryRaw<Row[]>`
          SELECT COALESCE("attributionChannel", 'sem_registro') AS channel,
                 COUNT(*)::int AS orders,
                 (COUNT(*) FILTER (WHERE status IN (${sold})))::int AS sales,
                 COALESCE(SUM("totalCents") FILTER (WHERE status IN (${sold})), 0)::int AS revenue
          FROM orders WHERE "createdAt" >= ${from} AND "createdAt" < ${to}
          GROUP BY 1`,
        this.prisma.$queryRaw<Row[]>`
          SELECT channel, source, campaign, COUNT(*)::int AS visits, COUNT(DISTINCT "visitorHash")::int AS visitors
          FROM traffic_visits
          WHERE "createdAt" >= ${from} AND "createdAt" < ${to} AND channel <> 'direto'
          GROUP BY channel, source, campaign ORDER BY visits DESC LIMIT 50`,
        this.prisma.$queryRaw<Row[]>`
          SELECT "attributionChannel" AS channel, "attributionSource" AS source, "attributionCampaign" AS campaign,
                 COUNT(*)::int AS orders,
                 (COUNT(*) FILTER (WHERE status IN (${sold})))::int AS sales,
                 COALESCE(SUM("totalCents") FILTER (WHERE status IN (${sold})), 0)::int AS revenue
          FROM orders
          WHERE "createdAt" >= ${from} AND "createdAt" < ${to} AND "attributionChannel" IS NOT NULL AND "attributionChannel" <> 'direto'
          GROUP BY 1, 2, 3`,
        this.prisma.$queryRaw<Row[]>`
          SELECT COALESCE(content, 'sem-local') AS content, COUNT(*)::int AS visits, COUNT(DISTINCT "visitorHash")::int AS visitors
          FROM traffic_visits
          WHERE "createdAt" >= ${from} AND "createdAt" < ${to} AND channel = 'qrcode'
          GROUP BY 1 ORDER BY visits DESC`,
        this.prisma.$queryRaw<Row[]>`
          SELECT COALESCE("attributionContent", 'sem-local') AS content,
                 COUNT(*)::int AS orders,
                 (COUNT(*) FILTER (WHERE status IN (${sold})))::int AS sales,
                 COALESCE(SUM("totalCents") FILTER (WHERE status IN (${sold})), 0)::int AS revenue
          FROM orders
          WHERE "createdAt" >= ${from} AND "createdAt" < ${to} AND "attributionChannel" = 'qrcode'
          GROUP BY 1`,
        this.prisma.$queryRaw<Array<{ day: string; visits: number; qr: number; social: number; sales: number; revenue: number }>>`
          WITH days AS (
            SELECT generate_series(
              date_trunc('day', ${from}::timestamptz AT TIME ZONE 'America/Sao_Paulo'),
              date_trunc('day', (${to}::timestamptz - interval '1 second') AT TIME ZONE 'America/Sao_Paulo'),
              interval '1 day') AS day
          ),
          v AS (
            SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS day,
                   COUNT(*)::int AS visits,
                   (COUNT(*) FILTER (WHERE channel = 'qrcode'))::int AS qr,
                   (COUNT(*) FILTER (WHERE channel IN (${Prisma.join(SOCIAL_CHANNELS)})))::int AS social
            FROM traffic_visits WHERE "createdAt" >= ${from} AND "createdAt" < ${to} GROUP BY 1
          ),
          o AS (
            SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS day,
                   COUNT(*)::int AS sales, COALESCE(SUM("totalCents"), 0)::int AS revenue
            FROM orders WHERE "createdAt" >= ${from} AND "createdAt" < ${to} AND status IN (${sold}) GROUP BY 1
          )
          SELECT to_char(days.day, 'YYYY-MM-DD') AS day,
                 COALESCE(v.visits, 0) AS visits, COALESCE(v.qr, 0) AS qr, COALESCE(v.social, 0) AS social,
                 COALESCE(o.sales, 0) AS sales, COALESCE(o.revenue, 0) AS revenue
          FROM days LEFT JOIN v ON v.day = days.day LEFT JOIN o ON o.day = days.day
          ORDER BY days.day`,
        this.prisma.$queryRaw<Array<{ visits: number; visitors: number }>>`
          SELECT COUNT(*)::int AS visits, COUNT(DISTINCT "visitorHash")::int AS visitors
          FROM traffic_visits WHERE "createdAt" >= ${from} AND "createdAt" < ${to}`,
        this.prisma.$queryRaw<Array<{ device: string; visits: number }>>`
          SELECT device, COUNT(*)::int AS visits
          FROM traffic_visits WHERE "createdAt" >= ${from} AND "createdAt" < ${to}
          GROUP BY device ORDER BY visits DESC`,
      ]);

    const withRates = <T extends { visitors: number; sales: number }>(row: T) => ({
      ...row,
      conversionRate: row.visitors > 0 ? row.sales / row.visitors : 0,
    });

    // Canal: visitas + pedidos atribuidos
    const channelKeys = new Set([...visitsByChannel.map((r) => r.channel), ...ordersByChannel.map((r) => r.channel)]);
    const channels = [...channelKeys]
      .map((channel) => {
        const v = visitsByChannel.find((r) => r.channel === channel);
        const o = ordersByChannel.find((r) => r.channel === channel);
        return withRates({
          channel,
          social: SOCIAL_CHANNELS.includes(channel),
          visits: v?.visits ?? 0,
          visitors: v?.visitors ?? 0,
          engagementRate: v?.visits ? (v.engaged ?? 0) / v.visits : 0,
          avgEngagementSec: v?.visitors ? (v.engagedMs ?? 0) / v.visitors / 1000 : 0,
          orders: o?.orders ?? 0,
          sales: o?.sales ?? 0,
          revenueCents: o?.revenue ?? 0,
        });
      })
      .sort((a, b) => b.visits - a.visits || b.sales - a.sales);

    const campaignRows = campaigns.map((c) => {
      const o = campaignOrders.find((r) => r.channel === c.channel && r.source === c.source && (r.campaign ?? null) === (c.campaign ?? null));
      return withRates({
        channel: c.channel,
        source: c.source!,
        campaign: c.campaign ?? null,
        visits: c.visits ?? 0,
        visitors: c.visitors ?? 0,
        orders: o?.orders ?? 0,
        sales: o?.sales ?? 0,
        revenueCents: o?.revenue ?? 0,
      });
    });

    const placeKeys = new Set([...qrPlaces.map((r) => r.content!), ...qrPlaceOrders.map((r) => r.content!)]);
    const placements = [...placeKeys].map((content) => {
      const v = qrPlaces.find((r) => r.content === content);
      const o = qrPlaceOrders.find((r) => r.content === content);
      return withRates({
        placement: content,
        visits: v?.visits ?? 0,
        visitors: v?.visitors ?? 0,
        orders: o?.orders ?? 0,
        sales: o?.sales ?? 0,
        revenueCents: o?.revenue ?? 0,
      });
    });

    const sumOf = (rows: Array<{ sales: number; revenueCents: number; orders: number; visits: number; visitors: number }>) =>
      rows.reduce(
        (acc, r) => ({
          visits: acc.visits + r.visits,
          visitors: acc.visitors + r.visitors,
          orders: acc.orders + r.orders,
          sales: acc.sales + r.sales,
          revenueCents: acc.revenueCents + r.revenueCents,
        }),
        { visits: 0, visitors: 0, orders: 0, sales: 0, revenueCents: 0 },
      );

    const qr = channels.find((c) => c.channel === "qrcode");
    const social = sumOf(channels.filter((c) => c.social));
    const all = sumOf(channels);

    return {
      range: { from: from.toISOString(), to: to.toISOString(), attributionDays: ATTRIBUTION_DAYS },
      totals: withRates({
        visits: totals[0]?.visits ?? 0,
        visitors: totals[0]?.visitors ?? 0,
        orders: all.orders,
        sales: all.sales,
        revenueCents: all.revenueCents,
      }),
      qrcode: withRates({
        visits: qr?.visits ?? 0,
        visitors: qr?.visitors ?? 0,
        orders: qr?.orders ?? 0,
        sales: qr?.sales ?? 0,
        revenueCents: qr?.revenueCents ?? 0,
        placements,
      }),
      social: withRates(social),
      channels,
      campaigns: campaignRows,
      devices,
      daily,
    };
  }
}
