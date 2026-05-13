import { ageCompletedOnDate } from "./age-projection";
import { buildAmortizationSchedule } from "./mortgage-amortization";
import type { SgCpfAgeBand } from "./sg-cpf";
import {
  monthlyCpfInflowsFromOwSubject,
  ordinaryWagesSubjectWithYtd,
  sgCpfAgeBandForCompletedAge,
} from "./sg-cpf-contribution-buckets";
import { addMonthsToYearMonth } from "@/lib/dates";
import {
  additionalWageCeilingRemaining,
  DEFAULT_ANNUAL_BONUS_PAYOUT_MONTH,
} from "./sg-cpf";

export const DEFAULT_CPF_OA_CREDITING_ANNUAL = 0.025;
export const DEFAULT_CPF_SA_CREDITING_ANNUAL = 0.04;
export const DEFAULT_CPF_MA_CREDITING_ANNUAL = 0.04;

export type CpfBalanceSnapshot = {
  oa: number;
  sa: number;
  ma: number;
  oaAnnualRate?: number | null;
  saAnnualRate?: number | null;
  maAnnualRate?: number | null;
  cpfisMonthlyFromOa: number;
  cpfisNotionalBalance: number;
  cpfisAnnualReturn: number;
};

export type HousingLoanProjectionInput = {
  completionMonth: string;
  firstPaymentMonth: string;
  downpaymentFromOa: number;
  feesFromOa: number;
  principal: number;
  annualNominalRate: number;
  termMonths: number;
  oaShareOfPayment: number;
  maxOaPerMonth: number | null;
};

export type CpfMonthPoint = {
  yearMonth: string;
  oa: number;
  sa: number;
  ma: number;
  cpfis: number;
  totalCpf: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function endOfYearMonthDate(ym: string): Date {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0, 12, 0, 0, 0);
}

/**
 * Month-step CPF projection: crediting on OA/SA/MA, OW-based contributions with
 * annual OW cap and monthly ceiling, housing lumps + amortized payments from OA,
 * optional monthly OA→CPFIS transfer and notional CPFIS growth.
 */
export function buildCpfMonthlyProjectionSeries(params: {
  startYearMonth: string;
  horizonMonths: number;
  /** When set, age bands follow completed age each month. */
  birthDate: string | null;
  /** Used when `birthDate` is null (no age progression in CPF rates). */
  fixedCpfAgeBand?: SgCpfAgeBand;
  grossMonthly: number;
  /**
   * Nominal raise per calendar year (e.g. 0.02). Applied on each January
   * strictly after `startYearMonth` (baseline month uses `grossMonthly` as-is).
   */
  annualSalaryGrowthNominal?: number;
  /** Annual bonus paid once a year (default assumed in December). */
  annualBonus?: number;
  /** Month number (1-12) bonus is assumed to be paid. */
  annualBonusPayoutMonth?: number;
  initial: CpfBalanceSnapshot;
  housingLoans: HousingLoanProjectionInput[];
}): CpfMonthPoint[] {
  const {
    startYearMonth,
    horizonMonths,
    birthDate,
    fixedCpfAgeBand,
    grossMonthly,
    annualSalaryGrowthNominal = 0,
    annualBonus = 0,
    annualBonusPayoutMonth = DEFAULT_ANNUAL_BONUS_PAYOUT_MONTH,
    initial,
    housingLoans,
  } = params;

  if (horizonMonths <= 0) return [];

  const paymentByYmByLoan = housingLoans.map((loan) => {
    const sched = buildAmortizationSchedule({
      principal: loan.principal,
      annualNominalRate: loan.annualNominalRate,
      termMonths: loan.termMonths,
      firstPaymentYearMonth: loan.firstPaymentMonth,
    });
    const map = new Map<string, number>();
    for (const row of sched) {
      map.set(row.yearMonth, row.totalPayment);
    }
    return { loan, map };
  });

  let oa = round2(initial.oa);
  let sa = round2(initial.sa);
  let ma = round2(initial.ma);
  let cpfis = round2(initial.cpfisNotionalBalance);

  const roa = initial.oaAnnualRate ?? DEFAULT_CPF_OA_CREDITING_ANNUAL;
  const rsa = initial.saAnnualRate ?? DEFAULT_CPF_SA_CREDITING_ANNUAL;
  const rma = initial.maAnnualRate ?? DEFAULT_CPF_MA_CREDITING_ANNUAL;
  const rCpfis = Math.max(0, initial.cpfisAnnualReturn);

  const out: CpfMonthPoint[] = [];
  let ytdOw = 0;
  const annualBonusSafe = Math.max(0, Number(annualBonus) || 0);
  const payoutMonth = Math.max(
    1,
    Math.min(12, Math.trunc(Number(annualBonusPayoutMonth) || 12))
  );
  const growth = Math.min(
    0.25,
    Math.max(0, Number(annualSalaryGrowthNominal) || 0)
  );
  let effectiveGross = grossMonthly;

  for (let i = 0; i < horizonMonths; i++) {
    const ym = addMonthsToYearMonth(startYearMonth, i);
    if (ym.endsWith("-01") && ym > startYearMonth && growth > 0) {
      effectiveGross *= 1 + growth;
    }
    if (ym.endsWith("-01")) {
      ytdOw = 0;
    }

    oa += round2((oa * roa) / 12);
    sa += round2((sa * rsa) / 12);
    ma += round2((ma * rma) / 12);
    cpfis += round2((cpfis * rCpfis) / 12);

    const band: SgCpfAgeBand =
      birthDate != null
        ? sgCpfAgeBandForCompletedAge(
            ageCompletedOnDate(birthDate, endOfYearMonthDate(ym))
          )
        : (fixedCpfAgeBand ?? "below_55");

    if (effectiveGross > 750) {
      const { subject, ytdOwSubjectAfter } = ordinaryWagesSubjectWithYtd(
        effectiveGross,
        ym,
        ytdOw
      );
      ytdOw = ytdOwSubjectAfter;
      const flows = monthlyCpfInflowsFromOwSubject(subject, band);
      oa += flows.oa;
      sa += flows.sa;
      ma += flows.ma;
    }

    if (annualBonusSafe > 0 && Number(ym.slice(5, 7)) === payoutMonth) {
      const awSubject = Math.min(
        annualBonusSafe,
        additionalWageCeilingRemaining(ytdOw)
      );
      if (awSubject > 0) {
        const awFlows = monthlyCpfInflowsFromOwSubject(awSubject, band);
        oa += awFlows.oa;
        sa += awFlows.sa;
        ma += awFlows.ma;
      }
    }

    for (const { loan } of paymentByYmByLoan) {
      if (ym === loan.completionMonth) {
        const lump = round2(loan.downpaymentFromOa + loan.feesFromOa);
        oa = round2(Math.max(0, oa - lump));
      }
    }

    for (const { loan, map } of paymentByYmByLoan) {
      const due = map.get(ym);
      if (due == null || due <= 0) continue;
      let fromOa = round2(due * loan.oaShareOfPayment);
      if (loan.maxOaPerMonth != null && loan.maxOaPerMonth >= 0) {
        fromOa = Math.min(fromOa, loan.maxOaPerMonth);
      }
      fromOa = Math.min(fromOa, oa);
      oa = round2(oa - fromOa);
    }

    const xfer = Math.min(oa, Math.max(0, initial.cpfisMonthlyFromOa));
    oa = round2(oa - xfer);
    cpfis = round2(cpfis + xfer);

    oa = round2(Math.max(0, oa));
    sa = round2(Math.max(0, sa));
    ma = round2(Math.max(0, ma));
    cpfis = round2(Math.max(0, cpfis));

    out.push({
      yearMonth: ym,
      oa,
      sa,
      ma,
      cpfis,
      totalCpf: round2(oa + sa + ma + cpfis),
    });
  }

  return out;
}

/**
 * Sample `everyNth` month (0 = all) for chart density.
 */
export function downsampleCpfSeries(
  series: CpfMonthPoint[],
  everyNth: number
): CpfMonthPoint[] {
  if (everyNth <= 1) return series;
  return series.filter((_, i) => i % everyNth === 0);
}
