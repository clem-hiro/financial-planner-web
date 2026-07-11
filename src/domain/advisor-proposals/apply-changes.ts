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
  deleteLiability,
  insertLiability,
  listLiabilities,
  updateLiability,
  type LiabilityWriteInput,
} from "@/data/repositories/liabilities";
import {
  deleteVehicle,
  insertVehicle,
  listVehicles,
  updateVehicle,
  type VehicleInsert,
} from "@/data/repositories/vehicles";
import {
  deleteProperty,
  insertProperty,
  listProperties,
  updateProperty,
  type PropertyInsert,
} from "@/data/repositories/properties";
import {
  deleteHousingLoan,
  insertHousingLoan,
  listHousingLoans,
  updateHousingLoan,
} from "@/data/repositories/housing-loans";
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
  HousingLoanRow,
  InvestmentRow,
  LiabilityRow,
  ProfileRow,
  PropertyRow,
  VehicleRow,
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
  "other_monthly_income",
  "monthly_gross_salary",
  "savings_target_monthly",
  "fixed_expenses_monthly",
  "retirement_monthly_spend_goal",
  "retirement_dividend_yield_annual",
  "retirement_withdrawal_rate_annual",
  "annual_salary_growth_nominal",
  "expense_growth_nominal",
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
    (a.investment_income_rate_annual ?? "0") !==
      (b.investment_income_rate_annual ?? "0") ||
    a.contribution_growth_annual !== b.contribution_growth_annual ||
    (a.contribution_type ?? null) !== (b.contribution_type ?? null) ||
    (a.contribution_duration_years ?? null) !==
      (b.contribution_duration_years ?? null) ||
    (a.contribution_start_date ?? null) !== (b.contribution_start_date ?? null) ||
    (a.contribution_end_date ?? null) !== (b.contribution_end_date ?? null) ||
    (a.plan_nature ?? null) !== (b.plan_nature ?? null) ||
    (a.withdrawal_annual ?? "0") !== (b.withdrawal_annual ?? "0") ||
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
    investment_income_rate_annual:
      toNumOrNull(row.investment_income_rate_annual ?? null) ?? 0,
    contribution_growth_annual:
      toNumOrNull(row.contribution_growth_annual) ?? 0,
    contribution_type: row.contribution_type || null,
    contribution_duration_years:
      toNumOrNull(row.contribution_duration_years ?? null),
    contribution_start_date: row.contribution_start_date ?? null,
    contribution_end_date: row.contribution_end_date ?? null,
    plan_nature: row.plan_nature ?? null,
    withdrawal_annual: toNumOrNull(row.withdrawal_annual ?? null) ?? 0,
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

function liabilityWritePayload(row: LiabilityRow): LiabilityWriteInput {
  return {
    name: row.name,
    balance: toNumOrNull(row.balance) ?? 0,
    category: row.category ?? null,
    loan_type: row.loan_type ?? null,
    interest_rate_annual: toNumOrNull(row.interest_rate_annual ?? null),
    remaining_tenure_months: row.remaining_tenure_months ?? null,
    monthly_repayment: toNumOrNull(row.monthly_repayment ?? null),
    repayment_override: row.repayment_override ?? false,
    start_date: row.start_date ?? null,
    notes: row.notes ?? null,
  };
}

function liabilityDiffers(a: LiabilityRow, b: LiabilityRow): boolean {
  return (
    a.name !== b.name ||
    (toNumOrNull(a.balance) ?? 0) !== (toNumOrNull(b.balance) ?? 0) ||
    (a.category ?? null) !== (b.category ?? null) ||
    (a.loan_type ?? null) !== (b.loan_type ?? null) ||
    (toNumOrNull(a.interest_rate_annual ?? null)) !==
      (toNumOrNull(b.interest_rate_annual ?? null)) ||
    (a.remaining_tenure_months ?? null) !==
      (b.remaining_tenure_months ?? null) ||
    (toNumOrNull(a.monthly_repayment ?? null)) !==
      (toNumOrNull(b.monthly_repayment ?? null)) ||
    (a.repayment_override ?? false) !== (b.repayment_override ?? false) ||
    (a.start_date ?? null) !== (b.start_date ?? null) ||
    (a.notes ?? null) !== (b.notes ?? null)
  );
}

function vehicleWritePayload(row: VehicleRow): VehicleInsert {
  return {
    label: row.label,
    vehicle_status: row.vehicle_status,
    loan_balance: toNumOrNull(row.loan_balance) ?? 0,
    loan_monthly_payment: toNumOrNull(row.loan_monthly_payment) ?? 0,
    loan_end_ym: row.loan_end_ym ?? null,
    monthly_petrol_cashcard: toNumOrNull(row.monthly_petrol_cashcard ?? null) ?? 0,
    annual_insurance: toNumOrNull(row.annual_insurance ?? null) ?? 0,
    annual_road_tax: toNumOrNull(row.annual_road_tax ?? null) ?? 0,
    annual_maintenance: toNumOrNull(row.annual_maintenance ?? null) ?? 0,
    display_order: row.display_order ?? 0,
  };
}

function vehicleDiffers(a: VehicleRow, b: VehicleRow): boolean {
  // Only the advisor-editable subset can change via compose.
  return (
    a.label !== b.label ||
    a.vehicle_status !== b.vehicle_status ||
    (toNumOrNull(a.current_market_value ?? null)) !==
      (toNumOrNull(b.current_market_value ?? null)) ||
    (toNumOrNull(a.on_the_road_paid) ?? 0) !==
      (toNumOrNull(b.on_the_road_paid) ?? 0) ||
    (toNumOrNull(a.loan_balance) ?? 0) !== (toNumOrNull(b.loan_balance) ?? 0) ||
    (toNumOrNull(a.loan_monthly_payment) ?? 0) !==
      (toNumOrNull(b.loan_monthly_payment) ?? 0) ||
    (a.loan_months_remaining ?? null) !== (b.loan_months_remaining ?? null)
  );
}

function propertyWritePayload(row: PropertyRow): PropertyInsert {
  return {
    name: row.name,
    property_type: row.property_type,
    purchase_price: toNumOrNull(row.purchase_price),
    current_valuation: toNumOrNull(row.current_valuation),
    ownership_percent: toNumOrNull(row.ownership_percent) ?? 100,
    status: row.status,
    rental_income_monthly: toNumOrNull(row.rental_income_monthly) ?? 0,
    planning_scope: row.planning_scope,
    display_order: row.display_order ?? 0,
  };
}

function propertyDiffers(a: PropertyRow, b: PropertyRow): boolean {
  return (
    a.name !== b.name ||
    a.property_type !== b.property_type ||
    (toNumOrNull(a.purchase_price)) !== (toNumOrNull(b.purchase_price)) ||
    (toNumOrNull(a.current_valuation)) !== (toNumOrNull(b.current_valuation)) ||
    (toNumOrNull(a.ownership_percent) ?? 100) !==
      (toNumOrNull(b.ownership_percent) ?? 100) ||
    a.status !== b.status ||
    (toNumOrNull(a.rental_income_monthly) ?? 0) !==
      (toNumOrNull(b.rental_income_monthly) ?? 0) ||
    a.planning_scope !== b.planning_scope
  );
}

// property_id is set by the caller (remapped + BOLA-checked); omitted here.
function housingLoanWritePayload(row: HousingLoanRow) {
  return {
    label: row.label,
    principal: toNumOrNull(row.principal) ?? 0,
    annual_nominal_rate: toNumOrNull(row.annual_nominal_rate) ?? 0,
    term_months: row.term_months ?? 0,
    completion_month: row.completion_month,
    first_payment_month: row.first_payment_month,
    downpayment_from_oa: toNumOrNull(row.downpayment_from_oa) ?? 0,
    fees_from_oa: toNumOrNull(row.fees_from_oa) ?? 0,
    oa_share_of_payment: toNumOrNull(row.oa_share_of_payment) ?? 0,
    max_oa_per_month: toNumOrNull(row.max_oa_per_month ?? null),
    lender_type: row.lender_type,
    original_loan_principal: toNumOrNull(row.original_loan_principal ?? null),
    principal_repaid_before_schedule:
      toNumOrNull(row.principal_repaid_before_schedule) ?? 0,
  };
}

function housingLoanDiffers(a: HousingLoanRow, b: HousingLoanRow): boolean {
  return (
    a.label !== b.label ||
    (a.property_id ?? null) !== (b.property_id ?? null) ||
    (toNumOrNull(a.principal) ?? 0) !== (toNumOrNull(b.principal) ?? 0) ||
    (toNumOrNull(a.annual_nominal_rate) ?? 0) !==
      (toNumOrNull(b.annual_nominal_rate) ?? 0) ||
    (a.term_months ?? 0) !== (b.term_months ?? 0) ||
    a.first_payment_month !== b.first_payment_month ||
    a.lender_type !== b.lender_type
  );
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
  "liability",
  "vehicle",
  "property",
  "housing_loan",
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
            : entityType === "property"
              ? base.properties?.find((p) => p.id === entityId)
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
  scan(
    "liability",
    (effective.liabilities ?? []).map((l) => ({ id: l.id, name: l.name }))
  );
  scan(
    "vehicle",
    (effective.vehicles ?? []).map((v) => ({ id: v.id, name: v.label }))
  );
  scan(
    "property",
    (effective.properties ?? []).map((p) => ({ id: p.id, name: p.name }))
  );
  scan(
    "housing_loan",
    (effective.housingLoans ?? []).map((h) => ({ id: h.id, name: h.label }))
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
        : /financial_liabilities_user_name_ci_uq/.test(blob)
          ? "liability"
          : /financial_vehicles_user_name_ci_uq/.test(blob)
            ? "vehicle"
            : /financial_properties_user_name_ci_uq/.test(blob)
              ? "property"
              : /financial_housing_loans_user_name_ci_uq/.test(blob)
                ? "housing_loan"
                : "investment";
  const nameField =
    entityType === "goal"
      ? "title"
      : entityType === "vehicle" || entityType === "housing_loan"
        ? "label"
        : "name";
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
  const [
    profile,
    investments,
    budgetLines,
    goals,
    cashAccounts,
    liabilities,
    vehicles,
    properties,
    housingLoans,
  ] = await Promise.all([
    getProfileById(supabase, clientUserId),
    listInvestments(supabase, clientUserId),
    listBudgetLines(supabase, clientUserId),
    listFinancialGoals(supabase, clientUserId),
    listCashAccounts(supabase, clientUserId),
    listLiabilities(supabase, clientUserId),
    listVehicles(supabase, clientUserId),
    listProperties(supabase, clientUserId),
    listHousingLoans(supabase, clientUserId),
  ]);
  const base: OverlayInputs = {
    profile,
    investments,
    budgetLines,
    goals,
    cashAccounts,
    liabilities,
    vehicles,
    properties,
    housingLoans,
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
    const [
      profile,
      investments,
      budgetLines,
      goals,
      cashAccounts,
      liabilities,
      vehicles,
      properties,
      housingLoans,
    ] = await Promise.all([
      getProfileById(supabase, clientUserId),
      listInvestments(supabase, clientUserId),
      listBudgetLines(supabase, clientUserId),
      listFinancialGoals(supabase, clientUserId),
      listCashAccounts(supabase, clientUserId),
      listLiabilities(supabase, clientUserId),
      listVehicles(supabase, clientUserId),
      listProperties(supabase, clientUserId),
      listHousingLoans(supabase, clientUserId),
    ]);
    base = {
      profile,
      investments,
      budgetLines,
      goals,
      cashAccounts,
      liabilities,
      vehicles,
      properties,
      housingLoans,
    };
    const conflicts = detectConflicts(changes, base);
    if (conflicts.length > 0) return { conflicts };
  }

  const { profile, investments, budgetLines, goals } = base;
  const cashAccounts = base.cashAccounts ?? [];
  const liabilities = base.liabilities ?? [];
  const vehicles = base.vehicles ?? [];
  const properties = base.properties ?? [];
  const housingLoans = base.housingLoans ?? [];
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

  // Liabilities — same generic diff (no cross-entity linkage).
  await applyEntityDiff(liabilities, effective.liabilities ?? [], {
    differs: liabilityDiffers,
    insertPayload: liabilityWritePayload,
    updatePayload: (_before, after) => liabilityWritePayload(after),
    insert: (p) => insertLiability(supabase, clientUserId, p),
    update: (id, p) => updateLiability(supabase, clientUserId, id, p),
    remove: (id) => deleteLiability(supabase, clientUserId, id),
  });

  // Vehicles — same generic diff (no cross-entity linkage).
  await applyEntityDiff(vehicles, effective.vehicles ?? [], {
    differs: vehicleDiffers,
    insertPayload: vehicleWritePayload,
    updatePayload: (_before, after) => vehicleWritePayload(after),
    insert: (p) => insertVehicle(supabase, clientUserId, p),
    update: (id, p) => updateVehicle(supabase, clientUserId, id, p),
    remove: (id) => deleteVehicle(supabase, clientUserId, id),
  });

  // Properties — bespoke (not applyEntityDiff) so we can capture the draft-key→
  // real-id map for the Phase 6 housing-loan property_id remap. Mirrors the
  // investmentIdMap pass. Properties first so a loan created in the same
  // proposal can resolve to a property created here.
  const effectiveProperties = effective.properties ?? [];
  const propBeforeIds = new Set(properties.map((p) => p.id));
  const propAfterIds = new Set(effectiveProperties.map((p) => p.id));
  const propertyIdMap = new Map<string, string>();

  for (const before of properties) {
    if (!propAfterIds.has(before.id)) {
      await deleteProperty(supabase, clientUserId, before.id);
    }
  }
  for (const after of effectiveProperties) {
    if (!propBeforeIds.has(after.id)) {
      const inserted = await insertProperty(
        supabase,
        clientUserId,
        propertyWritePayload(after)
      );
      propertyIdMap.set(after.id, inserted.id);
      continue;
    }
    const before = properties.find((p) => p.id === after.id);
    if (before && propertyDiffers(before, after)) {
      await updateProperty(
        supabase,
        clientUserId,
        after.id,
        propertyWritePayload(after)
      );
    }
  }
  // Phase 6 prep coupling (load-bearing): the housing-loan accept remaps a
  // loan's property_id through propertyIdMap, then asserts the resolved id is
  // in validPropertyIds — this client's EXISTING property ids ∪ the ids created
  // in THIS proposal. Proposal-scoped, NOT global: a loan may only link to a
  // property the client already owns or one created in the same proposal
  // (OWASP BOLA / tenant isolation). Built now; consumed in Phase 6.
  // Proposal-scoped (this client's existing ∪ this-proposal-created), NOT
  // global — a loan may only link to a property the client already owns or one
  // created in THIS proposal (OWASP BOLA / tenant isolation).
  const validPropertyIds = new Set<string>([
    ...properties.map((p) => p.id),
    ...propertyIdMap.values(),
  ]);
  const remapPropertyId = (pid: string | null | undefined): string | null => {
    if (pid == null || pid === "") return null;
    const resolved = propertyIdMap.get(pid) ?? pid;
    if (!validPropertyIds.has(resolved)) {
      throw new Error(
        "Cannot link a housing loan to a property from a different proposal — re-baseline this proposal."
      );
    }
    return resolved;
  };

  // Housing loans — bespoke (after properties) so a loan created in the same
  // proposal resolves its property_id to the just-created property's real id.
  const effectiveLoans = effective.housingLoans ?? [];
  const loanBeforeIds = new Set(housingLoans.map((h) => h.id));
  const loanAfterIds = new Set(effectiveLoans.map((h) => h.id));

  for (const before of housingLoans) {
    if (!loanAfterIds.has(before.id)) {
      await deleteHousingLoan(supabase, clientUserId, before.id);
    }
  }
  for (const after of effectiveLoans) {
    const propertyId = remapPropertyId(after.property_id);
    if (!loanBeforeIds.has(after.id)) {
      await insertHousingLoan(supabase, clientUserId, {
        ...housingLoanWritePayload(after),
        property_id: propertyId,
      });
      continue;
    }
    const before = housingLoans.find((h) => h.id === after.id);
    if (before && housingLoanDiffers(before, after)) {
      await updateHousingLoan(supabase, clientUserId, after.id, {
        ...housingLoanWritePayload(after),
        property_id: propertyId,
      });
    }
  }

  return { conflicts: [] };
}
