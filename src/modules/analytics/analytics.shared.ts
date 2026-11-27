import { OrderStatus, Prisma } from "@prisma/client";
import type { AnalyticsRangeDto } from "./dto/analytics.dto";

export const DAY_MS = 24 * 60 * 60 * 1000;
export const TZ = "America/Sao_Paulo";

/** Pedido que virou venda (estornado e cancelado ficam de fora). */
export const SOLD: OrderStatus[] = [OrderStatus.PAID, OrderStatus.IN_PRODUCTION, OrderStatus.SHIPPED, OrderStatus.DELIVERED];
export const SOLD_SQL = Prisma.join(SOLD.map((s) => Prisma.sql`${s}::"OrderStatus"`));

/**
 * Sessao engajada, como no Google Analytics: durou 10 s ou mais em primeiro plano
 * ou teve 2 paginas ou mais. A taxa de rejeicao e o inverso.
 */
export const ENGAGED_SQL = Prisma.sql`("engagedMs" >= 10000 OR pageviews >= 2)`;

export interface Range {
  from: Date;
  to: Date;
}

/** Periodo em dias do horario de Brasilia; `to` inclusivo. Padrao: ultimos 28 dias, como o Google Analytics. */
export function parseRange(dto: AnalyticsRangeDto): Range {
  const to = dto.to ? new Date(new Date(`${dto.to.slice(0, 10)}T00:00:00-03:00`).getTime() + DAY_MS) : new Date();
  const from = dto.from ? new Date(`${dto.from.slice(0, 10)}T00:00:00-03:00`) : new Date(to.getTime() - 28 * DAY_MS);
  return { from, to };
}

/** Periodo anterior do mesmo tamanho (comparacao do Resumo). */
export function previousRange({ from, to }: Range): Range {
  const span = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - span), to: from };
}

export const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : 0);
