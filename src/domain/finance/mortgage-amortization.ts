/**
 * Fixed-rate, level-payment mortgage amortization (monthly rests).
 */

import { addMonthsToYearMonth } from "@/lib/dates";

export type AmortizationPayment = {
  /** 0-based index of payment month from first payment. */
  index: number;
  /** Calendar month of this payment `YYYY-MM`. */
  yearMonth: string;
  totalPayment: number;
  interest: number;
  principal: number;
  /** Principal balance immediately after this payment. */
  balanceAfter: number;
};

export type BuildAmortizationScheduleParams = {
  principal: number;
  /** Nominal annual rate, e.g. 0.025 for 2.5%. */
  annualNominalRate: number;
  termMonths: number;
  /** First payment due in this month (inclusive). */
  firstPaymentYearMonth: string;
};

/**
 * Standard amortizing loan: constant monthly payment while balance > 0.
 */
export function buildAmortizationSchedule(
  params: BuildAmortizationScheduleParams
): AmortizationPayment[] {
  const { principal, annualNominalRate, termMonths, firstPaymentYearMonth } =
    params;
  if (principal <= 0 || termMonths <= 0) return [];

  const r = annualNominalRate / 12;
  const n = termMonths;
  let pmt: number;
  if (r === 0) {
    pmt = principal / n;
  } else {
    const pow = (1 + r) ** n;
    pmt = (principal * r * pow) / (pow - 1);
  }
  pmt = roundMoney(pmt);

  const out: AmortizationPayment[] = [];
  let balance = principal;

  for (let i = 0; i < n; i++) {
    const ym = addMonthsToYearMonth(firstPaymentYearMonth, i);
    const interest = roundMoney(balance * r);
    let principalPart = roundMoney(pmt - interest);
    if (principalPart > balance) {
      principalPart = balance;
    }
    const total = roundMoney(interest + principalPart);
    balance = roundMoney(balance - principalPart);
    out.push({
      index: i,
      yearMonth: ym,
      totalPayment: total,
      interest,
      principal: principalPart,
      balanceAfter: Math.max(0, balance),
    });
    if (balance <= 0.0001) break;
  }

  return out;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
