import Link from "next/link";
import type { SetupModuleDefinition } from "@/domain/setup/modules";
import type { SetupModuleEvaluation } from "@/domain/setup/types";
import { SetupModuleStatusBadge } from "@/features/setup-hub/SetupModuleStatusBadge";
import { formatRelativeTimeAgo } from "@/lib/relative-time";
import { appInlineLinkClass } from "@/ui/app-link-styles";

const STATUS_RING: Record<SetupModuleEvaluation["status"], string> = {
  complete: "ring-emerald-200/60 dark:ring-emerald-400/50",
  partial: "ring-amber-200/50 dark:ring-amber-400/50",
  not_started: "ring-slate-200/60 dark:ring-slate-500/70",
  pending: "ring-sky-200/60 dark:ring-sky-400/50",
};

export function SetupModuleCard({
  definition,
  evaluation,
}: {
  definition: SetupModuleDefinition;
  /** Null for navigation-only modules with no completion state. */
  evaluation?: SetupModuleEvaluation | null;
}) {
  const lastUpdated = evaluation
    ? formatRelativeTimeAgo(evaluation.lastUpdatedAt)
    : null;
  const ring = evaluation
    ? STATUS_RING[evaluation.status]
    : "ring-slate-200/60 dark:ring-slate-500/70";

  return (
    <article
      className={`flex h-full min-w-0 flex-col rounded-2xl bg-linear-to-br from-white via-slate-50/35 to-sky-50/15 p-5 shadow-[0_1px_0_0_rgba(15,23,42,0.04)] ring-1 ${ring} transition hover:ring-slate-300/80 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 dark:shadow-none dark:hover:ring-slate-400/80`}
    >
      <CardTop
        icon={definition.icon}
        title={definition.title}
        status={evaluation?.status ?? null}
      />
      <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {definition.description}
      </p>
      {evaluation ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span>
            {lastUpdated ? (
              <>Last updated {lastUpdated}</>
            ) : (
              <span className="text-slate-400 dark:text-slate-300">
                Not updated yet
              </span>
            )}
          </span>
          {evaluation.status !== "complete" &&
          evaluation.missingFields.length > 0 ? (
            <span
              className="max-w-[12rem] truncate text-slate-400 dark:text-slate-300"
              title={evaluation.missingFields.join(", ")}
            >
              Needs: {evaluation.missingFields.slice(0, 2).join(", ")}
              {evaluation.missingFields.length > 2 ? "…" : ""}
            </span>
          ) : null}
        </div>
      ) : null}
      <CardCta href={definition.href} ctaLabel={definition.ctaLabel} />
    </article>
  );
}

function CardTop({
  icon,
  title,
  status,
}: {
  icon: string;
  title: string;
  status: SetupModuleEvaluation["status"] | null;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 gap-y-2">
      <div
        className="row-span-2 flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-xl bg-white/90 text-lg text-slate-600 shadow-inner shadow-slate-900/5 ring-1 ring-slate-200/70 dark:bg-slate-950/80 dark:text-slate-100 dark:shadow-none dark:ring-slate-600/80"
        aria-hidden
      >
        {icon}
      </div>
      <h3 className="col-start-2 min-w-0 text-base font-semibold leading-snug tracking-tight text-[#0c192f] dark:text-slate-50">
        {title}
      </h3>
      {status ? (
        <div className="col-start-2 flex min-w-0 flex-wrap items-center gap-2">
          <SetupModuleStatusBadge status={status} />
        </div>
      ) : null}
    </div>
  );
}

function CardCta({ href, ctaLabel }: { href: string; ctaLabel: string }) {
  return (
    <div className="mt-auto pt-5">
      <Link
        href={href}
        className={`inline-flex items-center text-sm font-semibold ${appInlineLinkClass}`}
      >
        {ctaLabel} →
      </Link>
    </div>
  );
}
