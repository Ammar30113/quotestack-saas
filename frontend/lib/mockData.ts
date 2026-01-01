export type QuoteRow = {
  id?: number;
  supplier: string;
  price: string;
  currency: string;
  amountBase?: string | null;
  baseCurrency?: string | null;
  fxRate?: string | null;
  fxDate?: string | null;
  leadTimeDays: number;
  moq: number;
};

export function formatDate(input: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(input));
}
