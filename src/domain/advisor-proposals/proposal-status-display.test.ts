import { describe, expect, it } from "vitest";
import type { AdvisorProposalStatus } from "@/data/supabase/types";
import {
  proposalStatusDisplay,
  type ProposalStatusTone,
  type ProposalStatusVoice,
} from "./proposal-status-display";

const ALL_STATUSES: AdvisorProposalStatus[] = [
  "draft",
  "pending",
  "accepted",
  "rejected",
  "withdrawn",
  "accepting",
];

const VALID_TONES: ProposalStatusTone[] = [
  "neutral",
  "positive",
  "warning",
  "slate",
];

// input (status, voice) -> expected (label, tone). Exhaustive over the enum
// in both voices so a future status / wording drift is caught here.
const MATRIX: Array<
  [AdvisorProposalStatus, ProposalStatusVoice, string, ProposalStatusTone]
> = [
  ["draft", "advisor", "Draft", "neutral"],
  ["pending", "advisor", "Pending review", "warning"],
  ["accepted", "advisor", "Accepted", "positive"],
  ["rejected", "advisor", "Rejected", "slate"],
  ["withdrawn", "advisor", "Withdrawn", "slate"],
  ["accepting", "advisor", "Applying — rebuild if stuck", "warning"],
  ["draft", "client", "Not yet sent", "neutral"],
  ["pending", "client", "Awaiting your review", "warning"],
  ["accepted", "client", "Accepted", "positive"],
  ["rejected", "client", "Declined", "slate"],
  ["withdrawn", "client", "Withdrawn by advisor", "slate"],
  ["accepting", "client", "Being applied", "warning"],
];

describe("proposalStatusDisplay — voice x status matrix", () => {
  it.each(MATRIX)(
    "%s / %s -> %s",
    (status, voice, label, tone) => {
      const d = proposalStatusDisplay(status, voice);
      expect(d.label).toBe(label);
      expect(d.tone).toBe(tone);
    }
  );

  it("is total over the status enum in both voices (no undefined)", () => {
    for (const status of ALL_STATUSES) {
      for (const voice of ["advisor", "client"] as ProposalStatusVoice[]) {
        const d = proposalStatusDisplay(status, voice);
        expect(d).toBeTruthy();
        expect(typeof d.label).toBe("string");
        expect(d.label.length).toBeGreaterThan(0);
      }
    }
  });

  it("every tone is a valid AdvisorBadge tone subset", () => {
    for (const status of ALL_STATUSES) {
      for (const voice of ["advisor", "client"] as ProposalStatusVoice[]) {
        expect(VALID_TONES).toContain(
          proposalStatusDisplay(status, voice).tone
        );
      }
    }
  });

  it("advisor and client voices diverge where the wording must (rejected/withdrawn/draft/pending)", () => {
    for (const s of ["draft", "pending", "rejected", "withdrawn"] as const) {
      expect(proposalStatusDisplay(s, "advisor").label).not.toBe(
        proposalStatusDisplay(s, "client").label
      );
    }
    // accepted reads the same to both sides — deliberately not diverged.
    expect(proposalStatusDisplay("accepted", "advisor").label).toBe(
      proposalStatusDisplay("accepted", "client").label
    );
  });
});
