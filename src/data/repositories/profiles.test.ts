import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProfileById, updateProfile } from "./profiles";

type Row = Record<string, unknown>;

/**
 * Minimal in-memory Supabase implementing ONLY the two chains these repo
 * functions use: `.from().update().eq()` (updateProfile) and
 * `.from().select().eq().maybeSingle()` (getProfileById). It is a real store
 * (seeded rows persist; the patch is merged, not echoed), so a round-trip here
 * proves the write→read path — not just that the input bounced back.
 * Isolated to this file by design; not a shared harness.
 */
function fakeSupabase(seed: Record<string, Row>): SupabaseClient {
  const store: Record<string, Row> = {};
  for (const [id, row] of Object.entries(seed)) store[id] = { ...row };
  const guard = (table: string) => {
    if (table !== "financial_profiles") throw new Error(`unexpected table: ${table}`);
  };
  return {
    from(table: string) {
      guard(table);
      return {
        update(patch: Row) {
          return {
            eq(col: string, val: string) {
              if (col === "id" && store[val]) Object.assign(store[val], patch);
              return Promise.resolve({ error: null });
            },
          };
        },
        select() {
          return {
            eq(col: string, val: string) {
              return {
                maybeSingle() {
                  const data = col === "id" ? store[val] ?? null : null;
                  return Promise.resolve({ data, error: null });
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

describe("updateProfile → getProfileById round-trip", () => {
  it("persists expense_growth_nominal and reads it back", async () => {
    const supabase = fakeSupabase({
      u1: {
        id: "u1",
        profile_type: "advisor",
        advisor_user_id: null,
        display_name: "Seed Name",
        expense_growth_nominal: null,
      },
    });

    await updateProfile(supabase, "u1", {
      expense_growth_nominal: 0.03,
      annual_salary_growth_nominal: 0.05,
    });
    const profile = await getProfileById(supabase, "u1");

    // Field under test: the /simplify type-drift guard — this call only
    // compiles if the patch type still accepts expense_growth_nominal.
    expect(profile?.expense_growth_nominal).toBe(0.03);
    // Control: the sibling field also round-trips (not field-specific).
    expect(profile?.annual_salary_growth_nominal).toBe(0.05);
    // Control: an untouched seed field survives — proves a real store,
    // not a fake that just echoes the patch back.
    expect(profile?.display_name).toBe("Seed Name");
    expect(profile?.id).toBe("u1");
  });

  it("returns null when the row is absent", async () => {
    const supabase = fakeSupabase({});
    expect(await getProfileById(supabase, "missing")).toBeNull();
  });
});
