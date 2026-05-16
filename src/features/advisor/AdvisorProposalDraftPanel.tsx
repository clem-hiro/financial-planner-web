"use client";

import { useRouter } from "next/navigation";
import { useActionState, useTransition } from "react";
import type { AdvisorProposalChangeRow } from "@/data/supabase/types";
import { fieldMeta } from "@/domain/advisor-proposals/field-registry";
import { formatProposalDisplayValue } from "@/domain/advisor-proposals/format-display";
import { groupChangesBySection } from "@/domain/advisor-proposals/group-changes";
import { sectionLabel } from "@/domain/advisor-proposals/sections";
import {
  removeAdvisorProposalEntityAction,
  removeAdvisorProposalSectionAction,
  submitAdvisorProposalAction,
} from "@/server/advisor-proposal-actions";

const textareaClass =
  "mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-slate-300/40 focus:ring-2";

const MAX_PREVIEW_FIELDS = 3;

export function AdvisorProposalDraftPanel({
  proposalId,
  changes,
  currencyCode,
  disabled,
}: {
  proposalId: string | null;
  changes: AdvisorProposalChangeRow[];
  currencyCode: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const sections = groupChangesBySection(changes);
  const changeCount = changes.length;

  const [submitState, submitAction, submitPending] = useActionState(
    submitAdvisorProposalAction,
    { error: null as string | null, success: false }
  );

  if (disabled) return null;

  function refreshAfter(action: () => Promise<{ error: string | null }>) {
    startTransition(async () => {
      const res = await action();
      if (!res.error) router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {changeCount > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <DraftSummaryHeader changeCount={changeCount} isPending={isPending} />
          <ul className="mt-4 space-y-4">
            {sections.map((block) => (
              <li
                key={block.section}
                className="rounded-xl border border-slate-100 bg-slate-50/50 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {sectionLabel(block.section)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {block.changes.length}{" "}
                      {block.changes.length === 1 ? "field" : "fields"}
                    </p>
                  </div>
                  <RemoveSectionButton
                    section={block.section}
                    disabled={isPending || submitPending}
                    onRemove={() => {
                      const pid = proposalId;
                      if (!pid) return;
                      refreshAfter(async () => {
                        const fd = new FormData();
                        fd.set("proposal_id", pid);
                        fd.set("section", block.section);
                        return removeAdvisorProposalSectionAction({ error: null }, fd);
                      });
                    }}
                  />
                </div>
                <ul className="mt-3 space-y-3">
                  {block.entities.map((entity) => (
                    <li
                      key={`${entity.entityType}:${entity.entityId ?? "profile"}`}
                      className="rounded-lg border border-slate-100/90 bg-white px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-800">
                          {entity.headline}
                        </p>
                        <RemoveItemButton
                          disabled={isPending || submitPending}
                          onRemove={() => {
                            const pid = proposalId;
                            if (!pid) return;
                            refreshAfter(async () => {
                              const fd = new FormData();
                              fd.set("proposal_id", pid);
                              fd.set("entity_type", entity.entityType);
                              fd.set("entity_id", entity.entityId ?? "profile");
                              return removeAdvisorProposalEntityAction({ error: null }, fd);
                            });
                          }}
                        />
                      </div>
                      <ul className="mt-2 space-y-1">
                        {entity.changes
                          .filter(
                            (c) =>
                              c.field_key !== "_deleted" ||
                              entity.changes.length === 1
                          )
                          .slice(0, MAX_PREVIEW_FIELDS)
                          .map((c) => {
                          const meta = fieldMeta(c.entity_type, c.field_key);
                          const label = c.field_label.replace(/\s*\([^)]+\)\s*$/, "");
                          return (
                            <li
                              key={c.id}
                              className="text-xs leading-relaxed text-slate-600"
                            >
                              <span className="text-slate-500">{label}: </span>
                              <span className="text-slate-400 line-through decoration-slate-300/80">
                                {formatProposalDisplayValue(c.old_value, meta, currencyCode)}
                              </span>
                              <span className="text-slate-400"> → </span>
                              <span className="font-medium text-slate-800">
                                {formatProposalDisplayValue(c.new_value, meta, currencyCode)}
                              </span>
                            </li>
                          );
                        })}
                        {entity.changes.length > MAX_PREVIEW_FIELDS ? (
                          <li className="text-xs text-slate-400">
                            +{entity.changes.length - MAX_PREVIEW_FIELDS} more
                          </li>
                        ) : null}
                      </ul>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-600">
          Suggested changes will appear here as you edit the client plan.
        </div>
      )}

      {proposalId ? (
      <form
        action={submitAction}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <input type="hidden" name="proposal_id" value={proposalId} />
        <h2 className="text-sm font-semibold text-slate-900">Submit for client review</h2>
        <p className="mt-1 text-sm text-slate-600">
          {changeCount > 0
            ? `Send ${changeCount} suggested ${changeCount === 1 ? "change" : "changes"} to your client. They’ll see exactly what changed before anything updates.`
            : "Add at least one suggested change before submitting."}
        </p>
        <label className="mt-4 block text-sm">
          <span className="font-medium text-slate-700">Message to client (optional)</span>
          <textarea
            name="advisor_note"
            rows={3}
            className={textareaClass}
            placeholder="e.g. I updated your retirement assumptions to better reflect your desired lifestyle."
            disabled={submitPending || changeCount === 0}
          />
        </label>
        {submitState.error ? (
          <p className="mt-3 text-sm font-medium text-rose-700" role="alert">
            {submitState.error}
          </p>
        ) : null}
        {submitState.success ? (
          <p className="mt-3 text-sm font-medium text-emerald-800" role="status">
            Proposal sent — your client will be notified to review.
          </p>
        ) : null}
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={submitPending || changeCount === 0 || isPending}
            className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
          >
            {submitPending ? "Submitting…" : "Submit proposal"}
          </button>
        </div>
      </form>
      ) : null}
    </div>
  );
}

function DraftSummaryHeader({
  changeCount,
  isPending,
}: {
  changeCount: number;
  isPending: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-slate-900">Queued suggestions</h2>
      <span className="shrink-0 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-900">
        {isPending ? "…" : changeCount}
      </span>
    </div>
  );
}

function RemoveSectionButton({
  section,
  disabled,
  onRemove,
}: {
  section: string;
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onRemove}
      className="shrink-0 text-xs font-medium text-slate-500 underline-offset-2 hover:text-rose-700 hover:underline disabled:opacity-50"
      aria-label={`Remove all ${sectionLabel(section)} changes`}
    >
      Remove
    </button>
  );
}

function RemoveItemButton({
  disabled,
  onRemove,
}: {
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onRemove}
      className="shrink-0 text-[11px] font-medium text-slate-400 hover:text-rose-700 disabled:opacity-50"
      aria-label="Remove this item"
    >
      Remove
    </button>
  );
}
