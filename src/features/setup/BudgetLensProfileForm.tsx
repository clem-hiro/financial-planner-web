"use client";

import { useState } from "react";
import {
  BUDGET_STRATEGY_PRESETS,
  FOOD_SPEND_BAND_PRESETS,
  LIFESTYLE_PRESETS,
  type BudgetingStrategyId,
  type FoodSpendBandId,
  type LifestyleProfileId,
  type OnboardingConfidenceLevel,
} from "@/domain/finance/budget-guided-setup";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import { fpPrimaryButtonClass, fpSelectClass } from "@/ui/input-classes";
import { appCardClass, appCardPadding } from "@/ui/surface-classes";

type Props = {
  initialLifestyle: string | null;
  initialStrategy: string | null;
  initialConfidence: string | null;
  initialFoodSpendBand: string | null;
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

/**
 * Profile preferences that personalise Budget → Recommended Budget.
 * Allocation numbers live on Setup → Budget (Recommended Budget card).
 */
export function BudgetLensProfileForm(props: Props) {
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
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setStatus(null);
    try {
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
      if (!res.ok) throw new Error("save");
      setStatus("Saved.");
    } catch {
      setStatus("Could not save. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(ev) => void onSave(ev)}
      className={`${appCardClass} ${appCardPadding} space-y-5`}
      {...(pending ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay
        active={pending}
        message="Saving preferences…"
      />
      <div>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-slate-50">
          Budget preferences
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-slate-300">
          Used only when you apply the{" "}
          <span className="font-medium text-zinc-800 dark:text-slate-100">
            Recommended Budget
          </span>{" "}
          on the Budget tab — for example food amount and needs / wants /
          savings mix. Saving here does not change your income, logged expenses,
          or existing budget lines until you apply a recommendation.
        </p>
      </div>
      <label className="block max-w-md space-y-1 text-sm">
        <span className="text-zinc-600 dark:text-slate-200">
          Life stage
        </span>
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
        <span className="text-zinc-600 dark:text-slate-200">
          Typical monthly food spending
        </span>
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
        <span className="text-zinc-600 dark:text-slate-200">
          Money management style
        </span>
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
        <span className="text-zinc-600 dark:text-slate-200">
          Preference for detail
        </span>
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
      <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
        {status ? (
          <p
            className={
              status.startsWith("Saved")
                ? "text-sm text-emerald-800 dark:text-emerald-100 sm:mr-auto"
                : "text-sm text-red-700 dark:text-red-200 sm:mr-auto"
            }
          >
            {status}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className={`${fpPrimaryButtonClass} w-full sm:w-auto`}
        >
          {pending ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </form>
  );
}
