import { appCardClass, appCardPadding } from "@/ui/surface-classes";

export const onboardingCardClass = `${appCardClass} ${appCardPadding}`;

export function onboardingChoiceChipClass(
  selected: boolean,
  size: "sm" | "md" = "sm"
): string {
  const sizing =
    size === "sm"
      ? "rounded-full px-3 py-1.5 text-xs"
      : "rounded-full px-4 py-2 text-sm";
  return selected
    ? `${sizing} border border-emerald-500/80 bg-emerald-50 font-medium text-emerald-950 shadow-sm shadow-emerald-900/5 ring-1 ring-emerald-500/15 transition-colors`
    : `${sizing} border border-slate-200/90 bg-white text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50`;
}

export function onboardingOptionCardClass(selected: boolean): string {
  return selected
    ? "rounded-xl border-2 border-emerald-500/80 bg-emerald-50/70 p-3 text-left shadow-sm ring-1 ring-emerald-500/15 transition-colors"
    : "rounded-xl border border-slate-200/90 bg-white p-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50/80";
}

export function onboardingStrategyCardClass(selected: boolean): string {
  return selected
    ? "flex w-full flex-col rounded-xl border-2 border-emerald-500/80 bg-emerald-50/60 px-4 py-3 text-left shadow-sm ring-1 ring-emerald-500/15 transition-colors"
    : "flex w-full flex-col rounded-xl border border-slate-200/90 px-4 py-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50/80";
}
