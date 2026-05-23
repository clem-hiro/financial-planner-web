import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deleteBudgetLine,
  insertBudgetLine,
  listBudgetLines,
  updateBudgetLine,
} from "@/data/repositories/budget-lines";
import {
  deleteFinancialGoal,
  insertFinancialGoal,
  listFinancialGoals,
  updateFinancialGoal,
} from "@/data/repositories/goals";
import {
  deleteInvestment,
  insertInvestment,
  listInvestments,
  updateInvestment,
} from "@/data/repositories/investments";
import { getProfileById, updateProfile } from "@/data/repositories/profiles";
import type {
  AdvisorProposalChangeRow,
  BudgetLineRow,
  FinancialGoalRow,
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

function budgetLineWritePayload(row: BudgetLineRow) {
  return {
    category: row.category,
    cadence: row.cadence,
    amount: toNumOrNull(row.amount) ?? 0,
    calendar_year: row.calendar_year ?? null,
    start_year_month: row.start_year_month ?? null,
    end_year_month: row.end_year_month ?? null,
  };
}

function budgetLinePatch(
  before: BudgetLineRow,
  after: BudgetLineRow
): Parameters<typeof updateBudgetLine>[3] {
  const patch: Parameters<typeof updateBudgetLine>[3] = {};
  if (after.category !== before.category) patch.category = after.category;
  if (after.amount !== before.amount) patch.amount = toNumOrNull(after.amount) ?? 0;
  if (after.calendar_year !== before.calendar_year) {
    patch.calendar_year = after.calendar_year ?? null;
  }
  if (after.start_year_month !== before.start_year_month) {
    patch.start_year_month = after.start_year_month ?? null;
  }
  if (after.end_year_month !== before.end_year_month) {
    patch.end_year_month = after.end_year_month ?? null;
  }
  return patch;
}

function goalWritePayload(row: FinancialGoalRow) {
  return {
    title: row.title,
    target_amount: toNumOrNull(row.target_amount) ?? 0,
    target_date: row.target_date ?? null,
    linked_investment_id: row.linked_investment_id ?? null,
    current_amount: toNumOrNull(row.current_amount) ?? 0,
    monthly_contribution: toNumOrNull(row.monthly_contribution) ?? 0,
    expected_annual_return: toNumOrNull(row.expected_annual_return) ?? 0,
  };
}

function goalPatch(
  before: FinancialGoalRow,
  after: FinancialGoalRow
): Parameters<typeof updateFinancialGoal>[3] {
  const patch: Parameters<typeof updateFinancialGoal>[3] = {};
  if (after.title !== before.title) patch.title = after.title;
  if (after.target_amount !== before.target_amount) {
    patch.target_amount = toNumOrNull(after.target_amount) ?? 0;
  }
  if (after.target_date !== before.target_date) {
    patch.target_date = after.target_date ?? null;
  }
  if (after.linked_investment_id !== before.linked_investment_id) {
    patch.linked_investment_id = after.linked_investment_id ?? null;
  }
  if (after.current_amount !== before.current_amount) {
    patch.current_amount = toNumOrNull(after.current_amount) ?? 0;
  }
  if (after.monthly_contribution !== before.monthly_contribution) {
    patch.monthly_contribution = toNumOrNull(after.monthly_contribution) ?? 0;
  }
  if (after.expected_annual_return !== before.expected_annual_return) {
    patch.expected_annual_return = toNumOrNull(after.expected_annual_return) ?? 0;
  }
  return patch;
}

export type ProposalConflict = {
  entityType: AdvisorProposalChangeRow["entity_type"];
  entityId: string | null;
  label: string;
};

export type AcceptResult = { conflicts: ProposalConflict[] };

/**
 * Optimistic-concurrency pre-flight. base_version is the target entity's
 * updated_at captured at suggest-time. If the live row's updated_at no longer
 * matches (a client/another-proposal edit landed underneath) — or the row is
 * gone — accepting would silently overwrite that interim change. We detect it
 * from the already-batched base reads (no extra round-trip) and abort BEFORE
 * any write, so the accept is atomic: zero rows mutated on conflict.
 *
 * The ONLY sanctioned unguarded apply is a change row with `base_version ==
 * null` (a legacy/pre-P2 row that never captured a token). A change row that
 * DID capture a token demands a matching, present, versioned live row:
 *   - vanished row                       -> conflict
 *   - present but live version == null   -> conflict (post-migration anomaly;
 *       a versioned change against a token-less live row is unsafe — fail-safe,
 *       NOT a silent unguarded apply)  [H3]
 *   - present and version != base_version -> conflict
 * Every update/delete change row is evaluated independently (no collapse to
 * the entity's first row) so a mixed-base_version entity still conflicts on
 * the divergent row [H2]; the conflict OUTPUT is deduped per entity.
 */
function detectConflicts(
  changes: AdvisorProposalChangeRow[],
  base: OverlayInputs
): ProposalConflict[] {
  const liveRow = (
    entityType: AdvisorProposalChangeRow["entity_type"],
    entityId: string | null
  ): { present: boolean; version: string | undefined } => {
    if (entityType === "profile") {
      return { present: !!base.profile, version: base.profile?.updated_at };
    }
    const row =
      entityType === "budget_line"
        ? base.budgetLines.find((b) => b.id === entityId)
        : entityType === "goal"
          ? base.goals.find((g) => g.id === entityId)
          : base.investments.find((i) => i.id === entityId);
    return { present: !!row, version: row?.updated_at };
  };

  const conflictedEntities = new Set<string>();
  const conflicts: ProposalConflict[] = [];
  for (const c of changes) {
    const op = c.change_op ?? "update";
    if (op !== "update" && op !== "delete") continue;
    if (c.base_version == null) continue; // legacy/unversioned -> unguarded
    const key = `${c.entity_type}:${c.entity_id ?? "profile"}`;

    const { present, version } = liveRow(c.entity_type, c.entity_id);
    const conflict =
      !present || version == null || version !== c.base_version;
    if (conflict && !conflictedEntities.has(key)) {
      conflictedEntities.add(key);
      conflicts.push({
        entityType: c.entity_type,
        entityId: c.entity_id,
        label: c.field_label,
      });
    }
  }
  return conflicts;
}

/**
 * Read-only optimistic-concurrency pre-flight. MUST run while the proposal is
 * still 'pending' and BEFORE the C1 claim — a benign baseline-moved conflict
 * has to leave the proposal pending (advisor re-baselines), never park it in
 * 'accepting'. Returns the batched base reads so the writer doesn't re-read.
 */
export async function detectAcceptConflicts(
  supabase: SupabaseClient,
  clientUserId: string,
  changes: AdvisorProposalChangeRow[]
): Promise<{ conflicts: ProposalConflict[]; base: OverlayInputs }> {
  const [profile, investments, budgetLines, goals] = await Promise.all([
    getProfileById(supabase, clientUserId),
    listInvestments(supabase, clientUserId),
    listBudgetLines(supabase, clientUserId),
    listFinancialGoals(supabase, clientUserId),
  ]);
  const base: OverlayInputs = { profile, investments, budgetLines, goals };
  return { conflicts: detectConflicts(changes, base), base };
}

/**
 * Accept = persist the canonical state the *shared overlay mapper* produces.
 * Reading canonical, composing the effective state via `applyProposalChanges`,
 * then writing the diff guarantees the accepted result equals the proposed
 * preview (constraint C6 — one mapper, no second writer transform).
 *
 * `preCheckedBase` (handler path): the C1 claim already ran, so conflicts
 * were checked pre-claim — skip the re-detect (it could spuriously park a
 * just-claimed proposal) and write from the supplied base. Omitted (parity
 * test / direct callers): read + detect + write as before.
 */
export async function applyAcceptedProposalChanges(
  supabase: SupabaseClient,
  clientUserId: string,
  changes: AdvisorProposalChangeRow[],
  preCheckedBase?: OverlayInputs
): Promise<AcceptResult> {
  let base: OverlayInputs;
  if (preCheckedBase) {
    base = preCheckedBase;
  } else {
    const [profile, investments, budgetLines, goals] = await Promise.all([
      getProfileById(supabase, clientUserId),
      listInvestments(supabase, clientUserId),
      listBudgetLines(supabase, clientUserId),
      listFinancialGoals(supabase, clientUserId),
    ]);
    base = { profile, investments, budgetLines, goals };
    const conflicts = detectConflicts(changes, base);
    if (conflicts.length > 0) return { conflicts };
  }

  const { profile, investments, budgetLines, goals } = base;
  const effective = applyProposalChanges(base, changes);

  if (profile && effective.profile) {
    const patch = profilePatch(profile, effective.profile);
    if (Object.keys(patch).length > 0) {
      await updateProfile(supabase, clientUserId, patch);
    }
  }

  // Investments first so a created investment's real id is available to remap
  // a goal that links to it (draft-key -> real-id mapping pass).
  const investmentIdMap = new Map<string, string>();
  const invBeforeIds = new Set(investments.map((i) => i.id));
  const invAfterIds = new Set(effective.investments.map((i) => i.id));

  for (const before of investments) {
    if (!invAfterIds.has(before.id)) {
      await deleteInvestment(supabase, clientUserId, before.id);
    }
  }
  for (const after of effective.investments) {
    if (!invBeforeIds.has(after.id)) {
      const inserted = await insertInvestment(
        supabase,
        clientUserId,
        investmentWritePayload(after)
      );
      investmentIdMap.set(after.id, inserted.id);
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

  const blBeforeIds = new Set(budgetLines.map((b) => b.id));
  const blAfterIds = new Set(effective.budgetLines.map((b) => b.id));

  for (const before of budgetLines) {
    if (!blAfterIds.has(before.id)) {
      await deleteBudgetLine(supabase, clientUserId, before.id);
    }
  }
  for (const after of effective.budgetLines) {
    if (!blBeforeIds.has(after.id)) {
      await insertBudgetLine(
        supabase,
        clientUserId,
        budgetLineWritePayload(after)
      );
      continue;
    }
    const before = budgetLines.find((b) => b.id === after.id);
    if (before) {
      const patch = budgetLinePatch(before, after);
      if (Object.keys(patch).length > 0) {
        await updateBudgetLine(supabase, clientUserId, after.id, patch);
      }
    }
  }

  // H1 — a goal may only link to an investment that is canonical-existing or
  // created within THIS proposal. A draft key from another pending proposal
  // (or garbage) is forbidden: resolve it here against post-accept ids only
  // and fail loud rather than silently writing a dangling cross-proposal FK.
  const validInvestmentIds = new Set<string>([
    ...investments.map((i) => i.id),
    ...investmentIdMap.values(),
  ]);
  const remapLink = (id: string | null): string | null => {
    if (id == null) return null;
    const resolved = investmentIdMap.get(id) ?? id;
    if (!validInvestmentIds.has(resolved)) {
      throw new Error(
        "Cannot link a goal to an investment from a different proposal — re-baseline this proposal."
      );
    }
    return resolved;
  };

  const goalBeforeIds = new Set(goals.map((g) => g.id));
  const goalAfterIds = new Set(effective.goals.map((g) => g.id));

  for (const before of goals) {
    if (!goalAfterIds.has(before.id)) {
      await deleteFinancialGoal(supabase, clientUserId, before.id);
    }
  }
  for (const after of effective.goals) {
    const linked = remapLink(after.linked_investment_id);
    if (!goalBeforeIds.has(after.id)) {
      await insertFinancialGoal(supabase, clientUserId, {
        ...goalWritePayload(after),
        linked_investment_id: linked,
      });
      continue;
    }
    const before = goals.find((g) => g.id === after.id);
    if (before) {
      const patch = goalPatch(before, { ...after, linked_investment_id: linked });
      if (Object.keys(patch).length > 0) {
        await updateFinancialGoal(supabase, clientUserId, after.id, patch);
      }
    }
  }

  return { conflicts: [] };
}
