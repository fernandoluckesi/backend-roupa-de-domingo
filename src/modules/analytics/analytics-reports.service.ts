import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AnalyticsRangeDto, PathsQueryDto } from "./dto/analytics.dto";
import { ENGAGED_SQL, parseRange, previousRange, ratio, SOLD_SQL, TZ, type Range } from "./analytics.shared";
import { SESSION_TIMEOUT_MIN } from "./analytics.service";

const UNSET = "(não definido)";

/** Paginas com id no caminho viram um grupo (/produto/camiseta-x -> /produto/*). */
const GROUP_PATTERN = "^/(produto|conta/pedidos|pagamento)/[^/]+$";
const pathExpr = (group: boolean, column = Prisma.sql`p.path`) =>
  group ? Prisma.sql`regexp_replace(${column}, ${GROUP_PATTERN}, '/\\1/*')` : column;
const groupPath = (path: string) => path.replace(new RegExp(GROUP_PATTERN), "/$1/*");

/** Dimensoes de Usuarios: coluna fixa (nunca vem do cliente direto para o SQL). */
const DIMENSIONS = {
  country: Prisma.sql`COALESCE(v.country, ${UNSET})`,
  region: Prisma.sql`COALESCE(v.region || ' · ' || v.country, v.region, ${UNSET})`,
  city: Prisma.sql`COALESCE(v.city || ' · ' || COALESCE(v.region, v.country, ''), ${UNSET})`,
  device: Prisma.sql`v.device`,
  os: Prisma.sql`COALESCE(v.os, ${UNSET})`,
  browser: Prisma.sql`COALESCE(v.browser, ${UNSET})`,
  screen: Prisma.sql`COALESCE(v.screen, ${UNSET})`,
  language: Prisma.sql`COALESCE(lower(v.language), ${UNSET})`,
  userType: Prisma.sql`CASE WHEN v."isNewVisitor" THEN 'Novo' ELSE 'Recorrente' END`,
} as const;
type Dimension = keyof typeof DIMENSIONS;

interface DimRow {
  key: string;
  users: number;
  sessions: number;
  engaged: number;
  engagedMs: number;
  sales: number;
  revenue: number;
}

interface PathNode {
  path: string;
  sessions: number;
  children: PathNode[];
}

@Injectable()
export class AnalyticsReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- Resumo

  private async kpis({ from, to }: Range) {
    const [[v], [o]] = await Promise.all([
      this.prisma.$queryRaw<Array<{ users: number; newUsers: number; sessions: number; engaged: number; pageviews: number; engagedMs: number }>>`
        SELECT COUNT(DISTINCT "visitorHash")::int AS users,
               (COUNT(DISTINCT "visitorHash") FILTER (WHERE "isNewVisitor"))::int AS "newUsers",
               COUNT(*)::int AS sessions,
               (COUNT(*) FILTER (WHERE ${ENGAGED_SQL}))::int AS engaged,
               COALESCE(SUM(pageviews), 0)::int AS pageviews,
               COALESCE(SUM("engagedMs"), 0)::float8 AS "engagedMs"
        FROM traffic_visits WHERE "createdAt" >= ${from} AND "createdAt" < ${to}`,
      this.prisma.$queryRaw<Array<{ orders: number; sales: number; revenue: number }>>`
        SELECT COUNT(*)::int AS orders,
               (COUNT(*) FILTER (WHERE status IN (${SOLD_SQL})))::int AS sales,
               COALESCE(SUM("totalCents") FILTER (WHERE status IN (${SOLD_SQL})), 0)::int AS revenue
        FROM orders WHERE "createdAt" >= ${from} AND "createdAt" < ${to}`,
    ]);
    return {
      users: v.users,
      newUsers: v.newUsers,
      sessions: v.sessions,
      pageviews: v.pageviews,
      engagedSessions: v.engaged,
      engagementRate: ratio(v.engaged, v.sessions),
      bounceRate: v.sessions ? 1 - ratio(v.engaged, v.sessions) : 0,
      /** Tempo medio de engajamento por usuario, em segundos (metrica principal do GA4) */
      avgEngagementSec: ratio(v.engagedMs, v.users) / 1000,
      viewsPerSession: ratio(v.pageviews, v.sessions),
      orders: o.orders,
      sales: o.sales,
      revenueCents: o.revenue,
      conversionRate: ratio(o.sales, v.users),
    };
  }

  private daily({ from, to }: Range) {
    return this.prisma.$queryRaw<
      Array<{ day: string; users: number; newUsers: number; sessions: number; pageviews: number; engagedMs: number; sales: number; revenue: number }>
    >`
      WITH days AS (
        SELECT generate_series(
          date_trunc('day', ${from}::timestamptz AT TIME ZONE ${TZ}),
          date_trunc('day', (${to}::timestamptz - interval '1 second') AT TIME ZONE ${TZ}),
          interval '1 day') AS day
      ),
      v AS (
        SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${TZ}) AS day,
               COUNT(DISTINCT "visitorHash")::int AS users,
               (COUNT(DISTINCT "visitorHash") FILTER (WHERE "isNewVisitor"))::int AS "newUsers",
               COUNT(*)::int AS sessions, COALESCE(SUM(pageviews), 0)::int AS pageviews,
               COALESCE(SUM("engagedMs"), 0)::float8 AS "engagedMs"
        FROM traffic_visits WHERE "createdAt" >= ${from} AND "createdAt" < ${to} GROUP BY 1
      ),
      o AS (
        SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${TZ}) AS day,
               COUNT(*)::int AS sales, COALESCE(SUM("totalCents"), 0)::int AS revenue
        FROM orders WHERE "createdAt" >= ${from} AND "createdAt" < ${to} AND status IN (${SOLD_SQL}) GROUP BY 1
      )
      SELECT to_char(days.day, 'YYYY-MM-DD') AS day,
             COALESCE(v.users, 0) AS users, COALESCE(v."newUsers", 0) AS "newUsers",
             COALESCE(v.sessions, 0) AS sessions, COALESCE(v.pageviews, 0) AS pageviews,
             COALESCE(v."engagedMs", 0) AS "engagedMs",
             COALESCE(o.sales, 0) AS sales, COALESCE(o.revenue, 0) AS revenue
      FROM days LEFT JOIN v ON v.day = days.day LEFT JOIN o ON o.day = days.day
      ORDER BY days.day`;
  }

  async overview(dto: AnalyticsRangeDto) {
    const range = parseRange(dto);
    const { from, to } = range;
    const before = previousRange(range);
    const [current, previous, daily, previousDaily, pages, channels, cities, devices] = await Promise.all([
      this.kpis(range),
      this.kpis(before),
      this.daily(range),
      this.daily(before),
      this.prisma.$queryRaw<Array<{ path: string; title: string | null; views: number; users: number }>>`
        SELECT p.path, MAX(p.title) AS title, COUNT(*)::int AS views, COUNT(DISTINCT v."visitorHash")::int AS users
        FROM page_views p JOIN traffic_visits v ON v.id = p."visitId"
        WHERE p."createdAt" >= ${from} AND p."createdAt" < ${to}
        GROUP BY p.path ORDER BY views DESC LIMIT 7`,
      this.prisma.$queryRaw<Array<{ key: string; users: number; sessions: number }>>`
        SELECT channel AS key, COUNT(DISTINCT "visitorHash")::int AS users, COUNT(*)::int AS sessions
        FROM traffic_visits WHERE "createdAt" >= ${from} AND "createdAt" < ${to}
        GROUP BY channel ORDER BY sessions DESC LIMIT 7`,
      this.dimension("city", range, 7),
      this.dimension("device", range, 5),
    ]);
    return { range: { from, to }, current, previous, daily, previousDaily, pages, channels, cities, devices };
  }

  // ---------------------------------------------------------------- Tempo real

  async realtime() {
    const now = Date.now();
    const since = new Date(now - SESSION_TIMEOUT_MIN * 60_000);
    const [sessions, views, events] = await Promise.all([
      this.prisma.trafficVisit.findMany({
        where: { lastSeenAt: { gte: since } },
        select: { visitorHash: true, channel: true, city: true, region: true, device: true },
      }),
      this.prisma.pageView.findMany({
        where: { createdAt: { gte: since } },
        select: { path: true, title: true, createdAt: true, visit: { select: { visitorHash: true } } },
      }),
      this.prisma.analyticsEvent.groupBy({ by: ["name"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    ]);

    const perMinute = Array.from({ length: SESSION_TIMEOUT_MIN }, () => ({ users: new Set<string>(), views: 0 }));
    for (const view of views) {
      const ago = Math.min(SESSION_TIMEOUT_MIN - 1, Math.floor((now - view.createdAt.getTime()) / 60_000));
      perMinute[ago].views += 1;
      perMinute[ago].users.add(view.visit.visitorHash);
    }

    const countUsers = (key: (s: (typeof sessions)[number]) => string) => {
      const map = new Map<string, Set<string>>();
      for (const s of sessions) {
        const k = key(s);
        if (!map.has(k)) map.set(k, new Set());
        map.get(k)!.add(s.visitorHash);
      }
      return [...map].map(([k, users]) => ({ key: k, users: users.size })).sort((a, b) => b.users - a.users).slice(0, 10);
    };

    const pageMap = new Map<string, { title: string | null; views: number; users: Set<string> }>();
    for (const v of views) {
      const entry = pageMap.get(v.path) ?? { title: v.title, views: 0, users: new Set<string>() };
      entry.views += 1;
      entry.users.add(v.visit.visitorHash);
      pageMap.set(v.path, entry);
    }

    return {
      activeUsers: new Set(sessions.map((s) => s.visitorHash)).size,
      /** Indice 0 = minuto atual; 29 = ha 29 minutos */
      perMinute: perMinute.map((m) => ({ users: m.users.size, views: m.views })),
      pages: [...pageMap]
        .map(([path, e]) => ({ path, title: e.title, views: e.views, users: e.users.size }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10),
      channels: countUsers((s) => s.channel),
      cities: countUsers((s) => (s.city ? `${s.city}${s.region ? ` · ${s.region}` : ""}` : UNSET)),
      devices: countUsers((s) => s.device),
      events: events.map((e) => ({ name: e.name, count: e._count._all })),
    };
  }

  // ---------------------------------------------------------------- Engajamento

  async pages(dto: PathsQueryDto) {
    const { from, to } = parseRange(dto);
    const group = dto.group === "true";
    const path = pathExpr(group);
    const landing = pathExpr(group, Prisma.sql`v."landingPath"`);
    const [pages, landings, searches, events] = await Promise.all([
      this.prisma.$queryRaw<Array<{ path: string; title: string | null; views: number; users: number; engagedMs: number; entries: number; exits: number }>>`
        SELECT ${path} AS path, MAX(p.title) AS title, COUNT(*)::int AS views,
               COUNT(DISTINCT v."visitorHash")::int AS users,
               COALESCE(SUM(p."engagedMs"), 0)::float8 AS "engagedMs",
               (COUNT(*) FILTER (WHERE p.seq = 1))::int AS entries,
               (COUNT(*) FILTER (WHERE p.seq = v.pageviews))::int AS exits
        FROM page_views p JOIN traffic_visits v ON v.id = p."visitId"
        WHERE p."createdAt" >= ${from} AND p."createdAt" < ${to}
        GROUP BY 1 ORDER BY views DESC LIMIT 200`,
      this.prisma.$queryRaw<Array<{ path: string; sessions: number; users: number; engaged: number; engagedMs: number; orders: number }>>`
        SELECT ${landing} AS path, COUNT(*)::int AS sessions, COUNT(DISTINCT v."visitorHash")::int AS users,
               (COUNT(*) FILTER (WHERE ${ENGAGED_SQL}))::int AS engaged,
               COALESCE(SUM(v."engagedMs"), 0)::float8 AS "engagedMs",
               COALESCE(SUM(e.orders), 0)::int AS orders
        FROM traffic_visits v
        LEFT JOIN (SELECT "visitId", COUNT(*)::int AS orders FROM analytics_events WHERE name = 'order_created' GROUP BY 1) e
          ON e."visitId" = v.id
        WHERE v."createdAt" >= ${from} AND v."createdAt" < ${to} AND NOT v.minimal
        GROUP BY 1 ORDER BY sessions DESC LIMIT 100`,
      this.prisma.$queryRaw<Array<{ term: string; searches: number; sessions: number }>>`
        SELECT label AS term, COUNT(*)::int AS searches, COUNT(DISTINCT "visitId")::int AS sessions
        FROM analytics_events
        WHERE name = 'search' AND label IS NOT NULL AND "createdAt" >= ${from} AND "createdAt" < ${to}
        GROUP BY label ORDER BY searches DESC LIMIT 50`,
      this.prisma.$queryRaw<Array<{ name: string; count: number; sessions: number; valueCents: number }>>`
        SELECT name, COUNT(*)::int AS count, COUNT(DISTINCT "visitId")::int AS sessions,
               COALESCE(SUM("valueCents"), 0)::float8 AS "valueCents"
        FROM analytics_events WHERE "createdAt" >= ${from} AND "createdAt" < ${to}
        GROUP BY name ORDER BY count DESC`,
    ]);
    return {
      pages: pages.map((p) => ({ ...p, avgTimeSec: ratio(p.engagedMs, p.views) / 1000, exitRate: ratio(p.exits, p.views) })),
      landings: landings.map((l) => ({
        ...l,
        engagementRate: ratio(l.engaged, l.sessions),
        bounceRate: l.sessions ? 1 - ratio(l.engaged, l.sessions) : 0,
        avgEngagementSec: ratio(l.engagedMs, l.users) / 1000,
      })),
      searches,
      events,
    };
  }

  /**
   * Exploracao de caminhos: de uma pagina (ou do inicio da sessao), quais paginas vem depois,
   * em ate 4 passos. Paginas repetidas em sequencia (recarregar) contam uma vez.
   */
  async paths(dto: PathsQueryDto) {
    const { from, to } = parseRange(dto);
    const group = dto.group === "true";
    const rows = await this.prisma.pageView.findMany({
      where: { createdAt: { gte: from, lt: to } },
      select: { visitId: true, seq: true, path: true },
      orderBy: [{ visitId: "asc" }, { seq: "asc" }],
      take: 200_000,
    });

    const sessions = new Map<string, string[]>();
    for (const row of rows) {
      const path = group ? groupPath(row.path) : row.path;
      const list = sessions.get(row.visitId) ?? [];
      if (list[list.length - 1] !== path) list.push(path);
      sessions.set(row.visitId, list);
    }

    const EXIT = "(saiu do site)";
    const start = dto.start ? (group ? groupPath(dto.start) : dto.start) : null;
    const journeys: string[][] = [];
    for (const list of sessions.values()) {
      if (!start) journeys.push(list);
      else {
        const at = list.indexOf(start);
        if (at >= 0) journeys.push(list.slice(at + 1));
      }
    }

    const WIDTH = [8, 5, 4, 3];
    const build = (items: string[][], depth: number): PathNode[] => {
      if (depth >= WIDTH.length) return [];
      const counts = new Map<string, string[][]>();
      for (const steps of items) {
        const next = steps[0] ?? EXIT;
        if (!counts.has(next)) counts.set(next, []);
        if (steps.length) counts.get(next)!.push(steps.slice(1));
        else counts.get(next)!.push([]);
      }
      return [...counts]
        .map(([path, rest]) => ({
          path,
          sessions: rest.length,
          children: path === EXIT ? [] : build(rest, depth + 1),
        }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, WIDTH[depth]);
    };

    // Jornadas mais comuns (ate 5 paginas)
    const sequences = new Map<string, number>();
    for (const list of sessions.values()) {
      const key = list.slice(0, 5).join(" → ");
      sequences.set(key, (sequences.get(key) ?? 0) + 1);
    }

    // Lista de paginas para escolher o ponto de partida
    const pageCounts = new Map<string, number>();
    for (const list of sessions.values()) for (const p of new Set(list)) pageCounts.set(p, (pageCounts.get(p) ?? 0) + 1);

    return {
      start,
      sessions: journeys.length,
      totalSessions: sessions.size,
      tree: build(journeys, 0),
      topJourneys: [...sequences]
        .map(([path, count]) => ({ path, sessions: count }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 15),
      pagesList: [...pageCounts].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([path, count]) => ({ path, sessions: count })),
      truncated: rows.length >= 200_000,
    };
  }

  // ---------------------------------------------------------------- Usuarios

  private async dimension(dim: Dimension, { from, to }: Range, limit = 50) {
    const key = DIMENSIONS[dim];
    // Local e tecnologia nao existem para quem recusou Estatisticas (minimal)
    const onlyFull = ["country", "region", "city", "screen", "language"].includes(dim) ? Prisma.sql`AND NOT v.minimal` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<DimRow[]>`
      SELECT ${key} AS key, COUNT(DISTINCT v."visitorHash")::int AS users, COUNT(*)::int AS sessions,
             (COUNT(*) FILTER (WHERE ${ENGAGED_SQL}))::int AS engaged,
             COALESCE(SUM(v."engagedMs"), 0)::float8 AS "engagedMs",
             COALESCE(SUM(o.sales), 0)::int AS sales, COALESCE(SUM(o.revenue), 0)::int AS revenue
      FROM traffic_visits v
      LEFT JOIN (
        SELECT "visitId", COUNT(*)::int AS sales, SUM("totalCents")::int AS revenue
        FROM orders WHERE status IN (${SOLD_SQL}) AND "visitId" IS NOT NULL GROUP BY 1
      ) o ON o."visitId" = v.id
      WHERE v."createdAt" >= ${from} AND v."createdAt" < ${to} ${onlyFull}
      GROUP BY 1 ORDER BY users DESC, sessions DESC LIMIT ${limit}`;
    return rows.map((r) => ({
      ...r,
      engagementRate: ratio(r.engaged, r.sessions),
      avgEngagementSec: ratio(r.engagedMs, r.users) / 1000,
    }));
  }

  async audience(dto: AnalyticsRangeDto) {
    const range = parseRange(dto);
    const dims: Dimension[] = ["country", "region", "city", "userType", "device", "os", "browser", "screen", "language"];
    const results = await Promise.all(dims.map((d) => this.dimension(d, range)));
    return Object.fromEntries(dims.map((d, i) => [d, results[i]]));
  }

  // ---------------------------------------------------------------- Monetizacao

  async funnel(dto: AnalyticsRangeDto) {
    const { from, to } = parseRange(dto);
    const [byChannel, products, purchases] = await Promise.all([
      this.prisma.$queryRaw<Array<{ channel: string; sessions: number; viewed: number; carted: number; checkout: number; ordered: number; paid: number; revenue: number }>>`
        WITH s AS (
          SELECT v.id, v.channel,
                 bool_or(e.name IN ('view_item', 'add_to_cart', 'begin_checkout', 'order_created')) AS viewed,
                 bool_or(e.name IN ('add_to_cart', 'begin_checkout', 'order_created')) AS carted,
                 bool_or(e.name IN ('begin_checkout', 'order_created')) AS checkout,
                 bool_or(e.name = 'order_created') AS ordered,
                 bool_or(o.status IN (${SOLD_SQL})) AS paid,
                 COALESCE(SUM(o."totalCents") FILTER (WHERE o.status IN (${SOLD_SQL})), 0) AS revenue
          FROM traffic_visits v
          LEFT JOIN analytics_events e ON e."visitId" = v.id
          LEFT JOIN orders o ON e.name = 'order_created' AND o.number = e.label
          WHERE v."createdAt" >= ${from} AND v."createdAt" < ${to} AND NOT v.minimal
          GROUP BY v.id, v.channel
        )
        SELECT channel, COUNT(*)::int AS sessions,
               (COUNT(*) FILTER (WHERE viewed))::int AS viewed,
               (COUNT(*) FILTER (WHERE carted))::int AS carted,
               (COUNT(*) FILTER (WHERE checkout))::int AS checkout,
               (COUNT(*) FILTER (WHERE ordered))::int AS ordered,
               (COUNT(*) FILTER (WHERE paid))::int AS paid,
               COALESCE(SUM(revenue), 0)::int AS revenue
        FROM s GROUP BY channel ORDER BY sessions DESC`,
      this.prisma.$queryRaw<Array<{ slug: string; views: number; adds: number }>>`
        SELECT label AS slug,
               (COUNT(*) FILTER (WHERE name = 'view_item'))::int AS views,
               (COUNT(*) FILTER (WHERE name = 'add_to_cart'))::int AS adds
        FROM analytics_events
        WHERE name IN ('view_item', 'add_to_cart') AND label IS NOT NULL AND "createdAt" >= ${from} AND "createdAt" < ${to}
        GROUP BY label`,
      this.prisma.$queryRaw<Array<{ slug: string; name: string; quantity: number; revenue: number }>>`
        SELECT pr.slug, MAX(oi."productName") AS name, SUM(oi.quantity)::int AS quantity, SUM(oi."totalCents")::int AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi."orderId"
        JOIN product_variants pv ON pv.id = oi."variantId"
        JOIN products pr ON pr.id = pv."productId"
        WHERE o."createdAt" >= ${from} AND o."createdAt" < ${to} AND o.status IN (${SOLD_SQL})
        GROUP BY pr.slug`,
    ]);

    const steps = ["sessions", "viewed", "carted", "checkout", "ordered", "paid"] as const;
    const total = Object.fromEntries(steps.map((k) => [k, byChannel.reduce((acc, r) => acc + r[k], 0)])) as Record<(typeof steps)[number], number>;

    const slugs = [...new Set([...products.map((p) => p.slug), ...purchases.map((p) => p.slug)])];
    const names = slugs.length
      ? await this.prisma.product.findMany({ where: { slug: { in: slugs } }, select: { slug: true, name: true } })
      : [];
    const productRows = slugs
      .map((slug) => {
        const ev = products.find((p) => p.slug === slug);
        const buy = purchases.find((p) => p.slug === slug);
        return {
          slug,
          name: names.find((n) => n.slug === slug)?.name ?? buy?.name ?? slug,
          views: ev?.views ?? 0,
          adds: ev?.adds ?? 0,
          quantity: buy?.quantity ?? 0,
          revenueCents: buy?.revenue ?? 0,
          cartRate: ratio(ev?.adds ?? 0, ev?.views ?? 0),
          purchaseRate: ratio(buy?.quantity ?? 0, ev?.views ?? 0),
        };
      })
      .sort((a, b) => b.revenueCents - a.revenueCents || b.views - a.views)
      .slice(0, 100);

    return {
      steps: total,
      revenueCents: byChannel.reduce((acc, r) => acc + r.revenue, 0),
      byChannel,
      products: productRows,
    };
  }
}
