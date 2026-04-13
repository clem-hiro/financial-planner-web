/**
 * Employer CPF on OW and OA/SA/MA inflows as fractions of OW subject.
 * Approximation: below-55 allocation shape (23% / 6% / 8% of wages) scaled by
 * (employee + employer) total rate for the member's age band. Not a substitute
 * for CPFB statements (RA redirection, AW, SPR tiers, etc.).
 */

import type { SgCpfAgeBand } from "./sg-cpf";
import {
  ANNUAL_WAGE_CEILING_SG,
  employeeCpfRateSg,
  ordinaryWageCeilingSg,
} from "./sg-cpf";

/** Employer % of OW (private sector citizen, aligned with Jan 2026 employee table in sg-cpf). */
const EMPLOYER_RATE: Record<SgCpfAgeBand, number> = {
  below_55: 0.17,
  above_55_to_60: 0.15,
  above_60_to_65: 0.11,
  above_65_to_70: 0.095,
  above_70: 0.075,
};

/** Reference below-55 total and OA/SA/MA wage shares (CPFB private sector citizen). */
const REF_TOTAL_BELOW_55 = 0.37;
const REF_OA = 0.23;
const REF_SA = 0.06;
const REF_MA = 0.08;

export function employerCpfRateSg(ageBand: SgCpfAgeBand): number {
  return EMPLOYER_RATE[ageBand];
}

export function totalCpfContributionRateSg(ageBand: SgCpfAgeBand): number {
  return employeeCpfRateSg(ageBand) + employerCpfRateSg(ageBand);
}

/**
 * Monthly OA/SA/MA inflows from OW subject (same dollars as CPF uses for rates),
 * before bucket interest and withdrawals.
 */
export function monthlyCpfInflowsFromOwSubject(
  owSubject: number,
  ageBand: SgCpfAgeBand
): { oa: number; sa: number; ma: number; totalContribution: number } {
  const total = totalCpfContributionRateSg(ageBand);
  const scale = total / REF_TOTAL_BELOW_55;
  const oa = owSubject * REF_OA * scale;
  const sa = owSubject * REF_SA * scale;
  const ma = owSubject * REF_MA * scale;
  return {
    oa: roundMoney(oa),
    sa: roundMoney(sa),
    ma: roundMoney(ma),
    totalContribution: roundMoney(owSubject * total),
  };
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type OwSubjectYtdResult = {
  subject: number;
  ytdOwSubjectAfter: number;
};

/**
 * OW subject for this month given YTD OW already counted in the calendar year.
 * Resets `ytdOwSubjectBefore` to 0 at the start of each January (caller passes 0).
 */
export function ordinaryWagesSubjectWithYtd(
  grossMonthly: number,
  yearMonth: string,
  ytdOwSubjectBefore: number
): OwSubjectYtdResult {
  const ceiling = ordinaryWageCeilingSg(yearMonth);
  const afterMonthlyCeiling = Math.min(
    Math.max(0, grossMonthly),
    ceiling
  );
  const remainingAnnual = Math.max(
    0,
    ANNUAL_WAGE_CEILING_SG - Math.max(0, ytdOwSubjectBefore)
  );
  const subject = Math.min(afterMonthlyCeiling, remainingAnnual);
  return {
    subject,
    ytdOwSubjectAfter: Math.max(0, ytdOwSubjectBefore) + subject,
  };
}

export function sgCpfAgeBandForCompletedAge(age: number): SgCpfAgeBand {
  if (age < 55) return "below_55";
  if (age < 60) return "above_55_to_60";
  if (age < 65) return "above_60_to_65";
  if (age < 70) return "above_65_to_70";
  return "above_70";
}
