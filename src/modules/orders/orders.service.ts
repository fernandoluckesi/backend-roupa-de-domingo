import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CartOwner, CartService } from "../cart/cart.service";
import { PaymentsService } from "../payments/payments.service";
import { CreateOrderDto } from "./dto/create-order.dto";
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
      sentAt: true,
    },
  },
  coupon: { select: { code: true, description: true } },
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly payments: PaymentsService,
  ) {}

  /**
   * Checkout: converte o carrinho em pedido com snapshot de precos,
   * cria a preferencia de pagamento e devolve a URL de redirecionamento.
   */
  async checkout(owner: CartOwner, dto: CreateOrderDto) {
    const method = dto.shippingMethod ?? "economico";
    const zipCode = onlyDigits(dto.shippingAddress.zipCode);

    const cartSnapshot = await this.cart.getCart(owner, zipCode, method);

    if (cartSnapshot.isEmpty) {
      throw new BadRequestException(
        "Carrinho vazio. Difícil cobrar por boas intenções.",
      );
    }

    const { totals, items } = cartSnapshot;
    // Mesma cotacao usada nos totais do carrinho (evita uma segunda chamada a Printful)
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
        customerDocument: dto.customerDocument,
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
            note: "Pedido criado, aguardando pagamento",
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
        rawPayload: preference.raw as object,
      },
    });

    // Carrinho esvaziado só após a preferência existir, para não perder dados em caso de falha
    await this.cart.clear(owner);

    this.logger.log(`Pedido ${order.number} criado (${preference.provider}).`);

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

    // Pedido de usuário logado não pode ser lido por outro usuário autenticado.
    // Pedido de convidado fica acessível por quem tem o número (link de acompanhamento).
    if (order.userId && owner.userId && order.userId !== owner.userId) {
      throw new NotFoundException("Pedido nao encontrado.");
    }

    return this.serialize(order);
  }

  async cancel(number: string, owner: CartOwner) {
    const order = await this.prisma.order.findUnique({
      where: { number: number.toUpperCase() },
      select: { id: true, status: true, userId: true, timeline: true },
    });

    if (
      !order ||
      (order.userId && owner.userId && order.userId !== owner.userId)
    ) {
      throw new NotFoundException("Pedido nao encontrado.");
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        "Só é possível cancelar pedidos que ainda não foram pagos. Depois disso, a estampa já está rodando.",
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

  private serialize(order: any) {
    const statusLabels: Record<string, string> = {
      PENDING: "Aguardando pagamento",
      PAID: "Pagamento aprovado",
      IN_PRODUCTION: "Em produção na estamparia",
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
