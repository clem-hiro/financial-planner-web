"use client";

import { useEffect, useId, useRef } from "react";
import { METHODOLOGY_TOPICS } from "@/content/methodology-topics";
import { lockBodyScroll } from "@/lib/body-scroll-lock";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { useMethodology } from "./methodology-context";

export function MethodologySheet() {
  const { isOpen, activeTopicId, closeMethodology } = useMethodology();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const unlock = lockBodyScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMethodology();
    };
    window.addEventListener("keydown", onKey);
    closeBtnRef.current?.focus();
    return () => {
      unlock();
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, closeMethodology]);

  useEffect(() => {
    if (!isOpen) return;
    if (!activeTopicId) return;
    const el = document.getElementById(`methodology-topic-${activeTopicId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [isOpen, activeTopicId]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex justify-end bg-slate-900/40 p-0 backdrop-blur-sm dark:bg-black/55 sm:p-5"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeMethodology();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-full w-full max-w-lg flex-col overflow-hidden border-slate-200/80 bg-white shadow-2xl shadow-slate-900/20 dark:border-slate-700/80 dark:bg-slate-950 dark:shadow-black/70 sm:h-[min(100vh-2.5rem,48rem)] sm:rounded-2xl sm:border sm:border-l"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-white via-teal-50/30 to-white px-4 py-3 dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 sm:gap-3 sm:px-5 sm:py-4">
          <h2
            id={titleId}
            className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50"
          >
            How numbers work
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="min-h-11 min-w-11 rounded-full px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400/40 touch-manipulation dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50 dark:focus:ring-teal-300/45 sm:min-h-0 sm:min-w-0 sm:px-3 sm:py-1.5"
            onClick={closeMethodology}
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Plain-language notes on how this app computes what you see. Not
            financial advice.
          </p>
          <nav className="mt-5 border-b border-slate-100 pb-5 dark:border-slate-800">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Jump to
            </p>
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {METHODOLOGY_TOPICS.map((t) => (
                <li key={t.id}>
                  <a
                    href={`#methodology-topic-${t.id}`}
                    className={appInlineLinkClass}
                    onClick={(e) => {
                      e.preventDefault();
                      document
                        .getElementById(`methodology-topic-${t.id}`)
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    {t.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-8 space-y-10">
            {METHODOLOGY_TOPICS.map((t) => (
              <section
                key={t.id}
                id={`methodology-topic-${t.id}`}
                className="scroll-mt-4 border-b border-slate-100 pb-8 last:border-0 dark:border-slate-800"
              >
                <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  {t.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {t.summary}
                </p>
                {t.bullets.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {t.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                )}
                {t.formulas && t.formulas.length > 0 && (
                  <ul className="mt-3 space-y-1 rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:ring-1 dark:ring-slate-800">
                    {t.formulas.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                )}
                {t.footnote ? (
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t.footnote}</p>
                ) : null}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
