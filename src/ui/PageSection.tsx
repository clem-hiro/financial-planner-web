import type { ReactNode } from "react";
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
    ? "text-lg font-semibold tracking-tight text-teal-950"
    : "text-lg font-semibold tracking-tight text-slate-900";
  const descClass = isEmerald
    ? "mt-1 text-sm leading-relaxed text-teal-900/85"
    : "mt-1 text-sm leading-relaxed text-slate-600";

  const shell =
    isPlain
      ? ""
      : isEmerald
        ? `${appEmeraldPanelClass} ${appCardPadding} text-emerald-950`
        : `${appCardClass} ${appCardPadding}`;

  const header = (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className={titleClass}>{title}</h2>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );

  const desc = description ? (
    <div className={descClass}>{description}</div>
  ) : null;

  const childBlock = collapsible ? (
    <details className="group mt-4">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-xl bg-slate-100/90 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
        <span>Show details</span>
        <span className="text-slate-400 group-open:hidden">▼</span>
        <span className="hidden text-slate-400 group-open:inline">▲</span>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  ) : (
    <div className="mt-4">{children}</div>
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
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-xl bg-slate-100/90 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
              Show details <span className="text-slate-400">▼</span>
            </summary>
            <div className="mt-4">{children}</div>
          </details>
        ) : (
          <div className="mt-4">{children}</div>
        )}
      </section>
    );
  }

  return (
    <section id={id} className={[shell, className].filter(Boolean).join(" ")}>
      {header}
      {desc}
      {collapsible ? childBlock : <div className="mt-4">{children}</div>}
    </section>
  );
}
