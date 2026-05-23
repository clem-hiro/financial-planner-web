"use client";

import { useActionState, useRef, type ReactNode } from "react";
import { fieldMeta } from "@/domain/advisor-proposals/field-registry";
import { ProposalProjectionCompare } from "@/features/proposals/ProposalProjectionCompare";
import { formatProposalDisplayValue } from "@/domain/advisor-proposals/format-display";
import {
  compareSectionOrder,
  sectionLabel,
} from "@/domain/advisor-proposals/sections";
import type {
  AdvisorProposalChangeRow,
  AdvisorProposalRow,
  AdvisorProposalSectionNoteRow,
} from "@/data/supabase/types";
import type { ProposalConflict } from "@/domain/advisor-proposals/apply-changes";
import {
  acceptAdvisorProposalAction,
  type AcceptProposalState,
  rejectAdvisorProposalAction,
} from "@/server/advisor-proposal-actions";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import { appCardClass, appCardPadding } from "@/ui/surface-classes";
import Link from "next/link";

type SectionBlock = {
  section: string;
  changes: AdvisorProposalChangeRow[];
  sectionNote: string | null;
};

function groupBySection(
  changes: AdvisorProposalChangeRow[],
  sectionNotes: AdvisorProposalSectionNoteRow[]
): SectionBlock[] {
  const noteMap = new Map(sectionNotes.map((n) => [n.section, n.note]));
  const map = new Map<string, AdvisorProposalChangeRow[]>();
  for (const c of changes) {
    const list = map.get(c.section) ?? [];
    list.push(c);
    map.set(c.section, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => compareSectionOrder(a, b))
    .map(([section, sectionChanges]) => ({
      section,
      changes: sectionChanges,
      sectionNote: noteMap.get(section) ?? null,
    }));
}

function formatSubmittedDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Reusable accept/reject unit (forms + actions + pending overlay +
 * error/conflict surface). Shared by the in-flow footer here and the
 * client review's sticky bottom bar — one source so the two never drift.
 * `acceptState.conflicts` is the typed `ProposalConflict[]` returned by
 * `acceptAdvisorProposalAction` (backend P2 shipped this shape). On an
 * optimistic-concurrency conflict the backend has already notified the
 * advisor to re-baseline (B8); the client cannot self-resolve, so we name
 * the stale items and block Accept (Reject stays available).
 */
export function ProposalReviewActions({ proposalId }: { proposalId: string }) {
  // Single in-flight guard — belt to the `disabled` suspenders. Blocks a
  // second submit of accept OR reject from entering the server action via
  // Enter+click or a pre-hydration double-fire. Same lockRef pattern as
  // AdvisorProposeRemovalButton (set on entry, cleared in finally,
  // early-return if already locked); shared so the two can't interleave.
  const lockRef = useRef(false);

  const [acceptState, acceptAction, acceptPending] = useActionState(
    async (prev: AcceptProposalState, fd: FormData) => {
      if (lockRef.current) return prev;
      lockRef.current = true;
      try {
        return await acceptAdvisorProposalAction(prev, fd);
      } finally {
        lockRef.current = false;
      }
    },
    { error: null } as AcceptProposalState
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    async (prev: { error: string | null }, fd: FormData) => {
      if (lockRef.current) return prev;
      lockRef.current = true;
      try {
        return await rejectAdvisorProposalAction(prev, fd);
      } finally {
        lockRef.current = false;
      }
    },
    { error: null as string | null }
  );
  const actionPending = acceptPending || rejectPending;
  const conflicts: ProposalConflict[] = acceptState.conflicts ?? [];
  const conflictLabels = [...new Set(conflicts.map((c) => c.label))];
  const conflicted = conflictLabels.length > 0;

  return (
    <div className="space-y-3">
      <BlockingSubmitOverlay
        active={actionPending}
        message={acceptPending ? "Applying proposal…" : "Rejecting proposal…"}
      />
      {conflicted ? (
        <p className="text-sm font-medium text-amber-800" role="alert">
          Your plan changed since this proposal was created — these items are
          now out of date:{" "}
          <span className="font-semibold">{conflictLabels.join(", ")}</span>.
          Your advisor has been notified to refresh it before it can be
          applied.
        </p>
      ) : acceptState.error || rejectState.error ? (
        <p className="text-sm font-medium text-rose-700" role="alert">
          {acceptState.error ?? rejectState.error}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <form action={rejectAction}>
          <input type="hidden" name="proposal_id" value={proposalId} />
          <button
            type="submit"
            disabled={rejectPending || acceptPending}
            className="w-full rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
          >
            {rejectPending ? "Rejecting…" : "Reject changes"}
          </button>
        </form>
        <form action={acceptAction}>
          <input type="hidden" name="proposal_id" value={proposalId} />
          <button
            type="submit"
            disabled={acceptPending || rejectPending || conflicted}
            className="w-full rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50 sm:w-auto"
          >
            {acceptPending ? "Applying…" : "Accept changes"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function ProposalReviewView({
  proposal,
  changes,
  sectionNotes,
  advisorDisplayName,
  currencyCode,
  hasProjection = false,
  actualProjection = null,
  proposedProjection = null,
  hideFooterActions = false,
  backHref = "/dashboard",
  backLabel = "← Home",
}: {
  proposal: AdvisorProposalRow;
  changes: AdvisorProposalChangeRow[];
  sectionNotes: AdvisorProposalSectionNoteRow[];
  advisorDisplayName: string;
  currencyCode: string;
  hasProjection?: boolean;
  actualProjection?: ReactNode;
  proposedProjection?: ReactNode;
  /** When true, omit the in-flow footer (caller renders its own action bar). */
  hideFooterActions?: boolean;
  backHref?: string;
  backLabel?: string;
}) {
  const sections = groupBySection(changes, sectionNotes);
  const isPending = proposal.status === "pending";

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      <p className="text-sm">
        <Link
          href={backHref}
          className="font-medium text-emerald-700 hover:text-emerald-800"
        >
          {backLabel}
        </Link>
      </p>

      <header className={`${appCardClass} ${appCardPadding} space-y-4`}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Plan review
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Review suggested changes
        </h1>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
          <span>
            From <span className="font-medium text-slate-800">{advisorDisplayName}</span>
          </span>
          {proposal.submitted_at ? (
            <span>Submitted {formatSubmittedDate(proposal.submitted_at)}</span>
          ) : null}
        </div>
        {proposal.advisor_note ? (
          <blockquote className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm leading-relaxed text-slate-700">
            {proposal.advisor_note}
          </blockquote>
        ) : null}
        {proposal.status === "accepted" || proposal.status === "rejected" ? (
          <StatusBanner status={proposal.status} />
        ) : (
          <p className="text-sm leading-relaxed text-slate-600">
            Your advisor suggested updates to your financial plan. Review each change below —
            nothing updates until you accept.
          </p>
        )}
      </header>

      {hasProjection ? (
        <section className={`${appCardClass} ${appCardPadding} space-y-4`}>
          <h2 className="text-lg font-semibold text-slate-900">
            Your plan with these changes
          </h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Compare your current projection against the outcome if you accept
            this proposal.
          </p>
          <ProposalProjectionCompare
            hasOverlay
            actual={actualProjection}
            proposed={proposedProjection}
          />
        </section>
      ) : null}

      <div className="space-y-6">
        {sections.map((block) => (
          <section
            key={block.section}
            className={`${appCardClass} overflow-hidden`}
          >
            <div className="border-b border-slate-100 px-6 py-4 sm:px-8">
              <h2 className="text-lg font-semibold text-slate-900">
                {sectionLabel(block.section)}
              </h2>
              {block.sectionNote ? (
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{block.sectionNote}</p>
              ) : null}
            </div>
            <ul className="divide-y divide-slate-100">
              {block.changes.map((c) => {
                const meta = fieldMeta(c.entity_type, c.field_key);
                const oldDisplay = formatProposalDisplayValue(
                  c.old_value,
                  meta,
                  currencyCode
                );
                const newDisplay = formatProposalDisplayValue(
                  c.new_value,
                  meta,
                  currencyCode
                );
                return (
                  <li key={c.id} className="px-6 py-4 sm:px-8">
                    <p className="text-sm font-medium text-slate-800">{c.field_label}</p>
                    <div className="mt-2 flex flex-wrap items-baseline gap-2 text-sm">
                      <span className="text-slate-400 line-through decoration-slate-300/80">
                        {oldDisplay}
                      </span>
                      <span className="text-slate-400" aria-hidden>
                        →
                      </span>
                      <span className="font-semibold text-slate-900">{newDisplay}</span>
                    </div>
                    {c.explanation ? (
                      <p className="mt-2 text-xs leading-relaxed text-slate-500">{c.explanation}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {isPending && !hideFooterActions ? (
        <footer className={`${appCardClass} ${appCardPadding} space-y-4`}>
          <p className="text-sm text-slate-600">
            Accepting applies these updates to your plan. Rejecting leaves your current data
            unchanged.
          </p>
          <ProposalReviewActions proposalId={proposal.id} />
        </footer>
      ) : null}
    </div>
  );
}

function StatusBanner({ status }: { status: "accepted" | "rejected" }) {
  const accepted = status === "accepted";
  return (
    <p
      className={`rounded-xl px-4 py-3 text-sm font-medium ${
        accepted
          ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100"
          : "bg-slate-50 text-slate-800 ring-1 ring-slate-100"
      }`}
      role="status"
    >
      {accepted
        ? "You accepted these changes. Your plan has been updated."
        : "You rejected this proposal. Your plan was not changed."}
    </p>
  );
}
