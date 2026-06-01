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

  // Cash accept-writer scenario matrix:
  //   input                          | expected
  //   cash create (draft group)      | one financial_cash_accounts row written
  //   cash _deleted                  | the target row removed
  //   unsupported type (vehicle)     | throws pre-write, store untouched
  it("cash create inserts a financial_cash_accounts row from its draft group", async () => {
    const fake = makeFakeSupabase(seed());
    const res = await applyAcceptedProposalChanges(fake, "c1", [
      ch({
        entity_type: "cash_account",
        field_key: "name",
        new_value: "Emergency fund",
        change_op: "create",
        draft_entity_key: "ncash",
      }),
      ch({
        entity_type: "cash_account",
        field_key: "balance",
        new_value: "5000",
        change_op: "create",
        draft_entity_key: "ncash",
      }),
      ch({
        entity_type: "cash_account",
        field_key: "purpose",
        new_value: "emergency_fund",
        change_op: "create",
        draft_entity_key: "ncash",
      }),
    ]);
    expect(res.conflicts).toEqual([]);
    expect(fake.store.financial_cash_accounts).toHaveLength(1);
    const created = fake.store.financial_cash_accounts[0];
    expect(created.name).toBe("Emergency fund");
    expect(Number(created.balance)).toBe(5000);
    expect(created.purpose).toBe("emergency_fund");
    expect(created.user_id).toBe("c1");
  });

  it("cash _deleted removes the target cash account row", async () => {
    const fake = makeFakeSupabase({
      ...seed(),
      financial_cash_accounts: [
        {
          id: "cash1",
          user_id: "c1",
          name: "Old savings",
          balance: "1000",
          purpose: "other",
          created_at: V,
          updated_at: V,
        },
      ],
    });
    const res = await applyAcceptedProposalChanges(fake, "c1", [
      ch({
        entity_type: "cash_account",
        entity_id: "cash1",
        field_key: "_deleted",
        new_value: "true",
        change_op: "delete",
        base_version: V,
      }),
    ]);
    expect(res.conflicts).toEqual([]);
    expect(fake.store.financial_cash_accounts).toHaveLength(0);
  });

  it("liability create inserts a financial_liabilities row from its draft group", async () => {
    const fake = makeFakeSupabase(seed());
    const res = await applyAcceptedProposalChanges(fake, "c1", [
      ch({
        entity_type: "liability",
        field_key: "name",
        new_value: "Car loan",
        change_op: "create",
        draft_entity_key: "nl",
      }),
      ch({
        entity_type: "liability",
        field_key: "balance",
        new_value: "20000",
        change_op: "create",
        draft_entity_key: "nl",
      }),
      ch({
        entity_type: "liability",
        field_key: "category",
        new_value: "vehicle",
        change_op: "create",
        draft_entity_key: "nl",
      }),
    ]);
    expect(res.conflicts).toEqual([]);
    expect(fake.store.financial_liabilities).toHaveLength(1);
    const created = fake.store.financial_liabilities[0];
    expect(created.name).toBe("Car loan");
    expect(Number(created.balance)).toBe(20000);
    expect(created.category).toBe("vehicle");
    expect(created.user_id).toBe("c1");
  });

  it("liability accept ignores a mass-assignment attempt (cannot set user_id)", async () => {
    const fake = makeFakeSupabase(seed());
    const res = await applyAcceptedProposalChanges(fake, "c1", [
      ch({
        entity_type: "liability",
        field_key: "name",
        new_value: "Sneaky loan",
        change_op: "create",
        draft_entity_key: "nl",
      }),
      ch({
        entity_type: "liability",
        field_key: "balance",
        new_value: "5000",
        change_op: "create",
        draft_entity_key: "nl",
      }),
      // Injected non-allowlisted field — must NOT reach the row.
      ch({
        entity_type: "liability",
        field_key: "user_id",
        new_value: "attacker-uid",
        change_op: "create",
        draft_entity_key: "nl",
      }),
    ]);
    expect(res.conflicts).toEqual([]);
    expect(fake.store.financial_liabilities).toHaveLength(1);
    // user_id is set server-side from the accepting client, never the payload.
    expect(fake.store.financial_liabilities[0].user_id).toBe("c1");
  });

  it("liability _deleted removes the target liability row", async () => {
    const fake = makeFakeSupabase({
      ...seed(),
      financial_liabilities: [
        {
          id: "liab1",
          user_id: "c1",
          name: "Old loan",
          balance: "1000",
          created_at: V,
        },
      ],
    });
    const res = await applyAcceptedProposalChanges(fake, "c1", [
      ch({
        entity_type: "liability",
        entity_id: "liab1",
        field_key: "_deleted",
        new_value: "true",
        change_op: "delete",
      }),
    ]);
    expect(res.conflicts).toEqual([]);
    expect(fake.store.financial_liabilities).toHaveLength(0);
  });

  it("vehicle create inserts a financial_vehicles row (name field is label)", async () => {
    const fake = makeFakeSupabase(seed());
    const res = await applyAcceptedProposalChanges(fake, "c1", [
      ch({
        entity_type: "vehicle",
        field_key: "label",
        new_value: "Family car",
        change_op: "create",
        draft_entity_key: "nv",
      }),
      ch({
        entity_type: "vehicle",
        field_key: "vehicle_status",
        new_value: "active",
        change_op: "create",
        draft_entity_key: "nv",
      }),
      ch({
        entity_type: "vehicle",
        field_key: "current_market_value",
        new_value: "40000",
        change_op: "create",
        draft_entity_key: "nv",
      }),
    ]);
    expect(res.conflicts).toEqual([]);
    expect(fake.store.financial_vehicles).toHaveLength(1);
    const created = fake.store.financial_vehicles[0];
    expect(created.label).toBe("Family car");
    expect(Number(created.current_market_value)).toBe(40000);
    expect(created.user_id).toBe("c1");
  });

  it("vehicle accept ignores a mass-assignment attempt (cannot set user_id)", async () => {
    const fake = makeFakeSupabase(seed());
    const res = await applyAcceptedProposalChanges(fake, "c1", [
      ch({
        entity_type: "vehicle",
        field_key: "label",
        new_value: "Sneaky car",
        change_op: "create",
        draft_entity_key: "nv",
      }),
      ch({
        entity_type: "vehicle",
        field_key: "user_id",
        new_value: "attacker-uid",
        change_op: "create",
        draft_entity_key: "nv",
      }),
    ]);
    expect(res.conflicts).toEqual([]);
    expect(fake.store.financial_vehicles).toHaveLength(1);
    expect(fake.store.financial_vehicles[0].user_id).toBe("c1");
  });

  it("vehicle _deleted removes the target vehicle row", async () => {
    const fake = makeFakeSupabase({
      ...seed(),
      financial_vehicles: [
        {
          id: "veh1",
          user_id: "c1",
          label: "Old car",
          vehicle_status: "active",
          on_the_road_paid: "0",
          body_depreciation_years: 0,
          loan_balance: "0",
          loan_monthly_payment: "0",
          display_order: 0,
          first_registration_ym: null,
          arf_for_parf: null,
          body_open_market_at_purchase: null,
          loan_months_remaining: null,
          loan_annual_nominal_rate: null,
          created_at: V,
        },
      ],
    });
    const res = await applyAcceptedProposalChanges(fake, "c1", [
      ch({
        entity_type: "vehicle",
        entity_id: "veh1",
        field_key: "_deleted",
        new_value: "true",
        change_op: "delete",
      }),
    ]);
    expect(res.conflicts).toEqual([]);
    expect(fake.store.financial_vehicles).toHaveLength(0);
  });

  it("property create inserts a financial_properties row", async () => {
    const fake = makeFakeSupabase(seed());
    const res = await applyAcceptedProposalChanges(fake, "c1", [
      ch({
        entity_type: "property",
        field_key: "name",
        new_value: "Home",
        change_op: "create",
        draft_entity_key: "np",
      }),
      ch({
        entity_type: "property",
        field_key: "current_valuation",
        new_value: "850000",
        change_op: "create",
        draft_entity_key: "np",
      }),
    ]);
    expect(res.conflicts).toEqual([]);
    expect(fake.store.financial_properties).toHaveLength(1);
    const created = fake.store.financial_properties[0];
    expect(created.name).toBe("Home");
    expect(Number(created.current_valuation)).toBe(850000);
    expect(created.user_id).toBe("c1");
    // Groundwork for Phase 6: the insert mints a REAL id (not the draft key
    // "np") — that's the value propertyIdMap captures (draft-key→real-id) for
    // the housing-loan property_id remap. (Map is internal; this row id is the
    // observable proxy; the full remap is verified end-to-end in Phase 6.)
    expect(created.id).toMatch(/^db-/);
    expect(created.id).not.toBe("np");
  });

  it("property accept ignores a mass-assignment attempt (cannot set user_id)", async () => {
    const fake = makeFakeSupabase(seed());
    const res = await applyAcceptedProposalChanges(fake, "c1", [
      ch({
        entity_type: "property",
        field_key: "name",
        new_value: "Sneaky condo",
        change_op: "create",
        draft_entity_key: "np",
      }),
      ch({
        entity_type: "property",
        field_key: "user_id",
        new_value: "attacker-uid",
        change_op: "create",
        draft_entity_key: "np",
      }),
    ]);
    expect(res.conflicts).toEqual([]);
    expect(fake.store.financial_properties).toHaveLength(1);
    expect(fake.store.financial_properties[0].user_id).toBe("c1");
  });

  it("property _deleted removes the target property row", async () => {
    const fake = makeFakeSupabase({
      ...seed(),
      financial_properties: [
        {
          id: "prop1",
          user_id: "c1",
          name: "Old home",
          property_type: "hdb",
          purchase_price: null,
          current_valuation: "500000",
          ownership_percent: "100",
          status: "living_in",
          rental_income_monthly: "0",
          planning_scope: "current",
          display_order: 0,
          created_at: V,
          updated_at: V,
        },
      ],
    });
    const res = await applyAcceptedProposalChanges(fake, "c1", [
      ch({
        entity_type: "property",
        entity_id: "prop1",
        field_key: "_deleted",
        new_value: "true",
        change_op: "delete",
        base_version: V,
      }),
    ]);
    expect(res.conflicts).toEqual([]);
    expect(fake.store.financial_properties).toHaveLength(0);
  });

  it("housing_loan create inserts a financial_housing_loans row (name field is label)", async () => {
    const fake = makeFakeSupabase(seed());
    const res = await applyAcceptedProposalChanges(fake, "c1", [
      ch({
        entity_type: "housing_loan",
        field_key: "label",
        new_value: "Home loan",
        change_op: "create",
        draft_entity_key: "nh",
      }),
      ch({
        entity_type: "housing_loan",
        field_key: "principal",
        new_value: "400000",
        change_op: "create",
        draft_entity_key: "nh",
      }),
      ch({
        entity_type: "housing_loan",
        field_key: "first_payment_month",
        new_value: "2026-07",
        change_op: "create",
        draft_entity_key: "nh",
      }),
    ]);
    expect(res.conflicts).toEqual([]);
    expect(fake.store.financial_housing_loans).toHaveLength(1);
    const created = fake.store.financial_housing_loans[0];
    expect(created.label).toBe("Home loan");
    expect(Number(created.principal)).toBe(400000);
    expect(created.user_id).toBe("c1");
    expect(created.property_id ?? null).toBeNull();
  });

  it("same-proposal property + linked loan: loan.property_id resolves to the created property's real id", async () => {
    const fake = makeFakeSupabase(seed());
    const res = await applyAcceptedProposalChanges(fake, "c1", [
      // New property (overlay id = its draft key "kp").
      ch({
        entity_type: "property",
        field_key: "name",
        new_value: "New condo",
        change_op: "create",
        draft_entity_key: "kp",
      }),
      // New loan linking to that property via property_id = the draft key.
      ch({
        entity_type: "housing_loan",
        field_key: "label",
        new_value: "Condo mortgage",
        change_op: "create",
        draft_entity_key: "kl",
      }),
      ch({
        entity_type: "housing_loan",
        field_key: "property_id",
        new_value: "kp",
        change_op: "create",
        draft_entity_key: "kl",
      }),
    ]);
    expect(res.conflicts).toEqual([]);
    expect(fake.store.financial_properties).toHaveLength(1);
    expect(fake.store.financial_housing_loans).toHaveLength(1);
    const realPropertyId = fake.store.financial_properties[0].id as string;
    // Remapped: the loan points at the REAL inserted property id, not "kp".
    expect(fake.store.financial_housing_loans[0].property_id).toBe(realPropertyId);
    expect(realPropertyId).not.toBe("kp");
  });

  it("cross-proposal link: loan.property_id = a draft key with NO property in this proposal -> throws (BOLA)", async () => {
    const fake = makeFakeSupabase(seed());
    await expect(
      applyAcceptedProposalChanges(fake, "c1", [
        ch({
          entity_type: "housing_loan",
          field_key: "label",
          new_value: "Ghost loan",
          change_op: "create",
          draft_entity_key: "kl",
        }),
        ch({
          entity_type: "housing_loan",
          field_key: "property_id",
          new_value: "ghost-draft-from-another-proposal",
          change_op: "create",
          draft_entity_key: "kl",
        }),
      ])
    ).rejects.toThrow(/different proposal/i);
  });

  it("cross-client link: loan.property_id = a property id not owned by this client -> throws (BOLA)", async () => {
    const fake = makeFakeSupabase(seed());
    await expect(
      applyAcceptedProposalChanges(fake, "c1", [
        ch({
          entity_type: "housing_loan",
          field_key: "label",
          new_value: "Hijack loan",
          change_op: "create",
          draft_entity_key: "kl",
        }),
        ch({
          entity_type: "housing_loan",
          field_key: "property_id",
          new_value: "other-client-property-uuid",
          change_op: "create",
          draft_entity_key: "kl",
        }),
      ])
    ).rejects.toThrow(/different proposal/i);
  });

  it("housing_loan accept ignores a mass-assignment attempt (cannot set user_id)", async () => {
    const fake = makeFakeSupabase(seed());
    const res = await applyAcceptedProposalChanges(fake, "c1", [
      ch({
        entity_type: "housing_loan",
        field_key: "label",
        new_value: "Sneaky loan",
        change_op: "create",
        draft_entity_key: "nh",
      }),
      ch({
        entity_type: "housing_loan",
        field_key: "user_id",
        new_value: "attacker-uid",
        change_op: "create",
        draft_entity_key: "nh",
      }),
    ]);
    expect(res.conflicts).toEqual([]);
    expect(fake.store.financial_housing_loans).toHaveLength(1);
    expect(fake.store.financial_housing_loans[0].user_id).toBe("c1");
  });

  it("housing_loan _deleted removes the target loan row", async () => {
    const fake = makeFakeSupabase({
      ...seed(),
      financial_housing_loans: [
        {
          id: "loan1",
          user_id: "c1",
          property_id: null,
          label: "Old mortgage",
          principal: "300000",
          annual_nominal_rate: "0.03",
          term_months: 300,
          completion_month: "2020-01",
          first_payment_month: "2020-01",
          downpayment_from_oa: "0",
          fees_from_oa: "0",
          oa_share_of_payment: "0",
          max_oa_per_month: null,
          lender_type: "bank",
          original_loan_principal: null,
          principal_repaid_before_schedule: "0",
          created_at: V,
        },
      ],
    });
    const res = await applyAcceptedProposalChanges(fake, "c1", [
      ch({
        entity_type: "housing_loan",
        entity_id: "loan1",
        field_key: "_deleted",
        new_value: "true",
        change_op: "delete",
      }),
    ]);
    expect(res.conflicts).toEqual([]);
    expect(fake.store.financial_housing_loans).toHaveLength(0);
  });

  it("unknown entity_type throws before any write (defensive guard)", async () => {
    const fake = makeFakeSupabase(seed());
    await expect(
      applyAcceptedProposalChanges(fake, "c1", [
        ch({
          entity_type: "totally_bogus" as never,
          field_key: "name",
          new_value: "x",
          change_op: "create",
          draft_entity_key: "nb",
        }),
      ])
    ).rejects.toThrow(/unsupported entity type/i);
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

  it("two create-op vehicles with the same label (diff case) -> name_in_use", async () => {
    const fake = makeFakeSupabase(seed());
    const { conflicts } = await detectAcceptConflicts(fake, "c1", [
      ch({
        entity_type: "vehicle",
        field_key: "label",
        new_value: "Family Car",
        change_op: "create",
        draft_entity_key: "v1",
      }),
      ch({
        entity_type: "vehicle",
        field_key: "label",
        new_value: "family car",
        change_op: "create",
        draft_entity_key: "v2",
      }),
    ]);
    expect(
      conflicts.some((c) => c.reason === "name_in_use" && c.entityType === "vehicle")
    ).toBe(true);
  });

  it("two create-op properties with the same name (diff case) -> name_in_use", async () => {
    const fake = makeFakeSupabase(seed());
    const { conflicts } = await detectAcceptConflicts(fake, "c1", [
      ch({
        entity_type: "property",
        field_key: "name",
        new_value: "Home",
        change_op: "create",
        draft_entity_key: "p1",
      }),
      ch({
        entity_type: "property",
        field_key: "name",
        new_value: "home",
        change_op: "create",
        draft_entity_key: "p2",
      }),
    ]);
    expect(
      conflicts.some((c) => c.reason === "name_in_use" && c.entityType === "property")
    ).toBe(true);
  });

  it("two create-op housing loans with the same label (diff case) -> name_in_use", async () => {
    const fake = makeFakeSupabase(seed());
    const { conflicts } = await detectAcceptConflicts(fake, "c1", [
      ch({
        entity_type: "housing_loan",
        field_key: "label",
        new_value: "Home Loan",
        change_op: "create",
        draft_entity_key: "h1",
      }),
      ch({
        entity_type: "housing_loan",
        field_key: "label",
        new_value: "home loan",
        change_op: "create",
        draft_entity_key: "h2",
      }),
    ]);
    expect(
      conflicts.some(
        (c) => c.reason === "name_in_use" && c.entityType === "housing_loan"
      )
    ).toBe(true);
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
