"use client";

import { appActiveGradientStyle } from "@/ui/app-tab-styles";

const STEP_LABELS = ["Income", "Budget", "Done"] as const;

type Props = {
  step: number;
};

export function OnboardingProgress({ step }: Props) {
  const current = Math.min(3, Math.max(1, step));

  return (
    <div className="space-y-3" aria-label={`Guided setup, step ${current} of 3`}>
      <div className="flex gap-1.5" role="presentation">
        {STEP_LABELS.map((label, index) => {
          const segment = index + 1;
          const done = segment < current;
          const active = segment === current;
          return (
            <div key={label} className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  done || active ? "" : "bg-slate-200"
                }`}
                style={done || active ? appActiveGradientStyle : undefined}
                aria-hidden
              />
              <span
                className={`truncate text-center text-[10px] font-semibold uppercase tracking-[0.14em] ${
                  active
                    ? "text-emerald-900"
                    : done
                      ? "text-slate-600"
                      : "text-slate-400"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-800/90">
        Step {current} of 3
      </p>
    </div>
  );
}
