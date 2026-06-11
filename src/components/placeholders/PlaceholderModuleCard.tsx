import type { ReactNode } from "react";

export type ModuleRoadmapStatus =
  | "planned"
  | "work_in_progress"
  | "beta"
  | "complete";

const statusLabel: Record<ModuleRoadmapStatus, string> = {
  planned: "Planned",
  work_in_progress: "In progress",
  beta: "Beta",
  complete: "Available",
};

const statusStyles: Record<ModuleRoadmapStatus, string> = {
  planned:
    "border-slate-200/80 bg-slate-50/90 text-slate-600 dark:border-slate-500/60 dark:bg-slate-800 dark:text-slate-200",
  work_in_progress:
    "border-amber-200/70 bg-amber-50/80 text-amber-900 dark:border-amber-300/45 dark:bg-amber-950/45 dark:text-amber-100",
  beta: "border-sky-200/80 bg-sky-50/85 text-sky-900 dark:border-sky-300/45 dark:bg-sky-950/45 dark:text-sky-100",
  complete:
    "border-emerald-200/80 bg-emerald-50/85 text-emerald-900 dark:border-emerald-300/45 dark:bg-emerald-950/45 dark:text-emerald-100",
};

export function PlaceholderModuleCard({
  title,
  description,
  status,
  plannedTag,
  workInProgressTag,
  estimatedPhase,
  icon,
}: {
  title: string;
  description: string;
  status: ModuleRoadmapStatus;
  plannedTag?: boolean;
  workInProgressTag?: boolean;
  estimatedPhase?: string;
  icon?: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-roledescription="Roadmap module preview"
      className="group relative flex h-full flex-col rounded-2xl bg-linear-to-br from-white via-slate-50/40 to-sky-50/25 p-5 shadow-[0_1px_0_0_rgba(15,23,42,0.04)] ring-1 ring-slate-200/60 transition hover:ring-slate-300/80 dark:from-slate-950 dark:via-slate-900 dark:to-sky-950/30 dark:ring-slate-700/80 dark:hover:ring-slate-500/80"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/90 text-lg text-slate-600 shadow-inner shadow-slate-900/5 ring-1 ring-slate-200/70 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700/80"
              aria-hidden
            >
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            <h3 className="text-base font-semibold tracking-tight text-[#0c192f] dark:text-slate-50">
              {title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {description}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusStyles[status]}`}
        >
          {statusLabel[status]}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {plannedTag ? (
          <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600/80">
            Planned capability
          </span>
        ) : null}
        {workInProgressTag ? (
          <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-medium text-amber-900/90 ring-1 ring-amber-200/80 dark:bg-amber-950/45 dark:text-amber-100 dark:ring-amber-300/45">
            Work in progress
          </span>
        ) : null}
        {estimatedPhase ? (
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {estimatedPhase}
          </span>
        ) : null}
      </div>
      <p className="mt-auto pt-5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
        Opens when this module ships — your data stays private and unchanged.
      </p>
    </div>
  );
}
