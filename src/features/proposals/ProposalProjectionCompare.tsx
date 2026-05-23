"use client";

import { useState, type ReactNode } from "react";

/**
 * Slot-pattern toggle: `actual` / `proposed` are server-rendered projection
 * sections passed in as props (the existing chart component, not a redesign).
 * No overlay ⇒ canonical view, no toggle affordance. An optional `action`
 * (e.g. a "Compose proposal" button) renders right-aligned on the header row
 * and shows even with no overlay — the start-a-proposal entry point.
 */
export function ProposalProjectionCompare({
  actual,
  proposed,
  hasOverlay,
  action,
}: {
  actual: ReactNode;
  proposed: ReactNode;
  hasOverlay: boolean;
  action?: ReactNode;
}) {
  const [mode, setMode] = useState<"actual" | "proposed">(
    hasOverlay ? "proposed" : "actual"
  );

  // No overlay and no action ⇒ nothing to frame; render canonical only.
  if (!hasOverlay && !action) return <>{actual}</>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {hasOverlay ? (
          <div
            role="tablist"
            aria-label="Projection basis"
            className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-sm font-medium"
          >
            <button
              role="tab"
              aria-selected={mode === "actual"}
              onClick={() => setMode("actual")}
              className={`rounded-lg px-4 py-1.5 transition ${
                mode === "actual"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Actual
            </button>
            <button
              role="tab"
              aria-selected={mode === "proposed"}
              onClick={() => setMode("proposed")}
              className={`rounded-lg px-4 py-1.5 transition ${
                mode === "proposed"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              With proposal
            </button>
          </div>
        ) : (
          // Canonical state (advisor overview, where `action` is passed):
          // show the same tablist locked on "Actual" — "With proposal" is
          // disabled until a draft exists, signalling the toggle's purpose.
          <div
            role="tablist"
            aria-label="Projection basis"
            className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-sm font-medium"
          >
            <span
              role="tab"
              aria-selected
              className="rounded-lg bg-white px-4 py-1.5 text-slate-900 shadow-sm"
            >
              Actual
            </span>
            <button
              type="button"
              role="tab"
              disabled
              aria-disabled="true"
              className="cursor-not-allowed rounded-lg px-4 py-1.5 text-slate-300"
            >
              With proposal
            </button>
          </div>
        )}
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {hasOverlay ? (
        <>
          <div className={mode === "actual" ? undefined : "hidden"}>{actual}</div>
          <div className={mode === "proposed" ? undefined : "hidden"}>
            {proposed}
          </div>
        </>
      ) : (
        actual
      )}
    </div>
  );
}
