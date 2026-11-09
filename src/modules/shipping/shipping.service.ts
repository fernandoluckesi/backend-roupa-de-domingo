import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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
  /** Tabela propria por regiao (Correios, enviado pela loja) */
  source: "tabela";
}

interface RegionRate {
  economico: { priceCents: number; days: number };
  expresso: { priceCents: number; days: number };
}

/**
 * Frete por primeiro digito do CEP e peso. A loja produz e posta pelos Correios:
 * economico = PAC, expresso = SEDEX. Prazo = producao (2-4 dias uteis) + transporte.
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

/** Faixas de CEP dos Correios (5 primeiros digitos) -> UF. */
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

@Injectable()
export class ShippingService {
  constructor(private readonly config: ConfigService) {}

  get freeShippingThresholdCents(): number {
    return this.config.get<number>(
      "business.freeShippingThresholdCents",
      24900,
    );
  }

  /** Cota o frete pela tabela propria (Correios). */
  async quote(
    zipCodeRaw: string,
    weightGrams: number,
    subtotalCents = 0,
  ): Promise<ShippingOption[]> {
    const zipCode = onlyDigits(zipCodeRaw);
    if (zipCode.length !== 8) {
      throw new BadRequestException("CEP invalido. Precisa ter 8 digitos.");
    }

    const freeByThreshold =
      subtotalCents > 0 && subtotalCents >= this.freeShippingThresholdCents;

    // Frete gratis acima do limite vale para a opcao mais barata (a loja absorve o custo)
    return this.quoteTable(zipCode, weightGrams).map((o) =>
      freeByThreshold && o.method === "economico" ? { ...o, priceCents: 0 } : o,
    );
  }

  async resolveOption(
    zipCode: string,
    weightGrams: number,
    subtotalCents: number,
    method: string,
  ): Promise<ShippingOption> {
    const options = await this.quote(zipCode, weightGrams, subtotalCents);
    return options.find((o) => o.method === method) ?? options[0];
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
      carrier: method === "expresso" ? "Correios (SEDEX)" : "Correios (PAC)",
      estimatedDays: base.days,
      minDays: base.days,
      maxDays: base.days,
      estimatedDeliveryDate: null,
      source: "tabela",
      priceCents: Math.round((base.priceCents * weightFactor) / 10) * 10,
    });

    return [
      build("economico", rate.economico, "PAC — chega quando chegar"),
      build("expresso", rate.expresso, "SEDEX — ansiedade tem preço"),
    ];
  }
}
