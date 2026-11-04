import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isValidMercadoPagoSignature } from "./mercado-pago-signature";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { FulfillmentService } from "../fulfillment/fulfillment.service";
import {
  CreatePreferenceInput,
  MercadoPagoService,
  PaymentSnapshot,
  PreferenceResult,
} from "./mercado-pago.service";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mercadoPago: MercadoPagoService,
    private readonly fulfillment: FulfillmentService,
  ) {}

  get driver(): string {
    return this.mercadoPago.isConfigured ? "mercadopago" : "mock";
  }

  /**
   * Cria a preferencia de pagamento e devolve a URL de redirecionamento.
   * Sem credenciais do Mercado Pago, cai no checkout simulado local.
   */
  async createCheckout(
    input: CreatePreferenceInput,
  ): Promise<PreferenceResult> {
    if (this.mercadoPago.isConfigured) {
      return this.mercadoPago.createPreference(input);
    }

    const frontendUrl = this.config.get<string>(
      "frontendUrl",
      "http://localhost:5173",
    );
    const preferenceId = `MOCK-PREF-${input.orderNumber}`;

    this.logger.warn(
      `MP_ACCESS_TOKEN ausente: usando checkout simulado para ${input.orderNumber}.`,
    );

    return {
      preferenceId,
      initPoint: `${frontendUrl}/pagamento/simulado/${input.orderNumber}`,
      provider: "mock",
      raw: { simulated: true, items: input.items.length },
    };
  }

  /** Entrada do webhook do Mercado Pago. */
  async handleMercadoPagoWebhook(
    payload: Record<string, any>,
    query: Record<string, any>,
    headers: { signature?: string; requestId?: string } = {},
  ) {
    // Com a assinatura secreta configurada, rejeita notificacoes que nao vieram do Mercado Pago.
    // Mesmo sem ela o pagamento e sempre reconsultado na API, entao um webhook forjado nao aprova nada.
    const secret = this.config.get<string>("payment.webhookSecret", "");
    if (secret) {
      const dataId = query?.["data.id"] ?? payload?.data?.id;
      const valid = isValidMercadoPagoSignature({
        secret,
        signatureHeader: headers.signature,
        requestId: headers.requestId,
        dataId: dataId != null ? String(dataId) : undefined,
      });
      if (!valid) {
        this.logger.warn("Webhook do Mercado Pago com assinatura invalida. Rejeitado.");
        throw new UnauthorizedException("Assinatura invalida.");
      }
    }

    const paymentId =
      payload?.data?.id ??
      payload?.resource ??
      query?.["data.id"] ??
      query?.id ??
      null;

    const type = payload?.type ?? payload?.topic ?? query?.type ?? query?.topic;

    if (!paymentId || (type && !String(type).includes("payment"))) {
      this.logger.log(`Webhook ignorado (type=${type}).`);
      return { received: true, processed: false };
    }

    if (!this.mercadoPago.isConfigured) {
      this.logger.warn(
        "Webhook recebido sem credenciais configuradas. Ignorando.",
      );
      return { received: true, processed: false };
    }

    try {
      const snapshot = await this.mercadoPago.fetchPayment(String(paymentId));
      await this.applyPaymentSnapshot(snapshot);
      return { received: true, processed: true, order: snapshot.orderNumber };
    } catch (error) {
      // Responder 200 evita retry infinito do MP por erro nosso de parsing
      this.logger.error(
        `Falha ao processar webhook: ${(error as Error).message}`,
      );
      return { received: true, processed: false };
    }
  }

  /** Aprovacao manual no driver mock, para testar o fluxo sem credenciais. */
  async simulate(
    orderNumber: string,
    outcome: "approve" | "reject" | "pending",
  ) {
    if (this.mercadoPago.isConfigured) {
      throw new BadRequestException(
        "Simulacao indisponivel: o Mercado Pago real esta configurado.",
      );
    }

    const order = await this.prisma.order.findUnique({
      where: { number: orderNumber.toUpperCase() },
      include: { payment: true },
    });

    if (!order) {
      throw new NotFoundException("Pedido nao encontrado.");
    }

    const statusMap = {
      approve: PaymentStatus.APPROVED,
      reject: PaymentStatus.REJECTED,
      pending: PaymentStatus.IN_PROCESS,
    } as const;

    await this.applyPaymentSnapshot({
      providerPaymentId: `MOCK-PAY-${Date.now()}`,
      orderNumber: order.number,
      status: statusMap[outcome],
      rawStatus: outcome,
      method: outcome === "approve" ? "pix" : "credit_card",
      installments: 1,
      amountCents: order.totalCents,
      raw: { simulated: true, outcome },
    });

    return this.getStatus(order.number);
  }

  async getStatus(orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { number: orderNumber.toUpperCase() },
      select: {
        number: true,
        status: true,
        totalCents: true,
        payment: {
          select: {
            status: true,
            method: true,
            installments: true,
            initPoint: true,
            provider: true,
            paidAt: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException("Pedido nao encontrado.");
    }

    return order;
  }

  /** Nucleo idempotente: aplica o estado do pagamento no pedido. */
  private async applyPaymentSnapshot(snapshot: PaymentSnapshot): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { number: snapshot.orderNumber },
      include: { payment: true },
    });

    if (!order) {
      this.logger.warn(
        `Pagamento sem pedido correspondente: ${snapshot.orderNumber}`,
      );
      return;
    }

    const alreadyProcessed =
      order.payment?.providerPaymentId === snapshot.providerPaymentId &&
      order.payment?.status === snapshot.status;

    if (alreadyProcessed) {
      this.logger.log(`Pagamento de ${order.number} ja processado. Ignorando.`);
      return;
    }

    await this.prisma.payment.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        provider: this.driver,
        providerPaymentId: snapshot.providerPaymentId,
        status: snapshot.status,
        method: snapshot.method,
        installments: snapshot.installments,
        amountCents: snapshot.amountCents || order.totalCents,
        rawPayload: snapshot.raw as object,
        paidAt: snapshot.status === PaymentStatus.APPROVED ? new Date() : null,
      },
      update: {
        providerPaymentId: snapshot.providerPaymentId,
        status: snapshot.status,
        method: snapshot.method,
        installments: snapshot.installments,
        rawPayload: snapshot.raw as object,
        ...(snapshot.status === PaymentStatus.APPROVED
          ? { paidAt: new Date() }
          : {}),
      },
    });

    const nextOrderStatus = this.orderStatusFor(snapshot.status, order.status);

    if (nextOrderStatus && nextOrderStatus !== order.status) {
      const timeline = Array.isArray(order.timeline)
        ? (order.timeline as object[])
        : [];
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: nextOrderStatus,
          timeline: [
            ...timeline,
            {
              status: nextOrderStatus,
              at: new Date().toISOString(),
              note: `Pagamento ${snapshot.rawStatus} (${this.driver})`,
            },
          ] as object,
        },
      });
    }

    if (snapshot.status === PaymentStatus.APPROVED) {
      if (order.couponId) {
        await this.prisma.coupon.update({
          where: { id: order.couponId },
          data: { usedCount: { increment: 1 } },
        });
      }
      // Falha na estamparia nao deve derrubar a confirmacao do pagamento
      await this.fulfillment.dispatchOrder(order.id).catch((error) => {
        this.logger.error(`dispatchOrder falhou: ${(error as Error).message}`);
      });
    }
  }

  private orderStatusFor(
    paymentStatus: PaymentStatus,
    currentOrderStatus: OrderStatus,
  ): OrderStatus | null {
    // Pedido que já está em produção ou além não volta por notificação de pagamento
    const advanced: OrderStatus[] = [
      OrderStatus.IN_PRODUCTION,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ];

    switch (paymentStatus) {
      case PaymentStatus.APPROVED:
        return advanced.includes(currentOrderStatus) ? null : OrderStatus.PAID;
      case PaymentStatus.REJECTED:
        return advanced.includes(currentOrderStatus)
          ? null
          : OrderStatus.FAILED;
      case PaymentStatus.CANCELLED:
        return advanced.includes(currentOrderStatus)
          ? null
          : OrderStatus.CANCELLED;
      case PaymentStatus.REFUNDED:
        return OrderStatus.REFUNDED;
      default:
        return null;
    }
  }
}
