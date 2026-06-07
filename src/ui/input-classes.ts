/** Shared styled controls — calm slate fields, emerald focus ring. */
const base =
  "rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-[border-color,box-shadow,background-color] placeholder:text-slate-400 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

/** Hides browser spin buttons on `type="number"` inputs. */
export const fpNumberNoSpinnerClass =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

export const fpInputClass = `w-full max-w-xs ${base} ${fpNumberNoSpinnerClass}`;
export const fpInputNarrowClass = `w-full max-w-[8rem] ${base} ${fpNumberNoSpinnerClass}`;
export const fpSelectClass = `w-full max-w-xs ${base} cursor-pointer bg-white`;

export const fpPrimaryButtonClass =
  "rounded-full bg-linear-to-r from-[#0c192f] via-[#133359] to-[#047857] px-5 py-2.5 text-sm font-semibold tracking-tight text-white shadow-md shadow-slate-900/20 transition hover:brightness-105 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35";
