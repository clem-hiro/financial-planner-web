import Link from "next/link";
import type { SetupRecommendedStep } from "@/domain/setup/types";
export function SetupRecommendedNextStep({
  step,
}: {
  step: SetupRecommendedStep | null;
}) {
  if (!step) return null;

  return (
    <section className="rounded-2xl bg-linear-to-br from-[#0c192f] via-[#10213a] to-[#123355] p-6 text-white shadow-[0_16px_44px_-24px_rgba(12,25,47,0.55)] ring-1 ring-white/10 sm:p-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200/90">
        Recommended next step
      </p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
        Complete {step.title}
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-200">
        {step.reason}
      </p>
      <div className="mt-5">
        <Link
          href={step.href}
          className="inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#0c192f] shadow-sm transition hover:bg-slate-100"
        >
          {step.ctaLabel}
        </Link>
      </div>
    </section>
  );
}
