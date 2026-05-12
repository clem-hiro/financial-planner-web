import type { ReactNode } from "react";

const badgeTones = {
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  positive: "border-emerald-200/80 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200/80 bg-amber-50 text-amber-950",
  risk: "border-rose-200/80 bg-rose-50 text-rose-950",
  slate: "border-slate-800 bg-slate-900 text-white",
} as const;

export function AdvisorBadge({
  tone,
  children,
}: {
  tone: keyof typeof badgeTones;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}

export function AdvisorSection({
  id,
  title,
  description,
  eyebrow,
  children,
  aside,
}: {
  id?: string;
  title: string;
  description?: string;
  eyebrow?: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-28 rounded-2xl border border-slate-200/90 bg-white shadow-sm"
    >
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="min-w-0 space-y-1">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
          {description ? (
            <p className="max-w-2xl text-sm leading-relaxed text-slate-600">{description}</p>
          ) : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      <div className="px-5 py-5 sm:px-6 sm:py-6">{children}</div>
    </section>
  );
}

export function AdvisorComingSoonPanel({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">{body}</p>
    </div>
  );
}
