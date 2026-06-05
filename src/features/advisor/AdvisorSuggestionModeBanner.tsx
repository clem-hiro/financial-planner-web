import { AdvisorBadge } from "@/features/advisor/advisor-workspace-primitives";

export function AdvisorSuggestionModeBanner({
  changeCount,
  hasPendingProposal,
}: {
  changeCount: number;
  hasPendingProposal: boolean;
}) {
  if (hasPendingProposal) {
    return (
      <div
        className="rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50/95 via-white to-slate-50/40 px-5 py-4 shadow-sm ring-1 ring-amber-100/60"
        role="status"
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-amber-950">Client review in progress</p>
          <AdvisorBadge tone="neutral">Suggestion mode</AdvisorBadge>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-amber-900/90">
          {changeCount > 0
            ? `A submitted proposal is waiting for your client, and this separate draft has ${changeCount} queued ${changeCount === 1 ? "change" : "changes"}. Nothing is applied until the client accepts.`
            : "A submitted proposal is waiting for your client. You can still draft a separate proposal here; nothing is applied until the client accepts."}
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-sky-200/90 bg-gradient-to-br from-sky-50/95 via-white to-slate-50/40 px-5 py-4 shadow-sm ring-1 ring-sky-100/60"
      role="status"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-sky-950">Proposing changes to client plan</p>
        <AdvisorBadge tone="neutral">Suggestion mode</AdvisorBadge>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-sky-900/90">
        {changeCount > 0
          ? `${changeCount} suggested ${changeCount === 1 ? "change" : "changes"} queued. Nothing is applied to the client plan until they review and accept.`
          : "Edits are saved as suggestions — the client’s tracker stays unchanged until they accept your proposal."}
      </p>
    </div>
  );
}
