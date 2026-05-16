import type { ProposalFieldMeta } from "@/domain/advisor-proposals/field-registry";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";

export function formatProposalDisplayValue(
  raw: string | null,
  meta: ProposalFieldMeta,
  currencyCode = DEFAULT_BASE_CURRENCY
): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  if (meta.currency) {
    const n = Number(raw);
    if (Number.isFinite(n)) {
      return new Intl.NumberFormat("en-SG", {
        style: "currency",
        currency: currencyCode,
        maximumFractionDigits: 0,
      }).format(n);
    }
  }
  if (meta.percent) {
    const n = Number(raw);
    if (Number.isFinite(n)) {
      return `${(n * 100).toFixed(1)}%`;
    }
  }
  if (raw === "until_retirement") return "Until retirement";
  if (raw === "fixed_duration") return "Fixed duration";
  if (raw === "true" && meta.label === "Account") return "Remove account";
  return raw;
}
