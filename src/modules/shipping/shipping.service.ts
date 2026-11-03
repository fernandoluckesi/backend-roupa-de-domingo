import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { onlyDigits } from "../../common/utils/order-number.util";

export interface ShippingOption {
  method: "economico" | "expresso";
  label: string;
  priceCents: number;
  estimatedDays: number;
  carrier: string;
}

interface RegionRate {
  region: string;
  economico: { priceCents: number; days: number };
  expresso: { priceCents: number; days: number };
}

/** Tabela por primeiro digito do CEP. Simplificada de proposito: o parceiro real cota via API. */
const RATES: Record<string, RegionRate> = {
  "0": {
    region: "SP",
    economico: { priceCents: 1490, days: 6 },
    expresso: { priceCents: 2490, days: 2 },
  },
  "1": {
    region: "SP",
    economico: { priceCents: 1490, days: 7 },
    expresso: { priceCents: 2490, days: 2 },
  },
  "2": {
    region: "RJ/ES",
    economico: { priceCents: 1790, days: 8 },
    expresso: { priceCents: 2990, days: 3 },
  },
  "3": {
    region: "MG",
    economico: { priceCents: 1790, days: 8 },
    expresso: { priceCents: 2990, days: 3 },
  },
  "4": {
    region: "BA/SE",
    economico: { priceCents: 2290, days: 11 },
    expresso: { priceCents: 3690, days: 4 },
  },
  "5": {
    region: "PE/AL/PB/RN",
    economico: { priceCents: 2290, days: 12 },
    expresso: { priceCents: 3690, days: 4 },
  },
  "6": {
    region: "CE/PI/MA/Norte",
    economico: { priceCents: 2690, days: 14 },
    expresso: { priceCents: 4290, days: 5 },
  },
  "7": {
    region: "DF/GO/MT/MS",
    economico: { priceCents: 2490, days: 11 },
    expresso: { priceCents: 3990, days: 4 },
  },
  "8": {
    region: "PR/SC",
    economico: { priceCents: 1890, days: 8 },
    expresso: { priceCents: 3190, days: 3 },
  },
  "9": {
    region: "RS",
    economico: { priceCents: 1890, days: 9 },
    expresso: { priceCents: 3190, days: 3 },
  },
};

@Injectable()
export class ShippingService {
  constructor(private readonly config: ConfigService) {}

  get freeShippingThresholdCents(): number {
    return this.config.get<number>(
      "business.freeShippingThresholdCents",
      24900,
    );
  }

  quote(
    zipCodeRaw: string,
    weightGrams: number,
    subtotalCents = 0,
  ): ShippingOption[] {
    const zipCode = onlyDigits(zipCodeRaw);
    if (zipCode.length !== 8) {
      throw new BadRequestException("CEP invalido. Precisa ter 8 digitos.");
    }

    const rate = RATES[zipCode[0]] ?? RATES["1"];

    // Acima de 1kg cada quilo extra encarece 20% do frete base
    const extraKilos = Math.max(0, Math.ceil(weightGrams / 1000) - 1);
    const weightFactor = 1 + extraKilos * 0.2;

    const freeByThreshold =
      subtotalCents > 0 && subtotalCents >= this.freeShippingThresholdCents;

    const build = (
      method: ShippingOption["method"],
      base: { priceCents: number; days: number },
      label: string,
    ): ShippingOption => ({
      method,
      label,
      carrier: "Correios (via estamparia)",
      estimatedDays: base.days,
      priceCents:
        freeByThreshold && method === "economico"
          ? 0
          : Math.round((base.priceCents * weightFactor) / 10) * 10,
    });

    return [
      build("economico", rate.economico, "Econômico — chega quando chegar"),
      build("expresso", rate.expresso, "Expresso — ansiedade tem preço"),
    ];
  }

  resolveOption(
    zipCode: string,
    weightGrams: number,
    subtotalCents: number,
    method: string,
  ): ShippingOption {
    const options = this.quote(zipCode, weightGrams, subtotalCents);
    return options.find((o) => o.method === method) ?? options[0];
  }
}
