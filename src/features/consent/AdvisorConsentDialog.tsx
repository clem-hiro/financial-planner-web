"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { ClientConsentControl } from "@/features/consent/ClientConsentControl";
import type { AdvisorCategoryVisibility } from "@/lib/advisor-visibility";
import { lockBodyScroll } from "@/lib/body-scroll-lock";

type ConsentStatus = "active" | "withdrawn" | "none";

/**
 * Reusable advisor consent review modal — grant, withdraw, and (when active)
 * per-category visibility. Use from /more callouts, inbox deep-links, etc.
 */
export function AdvisorConsentDialog({
  open,
  onOpenChange,
  status,
  consentText,
  categoryVisibility,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: ConsentStatus;
  consentText: string;
  categoryVisibility?: AdvisorCategoryVisibility;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const unlock = lockBodyScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => {
      unlock();
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm dark:bg-black/55"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(90vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 dark:border-slate-700/80 dark:bg-slate-950 dark:shadow-black/70"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Privacy &amp; Advisor Access
            </p>
            <h2
              id={titleId}
              className="mt-1 text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50"
            >
              Consent for your advisor
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Your linked advisor can only view your data and prepare suggestions
              while consent is active. You can withdraw anytime.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={() => onOpenChange(false)}
            className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          <ClientConsentControl
            status={status}
            consentText={consentText}
            categoryVisibility={categoryVisibility}
            onResolved={() => onOpenChange(false)}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
