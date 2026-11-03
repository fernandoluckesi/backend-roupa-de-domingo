const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Gera o numero publico do pedido, usado como external_reference no Mercado Pago. */
export function generateOrderNumber(): string {
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `RD-${out}`;
}

export function onlyDigits(value?: string | null): string {
  return (value ?? "").replace(/\D/g, "");
}
