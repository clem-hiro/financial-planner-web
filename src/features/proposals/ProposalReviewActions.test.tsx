import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProposalReviewActions } from "@/features/proposals/ProposalReviewView";

// Static (SSR) render = useActionState initial state, so this smokes the
// DEFAULT (no-conflict) branch only: Accept enabled, both forms wired with
// the hidden proposal_id. The CONFLICTED branch (Accept disabled + deduped
// label list) and the lockRef double-submit guard require post-mount action
// state / interaction — see the browser-required list (P7b); they cannot be
// faked here without an interactive DOM test runner (not configured).
describe("ProposalReviewActions default-branch smoke", () => {
  it("renders Accept + Reject, both forms carry the proposal_id, no conflict notice by default", () => {
    const html = renderToStaticMarkup(
      <ProposalReviewActions proposalId="prop-123" />
    );
    expect(html).toContain("Accept changes");
    expect(html).toContain("Reject changes");
    // hidden proposal_id present (twice — one per form)
    const idMatches = html.match(/name="proposal_id" value="prop-123"/g) ?? [];
    expect(idMatches.length).toBe(2);
    // no conflict / error surface in the clean initial state
    expect(html).not.toContain("these items are now out of date");
    expect(html).not.toContain("role=\"alert\"");
  });

  it("Accept is NOT disabled in the clean initial state (conflict-gating off by default)", () => {
    const html = renderToStaticMarkup(
      <ProposalReviewActions proposalId="p" />
    );
    const acceptBtn = html.match(
      /<button[^>]*>Accept changes<\/button>/
    )?.[0];
    expect(acceptBtn).toBeTruthy();
    // Assert the real `disabled` ATTRIBUTE is absent — not the Tailwind
    // `disabled:opacity-50` class token, which is always in the className.
    expect(acceptBtn).not.toContain('disabled=""');
    // And it IS present on a conflicted/pending render path (sanity that the
    // attribute form is what we'd detect): the clean render has none.
    expect((html.match(/disabled=""/g) ?? []).length).toBe(0);
  });
});
