import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { Logger } from "@nestjs/common";

/**
 * Criptografia em repouso (AES-256-GCM) para dados pessoais de alto risco:
 * CPF (User.document, Order.customerDocument) e segredo do 2FA.
 *
 * Formato gravado: "enc:v1:<iv b64>:<tag b64>:<cifrado b64>". Valores sem o
 * prefixo sao legado em texto puro: continuam legiveis e sao cifrados pelo
 * script prisma/encrypt-documents.ts.
 */
const PREFIX = "enc:v1:";
const logger = new Logger("Crypto");

let cachedKeys: Buffer[] | null = null;

/** Chave derivada do JWT_SECRET: usada enquanto DATA_ENCRYPTION_KEY nao existir. */
const derivedKey = () =>
  createHash("sha256")
    .update(`rd-dev-data-key:${process.env.JWT_SECRET ?? "domingo-dev-secret"}`)
    .digest();

/**
 * [chave de escrita, ...chaves aceitas na leitura]. Ao configurar DATA_ENCRYPTION_KEY
 * depois, o que foi cifrado com a chave derivada continua legivel (rotacao sem downtime);
 * `npm run data:encrypt -- --rotate` regrava tudo com a chave nova.
 */
function keys(): Buffer[] {
  if (cachedKeys) return cachedKeys;
  const raw = process.env.DATA_ENCRYPTION_KEY ?? "";
  if (raw) {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length !== 32) {
      throw new Error("DATA_ENCRYPTION_KEY precisa ser 32 bytes em base64 (openssl rand -base64 32).");
    }
    cachedKeys = [decoded, derivedKey()];
  } else {
    const level = process.env.NODE_ENV === "production" ? "error" : "warn";
    logger[level](
      "DATA_ENCRYPTION_KEY ausente: CPF cifrado com chave derivada do JWT_SECRET. Configure DATA_ENCRYPTION_KEY (openssl rand -base64 32).",
    );
    cachedKeys = [derivedKey()];
  }
  return cachedKeys;
}

const key = () => keys()[0];

export const isEncrypted = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith(PREFIX);

export function encrypt(plain: string): string {
  if (isEncrypted(plain)) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${data.toString("base64")}`;
}

export function decrypt(value: string): string {
  if (!isEncrypted(value)) return value;
  const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(":");
  let lastError: unknown;
  for (const candidate of keys()) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", candidate, Buffer.from(ivB64, "base64"));
      decipher.setAuthTag(Buffer.from(tagB64, "base64"));
      return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/** true se o valor foi cifrado com uma chave antiga (precisa regravar na rotacao). */
export function needsRotation(value: string): boolean {
  if (!isEncrypted(value) || keys().length < 2) return false;
  const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(":");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    decipher.update(Buffer.from(dataB64, "base64"));
    decipher.final();
    return false;
  } catch {
    return true;
  }
}

/** Hash irreversivel com sal (IP em trilhas de auditoria/consentimento). */
export function hashIdentifier(value: string | undefined | null): string | null {
  if (!value) return null;
  // Sal fixo e separado da chave de dados: o hash nao muda quando a chave rotaciona
  return createHash("sha256").update(`rd-id-salt:${process.env.JWT_SECRET ?? "domingo-dev-secret"}:${value}`).digest("hex").slice(0, 32);
}

/** Token aleatorio para links de e-mail; so o hash vai para o banco. */
export function randomToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: sha256(token) };
}

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
