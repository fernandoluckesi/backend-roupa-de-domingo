/**
 * Mascaramento de dados pessoais para logs e trilhas de auditoria.
 * Regra: log nunca recebe CPF, senha, token ou endereco completo em claro.
 */

/** 123.456.789-09 -> ***.***.789-** (padrao usado por orgaos publicos) */
export function maskCpf(value?: string | null): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length !== 11) return digits ? "***" : "";
  return `***.***.${digits.slice(6, 9)}-**`;
}

/** maria.souza@gmail.com -> m***a@gmail.com */
export function maskEmail(value?: string | null): string {
  const email = String(value ?? "");
  const [user, domain] = email.split("@");
  if (!domain) return email ? "***" : "";
  return `${user.slice(0, 1)}***${user.length > 1 ? user.slice(-1) : ""}@${domain}`;
}

const SECRET_KEYS = /pass(word)?|token|secret|^otp$|^code$|authorization|cookie/i;
const CPF_KEYS = /^(document|customerDocument|cpf|taxNumber|tax_number)$/i;
const EMAIL_KEYS = /email/i;
const PHONE_KEYS = /phone|telefone/i;
const ADDRESS_KEYS = /^(street|number|complement|address1|address2)$/i;

/** Copia profunda com campos sensiveis mascarados (para AuditLog e logs). */
export function redact<T>(value: T, depth = 0): T {
  if (depth > 6 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1)) as unknown as T;
  if (typeof value !== "object") return value;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEYS.test(k)) out[k] = "[redacted]";
    else if (CPF_KEYS.test(k)) out[k] = typeof v === "string" ? maskCpf(v) : "[redacted]";
    else if (EMAIL_KEYS.test(k) && typeof v === "string") out[k] = maskEmail(v);
    else if (PHONE_KEYS.test(k) && typeof v === "string") out[k] = v ? `***${v.replace(/\D/g, "").slice(-2)}` : v;
    else if (ADDRESS_KEYS.test(k) && typeof v === "string") out[k] = v ? "***" : v;
    else out[k] = redact(v, depth + 1);
  }
  return out as T;
}

/** Remove qualquer sequencia com cara de CPF de um texto livre (mensagens de erro de provedores). */
export function scrubCpfFromText(text: string): string {
  return text.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, (m) => maskCpf(m));
}
