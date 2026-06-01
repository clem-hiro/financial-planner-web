import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// useRouter now drives the approval-dialog navigation; stub it so the SSR
// render has a router (no app-router provider in a node test).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { ProposalReviewActions } from "@/features/proposals/ProposalReviewView";

// Static (SSR) render = useActionState initial state + closed dialogs. Smokes
// the structure: while `status="pending"` the action row renders (Accept opens
// a confirm dialog — now a type="button", not a direct submit — backed by a
// hidden form carrying proposal_id; Reject unchanged); the dialog host stays
// mounted regardless of status so the approval dialog can survive
// accept→accepted. The interactive flow (Accept → confirm → action → `ok` →
// approval dialog → Go-to-page navigates) needs a DOM runner not configured
// here (no-new-deps) — covered by the manual WebKit smoke per the plan.
describe("ProposalReviewActions", () => {
  it("pending: renders Accept + Reject; both carry the proposal_id; no conflict notice", () => {
    const html = renderToStaticMarkup(
      <ProposalReviewActions proposalId="prop-123" status="pending" />
    );
    expect(html).toContain("Accept changes");
    expect(html).toContain("Reject changes");
    const idMatches = html.match(/name="proposal_id" value="prop-123"/g) ?? [];
    expect(idMatches.length).toBe(2);
    expect(html).not.toContain("these items are now out of date");
    expect(html).not.toContain('role="alert"');
  });

  it("pending: Accept is a dialog trigger (type=button), not a direct submit", () => {
    const html = renderToStaticMarkup(
      <ProposalReviewActions proposalId="p" status="pending" />
    );
    const acceptBtn = html.match(
      /<button type="button"[^>]*>Accept changes<\/button>/
    )?.[0];
    expect(acceptBtn).toBeTruthy();
    expect(acceptBtn).not.toContain('disabled=""');
  });

  it("pending: neither dialog renders in the initial (closed) state", () => {
    const html = renderToStaticMarkup(
      <ProposalReviewActions proposalId="p" status="pending" />
    );
    expect(html).not.toContain("Apply these changes to your plan?");
    expect(html).not.toContain("Proposal Approved");
  });

  it("accepted: no action row and no dialog (fresh visit must not pop the approval dialog)", () => {
    const html = renderToStaticMarkup(
      <ProposalReviewActions proposalId="p" status="accepted" />
    );
    expect(html).not.toContain("Accept changes");
    expect(html).not.toContain("Reject changes");
    expect(html).not.toContain("Proposal Approved");
    // The dialog host is mounted but renders nothing until THIS session's
    // accept sets `ok` — so the SSR/accepted render is empty.
    expect(html.trim()).toBe("");
  });
});
