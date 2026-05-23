import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AdvisorProposalRow } from "@/data/supabase/types";
import { ClientProposalsView } from "@/features/proposals/ClientProposalsView";

function row(
  status: AdvisorProposalRow["status"],
  over: Partial<AdvisorProposalRow> = {}
): AdvisorProposalRow {
  return {
    id: `id-${status}`,
    advisor_user_id: "a",
    client_user_id: "c",
    status,
    advisor_note: "Note text",
    submitted_at: "2026-01-02T00:00:00Z",
    resolved_at: "2026-02-03T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-02-03T00:00:00Z",
    ...over,
  };
}

describe("ClientProposalsView functional smoke", () => {
  it("empty → 'No proposals yet.' panel, no table", () => {
    const html = renderToStaticMarkup(<ClientProposalsView proposals={[]} />);
    expect(html).toContain("No proposals yet.");
    expect(html).not.toContain("<table");
  });

  it("renders CLIENT-voice status labels", () => {
    const html = renderToStaticMarkup(
      <ClientProposalsView
        proposals={[
          row("pending"),
          row("accepted"),
          row("rejected"),
          row("withdrawn"),
        ]}
      />
    );
    expect(html).toContain("Awaiting your review"); // pending, client voice
    expect(html).toContain("Accepted");
    expect(html).toContain("Declined"); // rejected, client voice
    expect(html).toContain("Withdrawn by advisor"); // withdrawn, client voice
    // advisor-voice strings must NOT leak into the client view
    expect(html).not.toContain("Pending review");
    expect(html).not.toContain(">Rejected<");
  });

  it("has NO Withdraw / Action column and rows link to /setup/advisor-proposals/{id}", () => {
    const html = renderToStaticMarkup(
      <ClientProposalsView proposals={[row("pending", { id: "p1" })]} />
    );
    expect(html).not.toContain("Withdraw");
    expect(html).not.toMatch(/<th[^>]*>\s*Action\s*<\/th>/);
    expect(html).toContain("/setup/advisor-proposals/p1");
    // client-facing column headers
    expect(html).toContain("Status");
    expect(html).toContain("Summary");
  });
});
