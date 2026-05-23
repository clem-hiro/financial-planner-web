import Link from "next/link";
import type { ReactNode } from "react";
import type {
  AdvisorProposalChangeRow,
  AdvisorProposalRow,
} from "@/data/supabase/types";
import { fieldMeta } from "@/domain/advisor-proposals/field-registry";
import { formatProposalDisplayValue } from "@/domain/advisor-proposals/format-display";
import { groupChangesBySection } from "@/domain/advisor-proposals/group-changes";
import { proposalStatusDisplay } from "@/domain/advisor-proposals/proposal-status-display";
import { shortDate } from "@/domain/advisor-proposals/proposal-format";
import { sectionLabel } from "@/domain/advisor-proposals/sections";
import { AdvisorBadge } from "@/features/advisor/advisor-workspace-primitives";
import { ProposalProjectionCompare } from "@/features/proposals/ProposalProjectionCompare";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { CollapsiblePane, CollapsiblePaneRail } from "@/ui/CollapsiblePaneRail";
import { appCardClass, appCardPadding } from "@/ui/surface-classes";

/**
 * Advisor-side, read-only view of one historical/pending proposal.
 * Withdraw lives on the table row (per plan A3); this view never mutates.
 */
export function AdvisorProposalDetailView({
  clientId,
  proposal,
  changes,
  currencyCode,
  hasProjection,
  actualProjection = null,
  proposedProjection = null,
}: {
  clientId: string;
  proposal: AdvisorProposalRow;
  changes: AdvisorProposalChangeRow[];
  currencyCode: string;
  hasProjection: boolean;
  actualProjection?: ReactNode;
  proposedProjection?: ReactNode;
}) {
  const sections = groupChangesBySection(changes);
  const display = proposalStatusDisplay(proposal.status, "advisor");

  return (
    <div className="space-y-8">
      <p className="text-sm">
        <Link
          href={`/advisor/client/${clientId}?view=proposals`}
          className={appInlineLinkClass}
        >
          ← Proposals
        </Link>
      </p>

      <header className={`${appCardClass} ${appCardPadding} space-y-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Proposal
          </h1>
          <AdvisorBadge tone={display.tone}>
            {display.label}
          </AdvisorBadge>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
          <span>Created {shortDate(proposal.created_at)}</span>
          <span>Submitted {shortDate(proposal.submitted_at)}</span>
          <span>Resolved {shortDate(proposal.resolved_at)}</span>
        </div>
        {proposal.advisor_note ? (
          <blockquote className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm leading-relaxed text-slate-700">
            {proposal.advisor_note}
          </blockquote>
        ) : null}
      </header>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start xl:gap-10">
        <div className="space-y-8">
          {hasProjection ? (
            <section className={`${appCardClass} ${appCardPadding} space-y-4`}>
              <h2 className="text-lg font-semibold text-slate-900">
                Projection with this proposal
              </h2>
              <p className="text-sm leading-relaxed text-slate-600">
                Compare the client&apos;s current projection against the
                outcome if this proposal is accepted.
              </p>
              <ProposalProjectionCompare
                hasOverlay
                actual={actualProjection}
                proposed={proposedProjection}
              />
            </section>
          ) : null}

          <div className="space-y-6">
            {sections.length === 0 ? (
              <p className="text-sm text-slate-600">
                This proposal has no recorded changes.
              </p>
            ) : (
              sections.map((block) => (
                <section
                  key={block.section}
                  className={`${appCardClass} overflow-hidden`}
                >
                  <div className="border-b border-slate-100 px-6 py-4 sm:px-8">
                    <h2 className="text-lg font-semibold text-slate-900">
                      {sectionLabel(block.section)}
                    </h2>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {block.changes.map((c) => {
                      const meta = fieldMeta(c.entity_type, c.field_key);
                      return (
                        <li key={c.id} className="px-6 py-4 sm:px-8">
                          <p className="text-sm font-medium text-slate-800">
                            {c.field_label}
                          </p>
                          <div className="mt-2 flex flex-wrap items-baseline gap-2 text-sm">
                            <span className="text-slate-400 line-through decoration-slate-300/80">
                              {formatProposalDisplayValue(
                                c.old_value,
                                meta,
                                currencyCode
                              )}
                            </span>
                            <span className="text-slate-400" aria-hidden>
                              →
                            </span>
                            <span className="font-semibold text-slate-900">
                              {formatProposalDisplayValue(
                                c.new_value,
                                meta,
                                currencyCode
                              )}
                            </span>
                          </div>
                          {c.explanation ? (
                            <p className="mt-2 text-xs leading-relaxed text-slate-500">
                              {c.explanation}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}
          </div>
        </div>

        <CollapsiblePaneRail>
          <CollapsiblePane title="Plans Consolidation" defaultOpen>
            {sections.length === 0 ? (
              <p className="text-sm text-slate-600">No changes in this proposal.</p>
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
          <CollapsiblePane title="Opportunity Detection">
            <p className="text-sm leading-relaxed text-slate-600">
              Insurance, CPF, and product opportunity scoring —{" "}
              <span className="font-medium text-slate-800">Opportunity Detection Coming</span>.
            </p>
          </CollapsiblePane>
          <CollapsiblePane title="AI Insights">
            <p className="text-sm leading-relaxed text-slate-600">
              Narrative briefs and anomaly explanations —{" "}
              <span className="font-medium text-slate-800">AI Insights Coming</span>.
            </p>
          </CollapsiblePane>
        </CollapsiblePaneRail>
      </div>
    </div>
  );
}
