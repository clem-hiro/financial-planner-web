import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calculateTimeToGoal,
  calculateTimeToGoalInvestmentPortfolio,
  futureValueInvestmentPortfolioAtMonth,
  projectFutureValue,
} from "@/domain/finance";
import { num } from "@/data/mappers";
import { getInvestmentById, listInvestments } from "@/data/repositories/investments";
import type { InvestmentRow } from "@/data/supabase/types";

export type ProjectionSnapshot = {
  currentValue: number;
  monthlyContribution: number;
  annualReturn: number;
};

export function projectionSnapshotFromInvestmentRows(
  rows: InvestmentRow[]
): ProjectionSnapshot | null {
  if (!rows.length) return null;
  return aggregateInvestments(rows);
}

function aggregateInvestments(rows: InvestmentRow[]): ProjectionSnapshot {
  let totalValue = 0;
  let totalContribution = 0;
  let weightedReturnNumerator = 0;
  for (const r of rows) {
    const v = num(r.current_value);
    const pmt = num(r.monthly_contribution);
    const ret = num(r.expected_annual_return);
    totalValue += v;
    totalContribution += pmt;
    weightedReturnNumerator += v * ret;
  }
  const annualReturn =
    totalValue > 0 ? weightedReturnNumerator / totalValue : 0;
  return {
    currentValue: totalValue,
    monthlyContribution: totalContribution,
    annualReturn,
  };
}

export async function resolveProjectionSnapshot(
  supabase: SupabaseClient,
  userId: string,
  investmentId: string | null
): Promise<ProjectionSnapshot | null> {
  if (investmentId) {
    const row = await getInvestmentById(supabase, userId, investmentId);
    if (!row) return null;
    return {
      currentValue: num(row.current_value),
      monthlyContribution: num(row.monthly_contribution),
      annualReturn: num(row.expected_annual_return),
    };
  }
  const all = await listInvestments(supabase, userId);
  if (!all.length) return null;
  return aggregateInvestments(all);
}

export type ProjectionSeriesPoint = { month: number; value: number };

export function buildProjectionSeries(
  snap: ProjectionSnapshot,
  horizonMonths: number
): ProjectionSeriesPoint[] {
  const cap = Math.min(Math.max(horizonMonths, 1), 600);
  const out: ProjectionSeriesPoint[] = [];
  for (let m = 0; m <= cap; m++) {
    out.push({
      month: m,
      value: projectFutureValue({
        currentValue: snap.currentValue,
        monthlyContribution: snap.monthlyContribution,
        annualReturn: snap.annualReturn,
        months: m,
      }),
    });
  }
  return out;
}

/** Per-account contributions (with optional phase caps), summed each month. */
export function buildInvestmentProjectionSeries(
  rows: InvestmentRow[],
  horizonMonths: number,
  opts: { monthsToRetirementFromNow: number | null }
): ProjectionSeriesPoint[] {
  const cap = Math.min(Math.max(horizonMonths, 1), 600);
  const out: ProjectionSeriesPoint[] = [];
  for (let m = 0; m <= cap; m++) {
    out.push({
      month: m,
      value: futureValueInvestmentPortfolioAtMonth(
        rows,
        m,
        opts.monthsToRetirementFromNow
      ),
    });
  }
  return out;
}

export function timeToGoalForTarget(
  snap: ProjectionSnapshot,
  targetAmount: number,
  options?: {
    investmentRows?: InvestmentRow[];
    monthsToRetirementFromNow?: number | null;
  }
) {
  const rows = options?.investmentRows;
  if (rows && rows.length > 0) {
    return calculateTimeToGoalInvestmentPortfolio(
      rows,
      targetAmount,
      options?.monthsToRetirementFromNow ?? null
    );
  }
  return calculateTimeToGoal({
    currentValue: snap.currentValue,
    monthlyContribution: snap.monthlyContribution,
    annualReturn: snap.annualReturn,
    targetAmount,
  });
}
