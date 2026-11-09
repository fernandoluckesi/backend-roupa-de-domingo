import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isValidMercadoPagoSignature } from "./mercado-pago-signature";
import { AuditActorType, AuditCategory, AuditOutcome, OrderStatus, PaymentStatus } from "@prisma/client";
import { AuditEvent, AuditService } from "../audit/audit.service";
import { scrubCpfFromText } from "../../common/utils/privacy.util";
import { PrismaService } from "../../prisma/prisma.service";
import { FulfillmentService } from "../fulfillment/fulfillment.service";
import { MailService } from "../mail/mail.service";
import { InvoicesService } from "../invoices/invoices.module";
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
    private readonly mail: MailService,
    private readonly invoices: InvoicesService,
    private readonly audit: AuditService,
  ) {}

  private static readonly PROVIDER_ACTOR = { type: AuditActorType.PROVIDER, id: "mercadopago" };

  /** Quem mudou o pagamento: o webhook do Mercado Pago ou a simulacao local (quem chamou). */
  private actorFor(origin: "webhook" | "simulation"): AuditEvent["actor"] {
    return origin === "webhook" ? PaymentsService.PROVIDER_ACTOR : undefined;
  }

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
        this.audit.record({
          category: AuditCategory.PAYMENT,
          action: "payment.webhook.rejected",
          outcome: AuditOutcome.FAILURE,
          actor: PaymentsService.PROVIDER_ACTOR,
          data: { reason: "invalid_signature", dataId: dataId != null ? String(dataId) : null },
        });
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
      await this.applyPaymentSnapshot(snapshot, "webhook");
      return { received: true, processed: true, order: snapshot.orderNumber };
    } catch (error) {
      // Responder 200 evita retry infinito do MP por erro nosso de parsing
      this.logger.error(
        `Falha ao processar webhook: ${(error as Error).message}`,
      );
      this.audit.record({
        category: AuditCategory.PAYMENT,
        action: "payment.webhook.failed",
        outcome: AuditOutcome.FAILURE,
        actor: PaymentsService.PROVIDER_ACTOR,
        data: { paymentId: String(paymentId), error: scrubCpfFromText((error as Error).message).slice(0, 300) },
      });
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
    }, "simulation");

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
  private async applyPaymentSnapshot(snapshot: PaymentSnapshot, origin: "webhook" | "simulation"): Promise<void> {
    const actor = this.actorFor(origin);
    const order = await this.prisma.order.findUnique({
      where: { number: snapshot.orderNumber },
      include: { payment: true },
    });

    if (!order) {
      this.logger.warn(
        `Pagamento sem pedido correspondente: ${snapshot.orderNumber}`,
      );
      this.audit.record({
        category: AuditCategory.PAYMENT,
        action: "payment.orphaned",
        outcome: AuditOutcome.FAILURE,
        actor,
        target: { type: "order", id: snapshot.orderNumber },
        data: { providerPaymentId: snapshot.providerPaymentId, status: snapshot.status },
      });
      return;
    }

    const alreadyProcessed =
      order.payment?.providerPaymentId === snapshot.providerPaymentId &&
      order.payment?.status === snapshot.status;

    if (alreadyProcessed) {
      this.logger.log(`Pagamento de ${order.number} ja processado. Ignorando.`);
      return;
    }

    // Trava propria: aprovado com valor diferente do pedido nao libera producao
    // (tolerancia de 1 centavo para arredondamento do rateio de desconto)
    const amountMismatch =
      snapshot.status === PaymentStatus.APPROVED &&
      Math.abs(snapshot.amountCents - order.totalCents) > 1;
    if (amountMismatch) {
      this.logger.error(
        `Valor pago divergente em ${order.number}: pago ${snapshot.amountCents}, pedido ${order.totalCents}. Pedido NAO liberado.`,
      );
      this.audit.record({
        category: AuditCategory.PAYMENT,
        action: "payment.amount_mismatch",
        outcome: AuditOutcome.FAILURE,
        actor,
        target: { type: "order", id: order.number },
        data: { paidCents: snapshot.amountCents, orderTotalCents: order.totalCents, providerPaymentId: snapshot.providerPaymentId },
      });
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
    this.audit.record({
      category: AuditCategory.PAYMENT,
      action: "payment.status_changed",
      outcome: snapshot.status === PaymentStatus.REJECTED ? AuditOutcome.FAILURE : AuditOutcome.SUCCESS,
      actor,
      target: { type: "order", id: order.number },
      data: {
        from: order.payment?.status ?? null,
        to: snapshot.status,
        providerStatus: snapshot.rawStatus,
        providerPaymentId: snapshot.providerPaymentId,
        method: snapshot.method,
        installments: snapshot.installments,
        amountCents: snapshot.amountCents,
        origin,
      },
    });

    if (amountMismatch) {
      const timeline = Array.isArray(order.timeline) ? (order.timeline as object[]) : [];
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          timeline: [
            ...timeline,
            {
              status: order.status,
              at: new Date().toISOString(),
              note: "Pagamento com valor divergente do pedido: em análise manual",
            },
          ] as object,
        },
      });
      return;
    }

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
      this.audit.record({
        category: AuditCategory.ORDER,
        action: "order.status_changed",
        actor,
        target: { type: "order", id: order.number },
        data: { from: order.status, to: nextOrderStatus, source: "payment", paymentStatus: snapshot.status },
      });
    }

    if (snapshot.status === PaymentStatus.APPROVED) {
      if (order.couponId) {
        await this.prisma.coupon.update({
          where: { id: order.couponId },
          data: { usedCount: { increment: 1 } },
        });
        this.audit.record({
          category: AuditCategory.ORDER,
          action: "order.coupon_redeemed",
          actor,
          target: { type: "order", id: order.number },
          data: { couponId: order.couponId, discountCents: order.discountCents },
        });
      }
      void this.mail.sendPaymentApproved(order.customerEmail, order.customerName, order.number);
      await this.invoices.issueForOrder(order.id).catch((error) => {
        this.logger.error(`Emissao de nota falhou: ${(error as Error).message}`);
      });
      // Entra na fila de producao do backoffice; falha aqui nao derruba a confirmacao do pagamento
      await this.fulfillment.enqueue(order.id).catch((error) => {
        this.logger.error(`Fila de producao falhou para ${order.number}: ${(error as Error).message}`);
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
