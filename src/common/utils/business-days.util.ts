/** Feriados nacionais fixos (MM-DD). Moveis (Carnaval, Sexta-feira Santa, Corpus Christi) ficam de fora. */
const NATIONAL_HOLIDAYS = new Set([
  "01-01",
  "04-21",
  "05-01",
  "09-07",
  "10-12",
  "11-02",
  "11-15",
  "11-20",
  "12-25",
]);

const isBusinessDay = (date: Date) => {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return false;
  const mmdd = `${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  return !NATIONAL_HOLIDAYS.has(mmdd);
};

/** Soma N dias uteis (prazo do SAC, aprovacao de devolucao). */
export function addBusinessDays(from: Date, days: number): Date {
  const date = new Date(from);
  let added = 0;
  while (added < days) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (isBusinessDay(date)) added++;
  }
  return date;
}

/** Protocolo legivel: PREFIXO-AAAAMMDD-XXXXXX */
export function protocolNumber(prefix: string): string {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0");
  return `${prefix}-${ymd}-${rand}`;
}
