import { describe, expect, it } from "vitest";
import { resolveOverlayForViewer } from "./overlay-gate";
import type { AdvisorProposalStatus } from "@/data/supabase/types";

const proposal = (status: AdvisorProposalStatus) => ({
  advisor_user_id: "adv",
  client_user_id: "cli",
  status,
});

const STATUSES: AdvisorProposalStatus[] = [
  "draft",
  "pending",
  "accepted",
  "rejected",
  "withdrawn",
  "accepting",
];

describe("resolveOverlayForViewer — role + status gate", () => {
  it("no proposal ⇒ never overlay", () => {
    expect(
      resolveOverlayForViewer({
        viewerRole: "advisor",
        viewerId: "adv",
        surface: "advisor_workspace",
        proposal: null,
      })
    ).toBe(false);
  });

  it("advisor workspace: own client's draft|pending only", () => {
    const expected: Record<AdvisorProposalStatus, boolean> = {
      draft: true,
      pending: true,
      accepted: false,
      rejected: false,
      withdrawn: false,
      accepting: false,
    };
    for (const s of STATUSES) {
      expect(
        resolveOverlayForViewer({
          viewerRole: "advisor",
          viewerId: "adv",
          surface: "advisor_workspace",
          proposal: proposal(s),
        })
      ).toBe(expected[s]);
    }
  });

  it("advisor workspace: a different advisor is denied", () => {
    expect(
      resolveOverlayForViewer({
        viewerRole: "advisor",
        viewerId: "someone-else",
        surface: "advisor_workspace",
        proposal: proposal("draft"),
      })
    ).toBe(false);
  });

  it("client review: own pending|accepted only — NEVER draft", () => {
    const expected: Record<AdvisorProposalStatus, boolean> = {
      draft: false,
      pending: true,
      accepted: true,
      rejected: false,
      withdrawn: false,
      accepting: false,
    };
    for (const s of STATUSES) {
      expect(
        resolveOverlayForViewer({
          viewerRole: "client",
          viewerId: "cli",
          surface: "client_review",
          proposal: proposal(s),
        })
      ).toBe(expected[s]);
    }
  });

  it("client review: a different client is denied even for pending", () => {
    expect(
      resolveOverlayForViewer({
        viewerRole: "client",
        viewerId: "other-client",
        surface: "client_review",
        proposal: proposal("pending"),
      })
    ).toBe(false);
  });

  it("client own dashboard: never overlaid for any status", () => {
    for (const s of STATUSES) {
      expect(
        resolveOverlayForViewer({
          viewerRole: "client",
          viewerId: "cli",
          surface: "client_dashboard",
          proposal: proposal(s),
        })
      ).toBe(false);
    }
  });

  it("advisor cannot use the client_review surface to see a draft", () => {
    expect(
      resolveOverlayForViewer({
        viewerRole: "advisor",
        viewerId: "adv",
        surface: "client_review",
        proposal: proposal("draft"),
      })
    ).toBe(false);
  });
});
