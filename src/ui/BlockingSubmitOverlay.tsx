"use client";

import { createPortal } from "react-dom";
import { useEffect, useSyncExternalStore } from "react";

const subscribeNoop = () => () => {};

/**
 * Full-viewport blocking layer while an async server action runs.
 * Renders via portal so parent overflow/transform cannot clip it.
 */
export function BlockingSubmitOverlay({
  active,
  message = "Saving…",
}: {
  active: boolean;
  message?: string;
}) {
  // SSR-safe hydration gate: portal needs document.body, which doesn't exist during SSR.
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);

  if (!mounted || !active) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-200 flex items-center justify-center bg-slate-950/40 backdrop-blur-[2px]"
      role="presentation"
    >
      <div className="mx-4 max-w-sm rounded-2xl border border-white/25 bg-white/95 px-6 py-5 shadow-2xl ring-1 ring-slate-900/5">
        <div className="flex items-center gap-3" role="status" aria-live="polite">
          <span
            className="size-5 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-slate-800"
            aria-hidden
          />
          <p className="text-sm font-medium text-slate-900">{message}</p>
        </div>
      </div>
    </div>,
    document.body
  );
}
