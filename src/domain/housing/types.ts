import type { HousingLoanRow, PropertyRow } from "@/data/supabase/types";

/** Asset kinds in the long-term setup IA (Assets → Housing). */
export type HousingPropertyType = PropertyRow["property_type"];

export type HousingPropertyStatus = PropertyRow["status"];

/** `current` = affects net worth / cashflow today; `future_simulation` = Goals-only (no live cashflow). */
export type HousingPlanningScope = PropertyRow["planning_scope"];

/** Linked debt kinds — mortgage today; car / renovation loans reserved. */
export type LinkedDebtKind = "mortgage" | "car_loan" | "renovation_loan";

/** Cross-cutting link between an asset and an optional liability row. */
export type LinkedAssetDebt<TDebt extends { id: string; type: LinkedDebtKind }> = {
  assetId: string;
  debts: TDebt[];
};

export type HousingMortgageDebt = {
  id: string;
  type: "mortgage";
  linkedAssetId: string | null;
  label: string;
  outstandingBalance: number;
  interestRateAnnual: number;
  termMonths: number;
  completionMonth: string;
  firstPaymentMonth: string;
  lenderType: HousingLoanRow["lender_type"];
  oaShareOfPayment: number;
  paymentSource: HousingLoanRow["payment_source"];
  row: HousingLoanRow;
};

/** Property-first view for UI and planners (current ownership only by default). */
export type HousingPropertyView = {
  id: string;
  name: string;
  propertyType: HousingPropertyType;
  purchasePrice: number | null;
  currentValuation: number | null;
  ownershipPercent: number;
  status: HousingPropertyStatus;
  rentalIncomeMonthly: number;
  planningScope: HousingPlanningScope;
  linkedDebtIds: string[];
  mortgage: HousingMortgageDebt | null;
  /** Underlying row when loaded from `financial_properties`. */
  propertyRow: PropertyRow | null;
  /** True when synthesized from a legacy loan without a property row. */
  isLegacySynthetic: boolean;
};
