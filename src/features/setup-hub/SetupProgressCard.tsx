import type { SetupProgressSummary } from "@/domain/setup/types";

export function SetupProgressCard({ progress }: { progress: SetupProgressSummary }) {
  const { completionPercent, completedCount, remainingCount, totalCount } = progress;

  return (
    <section>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800/75">
          Overall progress
        </p>
        <p className="text-xs text-slate-600 sm:text-right">
          <span className="font-semibold text-[#0c192f]">{completedCount}</span> of{" "}
          <span className="font-semibold text-[#0c192f]">{totalCount}</span> sections
          completed
          {remainingCount > 0 ? (
            <>
              {" "}
              · <span className="text-slate-500">{remainingCount} remaining</span>
            </>
          ) : null}
        </p>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <p className="w-14 font-mono text-2xl font-semibold tabular-nums tracking-tight text-emerald-950">
          {completionPercent}%
        </p>
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-emerald-50 ring-1 ring-emerald-100/80"
          role="progressbar"
          aria-valuenow={completionPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Financial setup completion"
        >
          <div
            className="h-full rounded-full bg-linear-to-r from-emerald-500 to-teal-500 transition-[width] duration-500 ease-out"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
      </div>
    </section>
  );
}
