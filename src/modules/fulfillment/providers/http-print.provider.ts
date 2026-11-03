import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";
import {
  CreatePrintOrderInput,
  PrintOrderResult,
  PrintOrderStatus,
  PrintProvider,
} from "./print-provider.interface";

const STATUS_MAP: Record<string, PrintOrderStatus> = {
  queued: "QUEUED",
  pending: "QUEUED",
  received: "QUEUED",
  printing: "IN_PRODUCTION",
  in_production: "IN_PRODUCTION",
  production: "IN_PRODUCTION",
  shipped: "SHIPPED",
  in_transit: "SHIPPED",
  delivered: "DELIVERED",
  error: "ERROR",
  failed: "ERROR",
  cancelled: "ERROR",
};

export function mapProviderStatus(raw?: string | null): PrintOrderStatus {
  return STATUS_MAP[(raw ?? "").toLowerCase()] ?? "QUEUED";
}

/**
 * Driver generico para um parceiro real de estamparia.
 * Ajuste o mapeamento de payload conforme o contrato do fornecedor escolhido.
 */
@Injectable()
export class HttpPrintProvider implements PrintProvider {
  readonly name = "http";
  private readonly logger = new Logger(HttpPrintProvider.name);
  private readonly client: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.client = axios.create({
      baseURL: this.config.get<string>("print.apiUrl") ?? "",
      timeout: 15000,
      headers: {
        Authorization: `Bearer ${this.config.get<string>("print.apiKey") ?? ""}`,
        "Content-Type": "application/json",
      },
    });
  }

  async createOrder(input: CreatePrintOrderInput): Promise<PrintOrderResult> {
    try {
      const { data } = await this.client.post("/orders", {
        external_id: input.externalId,
        shipping_method: input.shippingMethod,
        recipient: {
          name: input.recipient.name,
          phone: input.recipient.phone,
          document: input.recipient.document,
          zip_code: input.recipient.zipCode,
          street: input.recipient.street,
          number: input.recipient.number,
          complement: input.recipient.complement,
          district: input.recipient.district,
          city: input.recipient.city,
          state: input.recipient.state,
        },
        items: input.items.map((item) => ({
          sku: item.providerVariantId ?? item.sku,
          quantity: item.quantity,
          custom_text: item.customText,
          artwork_url: item.artworkUrl,
        })),
      });

      return {
        providerOrderId: data.id ?? data.order_id,
        status: mapProviderStatus(data.status),
        trackingCode: data.tracking_code ?? null,
        trackingUrl: data.tracking_url ?? null,
        raw: data,
      };
    } catch (error) {
      this.logger.error(
        `Falha ao criar print job: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(
        "A estamparia nao respondeu. O pedido fica na fila para reenvio.",
      );
    }
  }

  async getOrder(providerOrderId: string): Promise<PrintOrderResult> {
    const { data } = await this.client.get(`/orders/${providerOrderId}`);
    return {
      providerOrderId,
      status: mapProviderStatus(data.status),
      trackingCode: data.tracking_code ?? null,
      trackingUrl: data.tracking_url ?? null,
      raw: data,
    };
  }

  async cancelOrder(providerOrderId: string): Promise<void> {
    await this.client.post(`/orders/${providerOrderId}/cancel`);
  }
}
