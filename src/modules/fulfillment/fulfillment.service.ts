import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AuditCategory, FulfillmentStatus, OrderStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { MailService } from "../mail/mail.service";

/** PAC/SEDEX a partir do metodo escolhido no checkout */
export function serviceCodeFor(shippingMethod: string): "PAC" | "SEDEX" {
  return shippingMethod === "expresso" ? "SEDEX" : "PAC";
}

export function correiosTrackingUrl(code: string): string {
  return `https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(code)}`;
}

/** Padrao dos objetos registrados dos Correios: 2 letras + 9 digitos + 2 letras (ex.: AB123456789BR) */
export const TRACKING_CODE_PATTERN = /^[A-Z]{2}\d{9}[A-Z]{2}$/;

/** Transicoes permitidas na operacao (inclui voltar um passo para corrigir engano). */
const TRANSITIONS: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  QUEUED: [FulfillmentStatus.IN_PRODUCTION],
  IN_PRODUCTION: [FulfillmentStatus.PACKED, FulfillmentStatus.QUEUED],
  PACKED: [FulfillmentStatus.SHIPPED, FulfillmentStatus.IN_PRODUCTION],
  SHIPPED: [FulfillmentStatus.DELIVERED],
  DELIVERED: [],
};

export const FULFILLMENT_LABELS: Record<FulfillmentStatus, string> = {
  QUEUED: "A produzir",
  IN_PRODUCTION: "Em produção",
  PACKED: "Embalado",
  SHIPPED: "Postado",
  DELIVERED: "Entregue",
};

/** Status do pedido que acompanha cada etapa do fulfillment */
const ORDER_STATUS_FOR: Record<FulfillmentStatus, OrderStatus> = {
  QUEUED: OrderStatus.PAID,
  IN_PRODUCTION: OrderStatus.IN_PRODUCTION,
  PACKED: OrderStatus.IN_PRODUCTION,
  SHIPPED: OrderStatus.SHIPPED,
  DELIVERED: OrderStatus.DELIVERED,
};

/** Nota padrao da timeline (visivel ao cliente) */
const DEFAULT_NOTES: Record<FulfillmentStatus, string> = {
  QUEUED: "Pedido na fila de produção.",
  IN_PRODUCTION: "Seu pedido entrou em produção.",
  PACKED: "Pedido embalado, aguardando postagem.",
  SHIPPED: "Pedido postado nos Correios.",
  DELIVERED: "Pedido entregue.",
};

/** Pedidos em que a operacao pode mexer */
const WORKABLE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.IN_PRODUCTION,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

export interface FulfillmentUpdate {
  status?: FulfillmentStatus;
  trackingCode?: string;
  serviceCode?: "PAC" | "SEDEX";
  packageWeightGrams?: number | null;
  packageLengthCm?: number | null;
  packageWidthCm?: number | null;
  packageHeightCm?: number | null;
  internalNotes?: string | null;
  /** Texto extra na timeline do pedido (o cliente ve) */
  note?: string;
}

type TimelineEvent = { status: string; at: string; note: string | null };

/**
 * Producao, embalagem e postagem feitas pela propria loja.
 * Pagamento aprovado -> fila (QUEUED); a equipe avanca pelo backoffice.
 */
@Injectable()
export class FulfillmentService {
  private readonly logger = new Logger(FulfillmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  /** Chamado quando o pagamento e aprovado: coloca o pedido na fila de producao (idempotente). */
  async enqueue(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, number: true, shippingMethod: true, fulfillment: { select: { id: true } } },
    });
    if (!order || order.fulfillment) return;

    await this.prisma.fulfillment.create({
      data: { orderId: order.id, status: FulfillmentStatus.QUEUED, serviceCode: serviceCodeFor(order.shippingMethod) },
    });
    await this.appendTimeline(order.id, null, DEFAULT_NOTES.QUEUED);
    this.audit.record({
      category: AuditCategory.FULFILLMENT,
      action: "fulfillment.queued",
      target: { type: "order", id: order.number },
      data: { serviceCode: serviceCodeFor(order.shippingMethod) },
    });
    this.logger.log(`Pedido ${order.number} na fila de producao.`);
  }

  /** Atualizacao feita pela equipe (status, rastreio, embalagem, notas internas). */
  async update(orderNumber: string, dto: FulfillmentUpdate): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { number: orderNumber.toUpperCase() },
      include: { fulfillment: true },
    });
    if (!order) throw new NotFoundException("Pedido não encontrado.");
    if (!WORKABLE_ORDER_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        `Pedido ${order.number} está "${order.status}": só pedidos pagos entram na produção.`,
      );
    }

    // Pedido pago antes desta versao (ou sem fila) ganha o registro na hora
    const current =
      order.fulfillment ??
      (await this.prisma.fulfillment.create({
        data: { orderId: order.id, status: FulfillmentStatus.QUEUED, serviceCode: serviceCodeFor(order.shippingMethod) },
      }));

    const trackingCode = dto.trackingCode?.replace(/\s+/g, "").toUpperCase();
    if (trackingCode && !TRACKING_CODE_PATTERN.test(trackingCode)) {
      throw new BadRequestException("Código de rastreio inválido. Formato esperado: AB123456789BR.");
    }

    const target = dto.status && dto.status !== current.status ? dto.status : null;
    if (target && !TRANSITIONS[current.status].includes(target)) {
      throw new BadRequestException(
        `Não dá para ir de "${FULFILLMENT_LABELS[current.status]}" para "${FULFILLMENT_LABELS[target]}".`,
      );
    }
    const finalTracking = trackingCode ?? current.trackingCode;
    if (target === FulfillmentStatus.SHIPPED && !finalTracking) {
      throw new BadRequestException("Informe o código de rastreio dos Correios para marcar como postado.");
    }

    const now = new Date();
    const data: Prisma.FulfillmentUpdateInput = {
      ...(dto.serviceCode !== undefined ? { serviceCode: dto.serviceCode } : {}),
      ...(dto.packageWeightGrams !== undefined ? { packageWeightGrams: dto.packageWeightGrams } : {}),
      ...(dto.packageLengthCm !== undefined ? { packageLengthCm: dto.packageLengthCm } : {}),
      ...(dto.packageWidthCm !== undefined ? { packageWidthCm: dto.packageWidthCm } : {}),
      ...(dto.packageHeightCm !== undefined ? { packageHeightCm: dto.packageHeightCm } : {}),
      ...(dto.internalNotes !== undefined ? { internalNotes: dto.internalNotes?.trim() || null } : {}),
      ...(trackingCode ? { trackingCode, trackingUrl: correiosTrackingUrl(trackingCode) } : {}),
    };
    if (target) {
      data.status = target;
      if (target === FulfillmentStatus.IN_PRODUCTION && !current.productionStartedAt) data.productionStartedAt = now;
      if (target === FulfillmentStatus.PACKED) data.packedAt = now;
      if (target === FulfillmentStatus.SHIPPED) data.shippedAt = now;
      if (target === FulfillmentStatus.DELIVERED) data.deliveredAt = now;
    }

    await this.prisma.fulfillment.update({ where: { id: current.id }, data });

    // Rastreio corrigido depois da postagem tambem vai para o pedido
    if (trackingCode && trackingCode !== order.trackingCode && !target) {
      await this.prisma.order.update({ where: { id: order.id }, data: { trackingCode } });
    }

    const changedFields = Object.keys(data).filter((k) => k !== "status");
    if (target) {
      this.audit.record({
        category: AuditCategory.FULFILLMENT,
        action: "fulfillment.status_changed",
        target: { type: "order", id: order.number },
        data: { from: current.status, to: target, trackingCode: finalTracking ?? null, fields: changedFields },
      });
      await this.syncOrder(order, target, finalTracking ?? null, dto.note?.trim() || null);
    } else if (changedFields.length) {
      this.audit.record({
        category: AuditCategory.FULFILLMENT,
        action: "fulfillment.updated",
        target: { type: "order", id: order.number },
        data: { fields: changedFields },
      });
    }

    if (target === FulfillmentStatus.SHIPPED && finalTracking) {
      void this.mail.sendOrderShipped(order.customerEmail, order.customerName, {
        orderNumber: order.number,
        trackingCode: finalTracking,
        trackingUrl: correiosTrackingUrl(finalTracking),
        serviceCode: dto.serviceCode ?? current.serviceCode,
        estimatedDays: order.estimatedDays,
      });
    }
  }

  /** Marca as etiquetas como impressas. */
  async markLabelsPrinted(orderIds: string[]): Promise<void> {
    if (!orderIds.length) return;
    await this.prisma.fulfillment.updateMany({
      where: { orderId: { in: orderIds } },
      data: { labelPrintedAt: new Date() },
    });
  }

  /** Leva o pedido para o status que corresponde a etapa (avanca ou volta junto com a operacao). */
  private async syncOrder(
    order: { id: string; number: string; status: OrderStatus; timeline: Prisma.JsonValue },
    fulfillmentStatus: FulfillmentStatus,
    trackingCode: string | null,
    extraNote: string | null,
  ) {
    const next = ORDER_STATUS_FOR[fulfillmentStatus];
    const note = [DEFAULT_NOTES[fulfillmentStatus], trackingCode && fulfillmentStatus === FulfillmentStatus.SHIPPED ? `Rastreio: ${trackingCode}.` : null, extraNote]
      .filter(Boolean)
      .join(" ");
    const timeline = (Array.isArray(order.timeline) ? order.timeline : []) as TimelineEvent[];

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: next,
        ...(trackingCode ? { trackingCode } : {}),
        timeline: [...timeline, { status: next, at: new Date().toISOString(), note }] as object,
      },
    });
    if (next !== order.status) {
      this.audit.record({
        category: AuditCategory.ORDER,
        action: "order.status_changed",
        target: { type: "order", id: order.number },
        data: { from: order.status, to: next, source: "fulfillment", trackingCode },
      });
    }
  }

  private async appendTimeline(orderId: string, status: OrderStatus | null, note: string) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true, timeline: true } });
    const timeline = (Array.isArray(order.timeline) ? order.timeline : []) as TimelineEvent[];
    await this.prisma.order.update({
      where: { id: orderId },
      data: { timeline: [...timeline, { status: status ?? order.status, at: new Date().toISOString(), note }] as object },
    });
  }
}
