import { describe, expect, it } from "vitest";
import {
  CPF_RULES_REVIEW_MONTH,
  CPF_RULES_VERSION,
  cpfRulesReviewDedupeKey,
  shouldPromptCpfRulesReview,
} from "./cpf-rules-review";

describe("CPF rules review gate", () => {
  it("fires when the stored review version is missing", () => {
    expect(
      shouldPromptCpfRulesReview({
        lastCpfRulesReviewAt: null,
        lastCpfRulesReviewVersion: null,
        now: new Date("2026-05-21T00:00:00Z"),
      })
    ).toBe(true);
  });

  it("fires when the stored review version is older than the current rules version", () => {
    expect(
      shouldPromptCpfRulesReview({
        lastCpfRulesReviewAt: "2026-01-01T00:00:00Z",
        lastCpfRulesReviewVersion: "2025-01-01",
        currentRulesVersion: CPF_RULES_VERSION,
        now: new Date("2026-05-21T00:00:00Z"),
      })
    ).toBe(true);
  });

  it("does not fire before the recurring review month when the version is current", () => {
    expect(
      shouldPromptCpfRulesReview({
        lastCpfRulesReviewAt: "2026-05-21T00:00:00Z",
        lastCpfRulesReviewVersion: CPF_RULES_VERSION,
        now: new Date("2026-10-31T00:00:00Z"),
      })
    ).toBe(false);
  });

  it("fires in the recurring review month when the current version was only reviewed earlier that year", () => {
    expect(
      shouldPromptCpfRulesReview({
        lastCpfRulesReviewAt: "2026-05-21T00:00:00Z",
        lastCpfRulesReviewVersion: CPF_RULES_VERSION,
        now: new Date("2026-11-01T00:00:00Z"),
      })
    ).toBe(true);
  });

  it("does not fire after a current-version acknowledgement in the recurring review window", () => {
    expect(
      shouldPromptCpfRulesReview({
        lastCpfRulesReviewAt: "2026-11-05T00:00:00Z",
        lastCpfRulesReviewVersion: CPF_RULES_VERSION,
        now: new Date("2026-12-01T00:00:00Z"),
      })
    ).toBe(false);
  });
});

describe("cpfRulesReviewDedupeKey", () => {
  it("includes version and year so same-year rule updates can re-notify", () => {
    expect(cpfRulesReviewDedupeKey(2026)).toBe(
      `cpf_rules_review_due:${CPF_RULES_VERSION}:2026`
    );
    expect(cpfRulesReviewDedupeKey(2026, "2027-01-01")).toBe(
      "cpf_rules_review_due:2027-01-01:2026"
    );
  });

  it("keeps the configured annual review month explicit", () => {
    expect(CPF_RULES_REVIEW_MONTH).toBe(11);
  });
});
