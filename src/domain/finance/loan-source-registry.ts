export type LoanSourceKey = "housing" | "vehicle";

export type LoanSourceDefinition = {
  key: LoanSourceKey;
  label: string;
  setupTabId: string;
  sourceTable: string;
  debtCategory: "property" | "vehicle";
};

export const LOAN_SOURCE_DEFINITIONS: readonly LoanSourceDefinition[] = [
  {
    key: "housing",
    label: "Housing",
    setupTabId: "housing",
    sourceTable: "financial_housing_loans",
    debtCategory: "property",
  },
  {
    key: "vehicle",
    label: "Vehicles",
    setupTabId: "vehicles",
    sourceTable: "financial_vehicles",
    debtCategory: "vehicle",
  },
] as const;

export const LOAN_SOURCE_SETUP_TAB_IDS: readonly string[] =
  LOAN_SOURCE_DEFINITIONS.map((source) => source.setupTabId);

export function loanSourceDefinition(
  key: LoanSourceKey
): LoanSourceDefinition {
  const source = LOAN_SOURCE_DEFINITIONS.find((s) => s.key === key);
  if (!source) {
    throw new Error(`Unknown loan source: ${key}`);
  }
  return source;
}

export function expandTabsForLoanRegisterSources(
  tabs: ReadonlySet<string>
): ReadonlySet<string> {
  if (!tabs.has("cash-liabilities")) return tabs;
  return new Set([...tabs, ...LOAN_SOURCE_SETUP_TAB_IDS]);
}
