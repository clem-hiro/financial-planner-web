"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { fieldMeta } from "@/domain/advisor-proposals/field-registry";
import { ProposalProjectionCompare } from "@/features/proposals/ProposalProjectionCompare";
import { formatProposalDisplayValue } from "@/domain/advisor-proposals/format-display";
import { groupChangesBySection } from "@/domain/advisor-proposals/group-changes";
import { sectionLabel } from "@/domain/advisor-proposals/sections";
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
import { CollapsiblePane } from "@/ui/CollapsiblePaneRail";
import { ConfirmDialog } from "@/ui/ConfirmDialog";
import { appCardClass, appCardPadding } from "@/ui/surface-classes";
import Link from "next/link";

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
export function ProposalReviewActions({
  proposalId,
  status,
  surface = "footer",
}: {
  proposalId: string;
  /** Drives pending-only action UI. The dialog host stays mounted across the
   * accept→accepted flip so the approval dialog survives the revalidate
   * re-render (it would unmount if gated by isPending in the parent). */
  status: AdvisorProposalRow["status"];
  /** Chrome around the pending action row: in-flow card vs frozen bottom bar. */
  surface?: "footer" | "fixedBar";
}) {
  const router = useRouter();
  const isPending = status === "pending";
  // Single in-flight guard — belt to the `disabled` suspenders. Blocks a
  // second submit of accept OR reject from entering the server action via
  // Enter+click or a pre-hydration double-fire. Same lockRef pattern as
  // AdvisorProposeRemovalButton (set on entry, cleared in finally,
  // early-return if already locked); shared so the two can't interleave.
  const lockRef = useRef(false);
  const acceptFormRef = useRef<HTMLFormElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);

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
  // A fully-applied accept flips ok → swap the confirm dialog for the approval
  // dialog. (ok is set only on success; conflict/error leave it falsy.)
  useEffect(() => {
    if (acceptState.ok) {
      setConfirmOpen(false);
      setApprovalOpen(true);
    }
  }, [acceptState.ok]);

  const actionPending = acceptPending || rejectPending;
  const conflicts: ProposalConflict[] = acceptState.conflicts ?? [];
  const conflictLabels = [...new Set(conflicts.map((c) => c.label))];
  const conflicted = conflictLabels.length > 0;
  const nameConflictLabels = [
    ...new Set(
      conflicts.filter((c) => c.reason === "name_in_use").map((c) => c.label)
    ),
  ];

  const actionBody = (
    <div className="space-y-3">
      <BlockingSubmitOverlay
        active={actionPending}
        message={acceptPending ? "Applying proposal…" : "Rejecting proposal…"}
      />
      {nameConflictLabels.length > 0 ? (
        <p className="text-sm font-medium text-amber-800" role="alert">
          These names are already in use in your plan:{" "}
          <span className="font-semibold">
            {nameConflictLabels.join(", ")}
          </span>
          . Ask your advisor to rename them before it can be applied.
        </p>
      ) : conflicted ? (
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
        {/* Hidden form is the submit mechanism; the visible button opens the
            confirm dialog, which calls requestSubmit() on confirm (keeps the
            lockRef + progressive-enhancement action path). */}
        <form ref={acceptFormRef} action={acceptAction}>
          <input type="hidden" name="proposal_id" value={proposalId} />
        </form>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={acceptPending || rejectPending || conflicted}
          className="w-full rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50 sm:w-auto"
        >
          {acceptPending ? "Applying…" : "Accept changes"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Action row renders only while pending; the dialogs below stay mounted
          regardless so the approval dialog persists past accept→accepted. */}
      {isPending ? (
        surface === "fixedBar" ? (
          // fixed (not sticky): a sticky bottom-0 bar lifts off the viewport at
          // page bottom in WebKit. Mirrors OnboardingWizard's fixed nav.
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/90 bg-white/95 px-4 py-3 backdrop-blur-sm supports-[backdrop-filter]:bg-white/80 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto max-w-3xl">{actionBody}</div>
          </div>
        ) : (
          <footer className={`${appCardClass} ${appCardPadding} space-y-4`}>
            <p className="text-sm text-slate-600">
              Accepting applies these updates to your plan. Rejecting leaves your
              current data unchanged.
            </p>
            {actionBody}
          </footer>
        )
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title="Apply these changes?"
        body="Apply these changes to your plan? Your plan updates immediately."
        confirmLabel="Apply changes"
        cancelLabel="Cancel"
        onConfirm={() => {
          setConfirmOpen(false);
          acceptFormRef.current?.requestSubmit();
        }}
        onCancel={() => setConfirmOpen(false)}
      />

      <ConfirmDialog
        open={approvalOpen}
        title="Proposal Approved"
        body={'Head to "Setup" tab to view?'}
        confirmLabel="Go to page"
        cancelLabel="Stay on page"
        onConfirm={() => router.push("/setup?tab=profile")}
        onCancel={() => {
          setApprovalOpen(false);
          router.refresh();
        }}
      />
    </>
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
  hideBackLink = false,
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
  /** When true, omit the back link (caller renders it outside the grid column). */
  hideBackLink?: boolean;
  backHref?: string;
  backLabel?: string;
}) {
  const sections = groupChangesBySection(changes);
  const noteMap = new Map(sectionNotes.map((n) => [n.section, n.note]));

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      {hideBackLink ? null : (
        <p className="text-sm">
          <Link
            href={backHref}
            className="font-medium text-emerald-700 hover:text-emerald-800"
          >
            {backLabel}
          </Link>
        </p>
      )}

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

      {sections.length > 0 ? (
        <CollapsiblePane title="Advisor Proposals">
          <div className="space-y-6">
            {sections.map((block) => {
              const note = noteMap.get(block.section) ?? null;
              return (
                <div key={block.section} className="space-y-3">
                  {note ? (
                    <p className="text-xs leading-relaxed text-slate-500">{note}</p>
                  ) : null}
                  {block.entities.map((entity) => (
                    <section
                      key={`${entity.entityType}:${entity.entityId ?? "profile"}`}
                      className="space-y-2"
                    >
                      {/* Account is now the heading, so the field labels drop
                          their redundant " (Account)" suffix below. */}
                      <h3 className="text-sm font-semibold tracking-tight text-slate-900">
                        {sectionLabel(block.section)} — {entity.headline}
                      </h3>
                      <ul className="space-y-2">
                        {entity.changes.map((c) => {
                          const meta = fieldMeta(c.entity_type, c.field_key);
                          const label = c.field_label.replace(
                            /\s*\([^)]+\)\s*$/,
                            ""
                          );
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
                            <li
                              key={c.id}
                              className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3"
                            >
                              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                <p className="text-sm font-medium text-slate-800">
                                  {label}
                                </p>
                                <div className="flex flex-wrap items-baseline gap-2 text-sm tabular-nums">
                                  <span className="text-slate-400 line-through decoration-slate-300/80">
                                    {oldDisplay}
                                  </span>
                                  <span className="text-slate-300" aria-hidden>
                                    →
                                  </span>
                                  <span className="font-semibold text-slate-900">
                                    {newDisplay}
                                  </span>
                                </div>
                              </div>
                              {c.explanation ? (
                                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                                  {c.explanation}
                                </p>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                </div>
              );
            })}
          </div>
        </CollapsiblePane>
      ) : null}

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

      {/* Mounted regardless of status (footer chrome shows only while pending,
          inside the component) so the approval dialog survives accept→accepted.
          hideFooterActions = caller renders its own ProposalReviewActions. */}
      {!hideFooterActions ? (
        <ProposalReviewActions proposalId={proposal.id} status={proposal.status} />
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
