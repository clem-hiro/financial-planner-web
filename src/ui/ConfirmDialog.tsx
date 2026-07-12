"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { lockBodyScroll } from "@/lib/body-scroll-lock";

/**
 * Reusable confirm dialog — portal + backdrop + `role="dialog" aria-modal`
 * + ESC/backdrop cancel + body-scroll-lock. No new dependency.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  confirmDisabled = false,
  tone = "default",
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmDisabled?: boolean;
  /** `danger` for irreversible replace/delete actions. */
  tone?: "default" | "danger";
}) {
  const titleId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const unlock = lockBodyScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    confirmRef.current?.focus();
    return () => {
      unlock();
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onCancel]);

  if (!open || typeof document === "undefined") return null;

  const confirmClass =
    tone === "danger"
      ? "rounded-xl bg-rose-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-800 disabled:opacity-50 sm:w-auto dark:bg-rose-600 dark:hover:bg-rose-500"
      : "rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50 sm:w-auto dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white";

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm dark:bg-black/55"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-900/20 dark:border-slate-700 dark:bg-slate-950 dark:shadow-black/40 sm:p-6"
      >
        <h2
          id={titleId}
          className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50"
        >
          {title}
        </h2>
        <div className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {body}
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={confirmClass}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
