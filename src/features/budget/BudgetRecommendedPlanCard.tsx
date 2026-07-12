"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  generateGuidedMonthlyBudgetLines,
  type BudgetingStrategyId,
  type FoodSpendBandId,
  type LifestyleProfileId,
} from "@/domain/finance/budget-guided-setup";
import { applyGuidedBudgetLinesAction } from "@/server/actions";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import { ConfirmDialog } from "@/ui/ConfirmDialog";
import { fpPrimaryButtonClass, fpSecondaryButtonClass } from "@/ui/input-classes";
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
 * Starter monthly allocation on Budget. Numbers first; apply only when empty.
 * Replace is a quiet confirm — no signal checklist for clients.
 */
export function BudgetRecommendedPlanCard(props: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [replaceOpen, setReplaceOpen] = useState(false);

  const incomeNum =
    props.monthlyIncome != null &&
    Number.isFinite(props.monthlyIncome) &&
    props.monthlyIncome > 0
      ? props.monthlyIncome
      : 0;

  const hasExistingBudget = props.replaceableMonthlyLineCount > 0;

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

  async function onApply(replaceExisting: boolean) {
    setPending(true);
    setStatus(null);
    setReplaceOpen(false);
    try {
      const fd = new FormData();
      if (replaceExisting) {
        fd.set("replaceExisting", "true");
      }
      const result = await applyGuidedBudgetLinesAction({ error: null }, fd);
      if (result.error) {
        setStatus(result.error);
        return;
      }
      setStatus(
        replaceExisting
          ? "Recommended budget applied — previous monthly categories replaced."
          : "Recommended budget applied."
      );
      router.refresh();
    } catch {
      setStatus("Could not apply recommendation. Try again.");
    } finally {
      setPending(false);
    }
  }

  const replaceCount = props.replaceableMonthlyLineCount;

  return (
    <section
      id="budget-recommended"
      className={`scroll-mt-4 ${appCardClass} ${appCardPadding} space-y-5`}
      {...(pending ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay
        active={pending}
        message="Applying recommended budget…"
      />

      <ConfirmDialog
        open={replaceOpen}
        title="Replace your budget?"
        body={
          <>
            This replaces {replaceCount} monthly categor
            {replaceCount === 1 ? "y" : "ies"} with the plan above. Debt
            repayments and income tax lines are kept.
          </>
        }
        confirmLabel="Replace budget"
        cancelLabel="Keep my budget"
        tone="danger"
        confirmDisabled={pending}
        onConfirm={() => void onApply(true)}
        onCancel={() => setReplaceOpen(false)}
      />

      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-slate-50">
          Recommended Budget
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-slate-300">
          Built from your{" "}
          <Link href={props.profileHref} className={appInlineLinkClass}>
            Profile
          </Link>{" "}
          income and Budget preferences
          {hasExistingBudget
            ? " — shown for comparison. Edit categories above to change your plan."
            : "."}
        </p>
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

      {incomeNum > 0 ? (
        <div className="space-y-3 border-t border-slate-100 pt-5 dark:border-slate-700/70">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href={props.profileHref}
              className={`text-xs font-medium ${appInlineLinkClass}`}
            >
              Edit Budget preferences
            </Link>
            {hasExistingBudget ? (
              <button
                type="button"
                disabled={pending}
                className={`${fpSecondaryButtonClass} w-full sm:w-auto`}
                onClick={() => setReplaceOpen(true)}
              >
                Replace my budget with this plan
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                className={`${fpPrimaryButtonClass} w-full sm:w-auto`}
                onClick={() => void onApply(false)}
              >
                {pending ? "Applying…" : "Apply Recommendation"}
              </button>
            )}
          </div>
          {status ? (
            <p
              className={
                status.startsWith("Recommended")
                  ? "text-sm text-emerald-800 dark:text-emerald-100"
                  : "text-sm text-red-700 dark:text-red-200"
              }
            >
              {status}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
