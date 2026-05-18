"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  BUDGET_STRATEGY_PRESETS,
  FOOD_SPEND_BAND_PRESETS,
  LIFESTYLE_PRESETS,
  generateGuidedMonthlyBudgetLines,
  type BudgetingStrategyId,
  type FoodSpendBandId,
  type LifestyleProfileId,
  type OnboardingConfidenceLevel,
} from "@/domain/finance/budget-guided-setup";
import { applyGuidedBudgetLinesAction } from "@/server/actions";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import { fpPrimaryButtonClass, fpSelectClass } from "@/ui/input-classes";
import { formatCurrency } from "@/ui/lib/format";

type Props = {
  initialLifestyle: string | null;
  initialStrategy: string | null;
  initialConfidence: string | null;
  initialFoodSpendBand: string | null;
  monthlyIncome: number | null;
  currency: string;
  replaceableMonthlyLineCount: number;
};

function isLifestyleId(s: string | null): s is LifestyleProfileId {
  return (
    s != null &&
    LIFESTYLE_PRESETS.some((p) => p.id === (s as LifestyleProfileId))
  );
}

function isStrategyId(s: string | null): s is BudgetingStrategyId {
  return (
    s != null &&
    BUDGET_STRATEGY_PRESETS.some((p) => p.id === (s as BudgetingStrategyId))
  );
}

function isConfidence(s: string | null): s is OnboardingConfidenceLevel {
  return s === "rough" || s === "moderate" || s === "detailed";
}

function isFoodBand(s: string | null): s is FoodSpendBandId {
  return s != null && FOOD_SPEND_BAND_PRESETS.some((b) => b.id === s);
}

export function BudgetLensProfileForm(props: Props) {
  const router = useRouter();
  const [lifestyle, setLifestyle] = useState<LifestyleProfileId>(
    isLifestyleId(props.initialLifestyle)
      ? props.initialLifestyle
      : "young_professional"
  );
  const [strategy, setStrategy] = useState<BudgetingStrategyId>(
    isStrategyId(props.initialStrategy) ? props.initialStrategy : "balanced"
  );
  const [confidence, setConfidence] = useState<OnboardingConfidenceLevel>(
    isConfidence(props.initialConfidence) ? props.initialConfidence : "moderate"
  );
  const [foodBand, setFoodBand] = useState<FoodSpendBandId>(
    isFoodBand(props.initialFoodSpendBand)
      ? props.initialFoodSpendBand
      : "unknown"
  );
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [lensStatus, setLensStatus] = useState<string | null>(null);
  const [applyStatus, setApplyStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const incomeNum =
    props.monthlyIncome != null &&
    Number.isFinite(props.monthlyIncome) &&
    props.monthlyIncome > 0
      ? props.monthlyIncome
      : 0;

  const previewLines = useMemo(() => {
    if (incomeNum <= 0) return [];
    return generateGuidedMonthlyBudgetLines({
      monthlyIncome: incomeNum,
      lifestyle,
      strategy,
      foodSpendBand: foodBand,
    });
  }, [incomeNum, lifestyle, strategy, foodBand]);

  const needsReplaceConfirm = props.replaceableMonthlyLineCount > 0;
  const canApply =
    incomeNum > 0 && (!needsReplaceConfirm || confirmReplace) && !pending;

  async function saveLensFields(): Promise<boolean> {
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        lifestyle_profile: lifestyle,
        budgeting_strategy: strategy,
        onboarding_confidence_level: confidence,
        estimated_budget_mode: confidence === "rough",
        food_spend_band: foodBand,
      }),
    });
    return res.ok;
  }

  async function onSaveLens(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setLensStatus(null);
    setApplyStatus(null);
    try {
      if (!(await saveLensFields())) throw new Error("save");
      setLensStatus("Saved.");
    } catch {
      setLensStatus("Could not save. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function onApplyRecommended() {
    setPending(true);
    setLensStatus(null);
    setApplyStatus(null);
    try {
      if (!(await saveLensFields())) {
        setApplyStatus("Could not save lens settings. Try again.");
        return;
      }
      const fd = new FormData();
      if (needsReplaceConfirm) {
        fd.set("replaceExisting", "true");
      }
      const result = await applyGuidedBudgetLinesAction({ error: null }, fd);
      if (result.error) {
        setApplyStatus(result.error);
        return;
      }
      setApplyStatus("Recommended budget applied.");
      router.refresh();
    } catch {
      setApplyStatus("Could not apply budget. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(ev) => void onSaveLens(ev)}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5"
      {...(pending ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay
        active={pending}
        message="Updating budget lens…"
      />
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">Budget lens</h3>
        <p className="mt-1 text-xs text-zinc-600">
          Lifestyle, food spend, and money style tune a recommended monthly
          category mix. Save lens to update targets; apply when you want new
          budget lines from those settings.
        </p>
      </div>
      <label className="block max-w-md space-y-1 text-sm">
        <span className="text-zinc-600">Lifestyle template</span>
        <select
          className={fpSelectClass}
          value={lifestyle}
          onChange={(e) => setLifestyle(e.target.value as LifestyleProfileId)}
        >
          {LIFESTYLE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block max-w-md space-y-1 text-sm">
        <span className="text-zinc-600">Typical food spend (monthly)</span>
        <select
          className={fpSelectClass}
          value={foodBand}
          onChange={(e) => setFoodBand(e.target.value as FoodSpendBandId)}
        >
          {FOOD_SPEND_BAND_PRESETS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block max-w-md space-y-1 text-sm">
        <span className="text-zinc-600">Money management style</span>
        <select
          className={fpSelectClass}
          value={strategy}
          onChange={(e) => setStrategy(e.target.value as BudgetingStrategyId)}
        >
          {BUDGET_STRATEGY_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block max-w-md space-y-1 text-sm">
        <span className="text-zinc-600">Onboarding precision</span>
        <select
          className={fpSelectClass}
          value={confidence}
          onChange={(e) =>
            setConfidence(e.target.value as OnboardingConfidenceLevel)
          }
        >
          <option value="rough">Rough estimates ok</option>
          <option value="moderate">Balanced</option>
          <option value="detailed">Prefer detail</option>
        </select>
      </label>
      <div>
        <p className="text-sm font-medium text-zinc-800">
          Recommended monthly plan
        </p>
        {incomeNum <= 0 ? (
          <p className="mt-2 text-sm text-amber-800">
            Set a positive monthly take-home in{" "}
            <span className="font-medium">Income &amp; retirement</span> above to
            preview and apply amounts.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-100 rounded-xl border border-zinc-100">
            {previewLines.map((l) => (
              <li
                key={l.category}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <span className="capitalize text-zinc-800">{l.category}</span>
                <span className="tabular-nums text-zinc-700">
                  {formatCurrency(l.amount, props.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {needsReplaceConfirm && (
        <label className="flex items-start gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={confirmReplace}
            onChange={(e) => setConfirmReplace(e.target.checked)}
          />
          <span>
            Replace my {props.replaceableMonthlyLineCount} existing monthly
            categories with this plan (keeps debt repayment and income tax
            lines).
          </span>
        </label>
      )}
      <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className={fpPrimaryButtonClass}
          >
            {pending ? "Saving…" : "Save lens"}
          </button>
          <button
            type="button"
            disabled={!canApply}
            className="rounded-full border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void onApplyRecommended()}
          >
            {pending ? "Applying…" : "Apply recommended budget"}
          </button>
        </div>
        {(lensStatus || applyStatus) && (
          <p
            className={
              lensStatus?.startsWith("Saved") ||
              applyStatus?.startsWith("Recommended")
                ? "text-sm text-emerald-800"
                : "text-sm text-red-700"
            }
          >
            {applyStatus ?? lensStatus}
          </p>
        )}
        {applyStatus?.startsWith("Recommended") && (
          <p className="text-xs text-zinc-600">
            <Link href="/budget" className={appInlineLinkClass}>
              Open Budget
            </Link>{" "}
            to review or edit line amounts.
          </p>
        )}
      </div>
    </form>
  );
}
