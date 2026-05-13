import type { ReactNode } from "react";

export function RecommendationCard({
  title,
  body,
  actionSlot,
}: {
  title: string;
  body: string;
  actionSlot?: ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-linear-to-br from-[#0c192f] via-[#10213a] to-[#123355] p-5 text-white shadow-[0_16px_44px_-24px_rgba(12,25,47,0.55)] ring-1 ring-white/10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200/90">
        Recommendation
      </p>
      <h3 className="mt-1 text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-200">{body}</p>
      {actionSlot ? (
        <div className="mt-4 flex flex-wrap gap-2">{actionSlot}</div>
      ) : null}
    </section>
  );
}
