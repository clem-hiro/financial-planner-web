import { num } from "@/data/mappers";
import type { InvestmentRow } from "@/data/supabase/types";
import { contributionScheduleFromDates } from "./investment-contribution-dates";

export type InvestmentContributionRowSlice = Pick<
  InvestmentRow,
  | "contribution_type"
  | "contribution_duration_years"
  | "contribution_start_date"
  | "contribution_end_date"
>;

/**
 * Months from “today” during which end-of-month contributions apply.
 * `undefined` = same as total horizon (legacy / no retirement cap available).
 */
export function contributionMonthsLimitFromInvestmentRow(
  row: InvestmentContributionRowSlice,
  monthsToRetirementFromNow: number | null
): number | undefined {
  const fromDates = contributionScheduleFromDates(
    row.contribution_start_date,
    row.contribution_end_date
  );
  if (fromDates) {
    return fromDates.contributionMonthsLimit;
  }

  const rawType = row.contribution_type;
  const isFixed = rawType === "fixed_duration";

  if (isFixed) {
    const years = num(row.contribution_duration_years);
    if (Number.isFinite(years) && years > 0) {
      return Math.max(1, Math.floor(years * 12));
    }
    if (
      monthsToRetirementFromNow != null &&
      Number.isFinite(monthsToRetirementFromNow)
    ) {
      return Math.max(0, Math.floor(monthsToRetirementFromNow));
    }
    return undefined;
  }

  if (
    monthsToRetirementFromNow != null &&
    Number.isFinite(monthsToRetirementFromNow)
  ) {
    return Math.max(0, Math.floor(monthsToRetirementFromNow));
  }
  return undefined;
}

/** Zero-based month index when contributions begin (future premium start). */
export function contributionStartMonthFromInvestmentRow(
  row: InvestmentContributionRowSlice
): number | undefined {
  const fromDates = contributionScheduleFromDates(
    row.contribution_start_date,
    row.contribution_end_date
  );
  if (fromDates && fromDates.contributionStartMonth > 0) {
    return fromDates.contributionStartMonth;
  }
  return undefined;
}

export function withdrawalStartMonthFromInvestmentRow(
  row: Pick<
    InvestmentRow,
    | "contribution_type"
    | "contribution_duration_years"
    | "contribution_start_date"
    | "contribution_end_date"
    | "withdrawal_monthly"
    | "withdrawal_start_years"
  >,
  monthsToRetirementFromNow: number | null
): number | undefined {
  const monthlyWithdrawal = num(row.withdrawal_monthly);
  if (!Number.isFinite(monthlyWithdrawal) || monthlyWithdrawal <= 0) {
    return undefined;
  }

  const startYears = num(row.withdrawal_start_years);
  if (Number.isFinite(startYears) && startYears >= 0) {
    return Math.floor(startYears * 12);
  }

  if (
    monthsToRetirementFromNow != null &&
    Number.isFinite(monthsToRetirementFromNow)
  ) {
    return Math.max(0, Math.floor(monthsToRetirementFromNow));
  }

  const contributionLimit = contributionMonthsLimitFromInvestmentRow(
    row,
    monthsToRetirementFromNow
  );
  return contributionLimit != null ? Math.max(0, contributionLimit) : undefined;
}
