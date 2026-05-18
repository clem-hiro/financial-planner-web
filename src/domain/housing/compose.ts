import { num } from "@/data/mappers";
import type { HousingLoanRow, PropertyRow } from "@/data/supabase/types";
import type { HousingMortgageDebt, HousingPropertyView } from "@/domain/housing/types";

function loanToMortgage(loan: HousingLoanRow): HousingMortgageDebt {
  return {
    id: loan.id,
    type: "mortgage",
    linkedAssetId: loan.property_id ?? null,
    label: loan.label,
    outstandingBalance: num(loan.principal),
    interestRateAnnual: num(loan.annual_nominal_rate),
    termMonths: loan.term_months,
    completionMonth: loan.completion_month,
    firstPaymentMonth: loan.first_payment_month,
    lenderType: loan.lender_type ?? "hdb",
    oaShareOfPayment: num(loan.oa_share_of_payment),
    paymentSource: loan.payment_source ?? null,
    row: loan,
  };
}

function propertyRowToView(
  property: PropertyRow,
  mortgage: HousingMortgageDebt | null
): HousingPropertyView {
  return {
    id: property.id,
    name: property.name,
    propertyType: property.property_type,
    purchasePrice:
      property.purchase_price != null ? num(property.purchase_price) : null,
    currentValuation:
      property.current_valuation != null
        ? num(property.current_valuation)
        : null,
    ownershipPercent: num(property.ownership_percent),
    status: property.status,
    rentalIncomeMonthly: num(property.rental_income_monthly),
    planningScope: property.planning_scope,
    linkedDebtIds: mortgage ? [mortgage.id] : [],
    mortgage,
    propertyRow: property,
    isLegacySynthetic: false,
  };
}

function syntheticPropertyFromLoan(loan: HousingLoanRow): HousingPropertyView {
  const mortgage = loanToMortgage(loan);
  const kind = loan.property_kind;
  const propertyType =
    kind === "hdb" ||
    kind === "condo" ||
    kind === "ec" ||
    kind === "landed"
      ? kind
      : "unknown";
  const purchasePrice =
    loan.property_purchase_price != null &&
    String(loan.property_purchase_price).trim() !== ""
      ? num(loan.property_purchase_price)
      : null;

  return {
    id: `legacy-loan-${loan.id}`,
    name: loan.label?.trim() || "Property",
    propertyType,
    purchasePrice,
    currentValuation: null,
    ownershipPercent: 1,
    status: "living_in",
    rentalIncomeMonthly: 0,
    planningScope: "current",
    linkedDebtIds: [mortgage.id],
    mortgage,
    propertyRow: null,
    isLegacySynthetic: true,
  };
}

/**
 * Joins property rows with mortgage loans. Legacy loans without `property_id`
 * still appear as synthetic properties so dashboards stay stable pre-migration.
 */
export function composeHousingPropertyViews(
  properties: PropertyRow[],
  loans: HousingLoanRow[],
  options?: { includeFutureSimulations?: boolean }
): HousingPropertyView[] {
  const includeFuture = options?.includeFutureSimulations ?? false;
  const currentProperties = properties.filter(
    (p) => includeFuture || p.planning_scope === "current"
  );

  const loansByPropertyId = new Map<string, HousingLoanRow[]>();
  const orphanLoans: HousingLoanRow[] = [];

  for (const loan of loans) {
    if (loan.property_id) {
      const list = loansByPropertyId.get(loan.property_id) ?? [];
      list.push(loan);
      loansByPropertyId.set(loan.property_id, list);
    } else {
      orphanLoans.push(loan);
    }
  }

  const views: HousingPropertyView[] = [];

  for (const property of currentProperties) {
    const linked = loansByPropertyId.get(property.id) ?? [];
    const primary = linked[0] ?? null;
    views.push(
      propertyRowToView(property, primary ? loanToMortgage(primary) : null)
    );
    loansByPropertyId.delete(property.id);
  }

  for (const loan of orphanLoans) {
    views.push(syntheticPropertyFromLoan(loan));
  }

  // Properties referenced by loans but missing from the properties query (shouldn't happen).
  for (const [, linked] of loansByPropertyId) {
    for (const loan of linked) {
      views.push(syntheticPropertyFromLoan(loan));
    }
  }

  return views;
}

/** Flat mortgage list for projection pipelines (unchanged loan semantics). */
export function housingLoansForProjection(loans: HousingLoanRow[]): HousingLoanRow[] {
  return loans;
}
