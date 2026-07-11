export type SetupTabDef = { id: string; label: string };

export type SetupNavGroupId =
  | "progress"
  | "core"
  | "wealth"
  | "protection"
  | "future"
  | "advisor";

export type SetupNavGroup = {
  id: SetupNavGroupId;
  label: string;
  /** Tab ids in display order; empty for progress-only (Overview). */
  tabIds: readonly string[];
};

/** Flat tab list — order used for mobile rail and URL validation. */
export function buildSetupTabs(): readonly SetupTabDef[] {
  return [
    { id: "profile", label: "Profile" },
    { id: "add-account", label: "Investments" },
    { id: "cpf", label: "CPF" },
    { id: "income_tax", label: "Income tax" },
    { id: "housing", label: "Housing" },
    { id: "vehicles", label: "Vehicles" },
    { id: "cash-liabilities", label: "Cash and debts" },
    { id: "protection", label: "Protection" },
    { id: "budget", label: "Budget" },
    { id: "goals", label: "Goals" },
    { id: "advisor-proposals", label: "Advisor proposals" },
  ] as const;
}

/** Desktop side-nav groups — mirrors Setup hub mental model. */
export const SETUP_NAV_GROUPS: readonly SetupNavGroup[] = [
  { id: "progress", label: "Progress", tabIds: [] },
  {
    id: "core",
    label: "Core",
    tabIds: ["profile", "budget", "cash-liabilities"],
  },
  {
    id: "wealth",
    label: "Wealth",
    tabIds: ["add-account", "cpf", "housing", "vehicles"],
  },
  { id: "protection", label: "Protection", tabIds: ["protection"] },
  { id: "future", label: "Future", tabIds: ["goals", "income_tax"] },
  { id: "advisor", label: "Advisor", tabIds: ["advisor-proposals"] },
] as const;
