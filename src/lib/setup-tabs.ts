export type SetupTabDef = { id: string; label: string };

export function buildSetupTabs(): readonly SetupTabDef[] {
  return [
    { id: "profile", label: "Profile" },
    { id: "add-account", label: "Investments" },
    { id: "cpf", label: "CPF" },
    { id: "income_tax", label: "Income tax" },
    { id: "cash-liabilities", label: "Cash and debts" },
    { id: "housing", label: "Housing" },
    { id: "vehicles", label: "Vehicles" },
    { id: "budget", label: "Budget" },
    { id: "goals", label: "Goals" },
  ] as const;
}
