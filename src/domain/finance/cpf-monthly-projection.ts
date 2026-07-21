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
import {
  CPF_RA_FORMATION_AGE,
  CURRENT_FRS_SG,
  closeSpecialAccountBalance,
  routeCpfSaInvestmentMaturityProceeds,
  simulateRaFormationAt55,
  type CpfRaSimulation,
} from "./cpf-retirement-projection";

export const DEFAULT_CPF_OA_CREDITING_ANNUAL = 0.025;
export const DEFAULT_CPF_SA_CREDITING_ANNUAL = 0.04;
export const DEFAULT_CPF_MA_CREDITING_ANNUAL = 0.04;
/** RA uses the same floor crediting rate as SA in this MVP model. */
export const DEFAULT_CPF_RA_CREDITING_ANNUAL = DEFAULT_CPF_SA_CREDITING_ANNUAL;

export const CPF_BHS_ESTIMATED_ANNUAL_GROWTH_SG = 0.04;
export const CPF_BHS_OFFICIAL_BY_YEAR_SG = {
  2016: 49_800,
  2017: 52_000,
  2018: 54_500,
  2019: 57_200,
  2020: 60_000,
  2021: 63_000,
  2022: 66_000,
  2023: 68_500,
  2024: 71_500,
  2025: 75_500,
  2026: 79_000,
} as const;
export const CPF_BHS_LATEST_OFFICIAL_YEAR_SG = 2026;

const CPF_BHS_EARLIEST_OFFICIAL_YEAR_SG = 2016;

export type CpfBalanceSnapshot = {
  oa: number;
  sa: number;
  ma: number;
  ra?: number | null;
  oaAnnualRate?: number | null;
  saAnnualRate?: number | null;
  maAnnualRate?: number | null;
  cpfisMonthlyFromOa: number;
  cpfisNotionalBalance: number;
  cpfisAnnualReturn: number;
};

export type CpfInvestmentProjectionInput = {
  account: "oa" | "sa";
  purchaseMonth: string;
  premiumType: "single" | "regular";
  amount: number;
  projectedGrowthAnnual: number;
  maturityMonth: string;
};

export type HousingLoanProjectionInput = {
  completionMonth: string;
  firstPaymentMonth: string;
  downpaymentFromOa: number;
  feesFromOa: number;
  upfrontOaEvents?: Array<{
    yearMonth: string;
    amount: number;
  }>;
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
  ra: number;
  cpfis: number;
  totalCpf: number;
  /** Present on the month the age-55 OA/SA → RA set-aside runs. */
  raFormation?: CpfRaSimulation;
};

export type BasicHealthcareSumProjection = {
  amount: number;
  policyYear: number;
  isEstimated: boolean;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function endOfYearMonthDate(ym: string): Date {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0, 12, 0, 0, 0);
}

function endOfPreviousYearMonthDate(ym: string): Date {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 0, 12, 0, 0, 0);
}

function monthDiff(startYm: string, endYm: string): number {
  const [sy, sm] = startYm.split("-").map(Number);
  const [ey, em] = endYm.split("-").map(Number);
  return (ey - sy) * 12 + (em - sm);
}

function validYearMonth(ym: string): boolean {
  return /^\d{4}-\d{2}$/.test(ym);
}

export function basicHealthcareSumForYearSg(
  policyYear: number
): BasicHealthcareSumProjection {
  const year = Math.trunc(policyYear);
  const official =
    CPF_BHS_OFFICIAL_BY_YEAR_SG[
      year as keyof typeof CPF_BHS_OFFICIAL_BY_YEAR_SG
    ];
  if (official != null) {
    return { amount: official, policyYear: year, isEstimated: false };
  }
  if (year <= CPF_BHS_EARLIEST_OFFICIAL_YEAR_SG) {
    return {
      amount: CPF_BHS_OFFICIAL_BY_YEAR_SG[CPF_BHS_EARLIEST_OFFICIAL_YEAR_SG],
      policyYear: CPF_BHS_EARLIEST_OFFICIAL_YEAR_SG,
      isEstimated: false,
    };
  }
  const yearsAfterLatest = Math.max(0, year - CPF_BHS_LATEST_OFFICIAL_YEAR_SG);
  const latestAmount =
    CPF_BHS_OFFICIAL_BY_YEAR_SG[CPF_BHS_LATEST_OFFICIAL_YEAR_SG];
  return {
    amount: round2(
      latestAmount *
        Math.pow(1 + CPF_BHS_ESTIMATED_ANNUAL_GROWTH_SG, yearsAfterLatest)
    ),
    policyYear: year,
    isEstimated: true,
  };
}

function applicableBasicHealthcareSumForMonthSg(
  yearMonth: string,
  birthDate: string | null
): BasicHealthcareSumProjection {
  const projectionYear = Number(yearMonth.slice(0, 4));
  const birthYear =
    birthDate != null && /^\d{4}-\d{2}-\d{2}$/.test(birthDate)
      ? Number(birthDate.slice(0, 4))
      : null;
  const policyYear =
    birthYear == null
      ? projectionYear
      : Math.min(projectionYear, birthYear + 65);
  return basicHealthcareSumForYearSg(policyYear);
}

function overflowMediSaveAboveBhs(params: {
  ma: number;
  sa: number;
  ra: number;
  bhs: number;
  /** After RA formation / age 55, SA is closed — overflow goes to RA. */
  overflowToRa: boolean;
}): { ma: number; sa: number; ra: number } {
  const cap = Math.max(0, params.bhs);
  const excessMa = round2(Math.max(0, params.ma - cap));
  if (excessMa <= 0) {
    return { ma: params.ma, sa: params.sa, ra: params.ra };
  }
  if (params.overflowToRa) {
    return {
      ma: cap,
      sa: params.sa,
      ra: round2(params.ra + excessMa),
    };
  }
  return {
    ma: cap,
    sa: round2(params.sa + excessMa),
    ra: params.ra,
  };
}

function fixedBandAgeProxy(ageBand: SgCpfAgeBand | undefined): number {
  if (ageBand === "below_55") return 54;
  if (ageBand === "above_55_to_60") return 55;
  if (ageBand === "above_60_to_65") return 60;
  if (ageBand === "above_65_to_70") return 65;
  if (ageBand === "above_70") return 70;
  return 54;
}

/**
 * Month-step CPF projection: crediting on OA/SA/MA/RA, OW-based contributions with
 * annual OW cap and monthly ceiling, age-55 RA set-aside (SA then OA up to the
 * retirement-sum target), housing lumps + amortized payments from OA, optional
 * monthly OA→CPFIS transfer and notional CPFIS growth.
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
  /**
   * Zero-based month offset where employment CPF contributions stop. Month 0
   * means no projected salary / bonus CPF inflows; null means no stop.
   */
  employmentContributionEndMonth?: number | null;
  initial: CpfBalanceSnapshot;
  housingLoans: HousingLoanProjectionInput[];
  /** Recurring mortgage instalments are owned by the unified debt ledger when false. */
  deductRecurringHousingPayments?: boolean;
  cpfInvestments?: CpfInvestmentProjectionInput[];
  cpfRaTargetAt55?: number;
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
    employmentContributionEndMonth = null,
    initial,
    housingLoans,
    deductRecurringHousingPayments = true,
    cpfInvestments = [],
    cpfRaTargetAt55 = CURRENT_FRS_SG,
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
  let ra = round2(initial.ra ?? 0);
  let cpfis = round2(initial.cpfisNotionalBalance);

  const roa = initial.oaAnnualRate ?? DEFAULT_CPF_OA_CREDITING_ANNUAL;
  const rsa = initial.saAnnualRate ?? DEFAULT_CPF_SA_CREDITING_ANNUAL;
  const rma = initial.maAnnualRate ?? DEFAULT_CPF_MA_CREDITING_ANNUAL;
  /** RA tracks the SA floor rate in this MVP (no separate user override yet). */
  const rRa = rsa;
  const rCpfis = Math.max(0, initial.cpfisAnnualReturn);
  const cpfInvestmentStates = cpfInvestments
    .filter(
      (investment) =>
        validYearMonth(investment.purchaseMonth) &&
        validYearMonth(investment.maturityMonth) &&
        monthDiff(investment.purchaseMonth, investment.maturityMonth) >= 0 &&
        investment.amount > 0
    )
    .map((investment) => {
      let balance = 0;
      const monthlyRate =
        Math.max(-0.5, Math.min(1, investment.projectedGrowthAnnual)) / 12;
      let ym = investment.purchaseMonth;
      while (ym < startYearMonth && ym < investment.maturityMonth) {
        balance = round2(balance * (1 + monthlyRate));
        const shouldContribute =
          investment.premiumType === "single"
            ? ym === investment.purchaseMonth
            : ym >= investment.purchaseMonth;
        if (shouldContribute) {
          balance = round2(balance + investment.amount);
        }
        ym = addMonthsToYearMonth(ym, 1);
      }
      return { investment, balance, monthlyRate, matured: false };
    });

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
  const employmentEndMonth =
    employmentContributionEndMonth != null &&
    Number.isFinite(employmentContributionEndMonth)
      ? Math.max(0, Math.trunc(employmentContributionEndMonth))
      : null;
  /** Skip stock set-aside when a starting RA balance is already modelled. */
  let raSetAsideDone = round2(initial.ra ?? 0) > 0.5;

  for (let i = 0; i < horizonMonths; i++) {
    const ym = addMonthsToYearMonth(startYearMonth, i);
    const employmentContributionsActive =
      employmentEndMonth == null || i < employmentEndMonth;
    if (ym.endsWith("-01") && ym > startYearMonth && growth > 0) {
      effectiveGross *= 1 + growth;
    }
    if (ym.endsWith("-01")) {
      ytdOw = 0;
    }

    oa += round2((oa * roa) / 12);
    sa += round2((sa * rsa) / 12);
    ma += round2((ma * rma) / 12);
    ra += round2((ra * rRa) / 12);
    cpfis += round2((cpfis * rCpfis) / 12);
    for (const state of cpfInvestmentStates) {
      if (!state.matured && state.balance > 0) {
        state.balance = round2(state.balance * (1 + state.monthlyRate));
      }
    }

    const completedAgeForCpfMonth =
      birthDate != null
        ? ageCompletedOnDate(birthDate, endOfPreviousYearMonthDate(ym))
        : fixedBandAgeProxy(fixedCpfAgeBand);
    const ageAtMonthEnd =
      birthDate != null
        ? ageCompletedOnDate(birthDate, endOfYearMonthDate(ym))
        : fixedBandAgeProxy(fixedCpfAgeBand);
    const band: SgCpfAgeBand = sgCpfAgeBandForCompletedAge(
      completedAgeForCpfMonth
    );

    let raFormation: CpfRaSimulation | undefined;
    /**
     * Members already past 55: set aside opening stock once before salary
     * inflows so post-55 OA contributions stay in OA. Members turning 55 this
     * month: set aside after contributions (below) so birthday-month SA/OA
     * inflows are included in the transfer.
     */
    if (
      !raSetAsideDone &&
      ageAtMonthEnd >= CPF_RA_FORMATION_AGE &&
      completedAgeForCpfMonth >= CPF_RA_FORMATION_AGE
    ) {
      raFormation = simulateRaFormationAt55({
        oa,
        sa,
        targetRetirementSum: cpfRaTargetAt55,
      });
      oa = raFormation.afterRaCreation.remainingOa;
      sa = raFormation.afterRaCreation.remainingSa;
      ra = round2(ra + raFormation.afterRaCreation.ra);
      raSetAsideDone = true;
    } else if (
      ageAtMonthEnd >= CPF_RA_FORMATION_AGE &&
      sa > 0 &&
      raSetAsideDone
    ) {
      // Opening balances can include SA after RA already exists — SA is closed.
      ({ oa, sa, ra } = closeSpecialAccountBalance({
        sa,
        oa,
        ra,
        targetRetirementSum: cpfRaTargetAt55,
      }));
    }

    if (employmentContributionsActive && effectiveGross > 750) {
      const { subject, ytdOwSubjectAfter } = ordinaryWagesSubjectWithYtd(
        effectiveGross,
        ym,
        ytdOw
      );
      ytdOw = ytdOwSubjectAfter;
      const flows = monthlyCpfInflowsFromOwSubject(subject, band, {
        completedAge: completedAgeForCpfMonth,
        currentRaBalance: ra,
        cpfRaTarget: cpfRaTargetAt55,
      });
      oa += flows.oa;
      sa += flows.sa;
      ma += flows.ma;
      ra += flows.ra;
    }

    if (
      employmentContributionsActive &&
      annualBonusSafe > 0 &&
      Number(ym.slice(5, 7)) === payoutMonth
    ) {
      const awSubject = Math.min(
        annualBonusSafe,
        additionalWageCeilingRemaining(ytdOw)
      );
      if (awSubject > 0) {
        const awFlows = monthlyCpfInflowsFromOwSubject(awSubject, band, {
          completedAge: completedAgeForCpfMonth,
          currentRaBalance: ra,
          cpfRaTarget: cpfRaTargetAt55,
        });
        oa += awFlows.oa;
        sa += awFlows.sa;
        ma += awFlows.ma;
        ra += awFlows.ra;
      }
    }

    const memberPastRaFormationAge = ageAtMonthEnd >= CPF_RA_FORMATION_AGE;
    const bhs = applicableBasicHealthcareSumForMonthSg(ym, birthDate);
    ({ ma, sa, ra } = overflowMediSaveAboveBhs({
      ma,
      sa,
      ra,
      bhs: bhs.amount,
      overflowToRa: memberPastRaFormationAge || raSetAsideDone,
    }));

    if (
      !raSetAsideDone &&
      ageAtMonthEnd >= CPF_RA_FORMATION_AGE &&
      completedAgeForCpfMonth < CPF_RA_FORMATION_AGE
    ) {
      raFormation = simulateRaFormationAt55({
        oa,
        sa,
        targetRetirementSum: cpfRaTargetAt55,
      });
      oa = raFormation.afterRaCreation.remainingOa;
      sa = raFormation.afterRaCreation.remainingSa;
      ra = round2(ra + raFormation.afterRaCreation.ra);
      raSetAsideDone = true;
    }

    for (const { loan } of paymentByYmByLoan) {
      const explicitEvents = loan.upfrontOaEvents?.filter(
        (event) => event.yearMonth === ym && event.amount > 0
      );
      if (explicitEvents != null && explicitEvents.length > 0) {
        const lump = round2(
          explicitEvents.reduce((sum, event) => sum + event.amount, 0)
        );
        oa = round2(Math.max(0, oa - lump));
      } else if (!loan.upfrontOaEvents?.length && ym === loan.completionMonth) {
        const lump = round2(loan.downpaymentFromOa + loan.feesFromOa);
        oa = round2(Math.max(0, oa - lump));
      }
    }

    if (deductRecurringHousingPayments) {
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
    }

    for (const state of cpfInvestmentStates) {
      if (state.matured) continue;
      const investment = state.investment;

      if (ym === investment.maturityMonth) {
        const proceeds = round2(state.balance);
        if (proceeds > 0) {
          if (investment.account === "oa") {
            oa = round2(oa + proceeds);
          } else {
            const memberAgeAtMaturity =
              birthDate != null
                ? ageCompletedOnDate(birthDate, endOfYearMonthDate(ym))
                : fixedBandAgeProxy(fixedCpfAgeBand);
            const routed = routeCpfSaInvestmentMaturityProceeds({
              proceeds,
              memberAgeAtMaturity,
              currentRaBalance: ra,
              targetRetirementSum: cpfRaTargetAt55,
            });
            sa = round2(sa + routed.toSa);
            ra = round2(ra + routed.toRa);
            oa = round2(oa + routed.toOa);
          }
        }
        state.balance = 0;
        state.matured = true;
        continue;
      }

      const shouldContribute =
        ym >= investment.purchaseMonth &&
        ym < investment.maturityMonth &&
        (investment.premiumType === "regular" ||
          ym === investment.purchaseMonth);
      if (!shouldContribute) continue;

      if (investment.account === "oa") {
        const fromOa = round2(Math.min(oa, investment.amount));
        oa = round2(oa - fromOa);
        state.balance = round2(state.balance + fromOa);
      } else {
        const fromSa = round2(Math.min(sa, investment.amount));
        sa = round2(sa - fromSa);
        state.balance = round2(state.balance + fromSa);
      }
    }

    const xfer = Math.min(oa, Math.max(0, initial.cpfisMonthlyFromOa));
    oa = round2(oa - xfer);
    cpfis = round2(cpfis + xfer);

    oa = round2(Math.max(0, oa));
    sa = round2(Math.max(0, sa));
    ma = round2(Math.max(0, ma));
    ra = round2(Math.max(0, ra));
    const cpfInvestmentsNotional = round2(
      cpfInvestmentStates.reduce(
        (sum, state) => sum + (state.matured ? 0 : state.balance),
        0
      )
    );
    cpfis = round2(Math.max(0, cpfis));

    out.push({
      yearMonth: ym,
      oa,
      sa,
      ma,
      ra,
      cpfis: round2(cpfis + cpfInvestmentsNotional),
      totalCpf: round2(oa + sa + ma + ra + cpfis + cpfInvestmentsNotional),
      ...(raFormation ? { raFormation } : {}),
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
