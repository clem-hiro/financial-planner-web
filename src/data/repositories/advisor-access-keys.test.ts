import { describe, expect, it } from "vitest";
import type { AdvisorAccessKeyRow } from "@/data/supabase/types";
import { sortAdvisorAccessKeysForDisplay } from "./advisor-access-keys";

function key(
  overrides: Partial<AdvisorAccessKeyRow> &
    Pick<AdvisorAccessKeyRow, "id" | "status" | "created_at">
): AdvisorAccessKeyRow {
  return {
    advisor_user_id: "adv-1",
    access_key: `KEY-${overrides.id}`,
    claimed_by_user_id: null,
    claimed_at: null,
    expires_at: null,
    ...overrides,
  };
}

describe("sortAdvisorAccessKeysForDisplay", () => {
  it("groups available before claimed before expired", () => {
    const sorted = sortAdvisorAccessKeysForDisplay([
      key({ id: "c1", status: "claimed", created_at: "2026-01-03T00:00:00Z" }),
      key({ id: "e1", status: "expired", created_at: "2026-01-04T00:00:00Z" }),
      key({ id: "a1", status: "available", created_at: "2026-01-01T00:00:00Z" }),
      key({ id: "a2", status: "available", created_at: "2026-01-05T00:00:00Z" }),
    ]);
    expect(sorted.map((k) => k.id)).toEqual(["a2", "a1", "c1", "e1"]);
  });
});
