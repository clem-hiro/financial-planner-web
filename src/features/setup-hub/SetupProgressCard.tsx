import type { SetupProgressSummary } from "@/domain/setup/types";
import { appCardPadding, appEmeraldPanelClass } from "@/ui/surface-classes";

export function SetupProgressCard({ progress }: { progress: SetupProgressSummary }) {
  const { completionPercent, completedCount, remainingCount, totalCount } = progress;

  return (
    <section className={`${appEmeraldPanelClass} ${appCardPadding}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800/80">
        Overall progress
      </p>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-4xl font-semibold tabular-nums tracking-tight text-emerald-950 sm:text-5xl">
            {completionPercent}%
          </p>
          <p className="mt-1 text-sm font-medium text-emerald-900/80">Complete</p>
        </div>
        <p className="text-sm text-slate-600">
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
      <div
        className="mt-6 h-2.5 overflow-hidden rounded-full bg-white/80 ring-1 ring-emerald-100/80"
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
    </section>
  );
}
