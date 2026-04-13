/** Shared styled controls (fintech-style forms). */
const base =
  "rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-[border-color,box-shadow,background-color] placeholder:text-slate-400 focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

export const fpInputClass = `w-full max-w-xs ${base}`;
export const fpInputNarrowClass = `w-full max-w-[8rem] ${base}`;
export const fpSelectClass = `w-full max-w-xs ${base} cursor-pointer bg-white`;

export const fpPrimaryButtonClass =
  "rounded-xl bg-gradient-to-b from-slate-900 to-slate-950 px-5 py-2.5 text-sm font-semibold tracking-tight text-white shadow-lg shadow-slate-900/25 transition hover:from-slate-800 hover:to-slate-900 active:scale-[0.99]";
