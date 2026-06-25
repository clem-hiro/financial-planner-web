import {
  SOURCE_OWNED_DEBT_CATEGORIES,
  type DebtCategory,
  type LoanType,
} from "@/domain/finance/debt-repayment";

export const DEBT_CATEGORY_OPTIONS: {
  value: DebtCategory;
  label: string;
  icon: string;
}[] = [
  { value: "property", label: "Property loan", icon: "\u{1F3E0}" },
  { value: "vehicle", label: "Vehicle loan", icon: "\u{1F697}" },
  { value: "personal", label: "Personal loan", icon: "\u{1F4BC}" },
  { value: "credit_card", label: "Credit card", icon: "\u{1F4B3}" },
  { value: "renovation", label: "Renovation loan", icon: "\u{1F3D7}" },
  { value: "education", label: "Education loan", icon: "\u{1F4DA}" },
  { value: "other", label: "Other", icon: "\u{1F4CB}" },
];

export const GENERIC_DEBT_CATEGORY_OPTIONS = DEBT_CATEGORY_OPTIONS.filter(
  (option) => !SOURCE_OWNED_DEBT_CATEGORIES.includes(option.value)
);

export const LOAN_TYPE_OPTIONS: {
  value: LoanType;
  label: string;
  hint: string;
}[] = [
  {
    value: "amortized",
    label: "Reducing balance",
    hint: "Typical for property and most personal loans",
  },
  {
    value: "flat_rate",
    label: "Flat rate",
    hint: "Common for vehicle loans in Singapore",
  },
  {
    value: "revolving",
    label: "Flexible / manual",
    hint: "Credit cards and irregular repayments",
  },
];

export function debtCategoryIcon(
  category: DebtCategory | null | undefined
): string {
  return (
    DEBT_CATEGORY_OPTIONS.find((o) => o.value === category)?.icon ?? "\u{1F4B8}"
  );
}

export function debtCategoryLabel(
  category: DebtCategory | null | undefined
): string | null {
  return (
    DEBT_CATEGORY_OPTIONS.find((o) => o.value === category)?.label ?? null
  );
}

export function formatTenureYears(months: number | null | undefined): string {
  if (months == null || months <= 0) return "—";
  const years = months / 12;
  if (years >= 1 && Math.abs(years - Math.round(years)) < 0.05) {
    return `${Math.round(years)} years`;
  }
  return `${(months / 12).toFixed(1)} years`;
}

export function formatRatePercent(rateAnnual: number | null | undefined): string {
  if (rateAnnual == null || !Number.isFinite(rateAnnual)) return "—";
  return `${(rateAnnual * 100).toFixed(2)}%`;
}
