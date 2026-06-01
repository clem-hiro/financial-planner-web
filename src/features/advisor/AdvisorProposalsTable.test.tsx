import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AdvisorProposalRow } from "@/data/supabase/types";
import { AdvisorProposalsTable } from "@/features/advisor/AdvisorProposalsTable";

function row(
  status: AdvisorProposalRow["status"],
  id = `id-${status}`
): AdvisorProposalRow {
  return {
    id,
    advisor_user_id: "a",
    client_user_id: "c",
    status,
    advisor_note: "Advisor note",
    submitted_at: "2026-01-02T00:00:00Z",
    resolved_at: "2026-02-03T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-02-03T00:00:00Z",
  };
}

describe("AdvisorProposalsTable functional smoke", () => {
  it("empty → 'No proposals yet.' panel", () => {
    const html = renderToStaticMarkup(
      <AdvisorProposalsTable clientId="c" proposals={[]} />
    );
    expect(html).toContain("No proposals yet.");
  });

  it("renders ADVISOR-voice status labels + Status/Created/Summary/Resolved/Action headers", () => {
    const html = renderToStaticMarkup(
      <AdvisorProposalsTable
        clientId="c"
        proposals={[row("pending"), row("accepted")]}
      />
    );
    expect(html).toContain("Pending review"); // advisor voice
    expect(html).toContain("Accepted");
    for (const h of ["Status", "Created", "Summary", "Resolved", "Action"]) {
      expect(html).toContain(h);
    }
  });

  it("Withdraw control ONLY for draft|pending rows; resolved rows show em-dash", () => {
    const withdrawable = renderToStaticMarkup(
      <AdvisorProposalsTable
        clientId="c"
        proposals={[row("draft"), row("pending")]}
      />
    );
    expect(withdrawable).toContain("Withdraw");

    const resolved = renderToStaticMarkup(
      <AdvisorProposalsTable
        clientId="c"
        proposals={[row("accepted"), row("rejected"), row("withdrawn")]}
      />
    );
    expect(resolved).not.toContain(">Withdraw<");
    expect(resolved).toContain("—");
  });

  it("rows link to the per-proposal advisor detail view", () => {
    const html = renderToStaticMarkup(
      <AdvisorProposalsTable clientId="cli" proposals={[row("pending", "pX")]} />
    );
    // Static markup HTML-escapes & → &amp;; assert the path + both query
    // params rather than the raw ampersand form.
    expect(html).toContain("/advisor/client/cli?view=proposals");
    expect(html).toContain("p=pX");
  });
});
