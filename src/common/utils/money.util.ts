/** Converte centavos para o formato decimal que o Mercado Pago espera (2 casas). */
export function centsToUnit(cents: number): number {
  return Math.round(cents) / 100;
}

export function unitToCents(unit: number): number {
  return Math.round(unit * 100);
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Distribui um desconto total entre itens proporcionalmente ao valor de cada um,
 * garantindo que a soma dos descontos seja exatamente igual ao total.
 */
export function prorateDiscount(
  itemTotals: number[],
  discountCents: number,
): number[] {
  const sum = itemTotals.reduce((acc, v) => acc + v, 0);
  if (sum <= 0 || discountCents <= 0) {
    return itemTotals.map(() => 0);
  }
  const raw = itemTotals.map((total) =>
    Math.floor((total / sum) * discountCents),
  );
  let remainder = discountCents - raw.reduce((acc, v) => acc + v, 0);
  for (let i = 0; remainder > 0 && i < raw.length; i += 1) {
    if (raw[i] < itemTotals[i]) {
      raw[i] += 1;
      remainder -= 1;
    }
  }
  return raw;
}
