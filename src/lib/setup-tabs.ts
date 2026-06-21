export type SetupTabDef = { id: string; label: string };

export function buildSetupTabs(): readonly SetupTabDef[] {
  return [
    { id: "profile", label: "Profile" },
    { id: "add-account", label: "Investments" },
    { id: "cpf", label: "CPF" },
    { id: "income_tax", label: "Income tax" },
    { id: "housing", label: "Housing" },
    { id: "vehicles", label: "Vehicles" },
    { id: "cash-liabilities", label: "Cash and debts" },
    { id: "budget", label: "Budget" },
    { id: "goals", label: "Goals" },
    { id: "advisor-proposals", label: "Advisor proposals" },
  ] as const;
}
