import type { CollectDto } from "./dto/analytics.dto";

export interface Classified {
  channel: string;
  source: string;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  referrerHost: string | null;
}

/** Canais que contam como rede social no painel. */
export const SOCIAL_CHANNELS = ["instagram", "facebook", "tiktok", "whatsapp", "youtube", "x", "threads", "pinterest", "linkedin", "kwai"];

/** Destino do QR Code impresso nas pecas. */
export const QR_PATH = "/segredo";

const ALIASES: Record<string, string> = {
  ig: "instagram",
  insta: "instagram",
  instagram: "instagram",
  fb: "facebook",
  face: "facebook",
  facebook: "facebook",
  meta: "facebook",
  tt: "tiktok",
  tiktok: "tiktok",
  wpp: "whatsapp",
  zap: "whatsapp",
  whats: "whatsapp",
  whatsapp: "whatsapp",
  yt: "youtube",
  youtube: "youtube",
  twitter: "x",
  x: "x",
  threads: "threads",
  pinterest: "pinterest",
  linkedin: "linkedin",
  kwai: "kwai",
  google: "google",
  bing: "bing",
  email: "email",
  newsletter: "email",
  qr: "qrcode",
  qrcode: "qrcode",
};

const REFERRERS: Array<[RegExp, string]> = [
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "facebook"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)(wa\.me|whatsapp\.com|whatsapp\.net)$/, "whatsapp"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "x"],
  [/(^|\.)threads\.(net|com)$/, "threads"],
  [/(^|\.)pinterest\.[a-z.]+$/, "pinterest"],
  [/(^|\.)linkedin\.com$|(^|\.)lnkd\.in$/, "linkedin"],
  [/(^|\.)kwai\.com$/, "kwai"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)(mail\.google\.com|outlook\.live\.com|mail\.yahoo\.com)$/, "email"],
];

/** Caminho sem query string nem barra no final. */
export function cleanPath(path: string | undefined): string {
  return (path ?? "/").split(/[?#]/)[0].replace(/\/+$/, "").slice(0, 200) || "/";
}

/** Texto livre de campanha: minusculo, sem acento, so letras, numeros, - e _. */
export function slug(value: string | undefined | null, max = 80): string | null {
  if (!value) return null;
  const clean = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
  return clean || null;
}

function hostOf(referrer?: string): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * De onde a pessoa veio. Ordem: QR Code > UTM > id de clique do anuncio > dominio de origem > direto.
 * `siteHosts`: dominios da propria loja (navegacao interna nao e origem).
 */
export function classifyVisit(dto: CollectDto, siteHosts: string[]): Classified {
  const referrerHost = hostOf(dto.referrer);
  const external = referrerHost && !siteHosts.includes(referrerHost) ? referrerHost : null;
  const utmSource = slug(dto.utmSource);
  const medium = slug(dto.utmMedium);
  const campaign = slug(dto.utmCampaign, 120);
  const content = slug(dto.utmContent, 120);
  const path = cleanPath(dto.path);

  if (path === QR_PATH || (utmSource && ALIASES[utmSource] === "qrcode")) {
    return {
      channel: "qrcode",
      source: "qrcode",
      medium: medium ?? "impresso",
      campaign,
      content: slug(dto.qr, 40) ?? content ?? "sem-local",
      referrerHost: external,
    };
  }

  if (utmSource) {
    return { channel: ALIASES[utmSource] ?? "campanha", source: utmSource, medium, campaign, content, referrerHost: external };
  }

  const fromReferrer = external ? REFERRERS.find(([re]) => re.test(external))?.[1] : undefined;

  if (dto.clickId) {
    const byClick = dto.clickId === "google" ? "google" : dto.clickId === "tiktok" ? "tiktok" : fromReferrer === "instagram" ? "instagram" : "facebook";
    return { channel: byClick, source: byClick, medium: "anuncio", campaign: null, content: null, referrerHost: external };
  }

  if (fromReferrer) {
    const searchEngine = fromReferrer === "google" || fromReferrer === "bing";
    return {
      channel: fromReferrer,
      source: fromReferrer,
      medium: searchEngine ? "busca" : fromReferrer === "email" ? "email" : "social",
      campaign: null,
      content: null,
      referrerHost: external,
    };
  }

  if (external) {
    return { channel: "outro_site", source: external.slice(0, 80), medium: "link", campaign: null, content: null, referrerHost: external };
  }

  return { channel: "direto", source: "direto", medium: null, campaign: null, content: null, referrerHost: null };
}

const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|whatsapp\/|telegrambot|embedly|curl|wget|python-requests|axios\//i;

export function isBot(userAgent: string | undefined): boolean {
  return !userAgent || BOT_UA.test(userAgent);
}

export function deviceOf(userAgent: string | undefined): "mobile" | "tablet" | "desktop" {
  const ua = userAgent ?? "";
  if (/ipad|tablet|kindle|silk/i.test(ua)) return "tablet";
  if (/mobi|android|iphone|ipod/i.test(ua)) return "mobile";
  return "desktop";
}

/** Sistema e navegador a partir do User-Agent (navegadores internos dos apps contam como o app). */
export function parseUserAgent(userAgent: string | undefined): { os: string; browser: string } {
  const ua = userAgent ?? "";
  const os = /iphone|ipad|ipod/i.test(ua)
    ? "iOS"
    : /android/i.test(ua)
      ? "Android"
      : /windows/i.test(ua)
        ? "Windows"
        : /cros/i.test(ua)
          ? "ChromeOS"
          : /mac os x|macintosh/i.test(ua)
            ? "macOS"
            : /linux/i.test(ua)
              ? "Linux"
              : "Outro";
  const browser = /instagram/i.test(ua)
    ? "Instagram (app)"
    : /fban|fbav|fb_iab/i.test(ua)
      ? "Facebook (app)"
      : /musical_ly|bytedance|tiktok/i.test(ua)
        ? "TikTok (app)"
        : /whatsapp/i.test(ua)
          ? "WhatsApp (app)"
          : /samsungbrowser/i.test(ua)
            ? "Samsung Internet"
            : /edg\//i.test(ua)
              ? "Edge"
              : /opr\/|opera/i.test(ua)
                ? "Opera"
                : /firefox|fxios/i.test(ua)
                  ? "Firefox"
                  : /chrome|crios/i.test(ua)
                    ? "Chrome"
                    : /safari/i.test(ua)
                      ? "Safari"
                      : "Outro";
  return { os, browser };
}
