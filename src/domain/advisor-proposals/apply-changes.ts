import type { SupabaseClient } from "@supabase/supabase-js";
import { listBudgetLines, updateBudgetLine } from "@/data/repositories/budget-lines";
import { listFinancialGoals, updateFinancialGoal } from "@/data/repositories/goals";
import {
  deleteInvestment,
  insertInvestment,
  listInvestments,
  updateInvestment,
} from "@/data/repositories/investments";
import { getProfileById, updateProfile } from "@/data/repositories/profiles";
import type {
  AdvisorProposalChangeRow,
  InvestmentRow,
  ProfileRow,
} from "@/data/supabase/types";
import {
  applyProposalChanges,
  type OverlayInputs,
} from "@/domain/advisor-proposals/apply-overlay";

function toNumOrNull(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const PROFILE_NUM_FIELDS = [
  "monthly_income",
  "monthly_gross_salary",
  "savings_target_monthly",
  "fixed_expenses_monthly",
  "retirement_monthly_spend_goal",
  "retirement_dividend_yield_annual",
  "retirement_withdrawal_rate_annual",
  "annual_salary_growth_nominal",
] as const;

function profilePatch(
  before: ProfileRow,
  after: ProfileRow
): Parameters<typeof updateProfile>[2] {
  const patch: Parameters<typeof updateProfile>[2] = {};
  if (after.display_name !== before.display_name) {
    patch.display_name = after.display_name;
  }
  for (const f of PROFILE_NUM_FIELDS) {
    if (after[f] !== before[f]) patch[f] = toNumOrNull(after[f]);
  }
  if (after.target_retirement_age !== before.target_retirement_age) {
    patch.target_retirement_age = after.target_retirement_age;
  }
  return patch;
}

function investmentDiffers(a: InvestmentRow, b: InvestmentRow): boolean {
  return (
    a.name !== b.name ||
    a.current_value !== b.current_value ||
    a.monthly_contribution !== b.monthly_contribution ||
    a.expected_annual_return !== b.expected_annual_return ||
    a.contribution_growth_annual !== b.contribution_growth_annual ||
    (a.contribution_type ?? null) !== (b.contribution_type ?? null) ||
    (a.contribution_duration_years ?? null) !==
      (b.contribution_duration_years ?? null) ||
    a.withdrawal_monthly !== b.withdrawal_monthly ||
    (a.withdrawal_start_years ?? null) !== (b.withdrawal_start_years ?? null)
  );
}

function investmentWritePayload(row: InvestmentRow) {
  return {
    name: row.name,
    current_value: toNumOrNull(row.current_value) ?? 0,
    monthly_contribution: toNumOrNull(row.monthly_contribution) ?? 0,
    expected_annual_return: toNumOrNull(row.expected_annual_return) ?? 0,
    contribution_growth_annual:
      toNumOrNull(row.contribution_growth_annual) ?? 0,
    contribution_type: row.contribution_type || null,
    contribution_duration_years:
      toNumOrNull(row.contribution_duration_years ?? null),
    withdrawal_monthly: toNumOrNull(row.withdrawal_monthly) ?? 0,
    withdrawal_start_years: toNumOrNull(row.withdrawal_start_years ?? null),
  };
}

/**
 * Accept = persist the canonical state the *shared overlay mapper* produces.
 * Reading canonical, composing the effective state via `applyProposalChanges`,
 * then writing the diff guarantees the accepted result equals the proposed
 * preview (constraint C6 — one mapper, no second writer transform).
 */
export async function applyAcceptedProposalChanges(
  supabase: SupabaseClient,
  clientUserId: string,
  changes: AdvisorProposalChangeRow[]
): Promise<void> {
  const [profile, investments, budgetLines, goals] = await Promise.all([
    getProfileById(supabase, clientUserId),
    listInvestments(supabase, clientUserId),
    listBudgetLines(supabase, clientUserId),
    listFinancialGoals(supabase, clientUserId),
  ]);

  const base: OverlayInputs = { profile, investments, budgetLines, goals };
  const effective = applyProposalChanges(base, changes);

  if (profile && effective.profile) {
    const patch = profilePatch(profile, effective.profile);
    if (Object.keys(patch).length > 0) {
      await updateProfile(supabase, clientUserId, patch);
    }
  }

  for (const after of effective.budgetLines) {
    const before = budgetLines.find((b) => b.id === after.id);
    if (before && before.amount !== after.amount) {
      await updateBudgetLine(supabase, clientUserId, after.id, {
        amount: Number(after.amount),
      });
    }
  }

  for (const after of effective.goals) {
    const before = goals.find((g) => g.id === after.id);
    if (before && before.monthly_contribution !== after.monthly_contribution) {
      await updateFinancialGoal(supabase, clientUserId, after.id, {
        monthly_contribution: Number(after.monthly_contribution),
      });
    }
  }

  const beforeIds = new Set(investments.map((i) => i.id));
  const afterIds = new Set(effective.investments.map((i) => i.id));

  for (const before of investments) {
    if (!afterIds.has(before.id)) {
      await deleteInvestment(supabase, clientUserId, before.id);
    }
  }
  for (const after of effective.investments) {
    if (!beforeIds.has(after.id)) {
      await insertInvestment(
        supabase,
        clientUserId,
        investmentWritePayload(after)
      );
      continue;
    }
    const before = investments.find((i) => i.id === after.id);
    if (before && investmentDiffers(before, after)) {
      await updateInvestment(
        supabase,
        clientUserId,
        after.id,
        investmentWritePayload(after)
      );
    }
  }
}
