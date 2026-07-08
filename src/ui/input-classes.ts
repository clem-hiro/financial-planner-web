/** Shared styled controls — calm slate fields, emerald focus ring. */
const base =
  "rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-[border-color,box-shadow,background-color] placeholder:text-slate-400 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700/90 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-400/60 dark:focus:ring-emerald-400/20 dark:disabled:bg-slate-900/60 dark:disabled:text-slate-500";

/** Hides browser spin buttons on `type="number"` inputs. */
export const fpNumberNoSpinnerClass =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

export const fpInputClass = `w-full max-w-xs ${base} ${fpNumberNoSpinnerClass}`;
/** Full-width fields for stacked forms (auth, onboarding) — no `max-w-xs` cap. */
export const fpInputFullClass = `w-full ${base} ${fpNumberNoSpinnerClass}`;
export const fpInputNarrowClass = `w-full max-w-[8rem] ${base} ${fpNumberNoSpinnerClass}`;
export const fpSelectClass = `w-full max-w-xs ${base} cursor-pointer bg-white`;

export const fpPrimaryButtonClass =
  "rounded-full bg-linear-to-r from-[#0c192f] via-[#133359] to-[#047857] px-5 py-2.5 text-sm font-semibold tracking-tight text-white shadow-md shadow-slate-900/20 transition hover:brightness-105 active:scale-[0.99] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35 dark:from-emerald-300 dark:via-sky-300 dark:to-teal-300 dark:text-slate-950 dark:shadow-black/25";

/** Secondary actions — bordered slate control with touch-friendly height on mobile. */
export const fpSecondaryButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800 touch-manipulation sm:min-h-0 sm:py-1.5";

/** Compact secondary — inline row actions (priority, schedule rows). */
export const fpSecondaryButtonCompactClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200/90 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800 touch-manipulation sm:min-h-0 sm:py-1";
