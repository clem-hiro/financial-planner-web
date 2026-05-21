export const CASH_ACCOUNT_PURPOSES = [
  "emergency_fund",
  "everyday_spending",
  "short_term_savings",
  "other",
] as const;

export type CashAccountPurpose = (typeof CASH_ACCOUNT_PURPOSES)[number];

export const CASH_ACCOUNT_PURPOSE_LABELS: Record<CashAccountPurpose, string> = {
  emergency_fund: "Emergency fund",
  everyday_spending: "Everyday spending",
  short_term_savings: "Short-term savings",
  other: "Other cash",
};

export function parseCashAccountPurpose(
  value: string | null | undefined
): CashAccountPurpose | null {
  const v = String(value ?? "").trim();
  if (
    (CASH_ACCOUNT_PURPOSES as readonly string[]).includes(v)
  ) {
    return v as CashAccountPurpose;
  }
  return null;
}

export function cashPurposeSortOrder(purpose: CashAccountPurpose): number {
  switch (purpose) {
    case "emergency_fund":
      return 0;
    case "everyday_spending":
      return 1;
    case "short_term_savings":
      return 2;
    default:
      return 3;
  }
}
