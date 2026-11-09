import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { AuditCategory, AuditOutcome, OrderStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CartOwner, CartService } from "../cart/cart.service";
import { PaymentsService } from "../payments/payments.service";
import { MailService } from "../mail/mail.service";
import { ConsentService } from "../privacy/consent.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { maskCpf, maskEmail } from "../../common/utils/privacy.util";
import {
  generateOrderNumber,
  onlyDigits,
} from "../../common/utils/order-number.util";

const ORDER_INCLUDE = {
  items: true,
  payment: {
    select: {
      status: true,
      method: true,
      installments: true,
      initPoint: true,
      provider: true,
      paidAt: true,
      amountCents: true,
    },
  },
  fulfillment: {
    select: {
      status: true,
      trackingCode: true,
      trackingUrl: true,
      shippedAt: true,
      deliveredAt: true,
      serviceCode: true,
    },
  },
  coupon: { select: { code: true, description: true } },
  invoice: { select: { status: true, number: true, series: true, accessKey: true, pdfUrl: true, issuedAt: true } },
  returns: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      protocol: true,
      type: true,
      status: true,
      reason: true,
      items: true,
      reverseCode: true,
      refundCents: true,
      resolution: true,
      timeline: true,
      createdAt: true,
    },
  },
} satisfies Prisma.OrderInclude;

/** Antifraude simples: pedidos pendentes por pessoa na ultima hora */
const MAX_PENDING_ORDERS_PER_HOUR = 5;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly payments: PaymentsService,
    private readonly mail: MailService,
    private readonly consents: ConsentService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Checkout: converte o carrinho em pedido com snapshot de precos,
   * cria a preferencia de pagamento e devolve a URL de redirecionamento.
   */
  async checkout(owner: CartOwner, dto: CreateOrderDto) {
    const method = dto.shippingMethod ?? "economico";
    const zipCode = onlyDigits(dto.shippingAddress.zipCode);

    // Limite de tentativas: muitos pedidos abertos em pouco tempo costuma ser teste de cartao
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recentPending = await this.prisma.order.count({
      where: {
        status: { in: [OrderStatus.PENDING, OrderStatus.FAILED] },
        createdAt: { gte: since },
        OR: [
          ...(owner.userId ? [{ userId: owner.userId }] : []),
          { customerEmail: dto.customerEmail.toLowerCase() },
        ],
      },
    });
    if (recentPending >= MAX_PENDING_ORDERS_PER_HOUR) {
      this.audit.record({
        category: AuditCategory.ORDER,
        action: "order.checkout_blocked",
        outcome: AuditOutcome.FAILURE,
        data: { reason: "too_many_pending_orders", recentPending, guest: !owner.userId },
      });
      throw new BadRequestException(
        "Muitos pedidos abertos em pouco tempo. Conclua ou cancele um pedido pendente, ou tente de novo em 1 hora.",
      );
    }

    const cartSnapshot = await this.cart.getCart(owner, zipCode, method);

    if (cartSnapshot.isEmpty) {
      throw new BadRequestException(
        "Carrinho vazio. Difícil cobrar por boas intenções.",
      );
    }

    const { totals, items } = cartSnapshot;
    // Mesma cotacao usada nos totais do carrinho
    const shippingOption = cartSnapshot.shipping.selected;
    if (!shippingOption) {
      throw new BadRequestException("Nao foi possivel cotar o frete para esse CEP.");
    }
    const shippingCents = totals.shippingCents;

    const couponRecord = cartSnapshot.coupon
      ? await this.prisma.coupon.findUnique({
          where: { code: cartSnapshot.coupon.code },
          select: { id: true },
        })
      : null;

    const number = await this.generateUniqueNumber();

    const order = await this.prisma.order.create({
      data: {
        number,
        userId: owner.userId ?? null,
        status: OrderStatus.PENDING,
        customerName: dto.customerName,
        customerEmail: dto.customerEmail.toLowerCase(),
        customerPhone: dto.customerPhone,
        customerDocument: dto.customerDocument ? onlyDigits(dto.customerDocument) : undefined,
        shippingRecipient: dto.shippingAddress.recipient,
        shippingZipCode: zipCode,
        shippingStreet: dto.shippingAddress.street,
        shippingNumber: dto.shippingAddress.number,
        shippingComplement: dto.shippingAddress.complement,
        shippingDistrict: dto.shippingAddress.district,
        shippingCity: dto.shippingAddress.city,
        shippingState: dto.shippingAddress.state.toUpperCase(),
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        shippingCents,
        totalCents: totals.totalCents,
        couponId: couponRecord?.id ?? null,
        shippingMethod: method,
        estimatedDays: shippingOption.estimatedDays,
        notes: dto.notes,
        timeline: [
          {
            status: OrderStatus.PENDING,
            at: new Date().toISOString(),
            note: `Pedido criado, aguardando pagamento. Termos v${dto.termsVersion} aceitos no checkout.`,
          },
        ] as object,
        items: {
          create: items.map((item) => ({
            variantId: item.variantId,
            productName: item.productName,
            variantLabel: item.variantLabel,
            sku: item.sku,
            unitPriceCents: item.unitPriceCents,
            quantity: item.quantity,
            totalCents: item.totalCents,
            imageUrl: item.imageUrl,
            customText: item.customText,
          })),
        },
      },
      include: ORDER_INCLUDE,
    });

    const preference = await this.payments.createCheckout({
      orderNumber: order.number,
      discountCents: totals.discountCents,
      shippingCents,
      shippingLabel: shippingOption.label,
      items: items.map((item) => ({
        id: item.sku,
        title: item.productName,
        description: item.variantLabel,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
      })),
      payer: {
        name: dto.customerName,
        email: dto.customerEmail,
        phone: dto.customerPhone,
        document: dto.customerDocument,
        zipCode,
        street: dto.shippingAddress.street,
        number: dto.shippingAddress.number,
      },
    });

    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: preference.provider,
        preferenceId: preference.preferenceId,
        amountCents: order.totalCents,
        initPoint: preference.initPoint,
        // Minimizacao (LGPD art. 6o, III): so o necessario para conciliar, sem os dados do pagador
        rawPayload: { provider: preference.provider, preferenceId: preference.preferenceId } as object,
      },
    });

    // Aceite dos termos no checkout (vale tambem para convidado)
    await this.consents
      .record({ userId: owner.userId, sessionId: owner.sessionId, kind: "terms", version: dto.termsVersion, granted: true, details: { orderNumber: order.number } })
      .catch(() => undefined);

    // Confirmacao por e-mail com o resumo do contrato (Decreto 7.962/2013, art. 4o, III e IV)
    void this.mail.sendOrderConfirmation(order);

    // Carrinho esvaziado só após a preferência existir, para não perder dados em caso de falha
    await this.cart.clear(owner);

    this.logger.log(`Pedido ${order.number} criado (${preference.provider}).`);
    this.audit.record({
      category: AuditCategory.ORDER,
      action: "order.created",
      target: { type: "order", id: order.number },
      data: {
        guest: !owner.userId,
        items: items.length,
        units: items.reduce((sum, item) => sum + item.quantity, 0),
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        shippingCents,
        totalCents: totals.totalCents,
        coupon: cartSnapshot.coupon?.code ?? null,
        shippingMethod: method,
        shippingState: dto.shippingAddress.state.toUpperCase(),
        termsVersion: dto.termsVersion,
      },
    });
    this.audit.record({
      category: AuditCategory.PAYMENT,
      action: "payment.checkout_created",
      target: { type: "order", id: order.number },
      data: { provider: preference.provider, preferenceId: preference.preferenceId, amountCents: order.totalCents },
    });

    return {
      order: this.serialize({ ...order, payment: null }),
      payment: {
        provider: preference.provider,
        preferenceId: preference.preferenceId,
        simulated: preference.provider === "mock",
      },
      paymentUrl: preference.initPoint,
    };
  }

  async listMine(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return orders.map((order) => this.serialize(order));
  }

  async findByNumber(number: string, owner: CartOwner) {
    const order = await this.prisma.order.findUnique({
      where: { number: number.toUpperCase() },
      include: ORDER_INCLUDE,
    });

    if (!order) {
      throw new NotFoundException("Pedido nao encontrado.");
    }

    // Pedido de conta: so o dono le (anonimo ou outro usuario recebe 404, sem vazar dados).
    // Pedido de convidado: acompanhamento pelo numero, mas com os dados pessoais mascarados.
    if (order.userId) {
      if (order.userId !== owner.userId) throw new NotFoundException("Pedido nao encontrado.");
      return this.serialize(order);
    }
    return this.maskPersonalData(this.serialize(order));
  }

  async cancel(number: string, owner: CartOwner) {
    const order = await this.prisma.order.findUnique({
      where: { number: number.toUpperCase() },
      select: { id: true, number: true, status: true, userId: true, timeline: true },
    });

    if (!order || (order.userId && order.userId !== owner.userId)) {
      throw new NotFoundException("Pedido nao encontrado.");
    }

    if (order.status !== OrderStatus.PENDING) {
      this.audit.record({
        category: AuditCategory.ORDER,
        action: "order.cancel_failed",
        outcome: AuditOutcome.FAILURE,
        target: { type: "order", id: order.number },
        data: { reason: "not_pending", status: order.status },
      });
      throw new BadRequestException(
        "Só é possível cancelar pedidos que ainda não foram pagos. Depois disso, ele já entrou na fila de produção.",
      );
    }

    const timeline = Array.isArray(order.timeline)
      ? (order.timeline as object[])
      : [];

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.CANCELLED,
        timeline: [
          ...timeline,
          {
            status: OrderStatus.CANCELLED,
            at: new Date().toISOString(),
            note: "Cancelado pelo cliente",
          },
        ] as object,
      },
      include: ORDER_INCLUDE,
    });
    this.audit.record({
      category: AuditCategory.ORDER,
      action: "order.status_changed",
      target: { type: "order", id: order.number },
      data: { from: order.status, to: OrderStatus.CANCELLED, source: "customer_cancel", guest: !order.userId },
    });

    return this.serialize(updated);
  }

  private async generateUniqueNumber(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = generateOrderNumber();
      const exists = await this.prisma.order.findUnique({
        where: { number: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
    }
    return `RD-${Date.now().toString(36).toUpperCase()}`;
  }

  /** Visao publica (link de acompanhamento de convidado): sem CPF, telefone, e-mail ou endereco completo. */
  private maskPersonalData(order: any) {
    return {
      ...order,
      customerEmail: maskEmail(order.customerEmail),
      customerPhone: order.customerPhone ? "***" : null,
      customerDocument: order.customerDocument ? maskCpf(order.customerDocument) : null,
      shippingStreet: "***",
      shippingNumber: "***",
      shippingComplement: null,
      notes: null,
    };
  }

  private serialize(order: any) {
    const statusLabels: Record<string, string> = {
      PENDING: "Aguardando pagamento",
      PAID: "Pagamento aprovado",
      IN_PRODUCTION: "Em produção",
      SHIPPED: "Enviado",
      DELIVERED: "Entregue",
      CANCELLED: "Cancelado",
      REFUNDED: "Estornado",
      FAILED: "Pagamento recusado",
    };

    return {
      ...order,
      statusLabel: statusLabels[order.status] ?? order.status,
      timeline: Array.isArray(order.timeline) ? order.timeline : [],
    };
  }
}
