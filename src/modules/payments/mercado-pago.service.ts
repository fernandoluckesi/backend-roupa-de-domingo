import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";
import { PaymentStatus } from "@prisma/client";
import { centsToUnit, prorateDiscount } from "../../common/utils/money.util";
import { onlyDigits } from "../../common/utils/order-number.util";
import { scrubCpfFromText } from "../../common/utils/privacy.util";

/** Campos do pagamento que guardamos (minimizacao, LGPD art. 6o, III): nada do pagador. */
const PAYMENT_FIELDS_KEPT = [
  "id",
  "status",
  "status_detail",
  "payment_method_id",
  "payment_type_id",
  "installments",
  "transaction_amount",
  "currency_id",
  "date_created",
  "date_approved",
  "date_last_updated",
  "external_reference",
  "live_mode",
] as const;

export function minimizePayment(data: Record<string, unknown>) {
  return Object.fromEntries(PAYMENT_FIELDS_KEPT.filter((k) => k in data).map((k) => [k, data[k]]));
}

const MP_BASE_URL = "https://api.mercadopago.com";

export interface PreferenceItemInput {
  id: string;
  title: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface CreatePreferenceInput {
  orderNumber: string;
  items: PreferenceItemInput[];
  discountCents: number;
  shippingCents: number;
  shippingLabel: string;
  payer: {
    name: string;
    email: string;
    phone?: string | null;
    document?: string | null;
    zipCode: string;
    street: string;
    number: string;
  };
}

export interface PreferenceResult {
  preferenceId: string;
  initPoint: string;
  provider: "mercadopago" | "mock";
  raw: unknown;
}

export interface PaymentSnapshot {
  providerPaymentId: string;
  orderNumber: string;
  status: PaymentStatus;
  rawStatus: string;
  method?: string | null;
  installments?: number | null;
  amountCents: number;
  raw: unknown;
}

/** Mapa de status do Mercado Pago para o nosso dominio. */
export function mapMpStatus(status?: string | null): PaymentStatus {
  switch ((status ?? "").toLowerCase()) {
    case "approved":
      return PaymentStatus.APPROVED;
    case "authorized":
    case "in_process":
    case "in_mediation":
    case "pending":
      return PaymentStatus.IN_PROCESS;
    case "rejected":
      return PaymentStatus.REJECTED;
    case "cancelled":
      return PaymentStatus.CANCELLED;
    case "refunded":
    case "charged_back":
      return PaymentStatus.REFUNDED;
    default:
      return PaymentStatus.PENDING;
  }
}

@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);
  private readonly client: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.client = axios.create({
      baseURL: MP_BASE_URL,
      timeout: 20000,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
    });
  }

  private get accessToken(): string {
    return this.config.get<string>("payment.accessToken") ?? "";
  }

  private get frontendUrl(): string {
    return this.config.get<string>("frontendUrl") ?? "http://localhost:5173";
  }

  get isConfigured(): boolean {
    return (
      this.config.get<string>("payment.driver") === "mercadopago" &&
      this.accessToken.length > 0
    );
  }

  async createPreference(
    input: CreatePreferenceInput,
  ): Promise<PreferenceResult> {
    const body = this.buildPreferenceBody(input);

    try {
      const { data } = await this.client.post("/checkout/preferences", body, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "X-Idempotency-Key": input.orderNumber,
        },
      });

      const useSandbox = this.config.get<boolean>("payment.useSandbox", true);
      const initPoint: string =
        (useSandbox ? data.sandbox_init_point : data.init_point) ??
        data.init_point ??
        data.sandbox_init_point;

      if (!initPoint) {
        throw new Error("Mercado Pago nao devolveu init_point.");
      }

      this.logger.log(
        `Preference criada para ${input.orderNumber}: ${data.id}`,
      );

      return {
        preferenceId: data.id,
        initPoint,
        provider: "mercadopago",
        raw: { id: data.id, date_created: data.date_created },
      };
    } catch (error) {
      const detail =
        axios.isAxiosError(error) && error.response
          ? JSON.stringify(error.response.data)
          : (error as Error).message;
      this.logger.error(`Falha ao criar preference: ${scrubCpfFromText(detail)}`);
      throw new InternalServerErrorException(
        "Nao foi possivel iniciar o pagamento no Mercado Pago. Tente novamente.",
      );
    }
  }

  /** Reconsulta o pagamento na API. O payload do webhook nunca e fonte de verdade. */
  async fetchPayment(paymentId: string): Promise<PaymentSnapshot> {
    const { data } = await this.client.get(`/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    return {
      providerPaymentId: String(data.id),
      orderNumber: data.external_reference,
      status: mapMpStatus(data.status),
      rawStatus: data.status,
      method: data.payment_method_id ?? data.payment_type_id ?? null,
      installments: data.installments ?? null,
      amountCents: Math.round((data.transaction_amount ?? 0) * 100),
      raw: minimizePayment(data),
    };
  }

  /**
   * Estorno total (sem amountCents) ou parcial no mesmo meio de pagamento
   * (devolucao por arrependimento/defeito). Idempotency key evita estorno duplo.
   */
  async refundPayment(paymentId: string, idempotencyKey: string, amountCents?: number) {
    const { data } = await this.client.post(
      `/v1/payments/${paymentId}/refunds`,
      amountCents ? { amount: centsToUnit(amountCents) } : {},
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "X-Idempotency-Key": idempotencyKey,
        },
      },
    );
    return { refundId: String(data.id), status: String(data.status ?? "approved") };
  }

  private buildPreferenceBody(input: CreatePreferenceInput) {
    // O Mercado Pago nao aceita item com valor negativo, entao o desconto
    // e rateado no preco unitario dos itens antes de montar a preference.
    const itemTotals = input.items.map((i) => i.unitPriceCents * i.quantity);
    const discounts = prorateDiscount(itemTotals, input.discountCents);

    const items = input.items.map((item, index) => {
      const total = itemTotals[index] - discounts[index];
      const unitPrice = total / item.quantity;
      return {
        id: item.id,
        title: item.title.slice(0, 250),
        description: item.description.slice(0, 250),
        category_id: "fashion",
        quantity: item.quantity,
        currency_id: "BRL",
        unit_price: centsToUnit(unitPrice),
      };
    });

    if (input.shippingCents > 0) {
      items.push({
        id: "SHIPPING",
        title: `Frete — ${input.shippingLabel}`,
        description: "Entrega pelos Correios",
        category_id: "services",
        quantity: 1,
        currency_id: "BRL",
        unit_price: centsToUnit(input.shippingCents),
      });
    }

    const [firstName, ...restName] = input.payer.name.trim().split(" ");
    const notificationUrl = this.config.get<string>("payment.notificationUrl");
    const expiration = new Date(Date.now() + 24 * 60 * 60 * 1000);

    return {
      external_reference: input.orderNumber,
      statement_descriptor: "ROUPADEDOMINGO",
      items,
      payer: {
        name: firstName,
        surname: restName.join(" ") || firstName,
        email: input.payer.email,
        ...(input.payer.phone
          ? {
              phone: {
                area_code: onlyDigits(input.payer.phone).slice(0, 2),
                number: onlyDigits(input.payer.phone).slice(2),
              },
            }
          : {}),
        ...(input.payer.document
          ? {
              identification: {
                type: "CPF",
                number: onlyDigits(input.payer.document),
              },
            }
          : {}),
        address: {
          zip_code: onlyDigits(input.payer.zipCode),
          street_name: input.payer.street,
          street_number: input.payer.number,
        },
      },
      back_urls: {
        success: `${this.frontendUrl}/pagamento/sucesso`,
        pending: `${this.frontendUrl}/pagamento/pendente`,
        failure: `${this.frontendUrl}/pagamento/falha`,
      },
      auto_return: "approved",
      // Parcelamento em ate 12x (o que a pagina do produto informa); juros, se houver, sao exibidos pelo MP
      payment_methods: { installments: 12 },
      ...(notificationUrl ? { notification_url: notificationUrl } : {}),
      expires: true,
      expiration_date_to: expiration.toISOString(),
      metadata: {
        order_number: input.orderNumber,
        source: "roupa-de-domingo-web",
      },
    };
  }
}
