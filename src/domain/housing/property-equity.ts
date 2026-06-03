import type { HousingLoanRow, PropertyRow } from "@/data/supabase/types";
import { buildAmortizationSchedule } from "@/domain/finance/mortgage-amortization";

export interface PropertyEquityBreakdown {
  propertiesGrossAsset: number;
  propertiesLoan: number;
  propertiesNet: number;
  propertyCount: number;
}

export interface PropertyEquityBreakdownInput {
  properties: PropertyRow[];
  housingLoans: HousingLoanRow[];
  asOfYearMonth: string;
}

export function buildPropertyEquityBreakdown(
  input: PropertyEquityBreakdownInput
): PropertyEquityBreakdown {
  const loansByPropertyId = groupLoansByPropertyId(input.housingLoans);
  let propertiesGrossAsset = 0;
  let propertiesLoan = 0;
  let propertyCount = 0;

  for (const property of input.properties) {
    if (property.planning_scope !== "current") continue;

    propertyCount += 1;
    propertiesGrossAsset += ownedPropertyGrossValue(property);

    const linkedLoans = loansByPropertyId.get(property.id) ?? [];
    for (const loan of linkedLoans) {
      propertiesLoan += housingLoanBalanceAt(loan, input.asOfYearMonth);
    }
  }

  return {
    propertiesGrossAsset,
    propertiesLoan,
    propertiesNet: propertiesGrossAsset - propertiesLoan,
    propertyCount,
  };
}

export function normalizePropertyOwnership(
  raw: string | number | null | undefined
): number {
  let value = Number.NaN;
  if (typeof raw === "number") {
    value = raw;
  } else if (raw != null && raw !== "") {
    value = Number(raw);
  }
  if (!Number.isFinite(value) || value <= 0) return 0;

  const fraction = value > 1 ? value / 100 : value;
  return Math.min(1, Math.max(0, fraction));
}

function ownedPropertyGrossValue(property: PropertyRow): number {
  const value =
    property.current_valuation != null &&
    String(property.current_valuation).trim() !== ""
      ? moneyValue(property.current_valuation)
      : moneyValue(property.purchase_price);
  return (
    Math.max(0, value) * normalizePropertyOwnership(property.ownership_percent)
  );
}

function groupLoansByPropertyId(
  loans: HousingLoanRow[]
): Map<string, HousingLoanRow[]> {
  const out = new Map<string, HousingLoanRow[]>();
  for (const loan of loans) {
    if (!loan.property_id) continue;
    const list = out.get(loan.property_id) ?? [];
    list.push(loan);
    out.set(loan.property_id, list);
  }
  return out;
}

function housingLoanBalanceAt(loan: HousingLoanRow, asOfYearMonth: string): number {
  const principal = Math.max(0, moneyValue(loan.principal));
  if (principal <= 0) return 0;
  if (compareYearMonth(asOfYearMonth, loan.first_payment_month) < 0) {
    return principal;
  }

  const schedule = buildAmortizationSchedule({
    principal,
    annualNominalRate: Math.max(0, moneyValue(loan.annual_nominal_rate)),
    termMonths: Math.max(0, loan.term_months),
    firstPaymentYearMonth: loan.first_payment_month,
  });
  if (schedule.length <= 0) return principal;

  let balance = principal;
  for (const payment of schedule) {
    if (compareYearMonth(payment.yearMonth, asOfYearMonth) > 0) break;
    balance = payment.balanceAfter;
  }
  return Math.max(0, balance);
}

function moneyValue(value: string | null | undefined): number {
  if (value == null || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareYearMonth(a: string, b: string): number {
  return yearMonthIndex(a) - yearMonthIndex(b);
}

function yearMonthIndex(yearMonth: string): number {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!match) return Number.POSITIVE_INFINITY;
  return Number(match[1]) * 12 + Number(match[2]) - 1;
}
