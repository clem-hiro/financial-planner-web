import Link from "next/link";
import type { SetupRecommendedStep } from "@/domain/setup/types";

export function SetupRecommendedNextStep({
  step,
}: {
  step: SetupRecommendedStep | null;
}) {
  if (!step) return null;

  return (
    <section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Recommended next step
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#0c192f]">
            Complete {step.title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
            {step.reason}
          </p>
        </div>
        <Link
          href={step.href}
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full bg-[#0c192f] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          {step.ctaLabel}
        </Link>
      </div>
    </section>
  );
}
