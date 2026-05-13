import { num } from "@/data/mappers";
import type { InvestmentRow } from "@/data/supabase/types";

/**
 * Months from “today” during which end-of-month contributions apply.
 * `undefined` = same as total horizon (legacy / no retirement cap available).
 */
export function contributionMonthsLimitFromInvestmentRow(
  row: Pick<
    InvestmentRow,
    "contribution_type" | "contribution_duration_years"
  >,
  monthsToRetirementFromNow: number | null
): number | undefined {
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
