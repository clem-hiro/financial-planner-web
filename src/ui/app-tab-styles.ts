/** Outer track for pill tab rows (app shell + in-page section tabs). */
export const appTabRailClass =
  "flex min-w-max snap-x items-center gap-1 rounded-full border border-slate-200/90 bg-linear-to-r from-slate-50/95 via-white to-sky-50/90 p-1 shadow-inner shadow-slate-900/3 sm:min-w-0 sm:flex-wrap";

/** Main app shell top nav — single horizontal row (no wrap); parent supplies `overflow-x-auto`. */
export const appShellMainNavRailClass =
  "flex w-max min-w-max flex-nowrap snap-x items-center gap-1 rounded-full border border-slate-200/90 bg-linear-to-r from-slate-50/95 via-white to-sky-50/90 p-1 shadow-inner shadow-slate-900/3";

/** Base classes for each tab control (button or link). */
export const appTabPillClass =
  "inline-flex min-h-10 shrink-0 snap-start items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-[background-color,color,box-shadow] duration-200 touch-manipulation sm:min-h-0 sm:px-3.5 sm:py-1.5";

export const appTabPillActiveClass =
  "text-white shadow-sm shadow-slate-900/20";

/**
 * Brand active-state gradient as inline style. Tailwind v4 + Turbopack
 * intermittently JIT-drops arbitrary `[#hex]` utilities (see LEARNINGS.md),
 * which left the active pill/indicator unpainted under `text-white` —
 * invisible white-on-white. Inline style ships in the JS bundle and cannot
 * be dropped. Apply alongside `appTabPillActiveClass` whenever a tab/pill is active.
 */
export const appActiveGradientStyle = {
  backgroundImage: "linear-gradient(to right, #0c192f, #133359, #047857)",
} as const;

export const appTabPillInactiveClass =
  "text-slate-600 hover:bg-white hover:text-slate-900";
