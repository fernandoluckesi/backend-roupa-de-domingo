import { createHmac, timingSafeEqual } from "crypto";

/**
 * Valida o header x-signature do webhook do Mercado Pago.
 * Formato: "ts=<epoch>,v1=<hmac hex>". O HMAC-SHA256 (chave = assinatura secreta do painel)
 * e calculado sobre o manifesto "id:<data.id>;request-id:<x-request-id>;ts:<ts>;",
 * omitindo as partes ausentes. data.id alfanumerico vai em minusculas.
 * https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
export function isValidMercadoPagoSignature(input: {
  secret: string;
  signatureHeader?: string;
  requestId?: string;
  dataId?: string;
}): boolean {
  const { secret, signatureHeader, requestId } = input;
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, rest.join("=")];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const dataId = input.dataId
    ? /^[a-z0-9]+$/i.test(input.dataId)
      ? input.dataId.toLowerCase()
      : input.dataId
    : "";

  let manifest = "";
  if (dataId) manifest += `id:${dataId};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;

  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
