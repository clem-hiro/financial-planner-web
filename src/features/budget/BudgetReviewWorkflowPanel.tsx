import type { BudgetReviewWorkflow } from "@/domain/finance/budget-review";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { appCardClass } from "@/ui/surface-classes";
import { formatCurrency } from "@/ui/lib/format";

type BudgetReviewWorkflowPanelProps = {
  review: BudgetReviewWorkflow;
  currency: string;
  expensesHref: string;
};

const STATUS_LABEL: Record<BudgetReviewWorkflow["status"], string> = {
  ready: "Review ready",
  attention: "Review needed",
  empty: "Setup needed",
};

function stepTone(status: BudgetReviewWorkflow["steps"][number]["status"]) {
  if (status === "review") return "border-amber-200 bg-amber-50/70 text-amber-950";
  if (status === "empty") return "border-zinc-200 bg-zinc-50 text-zinc-700";
  return "border-emerald-100 bg-emerald-50/70 text-emerald-950";
}

export function BudgetReviewWorkflowPanel({
  review,
  currency,
  expensesHref,
}: BudgetReviewWorkflowPanelProps) {
  const topOverspent = review.overspentCategories.slice(0, 3);
  const topUnused = review.unusedCategories.slice(0, 3);

  return (
    <section
      id="budget-review"
      className={`${appCardClass} scroll-mt-4 overflow-hidden`}
    >
      <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="bg-linear-to-br from-teal-50/90 via-white to-slate-50 px-5 py-6 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-700">
            Recurring budget review
          </p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
            {STATUS_LABEL[review.status]} for {review.month}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {review.summary}
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs">
            <a href="#budget-monthly" className={appInlineLinkClass}>
              Review categories
            </a>
            <a href="#budget-unbudgeted" className={appInlineLinkClass}>
              Map unbudgeted spend
            </a>
            <a href={expensesHref} className={appInlineLinkClass}>
              Log actual spend
            </a>
          </div>
        </div>

        <div className="space-y-4 px-5 py-6 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {review.steps.map((step) => (
              <div
                key={step.id}
                className={`rounded-xl border px-3 py-3 ${stepTone(step.status)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold">{step.label}</p>
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-medium">
                    {step.count}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium">{step.summary}</p>
                <p className="mt-1 text-xs leading-relaxed opacity-80">
                  {step.detail}
                </p>
              </div>
            ))}
          </div>

          {(topOverspent.length > 0 ||
            review.overrides.length > 0 ||
            topUnused.length > 0) && (
            <div className="grid gap-3 text-xs text-slate-700 md:grid-cols-3">
              {topOverspent.length > 0 && (
                <div className="rounded-xl border border-red-100 bg-red-50/70 p-3">
                  <p className="font-semibold text-red-950">Over plan</p>
                  <ul className="mt-2 space-y-1">
                    {topOverspent.map((line) => (
                      <li key={line.categoryKey}>
                        {line.categoryLabel}:{" "}
                        <span className="font-medium text-red-900">
                          {formatCurrency(line.spent - line.budget, currency)} over
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {review.overrides.length > 0 && (
                <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-3">
                  <p className="font-semibold text-amber-950">Overrides</p>
                  <ul className="mt-2 space-y-1">
                    {review.overrides.slice(0, 3).map((override) => (
                      <li key={override.lineId}>
                        {override.category}:{" "}
                        <span className="font-medium text-amber-950">
                          {formatCurrency(override.overrideAmount, currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {topUnused.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <p className="font-semibold text-slate-950">No spend logged</p>
                  <ul className="mt-2 space-y-1">
                    {topUnused.map((line) => (
                      <li key={line.categoryKey}>
                        {line.categoryLabel}:{" "}
                        <span className="font-medium text-slate-900">
                          {formatCurrency(line.budget, currency)} planned
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
