/**
 * Employer CPF on OW and OA/SA/MA/RA inflows as fractions of OW subject.
 * Allocation ratios follow CPFB's "CPF Allocation Rates from 1 January 2026"
 * table for private sector / non-pensionable employees.
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
  above_55_to_60: 0.16,
  above_60_to_65: 0.125,
  above_65_to_70: 0.09,
  above_70: 0.075,
};

type AllocationAgeBand =
  | "age_35_and_below"
  | "above_35_to_45"
  | "above_45_to_50"
  | "above_50_to_55"
  | "above_55_to_60"
  | "above_60_to_65"
  | "above_65_to_70"
  | "above_70";

type ContributionAllocation = {
  oa: number;
  sa: number;
  ra: number;
  ma: number;
};

const CPF_ALLOCATION_RATIOS_2026: Record<
  AllocationAgeBand,
  ContributionAllocation
> = {
  age_35_and_below: { oa: 0.6217, sa: 0.1621, ra: 0, ma: 0.2162 },
  above_35_to_45: { oa: 0.5677, sa: 0.1891, ra: 0, ma: 0.2432 },
  above_45_to_50: { oa: 0.5136, sa: 0.2162, ra: 0, ma: 0.2702 },
  above_50_to_55: { oa: 0.4055, sa: 0.3108, ra: 0, ma: 0.2837 },
  above_55_to_60: { oa: 0.353, sa: 0, ra: 0.3382, ma: 0.3088 },
  above_60_to_65: { oa: 0.14, sa: 0, ra: 0.44, ma: 0.42 },
  above_65_to_70: { oa: 0.0607, sa: 0, ra: 0.303, ma: 0.6363 },
  above_70: { oa: 0.08, sa: 0, ra: 0.08, ma: 0.84 },
};

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
  ageBand: SgCpfAgeBand,
  options?: {
    completedAge?: number | null;
    currentRaBalance?: number;
    cpfRaTarget?: number;
  }
): {
  oa: number;
  sa: number;
  ma: number;
  ra: number;
  totalContribution: number;
} {
  const total = totalCpfContributionRateSg(ageBand);
  const totalContribution = roundMoney(owSubject * total);
  const allocation = CPF_ALLOCATION_RATIOS_2026[
    allocationAgeBandForCpfContribution(ageBand, options?.completedAge)
  ];
  let oa = totalContribution * allocation.oa;
  const sa = totalContribution * allocation.sa;
  let ra = totalContribution * allocation.ra;
  const ma = totalContribution * allocation.ma;
  if (ra > 0) {
    const currentRa = Math.max(0, options?.currentRaBalance ?? 0);
    const targetRa = Math.max(0, options?.cpfRaTarget ?? 0);
    const raHeadroom = Math.max(0, targetRa - currentRa);
    const toRa = Math.min(ra, raHeadroom);
    oa += ra - toRa;
    ra = toRa;
  }
  return {
    oa: roundMoney(oa),
    sa: roundMoney(sa),
    ma: roundMoney(ma),
    ra: roundMoney(ra),
    totalContribution,
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

function allocationAgeBandForCpfContribution(
  ageBand: SgCpfAgeBand,
  completedAge: number | null | undefined
): AllocationAgeBand {
  if (Number.isFinite(completedAge)) {
    const age = Math.max(0, Math.floor(completedAge as number));
    if (age <= 35) return "age_35_and_below";
    if (age <= 45) return "above_35_to_45";
    if (age <= 50) return "above_45_to_50";
    if (age < 55) return "above_50_to_55";
    if (age < 60) return "above_55_to_60";
    if (age < 65) return "above_60_to_65";
    if (age < 70) return "above_65_to_70";
    return "above_70";
  }
  if (ageBand === "above_55_to_60") return "above_55_to_60";
  if (ageBand === "above_60_to_65") return "above_60_to_65";
  if (ageBand === "above_65_to_70") return "above_65_to_70";
  if (ageBand === "above_70") return "above_70";
  return "above_50_to_55";
}
