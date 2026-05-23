import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyAcceptedProposalChanges,
  detectAcceptConflicts,
  nameConflictFromWriteError,
} from "./apply-changes";
import { applyProposalChanges, type OverlayInputs } from "./apply-overlay";
import type { AdvisorProposalChangeRow } from "@/data/supabase/types";

type Row = Record<string, unknown>;

const NUMERIC_STRING_COLS: Record<string, string[]> = {
  financial_budget_lines: ["amount"],
  financial_goals: [
    "target_amount",
    "current_amount",
    "monthly_contribution",
    "expected_annual_return",
  ],
  financial_investments: [
    "current_value",
    "monthly_contribution",
    "expected_annual_return",
    "contribution_duration_years",
  ],
};

function coerceRead(table: string, row: Row): Row {
  const out: Row = { ...row };
  for (const c of NUMERIC_STRING_COLS[table] ?? []) {
    if (out[c] !== null && out[c] !== undefined) out[c] = String(out[c]);
  }
  return out;
}

/** Minimal PostgREST-shaped fake (mirrors apply-changes.parity.test.ts). */
function makeFakeSupabase(seed: Record<string, Row[]>) {
  const store: Record<string, Row[]> = {};
  for (const [t, rows] of Object.entries(seed)) store[t] = rows.map((r) => ({ ...r }));
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
      return {
        data: store[table].filter(matches).map((r) => coerceRead(table, r)),
        error: null,
      };
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
        return Promise.resolve({
          data: Array.isArray(data) ? data[0] : data,
          error: null,
        });
      },
      then(resolve: (r: { data: Row | Row[] | null; error: null }) => unknown) {
        return Promise.resolve(run()).then(resolve);
      },
    };
    return chain;
  }

  return {
    from: (t: string) => builder(t),
    store,
  } as unknown as SupabaseClient & { store: Record<string, Row[]> };
}

function ch(
  o: Partial<AdvisorProposalChangeRow> &
    Pick<AdvisorProposalChangeRow, "entity_type" | "field_key" | "new_value">
): AdvisorProposalChangeRow {
  return {
    id: `c-${o.field_key}-${o.entity_id ?? o.draft_entity_key ?? "p"}`,
    proposal_id: "p1",
    section: o.section ?? "cash_flow",
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

const V = "2025-01-01T00:00:00Z";

function seed() {
  return {
    financial_profiles: [{ id: "c1", display_name: "N", updated_at: V }],
    financial_investments: [] as Row[],
    financial_budget_lines: [
      {
        id: "bl1",
        user_id: "c1",
        category: "food",
        cadence: "monthly",
        amount: "800",
        calendar_year: null,
        created_at: V,
        updated_at: V,
      },
    ],
    financial_goals: [
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
        created_at: V,
        updated_at: V,
      },
    ],
  };
}

describe("optimistic-concurrency pre-flight (scenario matrix)", () => {
  it("base_version MATCHES live updated_at -> applies, no conflicts", async () => {
    const fake = makeFakeSupabase(seed());
    const res = await applyAcceptedProposalChanges(fake, "c1", [
      ch({
        entity_type: "budget_line",
        entity_id: "bl1",
        field_key: "amount",
        new_value: "950",
        old_value: "800",
        change_op: "update",
        base_version: V,
      }),
    ]);
    expect(res.conflicts).toEqual([]);
    expect(fake.store.financial_budget_lines[0].amount).toBe(950);
  });

  it("base_version MISMATCH -> conflict, zero rows written (atomic abort)", async () => {
    const s = seed();
    s.financial_budget_lines[0].updated_at = "2025-09-09T00:00:00Z"; // moved
    const fake = makeFakeSupabase(s);
    const res = await applyAcceptedProposalChanges(fake, "c1", [
      ch({
        entity_type: "budget_line",
        entity_id: "bl1",
        field_key: "amount",
        new_value: "950",
        old_value: "800",
        change_op: "update",
        base_version: V,
      }),
    ]);
    expect(res.conflicts).toHaveLength(1);
    expect(res.conflicts[0].entityId).toBe("bl1");
    expect(fake.store.financial_budget_lines[0].amount).toBe("800"); // untouched
  });

  it("delete whose target VANISHED underneath -> conflict, no write", async () => {
    const s = seed();
    s.financial_goals = []; // gone
    const fake = makeFakeSupabase(s);
    const res = await applyAcceptedProposalChanges(fake, "c1", [
      ch({
        entity_type: "goal",
        entity_id: "g1",
        field_key: "monthly_contribution",
        new_value: "0",
        old_value: "300",
        change_op: "delete",
        base_version: V,
      }),
    ]);
    expect(res.conflicts).toHaveLength(1);
    expect(res.conflicts[0].entityType).toBe("goal");
  });

  it("H2 — mixed base_version on one entity: a divergent row still conflicts (no first-row collapse)", async () => {
    const fake = makeFakeSupabase(seed()); // bl1 live updated_at = V
    const res = await applyAcceptedProposalChanges(fake, "c1", [
      // first row's base_version matches live -> on its own, no conflict
      ch({
        entity_type: "budget_line",
        entity_id: "bl1",
        field_key: "amount",
        new_value: "900",
        old_value: "800",
        change_op: "update",
        base_version: V,
      }),
      // second row for the SAME entity captured a STALE base_version. The old
      // seen-first-wins logic dropped this -> silent overwrite. Must conflict.
      ch({
        entity_type: "budget_line",
        entity_id: "bl1",
        field_key: "category",
        new_value: "transport",
        old_value: "food",
        change_op: "update",
        base_version: "STALE-vX",
      }),
    ]);
    expect(res.conflicts).toHaveLength(1);
    expect(res.conflicts[0].entityId).toBe("bl1");
    expect(fake.store.financial_budget_lines[0].amount).toBe("800"); // zero-write
  });

  it("H3 — versioned change vs present-but-token-null live row is a HARD conflict (not silent unguarded)", async () => {
    const s = seed();
    delete (s.financial_budget_lines[0] as Record<string, unknown>).updated_at;
    const fake = makeFakeSupabase(s);
    const res = await applyAcceptedProposalChanges(fake, "c1", [
      ch({
        entity_type: "budget_line",
        entity_id: "bl1",
        field_key: "amount",
        new_value: "950",
        old_value: "800",
        change_op: "update",
        base_version: V, // versioned change, but live row has no token
      }),
    ]);
    expect(res.conflicts).toHaveLength(1);
    expect(fake.store.financial_budget_lines[0].amount).toBe("800");
  });

  it("null base_version (legacy/unversioned) -> applies unguarded", async () => {
    const s = seed();
    s.financial_budget_lines[0].updated_at = "2025-09-09T00:00:00Z";
    const fake = makeFakeSupabase(s);
    const res = await applyAcceptedProposalChanges(fake, "c1", [
      ch({
        entity_type: "budget_line",
        entity_id: "bl1",
        field_key: "amount",
        new_value: "777",
        old_value: "800",
        change_op: "update",
        base_version: null,
      }),
    ]);
    expect(res.conflicts).toEqual([]);
    expect(fake.store.financial_budget_lines[0].amount).toBe(777);
  });
});

describe("change_op writer: create / delete across entity types", () => {
  it("change_op delete removes the goal row", async () => {
    const fake = makeFakeSupabase(seed());
    const res = await applyAcceptedProposalChanges(fake, "c1", [
      ch({
        entity_type: "goal",
        entity_id: "g1",
        field_key: "monthly_contribution",
        new_value: "0",
        old_value: "300",
        change_op: "delete",
      }),
    ]);
    expect(res.conflicts).toEqual([]);
    expect(fake.store.financial_goals).toHaveLength(0);
  });

  it("change_op create inserts a new budget line from its draft group", async () => {
    const fake = makeFakeSupabase(seed());
    const res = await applyAcceptedProposalChanges(fake, "c1", [
      ch({
        entity_type: "budget_line",
        field_key: "category",
        new_value: "transport",
        change_op: "create",
        draft_entity_key: "nbl",
      }),
      ch({
        entity_type: "budget_line",
        field_key: "amount",
        new_value: "120",
        change_op: "create",
        draft_entity_key: "nbl",
      }),
    ]);
    expect(res.conflicts).toEqual([]);
    expect(fake.store.financial_budget_lines).toHaveLength(2);
    const created = fake.store.financial_budget_lines.find(
      (b) => b.category === "transport"
    );
    expect(created).toBeTruthy();
    expect(String(created?.amount)).toBe("120");
  });
});

describe("apply-overlay: draft_entity_key groups distinct new entities", () => {
  it("two create groups produce two independent new investments", () => {
    const base: OverlayInputs = {
      profile: null,
      investments: [],
      budgetLines: [],
      goals: [],
    };
    const out = applyProposalChanges(base, [
      ch({
        entity_type: "investment",
        field_key: "name",
        new_value: "Alpha",
        change_op: "create",
        draft_entity_key: "k1",
      }),
      ch({
        entity_type: "investment",
        field_key: "name",
        new_value: "Beta",
        change_op: "create",
        draft_entity_key: "k2",
      }),
    ]);
    expect(out.investments.map((i) => i.name).sort()).toEqual([
      "Alpha",
      "Beta",
    ]);
    expect(new Set(out.investments.map((i) => i.id)).size).toBe(2);
  });
});

function invRow(id: string, name: string): Row {
  return {
    id,
    user_id: "c1",
    name,
    current_value: "1000",
    monthly_contribution: "0",
    expected_annual_return: "0.05",
    contribution_growth_annual: "0",
    withdrawal_monthly: "0",
    withdrawal_start_years: null,
    created_at: V,
    updated_at: V,
  };
}

describe("name-uniqueness pre-flight (scenario matrix)", () => {
  it("two create-op investments with the same name (diff case) -> name_in_use", async () => {
    const fake = makeFakeSupabase(seed());
    const { conflicts } = await detectAcceptConflicts(fake, "c1", [
      ch({
        entity_type: "investment",
        field_key: "name",
        new_value: "ilp2",
        change_op: "create",
        draft_entity_key: "k1",
      }),
      ch({
        entity_type: "investment",
        field_key: "name",
        new_value: "ILP2",
        change_op: "create",
        draft_entity_key: "k2",
      }),
    ]);
    expect(conflicts.some((c) => c.reason === "name_in_use")).toBe(true);
  });

  it("create-op investment colliding with an existing live one (whitespace) -> conflict", async () => {
    const s = { ...seed(), financial_investments: [invRow("i1", "ILP2")] };
    const fake = makeFakeSupabase(s);
    const { conflicts } = await detectAcceptConflicts(fake, "c1", [
      ch({
        entity_type: "investment",
        field_key: "name",
        new_value: "  ilp2 ",
        change_op: "create",
        draft_entity_key: "k1",
      }),
    ]);
    expect(conflicts.some((c) => c.reason === "name_in_use")).toBe(true);
  });

  it("create-op goal title colliding with existing goal (case-insensitive) -> conflict", async () => {
    const fake = makeFakeSupabase(seed());
    const { conflicts } = await detectAcceptConflicts(fake, "c1", [
      ch({
        entity_type: "goal",
        field_key: "title",
        new_value: "HOUSE",
        change_op: "create",
        draft_entity_key: "k1",
      }),
    ]);
    expect(conflicts.some((c) => c.reason === "name_in_use")).toBe(true);
  });

  it("rename of an existing investment onto another existing name -> conflict", async () => {
    const s = {
      ...seed(),
      financial_investments: [invRow("i1", "Alpha"), invRow("i2", "Beta")],
    };
    const fake = makeFakeSupabase(s);
    const { conflicts } = await detectAcceptConflicts(fake, "c1", [
      ch({
        entity_type: "investment",
        entity_id: "i2",
        field_key: "name",
        new_value: "alpha",
        old_value: "Beta",
        change_op: "update",
      }),
    ]);
    expect(conflicts.some((c) => c.reason === "name_in_use")).toBe(true);
  });

  it("distinct create-op name -> no name conflict", async () => {
    const s = { ...seed(), financial_investments: [invRow("i1", "ILP2")] };
    const fake = makeFakeSupabase(s);
    const { conflicts } = await detectAcceptConflicts(fake, "c1", [
      ch({
        entity_type: "investment",
        field_key: "name",
        new_value: "ILP3",
        change_op: "create",
        draft_entity_key: "k1",
      }),
    ]);
    expect(conflicts.some((c) => c.reason === "name_in_use")).toBe(false);
  });
});

describe("nameConflictFromWriteError (post-claim 23505 -> name_in_use)", () => {
  const investChange = ch({
    entity_type: "investment",
    field_key: "name",
    new_value: "ilp2",
    change_op: "create",
    draft_entity_key: "k1",
  });

  it("maps a 23505 on the investments index to a name_in_use conflict with the label", () => {
    const err = {
      code: "23505",
      message:
        'duplicate key value violates unique constraint "financial_investments_user_name_ci_uq"',
    };
    const out = nameConflictFromWriteError(err, [investChange]);
    expect(out).toEqual([
      {
        entityType: "investment",
        entityId: null,
        label: "ilp2",
        reason: "name_in_use",
      },
    ]);
  });

  it("maps a 23505 on the goals index to a goal name_in_use conflict", () => {
    const err = {
      code: "23505",
      details: "Key (user_id, lower(btrim(title)))=(…, house) already exists.",
      message:
        'duplicate key value violates unique constraint "financial_goals_user_name_ci_uq"',
    };
    const out = nameConflictFromWriteError(err, [
      ch({
        entity_type: "goal",
        field_key: "title",
        new_value: "House",
        change_op: "create",
        draft_entity_key: "g1",
      }),
    ]);
    expect(out?.[0]).toMatchObject({
      entityType: "goal",
      reason: "name_in_use",
      label: "House",
    });
  });

  it("returns null for a non-23505 error", () => {
    expect(
      nameConflictFromWriteError(
        { code: "23503", message: "fk violation" },
        [investChange]
      )
    ).toBeNull();
  });

  it("returns null for a 23505 on a different (non-name) constraint", () => {
    const err = {
      code: "23505",
      message:
        'duplicate key value violates unique constraint "advisor_proposals_pkey"',
    };
    expect(nameConflictFromWriteError(err, [investChange])).toBeNull();
  });

  it("returns null for a non-object error", () => {
    expect(nameConflictFromWriteError("boom", [investChange])).toBeNull();
  });
});
