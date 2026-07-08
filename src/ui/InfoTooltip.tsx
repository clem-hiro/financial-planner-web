"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { MethodologyTopicId } from "@/content/methodology-topics";
import { useMethodology } from "@/features/help/methodology-context";

type Variant = "emerald" | "zinc";

const triggerClass: Record<Variant, string> = {
  emerald:
    "border-emerald-700/40 text-emerald-900 hover:bg-emerald-100/80 focus-visible:ring-emerald-500",
  zinc: "border-slate-400 text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-400",
};

/**
 * Small (?) control: toggles a short explanation, or opens the methodology
 * sheet when `methodologyTopicId` is set.
 */
export function InfoTooltip({
  children,
  variant = "zinc",
  ariaLabel = "Explain this",
  methodologyTopicId,
}: {
  children: React.ReactNode;
  variant?: Variant;
  ariaLabel?: string;
  /** When set, click opens “How numbers work” scrolled to this topic. */
  methodologyTopicId?: MethodologyTopicId;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();
  const { openMethodology } = useMethodology();

  useEffect(() => {
    if (!open || methodologyTopicId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, methodologyTopicId]);

  useEffect(() => {
    if (!open || methodologyTopicId) return;
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (!root.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open, methodologyTopicId]);

  const opensSheet = methodologyTopicId != null;

  return (
    <span
      ref={rootRef}
      className="relative inline-flex align-middle"
      onBlur={(e) => {
        const related = (e as React.FocusEvent).relatedTarget as Node | null;
        if (!related || !rootRef.current?.contains(related)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className={`ml-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-white/90 text-xs font-bold leading-none shadow-sm focus-visible:outline-none focus-visible:ring-2 touch-manipulation sm:h-6 sm:w-6 sm:text-[10px] ${triggerClass[variant]}`}
        aria-expanded={opensSheet ? undefined : open}
        aria-controls={opensSheet ? undefined : panelId}
        aria-haspopup={opensSheet ? "dialog" : "true"}
        aria-label={ariaLabel}
        onBlur={(e) => {
          if (!rootRef.current?.contains(e.relatedTarget as Node | null)) {
            setOpen(false);
          }
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (opensSheet) {
            openMethodology(methodologyTopicId);
            return;
          }
          setOpen((v) => !v);
        }}
      >
        ?
      </button>
      {!opensSheet && open && (
        <span
          id={panelId}
          role="region"
          aria-label={ariaLabel}
          className="absolute left-1/2 top-full z-60 mt-1.5 w-[min(20rem,calc(100vw-2.5rem))] -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-left text-[11px] leading-snug text-slate-100 shadow-xl sm:left-0 sm:translate-x-0"
        >
          <span className="block max-h-[min(70vh,22rem)] overflow-y-auto pr-0.5 [&_strong]:font-semibold [&_strong]:text-white">
            {children}
          </span>
        </span>
      )}
    </span>
  );
}
