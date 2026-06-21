import type { HousingLoanRow, VehicleRow } from "@/data/supabase/types";
import { vehicleRowToValuationInput } from "@/data/mappers";
import {
  dedupeSourceOwnedLoanNames,
  type SourceOwnedLoanRegisterEntry,
} from "@/domain/finance/loan-register";
import { loanSourceDefinition } from "@/domain/finance/loan-source-registry";
import { buildAmortizationSchedule } from "@/domain/finance/mortgage-amortization";
import { splitHousingInstalment } from "@/domain/finance/housing-loan-payments";
import {
  effectiveLoanBalance,
  loanMonthsRemainingResolved,
} from "@/domain/finance/vehicle-sg";
import { formatYearMonth } from "@/lib/dates";

function num(raw: string | number | null | undefined): number {
  if (raw == null) return 0;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  return Number.isFinite(n) ? n : 0;
}

function currentHousingLoanSchedule(
  row: HousingLoanRow,
  asOfYearMonth: string
): { balance: number; remainingPayments: number; monthlyPayment: number } | null {
  const principal = num(row.principal);
  if (principal <= 0 || row.term_months <= 0) return null;

  const schedule = buildAmortizationSchedule({
    principal,
    annualNominalRate: Math.max(0, num(row.annual_nominal_rate)),
    termMonths: row.term_months,
    firstPaymentYearMonth: row.first_payment_month,
  });
  if (schedule.length === 0) return null;

  let balance = principal;
  const remaining = [];
  for (const payment of schedule) {
    if (payment.yearMonth < asOfYearMonth) {
      balance = payment.balanceAfter;
    } else {
      remaining.push(payment);
    }
  }

  const firstDue = remaining[0];
  if (!firstDue || balance <= 0) return null;
  return {
    balance,
    remainingPayments: remaining.length,
    monthlyPayment: firstDue.totalPayment,
  };
}

function housingLoanToRegisterEntry(
  row: HousingLoanRow,
  asOfYearMonth: string
): SourceOwnedLoanRegisterEntry | null {
  const source = loanSourceDefinition("housing");
  const schedule = currentHousingLoanSchedule(row, asOfYearMonth);
  if (!schedule) return null;

  const split = splitHousingInstalment(row, schedule.monthlyPayment);
  return {
    id: `${source.key}:${row.id}`,
    sourceKey: source.key,
    sourceRowId: row.id,
    sourceLabel: source.label,
    rawName: row.label,
    displayName: row.label,
    balance: schedule.balance,
    monthlyPayment: schedule.monthlyPayment,
    annualInterestRate: Math.max(0, num(row.annual_nominal_rate)),
    remainingTenureMonths: schedule.remainingPayments,
    loanType: "amortized",
    fundingSource: split.paymentSource,
    cpfOaPayment: split.cpfOaPayment,
    cashPayment: split.cashPayment,
    setupTabId: source.setupTabId,
    details: [
      { label: "Source", value: source.label },
      {
        label: "Repayment source",
        value:
          split.paymentSource === "cpf_oa"
            ? "CPF OA"
            : split.paymentSource === "split"
              ? "Split cash / CPF OA"
              : "Cash",
      },
      {
        label: "First payment",
        value: row.first_payment_month,
      },
    ],
  };
}

function vehicleLoanToRegisterEntry(
  row: VehicleRow,
  asOf: Date
): SourceOwnedLoanRegisterEntry | null {
  const source = loanSourceDefinition("vehicle");
  const input = vehicleRowToValuationInput(row);
  const balance = effectiveLoanBalance(input, asOf);
  const monthlyPayment = num(row.loan_monthly_payment);
  const remainingTenureMonths = loanMonthsRemainingResolved(input, asOf);

  if (balance <= 0 && monthlyPayment <= 0 && remainingTenureMonths == null) {
    return null;
  }

  const loanEndYm = row.loan_end_ym ?? null;
  return {
    id: `${source.key}:${row.id}`,
    sourceKey: source.key,
    sourceRowId: row.id,
    sourceLabel: source.label,
    rawName: row.label,
    displayName: row.label,
    balance,
    monthlyPayment: monthlyPayment > 0 ? monthlyPayment : null,
    annualInterestRate:
      row.loan_annual_nominal_rate == null
        ? null
        : Math.max(0, num(row.loan_annual_nominal_rate)),
    remainingTenureMonths,
    loanType: "flat_rate",
    fundingSource: "cash",
    cpfOaPayment: null,
    cashPayment: monthlyPayment > 0 ? monthlyPayment : null,
    setupTabId: source.setupTabId,
    details: [
      { label: "Source", value: source.label },
      { label: "Repayment source", value: "Cash" },
      ...(loanEndYm ? [{ label: "Loan end", value: loanEndYm }] : []),
    ],
  };
}

export function buildSourceOwnedLoanRegisterEntries({
  housingLoans,
  vehicleRows,
  reservedNames = [],
  asOf = new Date(),
}: {
  housingLoans: readonly HousingLoanRow[];
  vehicleRows: readonly VehicleRow[];
  reservedNames?: readonly string[];
  asOf?: Date;
}): SourceOwnedLoanRegisterEntry[] {
  const asOfYearMonth = formatYearMonth(asOf);
  const entries = [
    ...housingLoans
      .map((row) => housingLoanToRegisterEntry(row, asOfYearMonth))
      .filter((row): row is SourceOwnedLoanRegisterEntry => row != null),
    ...vehicleRows
      .map((row) => vehicleLoanToRegisterEntry(row, asOf))
      .filter((row): row is SourceOwnedLoanRegisterEntry => row != null),
  ];

  return dedupeSourceOwnedLoanNames(entries, reservedNames).sort((a, b) => {
    const sourceCmp = a.sourceLabel.localeCompare(b.sourceLabel);
    if (sourceCmp !== 0) return sourceCmp;
    return a.displayName.localeCompare(b.displayName);
  });
}
