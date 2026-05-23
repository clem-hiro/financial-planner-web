import Link from "next/link";
import type { SetupModuleDefinition } from "@/domain/setup/modules";
import type { SetupModuleEvaluation } from "@/domain/setup/types";
import { SetupModuleStatusBadge } from "@/features/setup-hub/SetupModuleStatusBadge";
import { formatRelativeTimeAgo } from "@/lib/relative-time";
import { appInlineLinkClass } from "@/ui/app-link-styles";

const STATUS_RING: Record<SetupModuleEvaluation["status"], string> = {
  complete: "ring-emerald-200/60",
  partial: "ring-amber-200/50",
  not_started: "ring-slate-200/60",
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
  const ring = evaluation ? STATUS_RING[evaluation.status] : "ring-slate-200/60";

  return (
    <article
      className={`flex h-full flex-col rounded-2xl bg-linear-to-br from-white via-slate-50/35 to-sky-50/15 p-5 shadow-[0_1px_0_0_rgba(15,23,42,0.04)] ring-1 ${ring} transition hover:ring-slate-300/80`}
    >
      <CardTop
        icon={definition.icon}
        title={definition.title}
        status={evaluation?.status ?? null}
      />
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        {definition.description}
      </p>
      {evaluation ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <span>
            {lastUpdated ? (
              <>Last updated {lastUpdated}</>
            ) : (
              <span className="text-slate-400">Not updated yet</span>
            )}
          </span>
          {evaluation.status !== "complete" &&
          evaluation.missingFields.length > 0 ? (
            <span
              className="max-w-[12rem] truncate text-slate-400"
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
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/90 text-lg text-slate-600 shadow-inner shadow-slate-900/5 ring-1 ring-slate-200/70"
          aria-hidden
        >
          {icon}
        </div>
        <h3 className="text-base font-semibold tracking-tight text-[#0c192f]">
          {title}
        </h3>
      </div>
      {status ? <SetupModuleStatusBadge status={status} /> : null}
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
