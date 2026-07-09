import { debtBudgetCategoryName } from "@/domain/finance/debt-repayment";

export const VEHICLE_BUDGET_SLOTS = [
  "loan_repayment",
  "petrol",
  "insurance",
  "road_tax",
  "maintenance",
] as const;

export type VehicleBudgetSlot = (typeof VEHICLE_BUDGET_SLOTS)[number];

export function vehicleBudgetCategoryName(
  slot: VehicleBudgetSlot,
  vehicleName: string
): string {
  const name = vehicleName.trim() || "Vehicle";
  switch (slot) {
    case "loan_repayment":
      return debtBudgetCategoryName(name);
    case "petrol":
      return `Transport — ${name}`;
    case "insurance":
      return `Vehicle insurance — ${name}`;
    case "road_tax":
      return `Vehicle road tax — ${name}`;
    case "maintenance":
      return `Vehicle maintenance — ${name}`;
  }
}

/** Loan-repayment lines are mirrored in the debt ledger — exclude from living-expense projections. */
export function isVehicleLoanRepaymentBudgetLine(row: {
  source_vehicle_id?: string | null;
  vehicle_budget_slot?: string | null;
}): boolean {
  return (
    row.source_vehicle_id != null && row.vehicle_budget_slot === "loan_repayment"
  );
}
