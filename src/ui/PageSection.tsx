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
    ? "text-lg font-semibold tracking-tight text-emerald-950"
    : "text-lg font-semibold tracking-tight text-[#0c192f]";
  const descClass = isEmerald
    ? "mt-2 text-sm leading-relaxed text-emerald-900/85"
    : "mt-2 text-sm leading-relaxed text-slate-600";

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
    <details className="group mt-6">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/90 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white [&::-webkit-details-marker]:hidden">
        <span>Show details</span>
        <span className="text-slate-400 group-open:hidden">▼</span>
        <span className="hidden text-slate-400 group-open:inline">▲</span>
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
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-xl border border-slate-200/80 bg-slate-50/90 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white [&::-webkit-details-marker]:hidden">
              Show details <span className="text-slate-400">▼</span>
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
