import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { existsSync } from "node:fs";
import maxmind, { type CityResponse, type Reader } from "maxmind";

export interface GeoLocation {
  country: string | null;
  region: string | null;
  city: string | null;
}

const EMPTY: GeoLocation = { country: null, region: null, city: null };

/** Cabecalho do Cloudflare: vem codificado (ex.: "S%C3%A3o Paulo") ou em latin1 cru. */
function header(headers: Record<string, unknown>, name: string): string | null {
  const raw = headers[name];
  if (typeof raw !== "string" || !raw || raw === "XX" || raw === "T1") return null;
  try {
    return decodeURIComponent(raw).slice(0, 80);
  } catch {
    return raw.slice(0, 80);
  }
}

/**
 * Localizacao aproximada (pais, estado, cidade) a partir do IP, na hora da visita.
 * O IP nao e guardado. Fontes, na ordem:
 *   1. Cabecalhos do Cloudflare (cf-ipcountry, cf-region, cf-ipcity): ative em
 *      Rules > Managed Transforms > "Add visitor location headers" (gratis).
 *   2. Banco GeoIP local (.mmdb do DB-IP Lite ou MaxMind GeoLite2), em GEOIP_DB_PATH.
 *      Baixe com `npm run geoip:download`.
 */
@Injectable()
export class GeoService implements OnModuleInit {
  private readonly logger = new Logger(GeoService.name);
  private reader: Reader<CityResponse> | null = null;

  async onModuleInit() {
    const path = process.env.GEOIP_DB_PATH ?? "data/geoip/dbip-city-lite.mmdb";
    if (!existsSync(path)) {
      this.logger.log("Sem banco GeoIP local: a cidade vem so dos cabecalhos do Cloudflare (ver ANALISE-DE-ACESSOS.md).");
      return;
    }
    try {
      this.reader = await maxmind.open<CityResponse>(path);
      this.logger.log(`Banco GeoIP carregado (${path}).`);
    } catch (error) {
      this.logger.warn(`Falha ao abrir o banco GeoIP ${path}: ${(error as Error).message}`);
    }
  }

  locate(headers: Record<string, unknown>, ip: string | undefined): GeoLocation {
    const cfCountry = header(headers, "cf-ipcountry");
    if (cfCountry) {
      return { country: cfCountry.toUpperCase(), region: header(headers, "cf-region"), city: header(headers, "cf-ipcity") };
    }
    if (!this.reader || !ip) return EMPTY;
    try {
      const clean = ip.replace(/^::ffff:/, "");
      if (!maxmind.validate(clean)) return EMPTY;
      const hit = this.reader.get(clean);
      if (!hit) return EMPTY;
      const name = (names?: Record<string, string>) => names?.["pt-BR"] ?? names?.en ?? null;
      return {
        country: hit.country?.iso_code ?? null,
        region: name(hit.subdivisions?.[0]?.names as Record<string, string> | undefined),
        city: name(hit.city?.names as Record<string, string> | undefined),
      };
    } catch {
      return EMPTY;
    }
  }
}
