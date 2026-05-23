import Link from "next/link";
import type { AdvisorProposalRow } from "@/data/supabase/types";
import { proposalStatusDisplay } from "@/domain/advisor-proposals/proposal-status-display";
import { AdvisorBadge } from "@/features/advisor/advisor-workspace-primitives";
import { shortDate, summarize } from "@/domain/advisor-proposals/proposal-format";

export function ClientProposalsView({
  proposals,
}: {
  proposals: AdvisorProposalRow[];
}) {
  if (proposals.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-5 py-6 text-sm leading-relaxed text-slate-700">
        <p className="font-semibold text-slate-900">No proposals yet.</p>
        <p className="mt-3">
          When your advisor suggests changes to your plan, they will appear
          here — and stay here for every status — so you can review or revisit
          them any time, even after dismissing the inbox notification.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50/80">
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th scope="col" className="px-4 py-3">Status</th>
            <th scope="col" className="px-4 py-3">Received</th>
            <th scope="col" className="px-4 py-3">Summary</th>
            <th scope="col" className="px-4 py-3">Resolved</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {proposals.map((p) => {
            const display = proposalStatusDisplay(p.status, "client");
            const href = `/setup/advisor-proposals/${p.id}`;
            // Whole-row navigation via one <Link> per cell, not an
            // `after:absolute inset-0` overlay: an overlay anchored to a <tr>
            // escapes the row in real Safari and hijacks unrelated clicks.
            // Per-cell links keep soft-nav, right-click, and middle-click intact.
            return (
              <tr
                key={p.id}
                className="cursor-pointer transition hover:bg-slate-50/70"
              >
                <td className="p-0 align-middle">
                  <Link href={href} className="flex items-center px-4 py-3">
                    <AdvisorBadge tone={display.tone}>
                      {display.label}
                    </AdvisorBadge>
                  </Link>
                </td>
                <td className="p-0 align-middle text-slate-600 tabular-nums">
                  <Link href={href} className="block px-4 py-3">
                    {shortDate(p.submitted_at ?? p.created_at)}
                  </Link>
                </td>
                <td className="p-0 align-middle text-slate-700">
                  <Link href={href} className="block px-4 py-3">
                    {summarize(p.advisor_note)}
                  </Link>
                </td>
                <td className="p-0 align-middle text-slate-600 tabular-nums">
                  <Link href={href} className="block px-4 py-3">
                    {shortDate(p.resolved_at)}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
