import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deleteBudgetLine,
  insertBudgetLine,
  listBudgetLines,
  updateBudgetLine,
} from "@/data/repositories/budget-lines";
import {
  deleteCashAccount,
  insertCashAccount,
  listCashAccounts,
  updateCashAccount,
} from "@/data/repositories/cash-accounts";
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
  CashAccountPurpose,
  CashAccountRow,
  FinancialGoalRow,
  InvestmentRow,
  ProfileRow,
} from "@/data/supabase/types";
import {
  applyProposalChanges,
  type OverlayInputs,
} from "@/domain/advisor-proposals/apply-overlay";
import { normalizeEntityName } from "@/lib/validation";

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

function budgetLineDiffers(a: BudgetLineRow, b: BudgetLineRow): boolean {
  return (
    a.category !== b.category ||
    (toNumOrNull(a.amount) ?? 0) !== (toNumOrNull(b.amount) ?? 0) ||
    (a.calendar_year ?? null) !== (b.calendar_year ?? null) ||
    (a.start_year_month ?? null) !== (b.start_year_month ?? null) ||
    (a.end_year_month ?? null) !== (b.end_year_month ?? null)
  );
}

// Minimal patch (changed fields only) — keeps the update write byte-identical
// to the pre-refactor behavior so the C6 preview==read-after-accept parity
// holds (a full payload would write null start/end columns the overlay omits).
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

function cashAccountWritePayload(row: CashAccountRow) {
  return {
    name: row.name,
    balance: toNumOrNull(row.balance) ?? 0,
    purpose: row.purpose as CashAccountPurpose,
  };
}

function cashAccountDiffers(a: CashAccountRow, b: CashAccountRow): boolean {
  return (
    a.name !== b.name ||
    (toNumOrNull(a.balance) ?? 0) !== (toNumOrNull(b.balance) ?? 0) ||
    a.purpose !== b.purpose
  );
}

/**
 * Generic create/update/delete diff for entities with NO cross-entity linkage
 * (budget lines, cash accounts, and the future liability/property/vehicle
 * types). Investments + goals stay bespoke — their investment-id remap and
 * goal→investment FK validation are load-bearing and must not be folded in.
 * `differs` should compare on the NORMALIZED form (toNumOrNull both sides) so
 * numeric representation noise never forces a spurious write.
 */
async function applyEntityDiff<T extends { id: string }, IP, UP>(
  before: T[],
  after: T[],
  ops: {
    differs: (b: T, a: T) => boolean;
    /** Full row payload for inserts. */
    insertPayload: (row: T) => IP;
    /** Update payload — a minimal patch (budget) or the full row (cash). */
    updatePayload: (before: T, after: T) => UP;
    insert: (payload: IP) => Promise<unknown>;
    update: (id: string, payload: UP) => Promise<unknown>;
    remove: (id: string) => Promise<unknown>;
  }
): Promise<void> {
  const beforeIds = new Set(before.map((r) => r.id));
  const afterIds = new Set(after.map((r) => r.id));
  for (const b of before) {
    if (!afterIds.has(b.id)) await ops.remove(b.id);
  }
  for (const a of after) {
    if (!beforeIds.has(a.id)) {
      await ops.insert(ops.insertPayload(a));
      continue;
    }
    const b = before.find((r) => r.id === a.id);
    if (b && ops.differs(b, a)) await ops.update(a.id, ops.updatePayload(b, a));
  }
}

/** entity_types the accept writer can persist. A change carrying anything else
 * (a CHECK-allowed type whose phase hasn't shipped) is rejected before any
 * write — fail loud rather than silently dropping it. */
const ACCEPTED_ENTITY_TYPES = new Set<AdvisorProposalChangeRow["entity_type"]>([
  "profile",
  "budget_line",
  "goal",
  "investment",
  "cash_account",
]);

function assertHandledEntityTypes(changes: AdvisorProposalChangeRow[]): void {
  for (const c of changes) {
    if (!ACCEPTED_ENTITY_TYPES.has(c.entity_type)) {
      throw new Error(
        `Cannot accept proposal: unsupported entity type "${c.entity_type}".`
      );
    }
  }
}

export type ProposalConflict = {
  entityType: AdvisorProposalChangeRow["entity_type"];
  entityId: string | null;
  label: string;
  // Distinguishes the optimistic-concurrency "baseline moved" conflict from a
  // name-uniqueness collision so the client UI can show the right guidance.
  // Absent = baseline_moved (back-compat for existing producers/tests).
  reason?: "baseline_moved" | "name_in_use";
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
          : entityType === "cash_account"
            ? base.cashAccounts?.find((c) => c.id === entityId)
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
 * Per-user name-uniqueness pre-flight. Computes the post-accept state via the
 * shared overlay mapper and flags any two effective entities of the same type
 * that share a normalized name (`lower(btrim)`) — exactly what the DB unique
 * index (migration 20260623000000) would reject mid-accept with a raw 23505.
 * Catching it pre-claim turns that into a friendly conflict and avoids parking
 * the proposal in the terminal 'accepting' state. Live rows are already unique
 * (the index guarantees it), so only the proposal's create/rename ops can
 * introduce a duplicate — and `effective` reflects exactly those.
 */
function detectNameConflicts(
  changes: AdvisorProposalChangeRow[],
  base: OverlayInputs
): ProposalConflict[] {
  const effective = applyProposalChanges(base, changes);
  const conflicts: ProposalConflict[] = [];

  const scan = (
    entityType: ProposalConflict["entityType"],
    rows: { id: string; name: string }[]
  ) => {
    const seen = new Set<string>();
    for (const row of rows) {
      const norm = normalizeEntityName(row.name);
      if (seen.has(norm)) {
        conflicts.push({
          entityType,
          entityId: row.id,
          label: row.name,
          reason: "name_in_use",
        });
      } else {
        seen.add(norm);
      }
    }
  };

  scan(
    "investment",
    effective.investments.map((i) => ({ id: i.id, name: i.name }))
  );
  scan(
    "goal",
    effective.goals.map((g) => ({ id: g.id, name: g.title }))
  );
  scan(
    "cash_account",
    (effective.cashAccounts ?? []).map((c) => ({ id: c.id, name: c.name }))
  );
  return conflicts;
}

/**
 * Map a post-claim unique-violation (SQLSTATE 23505 on a `*_user_name_ci_uq`
 * index) to the same `name_in_use` conflict surface the pre-claim check uses.
 * Covers the rare TOCTOU race where a colliding name lands between
 * `detectNameConflicts` and the write. Returns null for any other error so the
 * caller keeps its generic handler. Labels come from the proposal's own
 * create/rename name fields for the violated entity type. The accept path
 * writes investments, goals, and cash accounts; only those three carry a
 * `*_user_name_ci_uq` index, so the violated index maps to one of them
 * (budget lines have no name-uniqueness index).
 */
export function nameConflictFromWriteError(
  e: unknown,
  changes: AdvisorProposalChangeRow[]
): ProposalConflict[] | null {
  if (!e || typeof e !== "object") return null;
  if ((e as { code?: unknown }).code !== "23505") return null;
  const blob = (["message", "details", "hint", "constraint"] as const)
    .map((k) => (e as Record<string, unknown>)[k])
    .filter((s): s is string => typeof s === "string")
    .join(" ");
  if (!/_user_name_ci_uq/.test(blob)) return null;

  const entityType: ProposalConflict["entityType"] =
    /financial_goals_user_name_ci_uq/.test(blob)
      ? "goal"
      : /financial_cash_accounts_user_name_ci_uq/.test(blob)
        ? "cash_account"
        : "investment";
  const nameField = entityType === "goal" ? "title" : "name";
  const labels = [
    ...new Set(
      changes
        .filter(
          (c) =>
            c.entity_type === entityType &&
            (c.change_op ?? "update") !== "delete" &&
            c.field_key === nameField &&
            c.new_value != null
        )
        .map((c) => c.new_value as string)
    ),
  ];
  return (labels.length > 0 ? labels : [""]).map((label) => ({
    entityType,
    entityId: null,
    label,
    reason: "name_in_use" as const,
  }));
}

/**
 * Read-only pre-flight: optimistic-concurrency (baseline moved) AND per-user
 * name uniqueness. MUST run while the proposal is still 'pending' and BEFORE
 * the C1 claim — a benign conflict has to leave the proposal pending (advisor
 * re-baselines / renames), never park it in 'accepting'. Returns the batched
 * base reads so the writer doesn't re-read.
 */
export async function detectAcceptConflicts(
  supabase: SupabaseClient,
  clientUserId: string,
  changes: AdvisorProposalChangeRow[]
): Promise<{ conflicts: ProposalConflict[]; base: OverlayInputs }> {
  assertHandledEntityTypes(changes);
  const [profile, investments, budgetLines, goals, cashAccounts] =
    await Promise.all([
      getProfileById(supabase, clientUserId),
      listInvestments(supabase, clientUserId),
      listBudgetLines(supabase, clientUserId),
      listFinancialGoals(supabase, clientUserId),
      listCashAccounts(supabase, clientUserId),
    ]);
  const base: OverlayInputs = {
    profile,
    investments,
    budgetLines,
    goals,
    cashAccounts,
  };
  const conflicts = [
    ...detectConflicts(changes, base),
    ...detectNameConflicts(changes, base),
  ];
  return { conflicts, base };
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
  assertHandledEntityTypes(changes);
  let base: OverlayInputs;
  if (preCheckedBase) {
    base = preCheckedBase;
  } else {
    const [profile, investments, budgetLines, goals, cashAccounts] =
      await Promise.all([
        getProfileById(supabase, clientUserId),
        listInvestments(supabase, clientUserId),
        listBudgetLines(supabase, clientUserId),
        listFinancialGoals(supabase, clientUserId),
        listCashAccounts(supabase, clientUserId),
      ]);
    base = { profile, investments, budgetLines, goals, cashAccounts };
    const conflicts = detectConflicts(changes, base);
    if (conflicts.length > 0) return { conflicts };
  }

  const { profile, investments, budgetLines, goals } = base;
  const cashAccounts = base.cashAccounts ?? [];
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

  await applyEntityDiff(budgetLines, effective.budgetLines, {
    differs: budgetLineDiffers,
    insertPayload: budgetLineWritePayload,
    updatePayload: budgetLinePatch,
    insert: (p) => insertBudgetLine(supabase, clientUserId, p),
    update: (id, p) => updateBudgetLine(supabase, clientUserId, id, p),
    remove: (id) => deleteBudgetLine(supabase, clientUserId, id),
  });

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

  // Cash accounts — no cross-entity linkage, same generic diff as budget lines.
  await applyEntityDiff(cashAccounts, effective.cashAccounts ?? [], {
    differs: cashAccountDiffers,
    insertPayload: cashAccountWritePayload,
    updatePayload: (_before, after) => cashAccountWritePayload(after),
    insert: (p) => insertCashAccount(supabase, clientUserId, p),
    update: (id, p) => updateCashAccount(supabase, clientUserId, id, p),
    remove: (id) => deleteCashAccount(supabase, clientUserId, id),
  });

  return { conflicts: [] };
}
