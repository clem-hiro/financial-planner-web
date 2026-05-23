import type {
  AdvisorProposalChangeRow,
  BudgetLineRow,
  FinancialGoalRow,
  InvestmentRow,
  ProfileRow,
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

type ChangeGroup = {
  entityType: AdvisorProposalChangeRow["entity_type"];
  entityId: string | null;
  changes: AdvisorProposalChangeRow[];
};

function groupByEntity(changes: AdvisorProposalChangeRow[]): ChangeGroup[] {
  const map = new Map<string, ChangeGroup>();
  for (const c of changes) {
    const key = `${c.entity_type}:${c.entity_id ?? "profile"}`;
    let g = map.get(key);
    if (!g) {
      g = { entityType: c.entity_type, entityId: c.entity_id, changes: [] };
      map.set(key, g);
    }
    g.changes.push(c);
  }
  return [...map.values()];
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

function applyInvestmentInsert(
  group: ChangeGroup,
  m: Map<string, string | null>
): InvestmentRow {
  // entity_id on a new investment is the advisor-side placeholder UUID; reuse
  // it so the row has a stable identity in preview.
  const id = group.entityId ?? "overlay-investment";
  return {
    id,
    user_id: "",
    name: m.get("name") ?? "Investment",
    current_value: numStr(m.get("current_value")) ?? "0",
    monthly_contribution: numStr(m.get("monthly_contribution")) ?? "0",
    expected_annual_return: numStr(m.get("expected_annual_return")) ?? "0",
    contribution_growth_annual:
      numStr(m.get("contribution_growth_annual")) ?? "0",
    contribution_type: m.get("contribution_type") || null,
    contribution_duration_years: m.get("contribution_duration_years")
      ? String(Number(m.get("contribution_duration_years")))
      : null,
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
  if (m.has("contribution_growth_annual")) {
    next.contribution_growth_annual =
      numStr(m.get("contribution_growth_annual")) ?? "0";
  }
  if (m.has("contribution_type")) next.contribution_type = m.get("contribution_type") || null;
  if (m.has("contribution_duration_years")) {
    const v = m.get("contribution_duration_years");
    next.contribution_duration_years = v ? String(Number(v)) : null;
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

  for (const group of groupByEntity(changes)) {
    const m = fieldMap(group.changes);

    if (group.entityType === "profile") {
      if (profile) profile = applyProfile(profile, m);
      continue;
    }

    if (group.entityType === "budget_line" && group.entityId) {
      const amount = numOrNull(m.get("amount"));
      if (amount != null) {
        budgetLines = budgetLines.map((b) =>
          b.id === group.entityId ? { ...b, amount: String(amount) } : b
        );
      }
      continue;
    }

    if (group.entityType === "goal" && group.entityId) {
      const mc = numOrNull(m.get("monthly_contribution"));
      if (mc != null) {
        goals = goals.map((g) =>
          g.id === group.entityId
            ? { ...g, monthly_contribution: String(mc) }
            : g
        );
      }
      continue;
    }

    if (group.entityType === "investment") {
      if (m.get("_deleted") === "true" && group.entityId) {
        investments = investments.filter((i) => i.id !== group.entityId);
        continue;
      }
      const isNewEntity = group.changes.every(
        (c) => c.old_value == null || c.old_value === ""
      );
      if (isNewEntity) {
        investments = [...investments, applyInvestmentInsert(group, m)];
      } else if (group.entityId) {
        investments = investments.map((i) =>
          i.id === group.entityId ? mergeInvestment(i, m) : i
        );
      }
    }
  }

  return { profile, investments, budgetLines, goals };
}
