import { describe, expect, it } from "vitest";
import {
  countStaleInvestments,
  investmentReviewReason,
  investmentRowIsStale,
  monthsSinceTimestamp,
  shouldPromptInvestmentReview,
} from "./investment-review";

describe("investment review staleness", () => {
  const now = new Date("2026-05-15T12:00:00Z");

  it("flags rows not updated in 12+ months", () => {
    expect(
      investmentRowIsStale(
        { updated_at: "2024-01-01T00:00:00Z", created_at: "2024-01-01T00:00:00Z" },
        now
      )
    ).toBe(true);
  });

  it("does not flag recently updated rows", () => {
    expect(
      investmentRowIsStale(
        { updated_at: "2026-04-01T00:00:00Z", created_at: "2024-01-01T00:00:00Z" },
        now
      )
    ).toBe(false);
  });

  it("counts stale accounts in a portfolio", () => {
    const n = countStaleInvestments(
      [
        { updated_at: "2024-01-01T00:00:00Z" },
        { updated_at: "2026-04-01T00:00:00Z" },
      ],
      now
    );
    expect(n).toBe(1);
  });
});

describe("investmentReviewReason", () => {
  const now = new Date("2026-05-15T12:00:00Z");

  it("returns no_timestamp when the row has never been touched", () => {
    expect(investmentReviewReason({}, now)).toEqual({ kind: "no_timestamp" });
  });

  it("returns stale_months with floored months for an old updated_at", () => {
    const reason = investmentReviewReason(
      { updated_at: "2025-03-01T12:00:00Z" },
      now
    );
    expect(reason).toEqual({ kind: "stale_months", months: 14 });
  });

  it("falls back to created_at when updated_at is null", () => {
    const reason = investmentReviewReason(
      { updated_at: null, created_at: "2025-03-01T12:00:00Z" },
      now
    );
    expect(reason).toEqual({ kind: "stale_months", months: 14 });
  });

  it("returns null for a recently updated row", () => {
    expect(
      investmentReviewReason({ updated_at: "2026-04-01T00:00:00Z" }, now)
    ).toBeNull();
  });
});

describe("shouldPromptInvestmentReview", () => {
  const now = new Date("2026-05-15T12:00:00Z");
  const stale = [{ updated_at: "2024-01-01T00:00:00Z" }];
  const fresh = [{ updated_at: "2026-04-01T00:00:00Z" }];

  it("no-ops with no accounts", () => {
    expect(
      shouldPromptInvestmentReview({
        investments: [],
        lastInvestmentReviewAt: null,
        now,
      })
    ).toBe(false);
  });

  it("no-ops when all accounts are fresh", () => {
    expect(
      shouldPromptInvestmentReview({
        investments: fresh,
        lastInvestmentReviewAt: null,
        now,
      })
    ).toBe(false);
  });

  it("prompts when stale and never acknowledged", () => {
    expect(
      shouldPromptInvestmentReview({
        investments: stale,
        lastInvestmentReviewAt: null,
        now,
      })
    ).toBe(true);
  });

  it("suppresses after a recent acknowledgement", () => {
    expect(
      shouldPromptInvestmentReview({
        investments: stale,
        lastInvestmentReviewAt: "2026-01-01T00:00:00Z",
        now,
      })
    ).toBe(false);
  });

  it("re-prompts when acknowledgement is older than validity window", () => {
    expect(
      shouldPromptInvestmentReview({
        investments: stale,
        lastInvestmentReviewAt: "2024-06-01T00:00:00Z",
        now,
      })
    ).toBe(true);
  });
});

describe("monthsSinceTimestamp", () => {
  it("returns a positive span for past dates", () => {
    const m = monthsSinceTimestamp(
      "2024-01-01T00:00:00Z",
      new Date("2026-01-01T00:00:00Z")
    );
    expect(m).toBeGreaterThan(23);
  });
});
