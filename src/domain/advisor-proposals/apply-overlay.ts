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

/**
 * The four canonical bindings a proposal can re-shape. Same row shapes the
 * repositories return so `getDashboardPayload` can substitute them directly and
 * a post-accept re-read deep-equals this output (the C6 anti-drift invariant).
 */
export type OverlayInputs = {
  profile: ProfileRow | null;
  investments: InvestmentRow[];
  budgetLines: BudgetLineRow[];
  goals: FinancialGoalRow[];
  /** Optional: the accept writer threads cash accounts through; the dashboard
   * preview omits it (cash isn't previewed in projections yet). Cash changes
   * are no-ops in the overlay unless this is supplied. */
  cashAccounts?: CashAccountRow[];
  /** Optional: same accept-only threading as cashAccounts (liabilities aren't
   * previewed yet). Liability changes are no-ops unless supplied. */
  liabilities?: LiabilityRow[];
  /** Optional: accept-only threading (vehicles aren't previewed yet). */
  vehicles?: VehicleRow[];
  /** Optional: accept-only threading. Properties are referenced by housing
   * loans (Phase 6) — the accept writer maps draft→real property ids. */
  properties?: PropertyRow[];
  /** Optional: accept-only threading. A loan's `property_id` may be a draft
   * property id; the accept writer remaps it to the real id (BOLA-checked). */
  housingLoans?: HousingLoanRow[];
};

/** Numeric coercion — byte-identical semantics to the legacy accept path. */
function numOrNull(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Postgres `numeric` columns come back from PostgREST as strings, so effective
 * rows keep that shape — this is what makes preview == read-after-accept hold
 * without a representation conversion at the comparison boundary.
 */
function numStr(raw: string | null | undefined): string | null {
  const n = numOrNull(raw);
  return n === null ? null : String(n);
}

type EntityOp = "create" | "update" | "delete";

type ChangeGroup = {
  entityType: AdvisorProposalChangeRow["entity_type"];
  entityId: string | null;
  draftKey: string | null;
  changes: AdvisorProposalChangeRow[];
};

function groupByEntity(changes: AdvisorProposalChangeRow[]): ChangeGroup[] {
  const map = new Map<string, ChangeGroup>();
  for (const c of changes) {
    const draftKey = c.draft_entity_key ?? null;
    const key = c.entity_id
      ? `${c.entity_type}:id:${c.entity_id}`
      : draftKey
        ? `${c.entity_type}:draft:${draftKey}`
        : `${c.entity_type}:profile`;
    let g = map.get(key);
    if (!g) {
      g = {
        entityType: c.entity_type,
        entityId: c.entity_id,
        draftKey,
        changes: [],
      };
      map.set(key, g);
    }
    g.changes.push(c);
  }
  return [...map.values()];
}

/**
 * Explicit change_op ('create'/'delete') wins. Otherwise (undefined, or the
 * 'update' default that migration 20260602000000 backfills onto pre-P2 rows)
 * fall back to the original investment-only heuristics — this keeps in-flight
 * legacy proposals and the existing parity/overlay fixtures byte-identical.
 */
function resolveOp(group: ChangeGroup): EntityOp {
  const explicit = group.changes.find(
    (c) => c.change_op === "create" || c.change_op === "delete"
  )?.change_op;
  if (explicit === "create" || explicit === "delete") return explicit;

  if (group.entityType === "investment") {
    if (
      group.changes.some(
        (c) => c.field_key === "_deleted" && c.new_value === "true"
      )
    ) {
      return "delete";
    }
    if (
      group.changes.length > 0 &&
      group.changes.every((c) => c.old_value == null || c.old_value === "")
    ) {
      return "create";
    }
  }
  return "update";
}

function fieldMap(changes: AdvisorProposalChangeRow[]): Map<string, string | null> {
  return new Map(changes.map((c) => [c.field_key, c.new_value]));
}

/** ProfileRow numeric columns carried as strings (declared `string | null`). */
const PROFILE_NUM_STR_FIELDS = [
  "monthly_income",
  "monthly_gross_salary",
  "savings_target_monthly",
  "fixed_expenses_monthly",
  "retirement_monthly_spend_goal",
  "retirement_dividend_yield_annual",
  "retirement_withdrawal_rate_annual",
  "annual_salary_growth_nominal",
  "expense_growth_nominal",
] as const;

function applyProfile(
  profile: ProfileRow,
  m: Map<string, string | null>
): ProfileRow {
  const next: ProfileRow = { ...profile };
  if (m.has("display_name")) next.display_name = m.get("display_name") ?? null;
  for (const f of PROFILE_NUM_STR_FIELDS) {
    if (m.has(f)) next[f] = numStr(m.get(f));
  }
  if (m.has("target_retirement_age")) {
    const v = m.get("target_retirement_age");
    next.target_retirement_age = v != null ? Number(v) : null;
  }
  return next;
}

/**
 * Stable preview identity for a not-yet-persisted entity. Prefer draft_entity_key
 * (the P2 grouping token); fall back to the legacy advisor-side placeholder
 * entity_id so pre-P2 in-flight proposals still render.
 */
function newEntityId(group: ChangeGroup, fallback: string): string {
  return group.draftKey ?? group.entityId ?? fallback;
}

function applyInvestmentInsert(
  group: ChangeGroup,
  m: Map<string, string | null>
): InvestmentRow {
  const id = newEntityId(group, "overlay-investment");
  return {
    id,
    user_id: "",
    name: m.get("name") ?? "Investment",
    current_value: numStr(m.get("current_value")) ?? "0",
    monthly_contribution: numStr(m.get("monthly_contribution")) ?? "0",
    expected_annual_return: numStr(m.get("expected_annual_return")) ?? "0",
    investment_income_rate_annual:
      numStr(m.get("investment_income_rate_annual")) ?? "0",
    contribution_growth_annual:
      numStr(m.get("contribution_growth_annual")) ?? "0",
    contribution_type: m.get("contribution_type") || null,
    contribution_duration_years: m.get("contribution_duration_years")
      ? String(Number(m.get("contribution_duration_years")))
      : null,
    contribution_start_date: m.get("contribution_start_date") || null,
    contribution_end_date: m.get("contribution_end_date") || null,
    plan_nature: m.get("plan_nature") || null,
    withdrawal_annual: numStr(m.get("withdrawal_annual")) ?? "0",
    withdrawal_monthly: numStr(m.get("withdrawal_monthly")) ?? "0",
    withdrawal_start_years: m.get("withdrawal_start_years")
      ? String(Number(m.get("withdrawal_start_years")))
      : null,
    created_at: "",
    updated_at: "",
  };
}

function mergeInvestment(
  row: InvestmentRow,
  m: Map<string, string | null>
): InvestmentRow {
  const next: InvestmentRow = { ...row };
  if (m.has("name")) next.name = m.get("name") ?? "Investment";
  if (m.has("current_value")) next.current_value = numStr(m.get("current_value")) ?? "0";
  if (m.has("monthly_contribution")) {
    next.monthly_contribution = numStr(m.get("monthly_contribution")) ?? "0";
  }
  if (m.has("expected_annual_return")) {
    next.expected_annual_return = numStr(m.get("expected_annual_return")) ?? "0";
  }
  if (m.has("investment_income_rate_annual")) {
    next.investment_income_rate_annual =
      numStr(m.get("investment_income_rate_annual")) ?? "0";
  }
  if (m.has("contribution_growth_annual")) {
    next.contribution_growth_annual =
      numStr(m.get("contribution_growth_annual")) ?? "0";
  }
  if (m.has("contribution_type")) next.contribution_type = m.get("contribution_type") || null;
  if (m.has("contribution_duration_years")) {
    const v = m.get("contribution_duration_years");
    next.contribution_duration_years = v ? String(Number(v)) : null;
  }
  if (m.has("contribution_start_date")) {
    next.contribution_start_date = m.get("contribution_start_date") || null;
  }
  if (m.has("contribution_end_date")) {
    next.contribution_end_date = m.get("contribution_end_date") || null;
  }
  if (m.has("plan_nature")) next.plan_nature = m.get("plan_nature") || null;
  if (m.has("withdrawal_annual")) {
    next.withdrawal_annual = numStr(m.get("withdrawal_annual")) ?? "0";
  }
  if (m.has("withdrawal_monthly")) {
    next.withdrawal_monthly = numStr(m.get("withdrawal_monthly")) ?? "0";
  }
  if (m.has("withdrawal_start_years")) {
    const v = m.get("withdrawal_start_years");
    next.withdrawal_start_years = v ? String(Number(v)) : null;
  }
  return next;
}

function applyBudgetLineInsert(
  group: ChangeGroup,
  m: Map<string, string | null>
): BudgetLineRow {
  const cy = m.get("calendar_year");
  return {
    id: newEntityId(group, "overlay-budget-line"),
    user_id: "",
    category: m.get("category") || "uncategorized",
    cadence: m.get("cadence") === "annual" ? "annual" : "monthly",
    amount: numStr(m.get("amount")) ?? "0",
    calendar_year: cy ? Number(cy) : null,
    start_year_month: m.get("start_year_month") || null,
    end_year_month: m.get("end_year_month") || null,
    created_at: "",
  };
}

function mergeBudgetLine(
  row: BudgetLineRow,
  m: Map<string, string | null>
): BudgetLineRow {
  const next: BudgetLineRow = { ...row };
  if (m.has("amount")) {
    const amount = numOrNull(m.get("amount"));
    if (amount != null) next.amount = String(amount);
  }
  if (m.has("category")) next.category = m.get("category") || next.category;
  if (m.has("calendar_year")) {
    const v = m.get("calendar_year");
    next.calendar_year = v ? Number(v) : null;
  }
  if (m.has("start_year_month")) {
    next.start_year_month = m.get("start_year_month") || null;
  }
  if (m.has("end_year_month")) {
    next.end_year_month = m.get("end_year_month") || null;
  }
  return next;
}

function applyGoalInsert(
  group: ChangeGroup,
  m: Map<string, string | null>
): FinancialGoalRow {
  return {
    id: newEntityId(group, "overlay-goal"),
    user_id: "",
    title: m.get("title") || "Goal",
    target_amount: numStr(m.get("target_amount")) ?? "0",
    target_date: m.get("target_date") || null,
    linked_investment_id: m.get("linked_investment_id") || null,
    current_amount: numStr(m.get("current_amount")) ?? "0",
    monthly_contribution: numStr(m.get("monthly_contribution")) ?? "0",
    expected_annual_return: numStr(m.get("expected_annual_return")) ?? "0",
    display_order: 0,
    created_at: "",
  };
}

function mergeGoal(
  row: FinancialGoalRow,
  m: Map<string, string | null>
): FinancialGoalRow {
  const next: FinancialGoalRow = { ...row };
  if (m.has("monthly_contribution")) {
    const mc = numOrNull(m.get("monthly_contribution"));
    if (mc != null) next.monthly_contribution = String(mc);
  }
  if (m.has("title")) next.title = m.get("title") || next.title;
  if (m.has("target_amount")) {
    const ta = numOrNull(m.get("target_amount"));
    if (ta != null) next.target_amount = String(ta);
  }
  if (m.has("target_date")) next.target_date = m.get("target_date") || null;
  if (m.has("current_amount")) {
    const ca = numOrNull(m.get("current_amount"));
    if (ca != null) next.current_amount = String(ca);
  }
  if (m.has("expected_annual_return")) {
    const er = numOrNull(m.get("expected_annual_return"));
    if (er != null) next.expected_annual_return = String(er);
  }
  if (m.has("linked_investment_id")) {
    next.linked_investment_id = m.get("linked_investment_id") || null;
  }
  return next;
}

function applyCashAccountInsert(
  group: ChangeGroup,
  m: Map<string, string | null>
): CashAccountRow {
  return {
    id: newEntityId(group, "overlay-cash-account"),
    user_id: "",
    name: m.get("name") ?? "Cash account",
    balance: numStr(m.get("balance")) ?? "0",
    purpose: ((m.get("purpose") || "other") as CashAccountPurpose),
    created_at: "",
    updated_at: "",
  };
}

function mergeCashAccount(
  row: CashAccountRow,
  m: Map<string, string | null>
): CashAccountRow {
  const next: CashAccountRow = { ...row };
  if (m.has("name")) next.name = m.get("name") || next.name;
  if (m.has("balance")) next.balance = numStr(m.get("balance")) ?? "0";
  if (m.has("purpose")) {
    next.purpose = ((m.get("purpose") || next.purpose) as CashAccountPurpose);
  }
  return next;
}

function applyLiabilityInsert(
  group: ChangeGroup,
  m: Map<string, string | null>
): LiabilityRow {
  const tenure = m.get("remaining_tenure_months");
  return {
    id: newEntityId(group, "overlay-liability"),
    user_id: "",
    name: m.get("name") ?? "Liability",
    balance: numStr(m.get("balance")) ?? "0",
    created_at: "",
    category: (m.get("category") || null) as LiabilityRow["category"],
    loan_type: (m.get("loan_type") || null) as LiabilityRow["loan_type"],
    interest_rate_annual: numStr(m.get("interest_rate_annual")),
    remaining_tenure_months:
      tenure != null && tenure !== "" ? Number(tenure) : null,
    monthly_repayment: numStr(m.get("monthly_repayment")),
    repayment_override: m.get("repayment_override") === "true",
    start_date: m.get("start_date") || null,
    notes: m.get("notes") || null,
  };
}

function mergeLiability(
  row: LiabilityRow,
  m: Map<string, string | null>
): LiabilityRow {
  const next: LiabilityRow = { ...row };
  if (m.has("name")) next.name = m.get("name") || next.name;
  if (m.has("balance")) next.balance = numStr(m.get("balance")) ?? "0";
  if (m.has("category")) {
    next.category = (m.get("category") || null) as LiabilityRow["category"];
  }
  if (m.has("loan_type")) {
    next.loan_type = (m.get("loan_type") || null) as LiabilityRow["loan_type"];
  }
  if (m.has("interest_rate_annual")) {
    next.interest_rate_annual = numStr(m.get("interest_rate_annual"));
  }
  if (m.has("remaining_tenure_months")) {
    const v = m.get("remaining_tenure_months");
    next.remaining_tenure_months = v != null && v !== "" ? Number(v) : null;
  }
  if (m.has("monthly_repayment")) {
    next.monthly_repayment = numStr(m.get("monthly_repayment"));
  }
  if (m.has("repayment_override")) {
    next.repayment_override = m.get("repayment_override") === "true";
  }
  if (m.has("start_date")) next.start_date = m.get("start_date") || null;
  if (m.has("notes")) next.notes = m.get("notes") || null;
  return next;
}

// The advisor compose form edits this subset; create defaults the rest of the
// financial_vehicles modelling columns (client refines in their own form).
function applyVehicleInsert(
  group: ChangeGroup,
  m: Map<string, string | null>
): VehicleRow {
  const months = m.get("loan_months_remaining");
  return {
    id: newEntityId(group, "overlay-vehicle"),
    user_id: "",
    label: m.get("label") ?? "Vehicle",
    vehicle_status: m.get("vehicle_status") === "planned" ? "planned" : "active",
    current_market_value: numStr(m.get("current_market_value")),
    first_registration_ym: null,
    on_the_road_paid: numStr(m.get("on_the_road_paid")) ?? "0",
    arf_for_parf: null,
    body_open_market_at_purchase: null,
    body_depreciation_years: 0,
    coe_expiry_ym: null,
    parf_if_deregistered_today: null,
    coe_if_deregistered_today: null,
    body_scrap_if_deregistered_today: null,
    loan_balance: numStr(m.get("loan_balance")) ?? "0",
    loan_monthly_payment: numStr(m.get("loan_monthly_payment")) ?? "0",
    loan_months_remaining: months != null && months !== "" ? Number(months) : null,
    loan_end_ym: null,
    loan_prefer_stored_balance: true,
    loan_simple_remaining_estimate: false,
    terminal_recovery_at_coe_expiry: null,
    loan_annual_nominal_rate: null,
    monthly_petrol_cashcard: "0",
    annual_insurance: "0",
    annual_road_tax: "0",
    annual_maintenance: "0",
    display_order: 0,
    created_at: "",
  };
}

function applyPropertyInsert(
  group: ChangeGroup,
  m: Map<string, string | null>
): PropertyRow {
  return {
    id: newEntityId(group, "overlay-property"),
    user_id: "",
    name: m.get("name") ?? "Property",
    property_type: (m.get("property_type") ||
      "unknown") as PropertyRow["property_type"],
    purchase_price: numStr(m.get("purchase_price")),
    current_valuation: numStr(m.get("current_valuation")),
    ownership_percent: numStr(m.get("ownership_percent")) ?? "100",
    status: (m.get("status") || "living_in") as PropertyRow["status"],
    rental_income_monthly: numStr(m.get("rental_income_monthly")) ?? "0",
    planning_scope: (m.get("planning_scope") ||
      "current") as PropertyRow["planning_scope"],
    display_order: 0,
    created_at: "",
    updated_at: "",
  };
}

function mergeProperty(
  row: PropertyRow,
  m: Map<string, string | null>
): PropertyRow {
  const next: PropertyRow = { ...row };
  if (m.has("name")) next.name = m.get("name") || next.name;
  if (m.has("property_type")) {
    next.property_type = (m.get("property_type") ||
      next.property_type) as PropertyRow["property_type"];
  }
  if (m.has("purchase_price")) next.purchase_price = numStr(m.get("purchase_price"));
  if (m.has("current_valuation")) {
    next.current_valuation = numStr(m.get("current_valuation"));
  }
  if (m.has("ownership_percent")) {
    next.ownership_percent = numStr(m.get("ownership_percent")) ?? "100";
  }
  if (m.has("status")) {
    next.status = (m.get("status") || next.status) as PropertyRow["status"];
  }
  if (m.has("rental_income_monthly")) {
    next.rental_income_monthly = numStr(m.get("rental_income_monthly")) ?? "0";
  }
  if (m.has("planning_scope")) {
    next.planning_scope = (m.get("planning_scope") ||
      next.planning_scope) as PropertyRow["planning_scope"];
  }
  return next;
}

// Loan links to a property via `property_id` (an existing real id, or a draft
// property id resolved at accept). The advisor form edits a core subset; create
// defaults the OA/BSD modelling columns (client refines in their own form).
function applyHousingLoanInsert(
  group: ChangeGroup,
  m: Map<string, string | null>
): HousingLoanRow {
  const fpm = m.get("first_payment_month") || "";
  const term = m.get("term_months");
  return {
    id: newEntityId(group, "overlay-housing-loan"),
    user_id: "",
    property_id: m.get("property_id") || null,
    label: m.get("label") ?? "Home loan",
    principal: numStr(m.get("principal")) ?? "0",
    annual_nominal_rate: numStr(m.get("annual_nominal_rate")) ?? "0",
    term_months: term != null && term !== "" ? Number(term) : 0,
    completion_month: m.get("completion_month") || fpm,
    first_payment_month: fpm,
    downpayment_from_oa: "0",
    fees_from_oa: "0",
    oa_share_of_payment: "0",
    max_oa_per_month: null,
    lender_type: (m.get("lender_type") ||
      "bank") as HousingLoanRow["lender_type"],
    original_loan_principal: null,
    principal_repaid_before_schedule: "0",
    created_at: "",
  };
}

function mergeHousingLoan(
  row: HousingLoanRow,
  m: Map<string, string | null>
): HousingLoanRow {
  const next: HousingLoanRow = { ...row };
  if (m.has("property_id")) next.property_id = m.get("property_id") || null;
  if (m.has("label")) next.label = m.get("label") || next.label;
  if (m.has("principal")) next.principal = numStr(m.get("principal")) ?? "0";
  if (m.has("annual_nominal_rate")) {
    next.annual_nominal_rate = numStr(m.get("annual_nominal_rate")) ?? "0";
  }
  if (m.has("term_months")) {
    const v = m.get("term_months");
    next.term_months = v != null && v !== "" ? Number(v) : 0;
  }
  if (m.has("first_payment_month")) {
    next.first_payment_month = m.get("first_payment_month") || "";
  }
  if (m.has("lender_type")) {
    next.lender_type = (m.get("lender_type") ||
      next.lender_type) as HousingLoanRow["lender_type"];
  }
  return next;
}

function mergeVehicle(row: VehicleRow, m: Map<string, string | null>): VehicleRow {
  const next: VehicleRow = { ...row };
  if (m.has("label")) next.label = m.get("label") || next.label;
  if (m.has("vehicle_status")) {
    next.vehicle_status = m.get("vehicle_status") === "planned" ? "planned" : "active";
  }
  if (m.has("current_market_value")) {
    next.current_market_value = numStr(m.get("current_market_value"));
  }
  if (m.has("on_the_road_paid")) {
    next.on_the_road_paid = numStr(m.get("on_the_road_paid")) ?? "0";
  }
  if (m.has("loan_balance")) {
    next.loan_balance = numStr(m.get("loan_balance")) ?? "0";
  }
  if (m.has("loan_monthly_payment")) {
    next.loan_monthly_payment = numStr(m.get("loan_monthly_payment")) ?? "0";
  }
  if (m.has("loan_months_remaining")) {
    const v = m.get("loan_months_remaining");
    next.loan_months_remaining = v != null && v !== "" ? Number(v) : null;
  }
  return next;
}

/**
 * Pure, IO-free composition of `base + proposal changes`. Empty change-set
 * returns the inputs by identity (the no-overlay byte-identical fast path).
 * Never mutates inputs — including the request-cached profile object.
 *
 * This is the SINGLE shared mapper: the in-memory overlay (`dashboard.ts`) and
 * the accept writer (`apply-changes.ts`) both call it, with no second transform
 * and no persisted "proposed plan" copy — a stored overlay drifts from canonical
 * and breaks preview == read-after-accept (C6).
 *
 * MERGE-CONFLICT RULE: if this conflicts vs a pre-change main, KEEP this design
 * — reject any persisted overlay snapshot or duplicate mapper. See HANDOFF §7.
 */
export function applyProposalChanges(
  inputs: OverlayInputs,
  changes: AdvisorProposalChangeRow[]
): OverlayInputs {
  if (changes.length === 0) return inputs;

  let profile = inputs.profile;
  let investments = inputs.investments;
  let budgetLines = inputs.budgetLines;
  let goals = inputs.goals;
  let cashAccounts = inputs.cashAccounts;
  let liabilities = inputs.liabilities;
  let vehicles = inputs.vehicles;
  let properties = inputs.properties;
  let housingLoans = inputs.housingLoans;

  for (const group of groupByEntity(changes)) {
    const m = fieldMap(group.changes);

    if (group.entityType === "profile") {
      if (profile) profile = applyProfile(profile, m);
      continue;
    }

    const op = resolveOp(group);

    if (group.entityType === "budget_line") {
      if (op === "delete" && group.entityId) {
        budgetLines = budgetLines.filter((b) => b.id !== group.entityId);
      } else if (op === "create") {
        budgetLines = [...budgetLines, applyBudgetLineInsert(group, m)];
      } else if (group.entityId) {
        budgetLines = budgetLines.map((b) =>
          b.id === group.entityId ? mergeBudgetLine(b, m) : b
        );
      }
      continue;
    }

    if (group.entityType === "goal") {
      if (op === "delete" && group.entityId) {
        goals = goals.filter((g) => g.id !== group.entityId);
      } else if (op === "create") {
        goals = [...goals, applyGoalInsert(group, m)];
      } else if (group.entityId) {
        goals = goals.map((g) =>
          g.id === group.entityId ? mergeGoal(g, m) : g
        );
      }
      continue;
    }

    if (group.entityType === "investment") {
      if (op === "delete" && group.entityId) {
        investments = investments.filter((i) => i.id !== group.entityId);
      } else if (op === "create") {
        investments = [...investments, applyInvestmentInsert(group, m)];
      } else if (group.entityId) {
        investments = investments.map((i) =>
          i.id === group.entityId ? mergeInvestment(i, m) : i
        );
      }
      continue;
    }

    // Cash is a no-op unless the caller supplied cashAccounts (accept path).
    if (group.entityType === "cash_account" && cashAccounts) {
      if (op === "delete" && group.entityId) {
        cashAccounts = cashAccounts.filter((c) => c.id !== group.entityId);
      } else if (op === "create") {
        cashAccounts = [...cashAccounts, applyCashAccountInsert(group, m)];
      } else if (group.entityId) {
        cashAccounts = cashAccounts.map((c) =>
          c.id === group.entityId ? mergeCashAccount(c, m) : c
        );
      }
      continue;
    }

    // Liability — same accept-only no-op-unless-supplied contract as cash.
    if (group.entityType === "liability" && liabilities) {
      if (op === "delete" && group.entityId) {
        liabilities = liabilities.filter((l) => l.id !== group.entityId);
      } else if (op === "create") {
        liabilities = [...liabilities, applyLiabilityInsert(group, m)];
      } else if (group.entityId) {
        liabilities = liabilities.map((l) =>
          l.id === group.entityId ? mergeLiability(l, m) : l
        );
      }
      continue;
    }

    // Vehicle — same accept-only contract.
    if (group.entityType === "vehicle" && vehicles) {
      if (op === "delete" && group.entityId) {
        vehicles = vehicles.filter((v) => v.id !== group.entityId);
      } else if (op === "create") {
        vehicles = [...vehicles, applyVehicleInsert(group, m)];
      } else if (group.entityId) {
        vehicles = vehicles.map((v) =>
          v.id === group.entityId ? mergeVehicle(v, m) : v
        );
      }
      continue;
    }

    // Property — same accept-only contract.
    if (group.entityType === "property" && properties) {
      if (op === "delete" && group.entityId) {
        properties = properties.filter((p) => p.id !== group.entityId);
      } else if (op === "create") {
        properties = [...properties, applyPropertyInsert(group, m)];
      } else if (group.entityId) {
        properties = properties.map((p) =>
          p.id === group.entityId ? mergeProperty(p, m) : p
        );
      }
      continue;
    }

    // Housing loan — same accept-only contract; property_id remap happens in
    // the accept writer (this pure overlay just carries the raw value).
    if (group.entityType === "housing_loan" && housingLoans) {
      if (op === "delete" && group.entityId) {
        housingLoans = housingLoans.filter((h) => h.id !== group.entityId);
      } else if (op === "create") {
        housingLoans = [...housingLoans, applyHousingLoanInsert(group, m)];
      } else if (group.entityId) {
        housingLoans = housingLoans.map((h) =>
          h.id === group.entityId ? mergeHousingLoan(h, m) : h
        );
      }
    }
  }

  return {
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
}
