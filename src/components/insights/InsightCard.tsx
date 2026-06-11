import type { ReactNode } from "react";

export function InsightCard({
  title,
  summary,
  tone = "neutral",
  footnote,
  children,
}: {
  title: string;
  summary: string;
  tone?: "neutral" | "positive" | "attention";
  footnote?: string;
  children?: ReactNode;
}) {
  const toneBar =
    tone === "positive"
      ? "from-emerald-500 to-emerald-400"
      : tone === "attention"
        ? "from-amber-500 to-amber-400"
        : "from-slate-400 to-slate-300";

  return (
    <section className="relative overflow-hidden rounded-2xl bg-white/90 p-5 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-700/80">
      <div
        className={`pointer-events-none absolute left-0 top-0 h-full w-1 bg-linear-to-b ${toneBar}`}
        aria-hidden
      />
      <div className="pl-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
          Insight
        </p>
        <h3 className="mt-1 text-base font-semibold tracking-tight text-[#0c192f] dark:text-slate-50">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{summary}</p>
        {children ? <div className="mt-4">{children}</div> : null}
        {footnote ? (
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
            {footnote}
          </p>
        ) : null}
      </div>
    </section>
  );
}
