"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ACTIVE_BUDGET_RECOMMENDATION_SIGNALS,
  FUTURE_BUDGET_RECOMMENDATION_SIGNALS,
  generateGuidedMonthlyBudgetLines,
  resolveActiveRecommendationSignals,
  type BudgetingStrategyId,
  type FoodSpendBandId,
  type LifestyleProfileId,
} from "@/domain/finance/budget-guided-setup";
import { applyGuidedBudgetLinesAction } from "@/server/actions";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import { fpPrimaryButtonClass } from "@/ui/input-classes";
import { formatCurrency } from "@/ui/lib/format";
import { appCardClass, appCardPadding } from "@/ui/surface-classes";

type Props = {
  monthlyIncome: number | null;
  currency: string;
  lifestyle: string | null;
  strategy: string | null;
  foodSpendBand: string | null;
  replaceableMonthlyLineCount: number;
  profileHref: string;
};

const LIFESTYLE_IDS: LifestyleProfileId[] = [
  "student",
  "fresh_graduate",
  "young_professional",
  "married_couple",
  "young_family",
  "high_saver",
  "flexible_lifestyle",
  "freelancer",
  "business_owner",
];

const STRATEGY_IDS: BudgetingStrategyId[] = [
  "balanced",
  "aggressive_saver",
  "flexible_lifestyle",
  "custom",
];

const FOOD_IDS: FoodSpendBandId[] = [
  "under_300",
  "range_300_600",
  "range_600_1000",
  "above_1000",
  "unknown",
];

function coerceLifestyle(raw: string | null): LifestyleProfileId {
  if (raw && LIFESTYLE_IDS.includes(raw as LifestyleProfileId)) {
    return raw as LifestyleProfileId;
  }
  return "young_professional";
}

function coerceStrategy(raw: string | null): BudgetingStrategyId {
  if (raw && STRATEGY_IDS.includes(raw as BudgetingStrategyId)) {
    return raw as BudgetingStrategyId;
  }
  return "balanced";
}

function coerceFoodBand(raw: string | null): FoodSpendBandId {
  if (raw && FOOD_IDS.includes(raw as FoodSpendBandId)) {
    return raw as FoodSpendBandId;
  }
  return "unknown";
}

/**
 * Advisor-style recommended monthly allocation on the Budget tab.
 * Generator stays modular via `BudgetRecommendationContext` so housing,
 * goals, investments, and other signals can plug in later.
 */
export function BudgetRecommendedPlanCard(props: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const incomeNum =
    props.monthlyIncome != null &&
    Number.isFinite(props.monthlyIncome) &&
    props.monthlyIncome > 0
      ? props.monthlyIncome
      : 0;

  const hasLifestyle =
    props.lifestyle != null && props.lifestyle.trim() !== "";
  const hasStrategy =
    props.strategy != null && props.strategy.trim() !== "";

  const context = useMemo(
    () => ({
      monthlyIncome: incomeNum,
      lifestyle: coerceLifestyle(props.lifestyle),
      strategy: coerceStrategy(props.strategy),
      foodSpendBand: coerceFoodBand(props.foodSpendBand),
    }),
    [incomeNum, props.lifestyle, props.strategy, props.foodSpendBand]
  );

  const previewLines = useMemo(
    () => generateGuidedMonthlyBudgetLines(context),
    [context]
  );

  const usedSignalIds = useMemo(
    () =>
      resolveActiveRecommendationSignals({
        monthlyIncome: incomeNum,
        foodSpendBand: context.foodSpendBand,
        hasLifestyle: hasLifestyle || incomeNum > 0,
        hasStrategy: hasStrategy || incomeNum > 0,
      }),
    [incomeNum, context.foodSpendBand, hasLifestyle, hasStrategy]
  );

  const usedSignals = ACTIVE_BUDGET_RECOMMENDATION_SIGNALS.filter((s) =>
    usedSignalIds.includes(s.id)
  );

  async function onApply() {
    setPending(true);
    setStatus(null);
    try {
      const fd = new FormData();
      if (props.replaceableMonthlyLineCount > 0) {
        fd.set("replaceExisting", "true");
      }
      const result = await applyGuidedBudgetLinesAction({ error: null }, fd);
      if (result.error) {
        setStatus(result.error);
        return;
      }
      setStatus("Recommended budget applied.");
      router.refresh();
    } catch {
      setStatus("Could not apply recommendation. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      id="budget-recommended"
      className={`scroll-mt-4 ${appCardClass} ${appCardPadding} space-y-8`}
      {...(pending ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay
        active={pending}
        message="Applying recommended budget…"
      />

      <div className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-slate-50">
          Recommended Budget
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-slate-300">
          Based on your income, lifestyle, financial goals and current financial
          setup, BYOFA recommends the following monthly allocation.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl bg-slate-50/80 px-4 py-4 dark:bg-slate-800/50 sm:px-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-slate-400">
          Recommended using
        </p>
        <ul className="space-y-2">
          {usedSignals.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2 text-sm text-zinc-800 dark:text-slate-100"
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-100"
                aria-hidden
              >
                ✓
              </span>
              {s.label}
            </li>
          ))}
        </ul>
        <div className="border-t border-slate-200/80 pt-4 dark:border-slate-700/80">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-slate-400">
            Future versions will also include
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-zinc-600 dark:text-slate-300">
            {FUTURE_BUDGET_RECOMMENDATION_SIGNALS.map((s) => (
              <li key={s.id} className="before:mr-1.5 before:content-['•']">
                {s.label}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-zinc-500 dark:text-slate-400">
            This is informational only. Refine preferences in{" "}
            <Link href={props.profileHref} className={appInlineLinkClass}>
              Profile
            </Link>
            .
          </p>
        </div>
      </div>

      {incomeNum <= 0 ? (
        <p className="text-sm text-amber-900 dark:text-amber-100">
          Set a positive monthly take-home in{" "}
          <Link href={props.profileHref} className={appInlineLinkClass}>
            Profile
          </Link>{" "}
          to see a recommended allocation.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-700/70">
          {previewLines.map((line) => (
            <li
              key={line.category}
              className="flex items-baseline justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <span className="text-sm capitalize text-zinc-800 dark:text-slate-100">
                {line.category}
              </span>
              <span className="text-sm tabular-nums text-zinc-700 dark:text-slate-200">
                {formatCurrency(line.amount, props.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 border-t border-slate-100 pt-6 dark:border-slate-700/70">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-slate-50">
            Apply Recommended Budget
          </h3>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-slate-300">
            This will update your monthly budget categories while preserving
            debt repayments and income tax entries.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={pending || incomeNum <= 0}
            className={fpPrimaryButtonClass}
            onClick={() => void onApply()}
          >
            {pending ? "Applying…" : "Apply Recommendation"}
          </button>
        </div>
        {status && (
          <p
            className={
              status.startsWith("Recommended")
                ? "text-sm text-emerald-800 dark:text-emerald-100"
                : "text-sm text-red-700 dark:text-red-200"
            }
          >
            {status}
          </p>
        )}
      </div>
    </section>
  );
}
