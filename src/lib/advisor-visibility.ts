/** The 5 sensitive advisor-visible categories, default PRIVATE (opt-in). The
 * 4 always-visible categories (profile, goals, budget, investments) are not
 * listed here — they are never gated. Mirrors the CHECK constraint in
 * 20260624000000_advisor_consent_category_visibility.sql. */
export const ADVISOR_VISIBILITY_CATEGORIES = [
  "cash_accounts",
  "liabilities",
  "properties",
  "housing_loans",
  "vehicles",
] as const;

export type AdvisorVisibilityCategory =
  (typeof ADVISOR_VISIBILITY_CATEGORIES)[number];

export const ADVISOR_VISIBILITY_LABELS: Record<
  AdvisorVisibilityCategory,
  string
> = {
  cash_accounts: "Cash accounts",
  liabilities: "Liabilities",
  properties: "Property",
  housing_loans: "Housing loans",
  vehicles: "Vehicles",
};

export function isAdvisorVisibilityCategory(
  value: string
): value is AdvisorVisibilityCategory {
  return (ADVISOR_VISIBILITY_CATEGORIES as readonly string[]).includes(value);
}

export type AdvisorCategoryVisibility = Record<
  AdvisorVisibilityCategory,
  boolean
>;

/** All categories default to false (private) — the default-deny baseline. */
export function defaultCategoryVisibility(): AdvisorCategoryVisibility {
  return Object.fromEntries(
    ADVISOR_VISIBILITY_CATEGORIES.map((c) => [c, false])
  ) as AdvisorCategoryVisibility;
}
