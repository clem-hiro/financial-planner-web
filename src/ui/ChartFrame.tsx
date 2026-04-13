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
      className={`${className} w-full max-w-full ${
        clipContent ? "overflow-hidden" : "overflow-visible"
      } rounded-2xl border border-slate-200/70 bg-gradient-to-b from-white via-white to-slate-50/90 p-2 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-950/[0.03] sm:p-3`}
    >
      {children}
    </div>
  );
}
