import { num } from "@/data/mappers";
import type { InvestmentRow } from "@/data/supabase/types";
import type { InvestmentBalanceRow } from "@/features/goals/investment-balance-types";

export function investmentRowToBalanceRow(row: InvestmentRow): InvestmentBalanceRow {
  return {
    id: row.id,
    name: row.name,
    current_value: num(row.current_value),
    monthly_contribution: num(row.monthly_contribution),
    expected_annual_return: num(row.expected_annual_return),
    contribution_growth_annual: num(row.contribution_growth_annual),
    contribution_type: row.contribution_type ?? null,
    contribution_duration_years:
      row.contribution_duration_years != null &&
      String(row.contribution_duration_years).trim() !== ""
        ? num(row.contribution_duration_years as string)
        : null,
    contribution_start_date: row.contribution_start_date ?? null,
    contribution_end_date: row.contribution_end_date ?? null,
    plan_nature: row.plan_nature ?? null,
    withdrawal_monthly: num(row.withdrawal_monthly),
    withdrawal_start_years:
      row.withdrawal_start_years != null &&
      String(row.withdrawal_start_years).trim() !== ""
        ? num(row.withdrawal_start_years)
        : null,
    updated_at: row.updated_at ?? null,
    created_at: row.created_at ?? null,
  };
}
