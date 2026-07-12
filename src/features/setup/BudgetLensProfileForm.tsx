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
import { appCardClass } from "@/ui/surface-classes";

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

const fieldSelectClass = `${fpSelectClass} max-w-none`;

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
      className={`${appCardClass} space-y-3 p-4 sm:p-5`}
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
        <p className="mt-0.5 text-xs leading-snug text-zinc-600 dark:text-slate-300">
          Shapes the Recommended Budget when you apply it — does not change your
          current lines on save.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="block text-xs font-medium text-zinc-600 dark:text-slate-300">
            Life stage
          </span>
          <select
            className={fieldSelectClass}
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
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="block text-xs font-medium text-zinc-600 dark:text-slate-300">
            Typical monthly food spending
          </span>
          <select
            className={fieldSelectClass}
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
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="block text-xs font-medium text-zinc-600 dark:text-slate-300">
            Money management style
          </span>
          <select
            className={fieldSelectClass}
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
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="block text-xs font-medium text-zinc-600 dark:text-slate-300">
            Preference for detail
          </span>
          <select
            className={fieldSelectClass}
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
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 pt-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
        {status ? (
          <p
            className={
              status.startsWith("Saved")
                ? "text-xs text-emerald-800 dark:text-emerald-100 sm:mr-auto"
                : "text-xs text-red-700 dark:text-red-200 sm:mr-auto"
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
