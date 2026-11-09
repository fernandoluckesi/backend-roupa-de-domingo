import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AuditCategory,
  FulfillmentStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ReturnStatus,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { FulfillmentService, serviceCodeFor } from "../fulfillment/fulfillment.service";
import type { ListOrdersQueryDto, OrderStage, UpdateFulfillmentDto } from "./dto/admin-orders.dto";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Aguardando pagamento",
  PAID: "Pago",
  IN_PRODUCTION: "Em produção",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
  REFUNDED: "Estornado",
  FAILED: "Pagamento recusado",
};

/** Pedidos pagos que a operacao trabalha (estornado/cancelado sai da fila mesmo com fulfillment aberto) */
const WORKABLE: OrderStatus[] = [OrderStatus.PAID, OrderStatus.IN_PRODUCTION, OrderStatus.SHIPPED, OrderStatus.DELIVERED];
const ISSUE_STATUSES: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.REFUNDED, OrderStatus.FAILED];
const OPEN_RETURN: ReturnStatus[] = [ReturnStatus.REQUESTED, ReturnStatus.APPROVED, ReturnStatus.IN_TRANSIT, ReturnStatus.RECEIVED];
const PRODUCTION_STAGES: OrderStage[] = ["to_produce", "in_production", "packed"];
const DEFAULT_ITEM_WEIGHT = 300;
const DAY_MS = 24 * 60 * 60 * 1000;

const STAGE_FULFILLMENT: Partial<Record<OrderStage, FulfillmentStatus>> = {
  to_produce: FulfillmentStatus.QUEUED,
  in_production: FulfillmentStatus.IN_PRODUCTION,
  packed: FulfillmentStatus.PACKED,
  shipped: FulfillmentStatus.SHIPPED,
  delivered: FulfillmentStatus.DELIVERED,
};

const DETAIL_INCLUDE = {
  items: { include: { variant: { select: { size: true, color: true, model: true, weightGrams: true } } } },
  payment: {
    select: {
      provider: true,
      status: true,
      method: true,
      installments: true,
      amountCents: true,
      providerPaymentId: true,
      paidAt: true,
    },
  },
  fulfillment: true,
  invoice: { select: { status: true, number: true, series: true, accessKey: true, pdfUrl: true, issuedAt: true } },
  coupon: { select: { code: true, description: true } },
  returns: { orderBy: { createdAt: "desc" }, select: { protocol: true, type: true, status: true, createdAt: true } },
} satisfies Prisma.OrderInclude;

type DetailOrder = Prisma.OrderGetPayload<{ include: typeof DETAIL_INCLUDE }>;

/** Gestao de pedidos do backoffice: listagem, detalhe, operacao, etiquetas e lista de producao. */
@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly fulfillment: FulfillmentService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- painel

  async summary() {
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const last30 = new Date(now - 30 * DAY_MS);

    const [byStatusRows, byFulfillmentRows, paidWithoutQueue, openReturns, today, month] = await Promise.all([
      this.prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.fulfillment.groupBy({
        by: ["status"],
        where: { order: { status: { in: WORKABLE } } },
        _count: { _all: true },
      }),
      this.prisma.order.count({ where: { status: OrderStatus.PAID, fulfillment: { is: null } } }),
      this.prisma.returnRequest.count({ where: { status: { in: OPEN_RETURN } } }),
      this.periodStats(startOfToday),
      this.periodStats(last30),
    ]);

    const byStatus = Object.fromEntries(Object.values(OrderStatus).map((s) => [s, 0])) as Record<OrderStatus, number>;
    byStatusRows.forEach((r) => (byStatus[r.status] = r._count._all));
    const byFulfillment = Object.fromEntries(Object.values(FulfillmentStatus).map((s) => [s, 0])) as Record<
      FulfillmentStatus,
      number
    >;
    byFulfillmentRows.forEach((r) => (byFulfillment[r.status] = r._count._all));
    byFulfillment.QUEUED += paidWithoutQueue;

    return { byStatus, byFulfillment, openReturns, today, last30Days: month };
  }

  private async periodStats(since: Date) {
    const [orders, paid] = await Promise.all([
      this.prisma.order.count({ where: { createdAt: { gte: since } } }),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.APPROVED, paidAt: { gte: since } },
        _count: { _all: true },
        _sum: { amountCents: true },
      }),
    ]);
    return { orders, paidOrders: paid._count._all, paidCents: paid._sum.amountCents ?? 0 };
  }

  // ---------------------------------------------------------------- listagem

  private stageWhere(stage: OrderStage): Prisma.OrderWhereInput {
    if (stage === "awaiting_payment") return { status: OrderStatus.PENDING };
    if (stage === "issues") {
      return { OR: [{ status: { in: ISSUE_STATUSES } }, { returns: { some: { status: { in: OPEN_RETURN } } } }] };
    }
    const fulfillmentStatus = STAGE_FULFILLMENT[stage];
    if (!fulfillmentStatus) return {};
    const inStage: Prisma.OrderWhereInput = { status: { in: WORKABLE }, fulfillment: { is: { status: fulfillmentStatus } } };
    // Pago sem registro de fila (falha no enqueue) tambem precisa ser produzido
    return stage === "to_produce"
      ? { OR: [inStage, { status: OrderStatus.PAID, fulfillment: { is: null } }] }
      : inStage;
  }

  async list(query: ListOrdersQueryDto) {
    const stage = query.stage ?? "all";
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 25, 100);
    const q = query.q?.trim();

    const where: Prisma.OrderWhereInput = {
      AND: [
        this.stageWhere(stage),
        q
          ? {
              OR: [
                { number: { contains: q.toUpperCase() } },
                { customerName: { contains: q, mode: "insensitive" } },
                { customerEmail: { contains: q.toLowerCase() } },
              ],
            }
          : {},
        query.from || query.to ? { createdAt: { gte: query.from, lte: query.to } } : {},
      ],
    };

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: PRODUCTION_STAGES.includes(stage) ? "asc" : "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          number: true,
          status: true,
          createdAt: true,
          customerName: true,
          shippingCity: true,
          shippingState: true,
          shippingMethod: true,
          totalCents: true,
          items: { select: { quantity: true } },
          payment: { select: { status: true, method: true, paidAt: true } },
          fulfillment: { select: { status: true, serviceCode: true, trackingCode: true, labelPrintedAt: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: orders.map(({ items, ...order }) => ({
        ...order,
        statusLabel: ORDER_STATUS_LABELS[order.status],
        units: items.reduce((sum, i) => sum + i.quantity, 0),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ---------------------------------------------------------------- detalhe e operacao

  async detail(number: string) {
    const order = await this.prisma.order.findUnique({ where: { number: number.toUpperCase() }, include: DETAIL_INCLUDE });
    if (!order) throw new NotFoundException("Pedido não encontrado.");
    return this.serialize(order);
  }

  async updateFulfillment(number: string, dto: UpdateFulfillmentDto) {
    await this.fulfillment.update(number, dto);
    return this.detail(number);
  }

  /** Cancelamento pela equipe: so pedido ainda nao pago (pago e estornado pelo fluxo de devolucao). */
  async cancel(number: string) {
    const order = await this.prisma.order.findUnique({
      where: { number: number.toUpperCase() },
      select: { id: true, number: true, status: true, timeline: true },
    });
    if (!order) throw new NotFoundException("Pedido não encontrado.");
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException("Só pedidos aguardando pagamento podem ser cancelados aqui. Pedido pago é estornado pela devolução.");
    }
    const timeline = Array.isArray(order.timeline) ? (order.timeline as object[]) : [];
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.CANCELLED,
        timeline: [...timeline, { status: OrderStatus.CANCELLED, at: new Date().toISOString(), note: "Cancelado pela loja" }] as object,
      },
    });
    this.audit.record({
      category: AuditCategory.ORDER,
      action: "order.status_changed",
      target: { type: "order", id: order.number },
      data: { from: order.status, to: OrderStatus.CANCELLED, source: "admin_cancel" },
    });
    return this.detail(order.number);
  }

  // ---------------------------------------------------------------- etiquetas

  sender() {
    const s = this.config.get<Record<string, string>>("sender") ?? {};
    const sender = {
      name: s.name ?? "",
      document: s.document ?? "",
      phone: s.phone ?? "",
      email: s.email ?? "",
      street: s.street ?? "",
      number: s.number ?? "",
      complement: s.complement ?? "",
      district: s.district ?? "",
      city: s.city ?? "",
      state: s.state ?? "",
      zipCode: s.zipCode ?? "",
    };
    const configured = Boolean(sender.name && sender.street && sender.number && sender.city && sender.state && sender.zipCode.length === 8);
    return { ...sender, configured };
  }

  /** Dados da etiqueta de endereco e da declaracao de conteudo; marca como impressa. */
  async labels(numbers: string[]) {
    const unique = [...new Set(numbers)];
    const orders = await this.prisma.order.findMany({ where: { number: { in: unique } }, include: DETAIL_INCLUDE });

    const missing = unique.filter((n) => !orders.some((o) => o.number === n));
    if (missing.length) throw new NotFoundException(`Pedido(s) não encontrado(s): ${missing.join(", ")}.`);
    const unpaid = orders.filter((o) => !WORKABLE.includes(o.status)).map((o) => o.number);
    if (unpaid.length) {
      throw new BadRequestException(`Etiqueta só para pedido pago. Fora do fluxo: ${unpaid.join(", ")}.`);
    }

    await this.fulfillment.markLabelsPrinted(orders.map((o) => o.id));
    const byNumber = new Map(orders.map((o) => [o.number, o]));

    return {
      sender: this.sender(),
      labels: unique.map((n) => {
        const o = byNumber.get(n)!;
        const f = o.fulfillment;
        return {
          number: o.number,
          createdAt: o.createdAt,
          serviceCode: (f?.serviceCode as "PAC" | "SEDEX" | null) ?? serviceCodeFor(o.shippingMethod),
          trackingCode: f?.trackingCode ?? null,
          recipient: {
            name: o.shippingRecipient,
            phone: o.customerPhone,
            document: o.customerDocument,
            street: o.shippingStreet,
            number: o.shippingNumber,
            complement: o.shippingComplement,
            district: o.shippingDistrict,
            city: o.shippingCity,
            state: o.shippingState,
            zipCode: o.shippingZipCode,
          },
          weightGrams: f?.packageWeightGrams ?? this.itemsWeight(o),
          dimensionsCm:
            f?.packageLengthCm && f.packageWidthCm && f.packageHeightCm
              ? { length: f.packageLengthCm, width: f.packageWidthCm, height: f.packageHeightCm }
              : null,
          declaredValueCents: Math.max(o.subtotalCents - o.discountCents, 0),
          invoiceNumber: o.invoice?.number ?? null,
          items: o.items.map((i) => ({
            description: `${i.productName} (${i.variantLabel})`,
            sku: i.sku,
            quantity: i.quantity,
            unitPriceCents: i.unitPriceCents,
            totalCents: i.totalCents,
          })),
        };
      }),
    };
  }

  // ---------------------------------------------------------------- lista de producao

  async productionList(stage: "to_produce" | "in_production") {
    const orders = await this.prisma.order.findMany({
      where: this.stageWhere(stage),
      orderBy: { createdAt: "asc" },
      select: {
        number: true,
        items: {
          select: {
            sku: true,
            productName: true,
            variantLabel: true,
            imageUrl: true,
            quantity: true,
            customText: true,
            variant: { select: { size: true, color: true, model: true } },
          },
        },
      },
    });

    const bySku = new Map<
      string,
      {
        sku: string;
        productName: string;
        variantLabel: string;
        size: string | null;
        color: string | null;
        model: string | null;
        imageUrl: string | null;
        quantity: number;
        customTexts: string[];
        orders: string[];
      }
    >();
    for (const order of orders) {
      for (const item of order.items) {
        const entry = bySku.get(item.sku) ?? {
          sku: item.sku,
          productName: item.productName,
          variantLabel: item.variantLabel,
          size: item.variant?.size ?? null,
          color: item.variant?.color ?? null,
          model: item.variant?.model ?? null,
          imageUrl: item.imageUrl,
          quantity: 0,
          customTexts: [],
          orders: [],
        };
        entry.quantity += item.quantity;
        if (item.customText) entry.customTexts.push(item.customText);
        if (!entry.orders.includes(order.number)) entry.orders.push(order.number);
        bySku.set(item.sku, entry);
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      orders: orders.map((o) => o.number),
      items: [...bySku.values()].sort(
        (a, b) => a.productName.localeCompare(b.productName, "pt-BR") || a.variantLabel.localeCompare(b.variantLabel, "pt-BR"),
      ),
    };
  }

  // ---------------------------------------------------------------- serializacao

  private itemsWeight(order: DetailOrder): number {
    return order.items.reduce((sum, i) => sum + (i.variant?.weightGrams ?? DEFAULT_ITEM_WEIGHT) * i.quantity, 0);
  }

  private serialize(order: DetailOrder) {
    const { items, couponId: _couponId, userId: _userId, ...rest } = order;
    return {
      ...rest,
      statusLabel: ORDER_STATUS_LABELS[order.status],
      timeline: Array.isArray(order.timeline) ? order.timeline : [],
      totalWeightGrams: this.itemsWeight(order),
      items: items.map(({ variant, variantId: _variantId, orderId: _orderId, ...item }) => ({
        ...item,
        size: variant?.size ?? null,
        color: variant?.color ?? null,
        model: variant?.model ?? null,
        weightGrams: variant?.weightGrams ?? null,
      })),
    };
  }
}
