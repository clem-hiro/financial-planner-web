"use client";

import { useActionState } from "react";
import { fieldMeta } from "@/domain/advisor-proposals/field-registry";
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
import {
  acceptAdvisorProposalAction,
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

export function ProposalReviewView({
  proposal,
  changes,
  sectionNotes,
  advisorDisplayName,
  currencyCode,
}: {
  proposal: AdvisorProposalRow;
  changes: AdvisorProposalChangeRow[];
  sectionNotes: AdvisorProposalSectionNoteRow[];
  advisorDisplayName: string;
  currencyCode: string;
}) {
  const sections = groupBySection(changes, sectionNotes);
  const isPending = proposal.status === "pending";
  const [acceptState, acceptAction, acceptPending] = useActionState(
    acceptAdvisorProposalAction,
    { error: null as string | null }
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectAdvisorProposalAction,
    { error: null as string | null }
  );
  const actionPending = acceptPending || rejectPending;

  return (
    <div
      className="mx-auto max-w-3xl space-y-8 pb-16"
      {...(actionPending ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay
        active={actionPending}
        message={acceptPending ? "Applying proposal…" : "Rejecting proposal…"}
      />
      <p className="text-sm">
        <Link href="/dashboard" className="font-medium text-emerald-700 hover:text-emerald-800">
          ← Home
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

      {isPending ? (
        <footer className={`${appCardClass} ${appCardPadding} space-y-4`}>
          <p className="text-sm text-slate-600">
            Accepting applies these updates to your plan. Rejecting leaves your current data
            unchanged.
          </p>
          {(acceptState.error || rejectState.error) && (
            <p className="text-sm font-medium text-rose-700" role="alert">
              {acceptState.error ?? rejectState.error}
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <form action={rejectAction}>
              <input type="hidden" name="proposal_id" value={proposal.id} />
              <button
                type="submit"
                disabled={rejectPending || acceptPending}
                className="w-full rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
              >
                {rejectPending ? "Rejecting…" : "Reject changes"}
              </button>
            </form>
            <form action={acceptAction}>
              <input type="hidden" name="proposal_id" value={proposal.id} />
              <button
                type="submit"
                disabled={acceptPending || rejectPending}
                className="w-full rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50 sm:w-auto"
              >
                {acceptPending ? "Applying…" : "Accept changes"}
              </button>
            </form>
          </div>
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
