import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";

export function formatCurrency(
  value: number,
  currency: string = DEFAULT_BASE_CURRENCY
): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(rate: number | null): string {
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}
