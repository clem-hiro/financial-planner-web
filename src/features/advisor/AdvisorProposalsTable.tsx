import type { AdvisorProposalRow } from "@/data/supabase/types";
import { proposalStatusDisplay } from "@/domain/advisor-proposals/proposal-status-display";
import { AdvisorBadge } from "@/features/advisor/advisor-workspace-primitives";
import { WithdrawProposalButton } from "@/features/advisor/WithdrawProposalButton";
import { shortDate, summarize } from "@/domain/advisor-proposals/proposal-format";

export function AdvisorProposalsTable({
  clientId,
  proposals,
}: {
  clientId: string;
  proposals: AdvisorProposalRow[];
}) {
  if (proposals.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-5 py-6 text-sm leading-relaxed text-slate-700">
        <p className="font-semibold text-slate-900">No proposals yet.</p>
        <p className="mt-3">
          Proposals you submit for this client will appear here — pending,
          accepted, rejected, and withdrawn — so you can revisit any of them at
          any time, even after the client dismisses the inbox notification.
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
            <th scope="col" className="px-4 py-3">Created</th>
            <th scope="col" className="px-4 py-3">Summary</th>
            <th scope="col" className="px-4 py-3">Resolved</th>
            <th scope="col" className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {proposals.map((p) => {
            const display = proposalStatusDisplay(p.status, "advisor");
            const href = `/advisor/client/${clientId}?view=proposals&p=${p.id}`;
            const canWithdraw =
              p.status === "draft" || p.status === "pending";
            return (
              <tr key={p.id} className="transition hover:bg-slate-50/70">
                <td className="px-4 py-3 align-middle">
                  {/* plain <a>: Next App Router soft-nav (<Link>/router.push) is unreliable in
                      WebKit/Safari for same-pathname search-param changes — verified flaky across
                      runs (see AdvisorClientDetailNav). No full-row `after:absolute inset-0` overlay
                      either: it escapes the <tr> in real Safari and hijacks unrelated clicks. */}
                  <a href={href} className="inline-flex items-center">
                    <span className="sr-only">View proposal details</span>
                    <AdvisorBadge tone={display.tone}>
                      {display.label}
                    </AdvisorBadge>
                  </a>
                </td>
                <td className="px-4 py-3 align-middle text-slate-600 tabular-nums">
                  {shortDate(p.created_at)}
                </td>
                <td className="px-4 py-3 align-middle text-slate-700">
                  {summarize(p.advisor_note)}
                </td>
                <td className="px-4 py-3 align-middle text-slate-600 tabular-nums">
                  {shortDate(p.resolved_at)}
                </td>
                <td className="px-4 py-3 text-right align-middle">
                  {canWithdraw ? (
                    <WithdrawProposalButton proposalId={p.id} />
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
