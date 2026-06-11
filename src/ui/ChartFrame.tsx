import type { ReactNode } from "react";

export function ChartFrame({
  children,
  className = "h-64",
  /** When false, content (e.g. Recharts tooltips) is not clipped at the card edge. */
  clipContent = true,
}: {
  children: ReactNode;
  /** Height / min-height utility classes (default h-64). */
  className?: string;
  clipContent?: boolean;
}) {
  return (
    <div
      className={`${className} w-full min-w-0 max-w-full ${
        clipContent ? "overflow-hidden" : "overflow-visible"
      } rounded-2xl border border-slate-200/70 bg-gradient-to-b from-white via-white to-slate-50/90 p-2 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-950/[0.03] dark:border-slate-800/80 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:shadow-black/20 dark:ring-white/[0.04] sm:p-3`}
    >
      <div className="h-full min-h-0 w-full min-w-0">{children}</div>
    </div>
  );
}
