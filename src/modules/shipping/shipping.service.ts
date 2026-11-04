import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";
import { onlyDigits } from "../../common/utils/order-number.util";

export interface ShippingOption {
  method: "economico" | "expresso";
  label: string;
  priceCents: number;
  /** Prazo maximo em dias (compatibilidade: era o unico campo de prazo) */
  estimatedDays: number;
  minDays: number;
  maxDays: number;
  /** Data maxima prevista (YYYY-MM-DD), quando a transportadora informa */
  estimatedDeliveryDate: string | null;
  carrier: string;
  /** "printful" = cotacao real da estamparia; "tabela" = estimativa local */
  source: "printful" | "tabela";
}

/** Item usado na cotacao real: sync variant da Printful + quantidade */
export interface ShippingQuoteItem {
  providerVariantId: string | null;
  quantity: number;
}

interface RegionRate {
  economico: { priceCents: number; days: number };
  expresso: { priceCents: number; days: number };
}

/**
 * Tabela de reserva por primeiro digito do CEP. So e usada quando a cotacao real
 * nao esta disponivel (sem token da Printful, itens sem variante Printful ou API fora).
 */
const RATES: Record<string, RegionRate> = {
  "0": { economico: { priceCents: 1490, days: 6 }, expresso: { priceCents: 2490, days: 2 } },
  "1": { economico: { priceCents: 1490, days: 7 }, expresso: { priceCents: 2490, days: 2 } },
  "2": { economico: { priceCents: 1790, days: 8 }, expresso: { priceCents: 2990, days: 3 } },
  "3": { economico: { priceCents: 1790, days: 8 }, expresso: { priceCents: 2990, days: 3 } },
  "4": { economico: { priceCents: 2290, days: 11 }, expresso: { priceCents: 3690, days: 4 } },
  "5": { economico: { priceCents: 2290, days: 12 }, expresso: { priceCents: 3690, days: 4 } },
  "6": { economico: { priceCents: 2690, days: 14 }, expresso: { priceCents: 4290, days: 5 } },
  "7": { economico: { priceCents: 2490, days: 11 }, expresso: { priceCents: 3990, days: 4 } },
  "8": { economico: { priceCents: 1890, days: 8 }, expresso: { priceCents: 3190, days: 3 } },
  "9": { economico: { priceCents: 1890, days: 9 }, expresso: { priceCents: 3190, days: 3 } },
};

/** Faixas de CEP dos Correios (5 primeiros digitos) -> UF. A Printful exige state_code. */
const CEP_RANGES: Array<[number, number, string]> = [
  [1000, 19999, "SP"],
  [20000, 28999, "RJ"],
  [29000, 29999, "ES"],
  [30000, 39999, "MG"],
  [40000, 48999, "BA"],
  [49000, 49999, "SE"],
  [50000, 56999, "PE"],
  [57000, 57999, "AL"],
  [58000, 58999, "PB"],
  [59000, 59999, "RN"],
  [60000, 63999, "CE"],
  [64000, 64999, "PI"],
  [65000, 65999, "MA"],
  [66000, 68899, "PA"],
  [68900, 68999, "AP"],
  [69000, 69299, "AM"],
  [69300, 69399, "RR"],
  [69400, 69899, "AM"],
  [69900, 69999, "AC"],
  [70000, 72799, "DF"],
  [72800, 72999, "GO"],
  [73000, 73699, "DF"],
  [73700, 76799, "GO"],
  [76800, 76999, "RO"],
  [77000, 77999, "TO"],
  [78000, 78899, "MT"],
  [79000, 79999, "MS"],
  [80000, 87999, "PR"],
  [88000, 89999, "SC"],
  [90000, 99999, "RS"],
];

export function stateFromZipCode(zipCode: string): string | null {
  const prefix = parseInt(onlyDigits(zipCode).slice(0, 5), 10);
  if (Number.isNaN(prefix)) return null;
  const range = CEP_RANGES.find(([min, max]) => prefix >= min && prefix <= max);
  return range ? range[2] : null;
}

/** id de frete da Printful -> metodo do dominio. No Brasil so existe STANDARD hoje. */
const PRINTFUL_METHODS: Record<string, ShippingOption["method"]> = {
  STANDARD: "economico",
  EXPRESS: "expresso",
};

interface PrintfulRate {
  id: string;
  name: string;
  rate: string;
  currency: string;
  minDeliveryDays?: number;
  maxDeliveryDays?: number;
  maxDeliveryDate?: string;
}

const CACHE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);
  private readonly printful: AxiosInstance | null;
  private readonly cache = new Map<
    string,
    { at: number; rates: PrintfulRate[] }
  >();

  constructor(private readonly config: ConfigService) {
    const apiKey = config.get<string>("print.apiKey", "");
    const enabled =
      config.get<string>("print.provider") === "printful" && Boolean(apiKey);
    const storeId = config.get<string>("print.printful.storeId", "");
    this.printful = enabled
      ? axios.create({
          baseURL:
            config.get<string>("print.apiUrl") || "https://api.printful.com",
          timeout: 8000,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            ...(storeId ? { "X-PF-Store-Id": storeId } : {}),
          },
        })
      : null;
  }

  get freeShippingThresholdCents(): number {
    return this.config.get<number>(
      "business.freeShippingThresholdCents",
      24900,
    );
  }

  /**
   * Cota o frete. Com a Printful ativa e itens com variante Printful, o valor e o prazo
   * vem da API dela (POST /shipping/rates). Senao, usa a tabela local.
   */
  async quote(
    zipCodeRaw: string,
    weightGrams: number,
    subtotalCents = 0,
    items: ShippingQuoteItem[] = [],
  ): Promise<ShippingOption[]> {
    const zipCode = onlyDigits(zipCodeRaw);
    if (zipCode.length !== 8) {
      throw new BadRequestException("CEP invalido. Precisa ter 8 digitos.");
    }

    const freeByThreshold =
      subtotalCents > 0 && subtotalCents >= this.freeShippingThresholdCents;

    const real = await this.quotePrintful(zipCode, items);
    const options = real ?? this.quoteTable(zipCode, weightGrams);

    // Frete gratis acima do limite vale para a opcao mais barata (a loja absorve o custo)
    return options.map((o) =>
      freeByThreshold && o.method === "economico" ? { ...o, priceCents: 0 } : o,
    );
  }

  async resolveOption(
    zipCode: string,
    weightGrams: number,
    subtotalCents: number,
    method: string,
    items: ShippingQuoteItem[] = [],
  ): Promise<ShippingOption> {
    const options = await this.quote(zipCode, weightGrams, subtotalCents, items);
    return options.find((o) => o.method === method) ?? options[0];
  }

  private async quotePrintful(
    zipCode: string,
    items: ShippingQuoteItem[],
  ): Promise<ShippingOption[] | null> {
    if (!this.printful) return null;
    const printfulItems = items.filter((i) => i.providerVariantId);
    if (!printfulItems.length) return null;

    const state = stateFromZipCode(zipCode);
    if (!state) return null;

    const zip = `${zipCode.slice(0, 5)}-${zipCode.slice(5)}`;
    const body = {
      recipient: { country_code: "BR", state_code: state, zip },
      items: printfulItems.map((i) => ({
        external_variant_id: i.providerVariantId,
        quantity: i.quantity,
      })),
      currency: "BRL",
      locale: "pt_BR",
    };
    const key = JSON.stringify(body);

    let rates = this.cachedRates(key);
    if (!rates) {
      try {
        const { data } = await this.printful.post<{ result: PrintfulRate[] }>(
          "/shipping/rates",
          body,
        );
        rates = data.result ?? [];
        this.cache.set(key, { at: Date.now(), rates });
      } catch (err) {
        const e = err as {
          response?: { status?: number; data?: { error?: { message?: string } } };
          message?: string;
        };
        this.logger.warn(
          `Cotacao Printful falhou (${e.response?.status ?? "sem resposta"}: ` +
            `${e.response?.data?.error?.message ?? e.message}). Usando tabela local.`,
        );
        return null;
      }
    }

    const options = rates
      .filter((r) => PRINTFUL_METHODS[r.id] && r.currency === "BRL")
      .map((r): ShippingOption => {
        const method = PRINTFUL_METHODS[r.id];
        const minDays = r.minDeliveryDays ?? r.maxDeliveryDays ?? 0;
        const maxDays = r.maxDeliveryDays ?? minDays;
        return {
          method,
          label:
            method === "economico"
              ? "Padrão — produzido sob demanda e enviado"
              : "Expresso — ansiedade tem preço",
          priceCents: Math.round(parseFloat(r.rate) * 100),
          estimatedDays: maxDays,
          minDays,
          maxDays,
          estimatedDeliveryDate: r.maxDeliveryDate ?? null,
          carrier: "Printful",
          source: "printful",
        };
      });

    return options.length ? options : null;
  }

  private cachedRates(key: string): PrintfulRate[] | null {
    const hit = this.cache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }
    return hit.rates;
  }

  private quoteTable(zipCode: string, weightGrams: number): ShippingOption[] {
    const rate = RATES[zipCode[0]] ?? RATES["1"];

    // Acima de 1kg cada quilo extra encarece 20% do frete base
    const extraKilos = Math.max(0, Math.ceil(weightGrams / 1000) - 1);
    const weightFactor = 1 + extraKilos * 0.2;

    const build = (
      method: ShippingOption["method"],
      base: { priceCents: number; days: number },
      label: string,
    ): ShippingOption => ({
      method,
      label,
      carrier: "Correios (via estamparia)",
      estimatedDays: base.days,
      minDays: base.days,
      maxDays: base.days,
      estimatedDeliveryDate: null,
      source: "tabela",
      priceCents: Math.round((base.priceCents * weightFactor) / 10) * 10,
    });

    return [
      build("economico", rate.economico, "Econômico — chega quando chegar"),
      build("expresso", rate.expresso, "Expresso — ansiedade tem preço"),
    ];
  }
}
