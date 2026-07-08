import type { ReactNode } from "react";
import { appBrandNavyTextStyle } from "@/ui/app-tab-styles";
import { appCardClass, appCardPadding, appEmeraldPanelClass } from "@/ui/surface-classes";

type PageSectionProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  id?: string;
  className?: string;
  collapsible?: boolean;
  variant?: "default" | "emerald" | "plain";
  children: ReactNode;
};

export function PageSection({
  title,
  description,
  actions,
  id,
  className,
  collapsible,
  variant = "default",
  children,
}: PageSectionProps) {
  const isEmerald = variant === "emerald";
  const isPlain = variant === "plain";

  const titleClass = isEmerald
    ? "text-lg font-semibold tracking-tight text-emerald-950 dark:text-emerald-100"
    : "text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50";
  const descClass = isEmerald
    ? "mt-2 text-sm leading-relaxed text-emerald-900/85 dark:text-emerald-100/80"
    : "mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300";

  const shell =
    isPlain
      ? ""
      : isEmerald
        ? `${appEmeraldPanelClass} ${appCardPadding} text-emerald-950`
        : `${appCardClass} ${appCardPadding}`;

  const header = (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2
        className={titleClass}
        style={isEmerald ? undefined : appBrandNavyTextStyle}
      >
        {title}
      </h2>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );

  const desc = description ? (
    <div className={descClass}>{description}</div>
  ) : null;

  const collapsibleSummary = (
    <>
      <span className="group-open:hidden">Show details</span>
      <span className="hidden group-open:inline">Hide details</span>
      <span className="text-slate-400 group-open:hidden" aria-hidden>
        ▼
      </span>
      <span className="hidden text-slate-400 group-open:inline" aria-hidden>
        ▲
      </span>
    </>
  );

  const childBlock = collapsible ? (
    <details className="group mt-6">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/90 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800 [&::-webkit-details-marker]:hidden">
        {collapsibleSummary}
      </summary>
      <div className="mt-6">{children}</div>
    </details>
  ) : (
    <div className="mt-6">{children}</div>
  );

  if (isPlain) {
    return (
      <section
        id={id}
        className={["space-y-2", className].filter(Boolean).join(" ")}
      >
        {header}
        {desc}
        {collapsible ? (
          <details className="group">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-xl border border-slate-200/80 bg-slate-50/90 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800 [&::-webkit-details-marker]:hidden">
              {collapsibleSummary}
            </summary>
            <div className="mt-6">{children}</div>
          </details>
        ) : (
          <div className="mt-6">{children}</div>
        )}
      </section>
    );
  }

  return (
    <section id={id} className={[shell, className].filter(Boolean).join(" ")}>
      {header}
      {desc}
      {collapsible ? childBlock : <div className="mt-6">{children}</div>}
    </section>
  );
}
