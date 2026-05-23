import type { ReactNode } from "react";
import type {
  AdvisorProposalChangeRow,
  AdvisorProposalRow,
  AdvisorProposalSectionNoteRow,
} from "@/data/supabase/types";
import { groupChangesBySection } from "@/domain/advisor-proposals/group-changes";
import { sectionLabel } from "@/domain/advisor-proposals/sections";
import {
  ProposalReviewActions,
  ProposalReviewView,
} from "@/features/proposals/ProposalReviewView";
import { CollapsiblePane, CollapsiblePaneRail } from "@/ui/CollapsiblePaneRail";

/**
 * Client per-proposal review: the existing ProposalReviewView (header +
 * projection compare + per-change list) beside a CollapsiblePaneRail
 * (Plans Consolidation + AI Insights only — no Opportunity Detection for
 * the client), with a sticky bottom Accept/Reject bar while `pending`.
 * Layout mirrors the advisor per-proposal view.
 */
export function ClientProposalReviewView({
  proposal,
  changes,
  sectionNotes,
  advisorDisplayName,
  currencyCode,
  hasProjection,
  actualProjection = null,
  proposedProjection = null,
}: {
  proposal: AdvisorProposalRow;
  changes: AdvisorProposalChangeRow[];
  sectionNotes: AdvisorProposalSectionNoteRow[];
  advisorDisplayName: string;
  currencyCode: string;
  hasProjection: boolean;
  actualProjection?: ReactNode;
  proposedProjection?: ReactNode;
}) {
  const sections = groupChangesBySection(changes);
  const isPending = proposal.status === "pending";

  return (
    <div className="space-y-8">
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start xl:gap-10">
        <div className="min-w-0">
          <ProposalReviewView
            proposal={proposal}
            changes={changes}
            sectionNotes={sectionNotes}
            advisorDisplayName={advisorDisplayName}
            currencyCode={currencyCode}
            hasProjection={hasProjection}
            actualProjection={actualProjection}
            proposedProjection={proposedProjection}
            hideFooterActions
            backHref="/setup?tab=advisor-proposals"
            backLabel="← Proposals"
          />
        </div>

        <CollapsiblePaneRail>
          <CollapsiblePane title="Plans Consolidation" defaultOpen>
            {sections.length === 0 ? (
              <p className="text-sm text-slate-600">
                No changes in this proposal.
              </p>
            ) : (
              <ul className="space-y-4">
                {sections.map((block) => (
                  <li
                    key={block.section}
                    className="rounded-xl border border-slate-100 bg-slate-50/50 p-3"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {sectionLabel(block.section)}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {block.entities.map((entity) => (
                        <li
                          key={`${entity.entityType}:${entity.entityId ?? "profile"}`}
                          className="flex items-baseline justify-between gap-2 text-xs text-slate-600"
                        >
                          <span className="min-w-0 truncate font-medium text-slate-800">
                            {entity.headline}
                          </span>
                          <span className="shrink-0 text-slate-500">
                            {entity.changes.length}{" "}
                            {entity.changes.length === 1 ? "field" : "fields"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </CollapsiblePane>
          <CollapsiblePane title="AI Insights">
            <p className="text-sm leading-relaxed text-slate-600">
              Narrative briefs and anomaly explanations —{" "}
              <span className="font-medium text-slate-800">AI Insights Coming</span>.
            </p>
          </CollapsiblePane>
        </CollapsiblePaneRail>
      </div>

      {isPending ? (
        <div className="sticky bottom-0 z-10 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-t-xl sm:px-6">
          <div className="mx-auto max-w-3xl">
            <ProposalReviewActions proposalId={proposal.id} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
