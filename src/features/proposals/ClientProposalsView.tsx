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
            return (
              <tr
                key={p.id}
                className="relative transition hover:bg-slate-50/70"
              >
                <td className="px-4 py-3 align-middle">
                  <Link
                    href={href}
                    className="inline-flex items-center after:absolute after:inset-0 after:content-['']"
                  >
                    <span className="sr-only">Review proposal</span>
                    <AdvisorBadge tone={display.tone}>
                      {display.label}
                    </AdvisorBadge>
                  </Link>
                </td>
                <td className="px-4 py-3 align-middle text-slate-600 tabular-nums">
                  {shortDate(p.submitted_at ?? p.created_at)}
                </td>
                <td className="px-4 py-3 align-middle text-slate-700">
                  {summarize(p.advisor_note)}
                </td>
                <td className="px-4 py-3 align-middle text-slate-600 tabular-nums">
                  {shortDate(p.resolved_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
