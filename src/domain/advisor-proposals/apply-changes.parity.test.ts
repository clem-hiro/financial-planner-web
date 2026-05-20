import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyAcceptedProposalChanges } from "./apply-changes";
import { applyProposalChanges, type OverlayInputs } from "./apply-overlay";
import type { AdvisorProposalChangeRow } from "@/data/supabase/types";

type Row = Record<string, unknown>;

/**
 * Numeric columns PostgREST serializes as JSON strings on read. The fake must
 * mirror this so a write-then-read round-trips into the same canonical shape
 * the pure overlay mapper produces — that is what makes the parity assertion
 * an honest preview==read-after-accept proof rather than an artifact of the
 * fake's representation. Isolated to this file by design.
 */
const NUMERIC_STRING_COLS: Record<string, string[]> = {
  financial_profiles: [
    "monthly_income",
    "monthly_gross_salary",
    "savings_target_monthly",
    "fixed_expenses_monthly",
    "retirement_monthly_spend_goal",
    "retirement_dividend_yield_annual",
    "retirement_withdrawal_rate_annual",
    "annual_salary_growth_nominal",
    "annual_bonus",
    "debt_obligations_monthly",
    "expense_growth_nominal",
  ],
  financial_investments: [
    "current_value",
    "monthly_contribution",
    "expected_annual_return",
    "contribution_duration_years",
  ],
  financial_budget_lines: ["amount"],
  financial_goals: [
    "target_amount",
    "current_amount",
    "monthly_contribution",
    "expected_annual_return",
  ],
};

function coerceRead(table: string, row: Row): Row {
  const cols = NUMERIC_STRING_COLS[table] ?? [];
  const out: Row = { ...row };
  for (const c of cols) {
    if (out[c] !== null && out[c] !== undefined) out[c] = String(out[c]);
  }
  return out;
}

function makeFakeSupabase(seed: Record<string, Row[]>): SupabaseClient {
  const store: Record<string, Row[]> = {};
  for (const [t, rows] of Object.entries(seed)) {
    store[t] = rows.map((r) => ({ ...r }));
  }
  let idSeq = 0;

  function builder(table: string) {
    store[table] ??= [];
    const filters: Array<[string, unknown]> = [];
    let op: "select" | "insert" | "update" | "delete" = "select";
    let payload: Row | Row[] | null = null;
    let patch: Row | null = null;
    let returning = false;

    const matches = (r: Row) => filters.every(([c, v]) => r[c] === v);

    function run(): { data: Row | Row[] | null; error: null } {
      if (op === "insert") {
        const rows = Array.isArray(payload) ? payload : [payload as Row];
        const inserted = rows.map((r) => ({
          id: `db-${++idSeq}`,
          created_at: "2025-06-01T00:00:00Z",
          updated_at: "2025-06-01T00:00:00Z",
          ...r,
        }));
        store[table].push(...inserted);
        const data = inserted.map((r) => coerceRead(table, r));
        return { data: returning ? data[0] : null, error: null };
      }
      if (op === "update") {
        const updated: Row[] = [];
        for (const r of store[table]) {
          if (matches(r)) {
            Object.assign(r, patch);
            updated.push(r);
          }
        }
        const data = updated.map((r) => coerceRead(table, r));
        return { data: returning ? data[0] : null, error: null };
      }
      if (op === "delete") {
        store[table] = store[table].filter((r) => !matches(r));
        return { data: null, error: null };
      }
      const data = store[table]
        .filter(matches)
        .map((r) => coerceRead(table, r));
      return { data, error: null };
    }

    const chain: Record<string, unknown> = {
      select() {
        if (op === "insert" || op === "update") returning = true;
        return chain;
      },
      insert(v: Row | Row[]) {
        op = "insert";
        payload = v;
        return chain;
      },
      update(v: Row) {
        op = "update";
        patch = v;
        return chain;
      },
      delete() {
        op = "delete";
        return chain;
      },
      eq(c: string, v: unknown) {
        filters.push([c, v]);
        return chain;
      },
      is(c: string, v: unknown) {
        filters.push([c, v]);
        return chain;
      },
      order() {
        return chain;
      },
      maybeSingle() {
        const { data } = run();
        const first = Array.isArray(data) ? (data[0] ?? null) : data;
        return Promise.resolve({ data: first, error: null });
      },
      single() {
        const { data } = run();
        const first = Array.isArray(data) ? data[0] : data;
        return Promise.resolve({ data: first, error: null });
      },
      then(
        resolve: (r: { data: Row | Row[] | null; error: null }) => unknown
      ) {
        return Promise.resolve(run()).then(resolve);
      },
    };
    return chain;
  }

  return {
    from: (table: string) => builder(table),
  } as unknown as SupabaseClient;
}

function canonical(): OverlayInputs {
  return {
    profile: {
      id: "c1",
      profile_type: "client",
      advisor_user_id: "a1",
      display_name: "Old Name",
      monthly_income: "5000",
      salary_frequency: "monthly",
      annual_bonus: "0",
      savings_target_monthly: "1000",
      fixed_expenses_monthly: "2000",
      debt_obligations_monthly: "0",
      monthly_gross_salary: "6000",
      annual_salary_growth_nominal: "0.02",
      expense_growth_nominal: "0.02",
      cpf_age_band: "below_55",
      birth_date: "1990-01-01",
      target_retirement_age: 65,
      retirement_monthly_spend_goal: "3000",
      retirement_dividend_yield_annual: "0.03",
      retirement_withdrawal_rate_annual: "0.04",
      onboarding_required: false,
      onboarding_step: null,
      onboarding_completed_at: null,
      lifestyle_profile: null,
      budgeting_strategy: null,
      onboarding_confidence_level: null,
      budget_generation_source: null,
      estimated_budget_mode: false,
      food_spend_band: null,
      base_currency: "SGD",
      salary_increment_month: null,
      last_salary_review_at: null,
      last_investment_review_at: null,
      created_at: "2025-01-01T00:00:00Z",
    },
    investments: [
      {
        id: "inv1",
        user_id: "c1",
        name: "Brokerage",
        current_value: "10000",
        monthly_contribution: "500",
        expected_annual_return: "0.06",
        contribution_type: "until_retirement",
        contribution_duration_years: null,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      },
    ],
    budgetLines: [
      {
        id: "bl1",
        user_id: "c1",
        category: "food",
        cadence: "monthly",
        amount: "800",
        calendar_year: null,
        created_at: "2025-01-01T00:00:00Z",
      },
    ],
    goals: [
      {
        id: "g1",
        user_id: "c1",
        title: "House",
        target_amount: "100000",
        target_date: null,
        linked_investment_id: null,
        current_amount: "5000",
        monthly_contribution: "300",
        expected_annual_return: "0.04",
        created_at: "2025-01-01T00:00:00Z",
      },
    ],
  };
}

function ch(
  o: Partial<AdvisorProposalChangeRow> &
    Pick<AdvisorProposalChangeRow, "entity_type" | "field_key" | "new_value">
): AdvisorProposalChangeRow {
  return {
    id: `c-${o.field_key}-${o.entity_id ?? "p"}`,
    proposal_id: "prop1",
    section: o.section ?? "profile_assumptions",
    entity_id: o.entity_id ?? null,
    field_label: o.field_key,
    old_value: o.old_value ?? null,
    explanation: null,
    sort_order: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...o,
  };
}

const investmentValueShape = (rows: Array<Record<string, unknown>>) =>
  rows
    .map((i) => ({
      name: i.name,
      current_value: i.current_value,
      monthly_contribution: i.monthly_contribution,
      expected_annual_return: i.expected_annual_return,
      contribution_type: i.contribution_type ?? null,
      contribution_duration_years: i.contribution_duration_years ?? null,
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

describe("C6 anti-drift: overlay == canonical state after the accept path runs", () => {
  it("preview deep-equals read-after-accept for a broad change-set", async () => {
    const base = canonical();
    const changes: AdvisorProposalChangeRow[] = [
      ch({ entity_type: "profile", field_key: "display_name", new_value: "New Name", old_value: "Old Name" }),
      ch({ entity_type: "profile", field_key: "monthly_income", new_value: "7500", old_value: "5000" }),
      // the three fields the legacy accept path silently dropped:
      ch({ entity_type: "profile", field_key: "retirement_dividend_yield_annual", new_value: "0.05", old_value: "0.03", section: "retirement_planning" }),
      ch({ entity_type: "profile", field_key: "retirement_withdrawal_rate_annual", new_value: "0.035", old_value: "0.04", section: "retirement_planning" }),
      ch({ entity_type: "profile", field_key: "annual_salary_growth_nominal", new_value: "0.04", old_value: "0.02" }),
      ch({ entity_type: "profile", field_key: "target_retirement_age", new_value: "60", old_value: "65", section: "retirement_planning" }),
      ch({ entity_type: "budget_line", entity_id: "bl1", field_key: "amount", new_value: "950", old_value: "800", section: "cash_flow" }),
      ch({ entity_type: "goal", entity_id: "g1", field_key: "monthly_contribution", new_value: "750", old_value: "300", section: "goals" }),
      // partial investment edit — must NOT clobber unchanged fields:
      ch({ entity_type: "investment", entity_id: "inv1", field_key: "monthly_contribution", new_value: "900", old_value: "500", section: "investments" }),
      // brand-new investment:
      ch({ entity_type: "investment", entity_id: "new1", field_key: "name", new_value: "Robo", old_value: null, section: "investments" }),
      ch({ entity_type: "investment", entity_id: "new1", field_key: "current_value", new_value: "2000", old_value: null, section: "investments" }),
      ch({ entity_type: "investment", entity_id: "new1", field_key: "monthly_contribution", new_value: "250", old_value: null, section: "investments" }),
      ch({ entity_type: "investment", entity_id: "new1", field_key: "expected_annual_return", new_value: "0.07", old_value: null, section: "investments" }),
    ];

    const overlay = applyProposalChanges(base, changes);

    const supabase = makeFakeSupabase({
      financial_profiles: [base.profile as Row],
      financial_investments: base.investments as Row[],
      financial_budget_lines: base.budgetLines as Row[],
      financial_goals: base.goals as Row[],
    });
    await applyAcceptedProposalChanges(supabase, "c1", changes);

    const prof = await supabase
      .from("financial_profiles")
      .select("*")
      .eq("id", "c1")
      .maybeSingle();
    const invs = await supabase
      .from("financial_investments")
      .select("*")
      .eq("user_id", "c1");
    const bls = await supabase
      .from("financial_budget_lines")
      .select("*")
      .eq("user_id", "c1");
    const gls = await supabase
      .from("financial_goals")
      .select("*")
      .eq("user_id", "c1");

    // Profile: identical canonical shape (untouched fields preserved, the 3
    // formerly-dropped fields now persisted).
    expect(prof.data).toEqual(overlay.profile);
    expect((prof.data as Row).retirement_dividend_yield_annual).toBe("0.05");
    expect((prof.data as Row).retirement_withdrawal_rate_annual).toBe("0.035");
    expect((prof.data as Row).annual_salary_growth_nominal).toBe("0.04");

    expect((bls.data as Row[])).toEqual(overlay.budgetLines);
    expect((gls.data as Row[])).toEqual(overlay.goals);

    // Investments: ids/timestamps differ for the inserted row; the value-bearing
    // shape (what the projection consumes) must match exactly, and the partial
    // edit must not have clobbered the canonical name/current_value.
    expect(investmentValueShape(invs.data as Row[])).toEqual(
      investmentValueShape(
        overlay.investments as Array<Record<string, unknown>>
      )
    );
    const edited = (invs.data as Row[]).find((i) => i.name === "Brokerage");
    expect(edited?.monthly_contribution).toBe("900");
    expect(edited?.current_value).toBe("10000");
  });
});

describe("structural: apply-overlay.ts is IO-free (zero write/supabase imports)", () => {
  it("imports no repository or supabase client", () => {
    const src = readFileSync(
      path.resolve(__dirname, "apply-overlay.ts"),
      "utf8"
    );
    const importLines = src
      .split("\n")
      .filter((l) => l.trimStart().startsWith("import"));
    for (const line of importLines) {
      expect(line).not.toMatch(/@\/data\/repositories\//);
      expect(line).not.toMatch(/@supabase\/supabase-js/);
      expect(line).not.toMatch(/@\/data\/supabase\/server/);
    }
    // Only the row type module is allowed, and only as a type import.
    expect(src).toContain('import type {');
  });
});
