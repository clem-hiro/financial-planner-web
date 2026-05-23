/** Shared by investment forms (client) and server-action parsers — keep free of server imports. */
export type InvestmentPlanNature =
  | "pure_investment"
  | "includes_insurance_coverage";
