import { redact, scrubCpfFromText } from "../../common/utils/privacy.util";
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { FulfillmentStatus, OrderStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  PRINT_PROVIDER,
  PrintOrderStatus,
  PrintProvider,
} from "./providers/print-provider.interface";

const FULFILLMENT_TO_ORDER: Partial<Record<PrintOrderStatus, OrderStatus>> = {
  IN_PRODUCTION: OrderStatus.IN_PRODUCTION,
  SHIPPED: OrderStatus.SHIPPED,
  DELIVERED: OrderStatus.DELIVERED,
};

@Injectable()
export class FulfillmentService {
  private readonly logger = new Logger(FulfillmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PRINT_PROVIDER) private readonly provider: PrintProvider,
  ) {}

  /** Chamado quando o pagamento e aprovado. Falha aqui nao derruba o pagamento. */
  async dispatchOrder(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { variant: { select: { printProviderVariantId: true } } },
        },
        fulfillment: true,
      },
    });

    if (!order) return;

    if (
      order.fulfillment &&
      order.fulfillment.status !== FulfillmentStatus.ERROR
    ) {
      this.logger.log(`Pedido ${order.number} ja tem print job. Ignorando.`);
      return;
    }

    try {
      const result = await this.provider.createOrder({
        externalId: order.number,
        shippingMethod: order.shippingMethod,
        recipient: {
          name: order.shippingRecipient,
          phone: order.customerPhone,
          document: order.customerDocument,
          zipCode: order.shippingZipCode,
          street: order.shippingStreet,
          number: order.shippingNumber,
          complement: order.shippingComplement,
          district: order.shippingDistrict,
          city: order.shippingCity,
          state: order.shippingState,
        },
        items: order.items.map((item) => ({
          sku: item.sku,
          providerVariantId: item.variant?.printProviderVariantId ?? null,
          productName: item.productName,
          variantLabel: item.variantLabel,
          quantity: item.quantity,
          customText: item.customText,
          artworkUrl: item.imageUrl,
        })),
      });

      await this.prisma.fulfillment.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          provider: this.provider.name,
          providerOrderId: result.providerOrderId,
          status: FulfillmentStatus.SENT,
          rawPayload: redact(result.raw) as object,
          sentAt: new Date(),
        },
        update: {
          providerOrderId: result.providerOrderId,
          status: FulfillmentStatus.SENT,
          lastError: null,
          rawPayload: redact(result.raw) as object,
          sentAt: new Date(),
        },
      });

      if (result.draft) {
        // Rascunho nao entra em producao: fica PAID ate alguem confirmar na Printful
        await this.appendTimeline(
          order.id,
          `Rascunho criado na estamparia (${result.providerOrderId}). Aguardando confirmacao.`,
        );
        this.logger.log(
          `Pedido ${order.number} criado como rascunho (${result.providerOrderId}).`,
        );
        return;
      }

      await this.advanceOrder(order.id, OrderStatus.IN_PRODUCTION, {
        note: `Enviado para a estamparia (${result.providerOrderId})`,
      });

      this.logger.log(`Pedido ${order.number} enviado para producao.`);
    } catch (error) {
      const message = (error as Error).message;
      this.logger.error(`Falha no print job de ${order.number}: ${scrubCpfFromText(message)}`);

      await this.prisma.fulfillment.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          provider: this.provider.name,
          status: FulfillmentStatus.ERROR,
          lastError: message,
        },
        update: { status: FulfillmentStatus.ERROR, lastError: message },
      });
    }
  }

  /** Reenvio manual de pedido pago que nao chegou na estamparia (status ERROR). */
  async redispatch(orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { number: orderNumber },
      include: { fulfillment: true },
    });
    if (!order) throw new NotFoundException("Pedido nao encontrado.");
    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException(
        `So pedidos pagos aguardando producao podem ser reenviados (status atual: ${order.status}).`,
      );
    }

    await this.dispatchOrder(order.id);
    return this.prisma.fulfillment.findUnique({ where: { orderId: order.id } });
  }

  /** Consulta o parceiro e sincroniza o estado local. */
  async syncOrder(orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { number: orderNumber },
      include: { fulfillment: true },
    });

    if (!order?.fulfillment?.providerOrderId) {
      throw new NotFoundException(
        "Esse pedido ainda nao tem producao iniciada.",
      );
    }

    const result = await this.provider.getOrder(
      order.fulfillment.providerOrderId,
    );
    await this.applyProviderStatus(order.id, result.status, {
      trackingCode: result.trackingCode,
      trackingUrl: result.trackingUrl,
      raw: result.raw,
    });

    return this.prisma.fulfillment.findUniqueOrThrow({
      where: { orderId: order.id },
    });
  }

  async handleWebhook(payload: {
    externalId: string;
    providerOrderId?: string;
    status: PrintOrderStatus;
    trackingCode?: string | null;
    trackingUrl?: string | null;
    raw: unknown;
  }) {
    const order = await this.prisma.order.findUnique({
      where: { number: payload.externalId },
      select: { id: true, number: true },
    });

    if (!order) {
      this.logger.warn(
        `Webhook da estamparia para pedido inexistente: ${payload.externalId}`,
      );
      return { received: true, matched: false };
    }

    await this.applyProviderStatus(order.id, payload.status, {
      trackingCode: payload.trackingCode,
      trackingUrl: payload.trackingUrl,
      raw: payload.raw,
      providerOrderId: payload.providerOrderId,
    });

    return { received: true, matched: true, order: order.number };
  }

  private async applyProviderStatus(
    orderId: string,
    status: PrintOrderStatus,
    extra: {
      trackingCode?: string | null;
      trackingUrl?: string | null;
      raw?: unknown;
      providerOrderId?: string;
    },
  ) {
    await this.prisma.fulfillment.upsert({
      where: { orderId },
      create: {
        orderId,
        provider: this.provider.name,
        providerOrderId: extra.providerOrderId,
        status: status as FulfillmentStatus,
        trackingCode: extra.trackingCode,
        trackingUrl: extra.trackingUrl,
        rawPayload: redact(extra.raw ?? {}) as object,
      },
      update: {
        status: status as FulfillmentStatus,
        ...(extra.providerOrderId
          ? { providerOrderId: extra.providerOrderId }
          : {}),
        ...(extra.trackingCode ? { trackingCode: extra.trackingCode } : {}),
        ...(extra.trackingUrl ? { trackingUrl: extra.trackingUrl } : {}),
        rawPayload: redact(extra.raw ?? {}) as object,
      },
    });

    const orderStatus = FULFILLMENT_TO_ORDER[status];
    if (orderStatus) {
      await this.advanceOrder(orderId, orderStatus, {
        trackingCode: extra.trackingCode ?? undefined,
        note: `Atualizacao da estamparia: ${status}`,
      });
    }
  }

  private async appendTimeline(orderId: string, note: string) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { status: true, timeline: true },
    });
    const timeline = Array.isArray(order.timeline) ? order.timeline : [];
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        timeline: [
          ...(timeline as object[]),
          { status: order.status, at: new Date().toISOString(), note },
        ] as object,
      },
    });
  }

  /** Nunca retrocede o status do pedido. */
  private async advanceOrder(
    orderId: string,
    status: OrderStatus,
    extra: { trackingCode?: string; note?: string },
  ) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { status: true, timeline: true },
    });

    const RANK: Record<string, number> = {
      PENDING: 0,
      PAID: 1,
      IN_PRODUCTION: 2,
      SHIPPED: 3,
      DELIVERED: 4,
    };

    if ((RANK[status] ?? 0) <= (RANK[order.status] ?? 0)) {
      if (extra.trackingCode) {
        await this.prisma.order.update({
          where: { id: orderId },
          data: { trackingCode: extra.trackingCode },
        });
      }
      return;
    }

    const timeline = Array.isArray(order.timeline) ? order.timeline : [];

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        ...(extra.trackingCode ? { trackingCode: extra.trackingCode } : {}),
        timeline: [
          ...(timeline as object[]),
          { status, at: new Date().toISOString(), note: extra.note ?? null },
        ] as object,
      },
    });
  }
}
