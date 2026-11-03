import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CreatePrintOrderInput,
  PrintOrderResult,
  PrintOrderStatus,
  PrintProvider,
} from "./print-provider.interface";

interface MockRecord {
  providerOrderId: string;
  createdAt: number;
  input: CreatePrintOrderInput;
  trackingCode: string;
  cancelled: boolean;
}

/**
 * Simula a estamparia em desenvolvimento. O status evolui conforme o tempo,
 * para que a timeline do pedido fique visivel sem parceiro contratado.
 */
@Injectable()
export class MockPrintProvider implements PrintProvider {
  readonly name = "mock";
  private readonly logger = new Logger(MockPrintProvider.name);
  private readonly store = new Map<string, MockRecord>();

  constructor(private readonly config: ConfigService) {}

  private get speed(): number {
    return Math.max(0.1, this.config.get<number>("print.mockSpeed", 1));
  }

  async createOrder(input: CreatePrintOrderInput): Promise<PrintOrderResult> {
    const providerOrderId = `MOCK-${Math.random()
      .toString(36)
      .slice(2, 10)
      .toUpperCase()}`;

    const record: MockRecord = {
      providerOrderId,
      createdAt: Date.now(),
      input,
      trackingCode: `BR${Math.floor(Math.random() * 1e9)
        .toString()
        .padStart(9, "0")}BR`,
      cancelled: false,
    };

    this.store.set(providerOrderId, record);

    this.logger.log(
      `Print job criado para ${input.externalId} (${input.items.length} itens) -> ${providerOrderId}`,
    );

    return {
      providerOrderId,
      status: "QUEUED",
      raw: { ...record, simulated: true },
    };
  }

  async getOrder(providerOrderId: string): Promise<PrintOrderResult> {
    const record = this.store.get(providerOrderId);

    if (!record) {
      // Reinicio do processo perde o mapa em memoria; devolvemos um estado plausivel.
      return {
        providerOrderId,
        status: "IN_PRODUCTION",
        raw: { note: "registro nao encontrado no mock em memoria" },
      };
    }

    if (record.cancelled) {
      return { providerOrderId, status: "ERROR", raw: { cancelled: true } };
    }

    const elapsed = ((Date.now() - record.createdAt) / 1000) * this.speed;

    let status: PrintOrderStatus = "QUEUED";
    if (elapsed > 120) status = "DELIVERED";
    else if (elapsed > 60) status = "SHIPPED";
    else if (elapsed > 30) status = "IN_PRODUCTION";

    const shipped = status === "SHIPPED" || status === "DELIVERED";

    return {
      providerOrderId,
      status,
      trackingCode: shipped ? record.trackingCode : null,
      trackingUrl: shipped
        ? `https://rastreamento.correios.com.br/app/index.php?objeto=${record.trackingCode}`
        : null,
      raw: { elapsedSeconds: Math.round(elapsed), simulated: true },
    };
  }

  async cancelOrder(providerOrderId: string): Promise<void> {
    const record = this.store.get(providerOrderId);
    if (record) record.cancelled = true;
  }
}
