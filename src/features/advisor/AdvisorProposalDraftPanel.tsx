"use client";

import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
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
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import { ConfirmDialog } from "@/ui/ConfirmDialog";

const textareaClass =
  "w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-slate-300/40 focus:ring-2";

const MAX_PREVIEW_FIELDS = 3;

/**
 * Queued-suggestions summary (list + per-section/item remove). Stays in the
 * right rail on Compose. The Submit form was split into `SubmitProposalBar`
 * (rendered as a frozen bottom bar on the left pane).
 */
export function DraftSummaryPanel({
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

  if (disabled) return null;

  function refreshAfter(action: () => Promise<{ error: string | null }>) {
    startTransition(async () => {
      const res = await action();
      if (!res.error) router.refresh();
    });
  }

  const busy = isPending;

  return (
    <div className="space-y-4" {...(busy ? { inert: true } : {})}>
      <BlockingSubmitOverlay active={busy} message="Updating proposal…" />
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
                    disabled={isPending}
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
                          disabled={isPending}
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
    </div>
  );
}

/**
 * Submit-for-review form, rendered as a FROZEN action bar pinned to the
 * viewport bottom on the Compose view (mirrors OnboardingWizard's fixed nav +
 * the client accept bar). `fixed` rather than `sticky` on purpose: a sticky
 * bar rides up off the viewport at page bottom when a sibling column is taller
 * (the exact failure item 4 fixes). Renders nothing until a draft exists.
 *
 * `alignToId`: clip the fixed bar to that element's horizontal box (the left
 * editing column) via a ResizeObserver, so it doesn't span under the right
 * rail. Below the xl breakpoint (single-column layout) it falls back to full
 * width. SSR-safe: a brief full-width first paint before the effect runs.
 */
const XL_BREAKPOINT = 1280;

export function SubmitProposalBar({
  proposalId,
  changeCount,
  disabled,
  alignToId,
}: {
  proposalId: string | null;
  changeCount: number;
  disabled: boolean;
  alignToId?: string;
}) {
  const [submitState, submitAction, submitPending] = useActionState(
    submitAdvisorProposalAction,
    { error: null as string | null, success: false }
  );
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const active = !disabled && !!proposalId;

  useEffect(() => {
    if (!alignToId || !active) return;
    const el = document.getElementById(alignToId);
    if (!el) return;
    const measure = () => {
      // Below xl the compose layout stacks to one column → span full width.
      if (window.innerWidth < XL_BREAKPOINT) {
        setBox(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setBox({ left: r.left, width: r.width });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [alignToId, active]);

  if (!active) return null;

  // Clipped to the left column when measured; full-width fallback otherwise.
  const barStyle: CSSProperties = box
    ? { left: box.left, width: box.width, right: "auto" }
    : { left: 0, right: 0 };

  return (
    <>
      <BlockingSubmitOverlay active={submitPending} message="Submitting proposal…" />
      <div
        style={barStyle}
        className="fixed bottom-0 z-20 border-t border-slate-200/90 bg-white/95 px-4 py-3 backdrop-blur-sm supports-[backdrop-filter]:bg-white/80 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <form ref={formRef} action={submitAction} className="mx-auto max-w-3xl">
          <input type="hidden" name="proposal_id" value={proposalId} />
          <p className="text-sm font-semibold text-slate-900">
            Submit for client review
          </p>
          <label
            htmlFor="advisor_note"
            className="mt-1 block text-sm font-medium text-slate-700"
          >
            Message to client (optional)
          </label>
          {/* textarea is a DIRECT sibling of the button so items-end levels the
              button's bottom border exactly with the textarea's. */}
          <div className="mt-1.5 flex items-end gap-6">
            <textarea
              id="advisor_note"
              name="advisor_note"
              rows={2}
              className={`${textareaClass} flex-1`}
              placeholder="e.g. I updated your retirement assumptions."
              disabled={submitPending || changeCount === 0}
            />
            {/* type=button opens the confirm dialog; Confirm requestSubmit()s
                this form so submitAction/useActionState + the textarea value +
                the overlay/disabled states stay intact. */}
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={submitPending || changeCount === 0}
              className="inline-flex shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
            >
              {submitPending ? "Submitting…" : "Submit proposal"}
            </button>
          </div>
          {changeCount === 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              Add at least one suggested change before submitting.
            </p>
          ) : null}
          {submitState.error ? (
            <p className="mt-2 text-sm font-medium text-rose-700" role="alert">
              {submitState.error}
            </p>
          ) : null}
          {submitState.success ? (
            <p className="mt-2 text-sm font-medium text-emerald-800" role="status">
              Proposal sent — your client will be notified to review.
            </p>
          ) : null}
        </form>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Submit proposal"
        body="Your client will be notified to review these changes. Nothing on their plan changes until they accept."
        confirmLabel="Submit"
        cancelLabel="Cancel"
        onConfirm={() => {
          setConfirmOpen(false);
          formRef.current?.requestSubmit();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
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
