import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";
import {
  CreatePrintOrderInput,
  PrintOrderResult,
  PrintOrderStatus,
  PrintProvider,
} from "./print-provider.interface";

/** Status de pedido da API v1 da Printful -> status do dominio */
const STATUS_MAP: Record<string, PrintOrderStatus> = {
  draft: "QUEUED",
  pending: "QUEUED",
  onhold: "QUEUED",
  inprocess: "IN_PRODUCTION",
  partial: "IN_PRODUCTION",
  fulfilled: "SHIPPED",
  failed: "ERROR",
  canceled: "ERROR",
};

export function mapPrintfulStatus(raw?: string | null): PrintOrderStatus {
  return STATUS_MAP[(raw ?? "").toLowerCase()] ?? "QUEUED";
}

/** No Brasil a Printful so oferece STANDARD; economico/expresso caem nele. */
const SHIPPING_MAP: Record<string, string> = {
  economico: "STANDARD",
  expresso: "STANDARD",
};

/** A Printful exige a mascara: 000.000.000-00 (CPF) ou 00.000.000/0000-00 (CNPJ). */
export function formatTaxNumber(raw?: string | null): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (d.length === 14) {
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return null;
}

interface PrintfulShipment {
  tracking_number?: string | null;
  tracking_url?: string | null;
}

interface PrintfulOrder {
  id: number;
  external_id: string;
  status: string;
  shipments?: PrintfulShipment[];
  costs?: unknown;
}

/**
 * Driver da Printful (API v1, https://developers.printful.com/docs/).
 * Os itens referenciam sync variants da loja via external_variant_id
 * (ProductVariant.printProviderVariantId), entao arte e posicao ja estao na Printful.
 */
@Injectable()
export class PrintfulPrintProvider implements PrintProvider {
  readonly name = "printful";
  private readonly logger = new Logger(PrintfulPrintProvider.name);
  private readonly client: AxiosInstance;
  private readonly confirmOrders: boolean;

  constructor(config: ConfigService) {
    const storeId = config.get<string>("print.printful.storeId", "");
    const wantsConfirm = config.get<boolean>(
      "print.printful.confirmOrders",
      false,
    );
    // Com pagamento simulado qualquer um "aprova" um pedido: nunca cobrar a Printful nesse caso
    const realPayments = Boolean(config.get<string>("payment.accessToken"));
    this.confirmOrders = wantsConfirm && realPayments;
    if (wantsConfirm && !realPayments) {
      this.logger.warn(
        "PRINTFUL_CONFIRM_ORDERS=true ignorado: Mercado Pago nao configurado. Pedidos ficam em rascunho.",
      );
    }
    this.client = axios.create({
      baseURL:
        config.get<string>("print.apiUrl") || "https://api.printful.com",
      timeout: 20000,
      headers: {
        Authorization: `Bearer ${config.get<string>("print.apiKey", "")}`,
        "Content-Type": "application/json",
        ...(storeId ? { "X-PF-Store-Id": storeId } : {}),
      },
    });
  }

  async createOrder(input: CreatePrintOrderInput): Promise<PrintOrderResult> {
    const unmapped = input.items.filter((item) => !item.providerVariantId);
    if (unmapped.length) {
      throw new Error(
        `Itens sem variante Printful: ${unmapped.map((i) => i.sku).join(", ")}`,
      );
    }

    const taxNumber = formatTaxNumber(input.recipient.document);
    if (!taxNumber) {
      throw new Error(
        "CPF (11 digitos) ou CNPJ (14 digitos) do cliente e obrigatorio para envio no Brasil.",
      );
    }

    const r = input.recipient;
    const body = {
      external_id: input.externalId,
      shipping: SHIPPING_MAP[input.shippingMethod] ?? "STANDARD",
      recipient: {
        name: r.name,
        address1: `${r.street}, ${r.number}`,
        address2:
          [r.complement, r.district].filter(Boolean).join(" - ") || undefined,
        city: r.city,
        state_code: r.state.toUpperCase(),
        country_code: "BR",
        zip: r.zipCode,
        phone: r.phone ?? undefined,
        tax_number: taxNumber,
      },
      items: input.items.map((item) => ({
        external_variant_id: item.providerVariantId,
        quantity: item.quantity,
      })),
    };

    const order = await this.request<PrintfulOrder>(
      "post",
      `/orders${this.confirmOrders ? "?confirm=true" : ""}`,
      body,
    );

    this.logger.log(
      `Pedido ${input.externalId} criado na Printful (#${order.id}, ${order.status})`,
    );
    return this.toResult(order);
  }

  async getOrder(providerOrderId: string): Promise<PrintOrderResult> {
    return this.toResult(
      await this.request<PrintfulOrder>("get", `/orders/${providerOrderId}`),
    );
  }

  async cancelOrder(providerOrderId: string): Promise<void> {
    await this.request("delete", `/orders/${providerOrderId}`);
  }

  private async request<T>(
    method: "get" | "post" | "delete",
    url: string,
    data?: unknown,
  ): Promise<T> {
    try {
      const response = await this.client.request({ method, url, data });
      return response.data.result as T;
    } catch (error) {
      // A mensagem da Printful vai para Fulfillment.lastError, sem dados do token
      const detail = axios.isAxiosError(error)
        ? `${error.response?.status ?? "sem resposta"}: ${
            error.response?.data?.error?.message ??
            error.response?.data?.result ??
            error.message
          }`
        : (error as Error).message;
      throw new Error(`Printful ${method.toUpperCase()} ${url} -> ${detail}`);
    }
  }

  private toResult(order: PrintfulOrder): PrintOrderResult {
    const shipment = order.shipments?.find((s) => s.tracking_number);
    return {
      providerOrderId: String(order.id),
      status: mapPrintfulStatus(order.status),
      trackingCode: shipment?.tracking_number ?? null,
      trackingUrl: shipment?.tracking_url ?? null,
      draft: order.status === "draft",
      raw: order,
    };
  }
}
