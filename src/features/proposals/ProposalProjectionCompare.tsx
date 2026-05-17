"use client";

import { useState, type ReactNode } from "react";

/**
 * Slot-pattern toggle: `actual` / `proposed` are server-rendered projection
 * sections passed in as props (the existing chart component, not a redesign).
 * No overlay ⇒ render the canonical view with no toggle affordance.
 */
export function ProposalProjectionCompare({
  actual,
  proposed,
  hasOverlay,
}: {
  actual: ReactNode;
  proposed: ReactNode;
  hasOverlay: boolean;
}) {
  const [mode, setMode] = useState<"actual" | "proposed">(
    hasOverlay ? "proposed" : "actual"
  );

  if (!hasOverlay) return <>{actual}</>;

  return (
    <div className="space-y-4">
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
      <div className={mode === "actual" ? undefined : "hidden"}>{actual}</div>
      <div className={mode === "proposed" ? undefined : "hidden"}>
        {proposed}
      </div>
    </div>
  );
}
