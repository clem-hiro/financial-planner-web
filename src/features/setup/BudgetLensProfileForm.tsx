"use client";

import { useState } from "react";
import {
  BUDGET_STRATEGY_PRESETS,
  LIFESTYLE_PRESETS,
  type BudgetingStrategyId,
  type LifestyleProfileId,
  type OnboardingConfidenceLevel,
} from "@/domain/finance/budget-guided-setup";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import { fpPrimaryButtonClass, fpSelectClass } from "@/ui/input-classes";

type Props = {
  initialLifestyle: string | null;
  initialStrategy: string | null;
  initialConfidence: string | null;
};

export function BudgetLensProfileForm(props: Props) {
  const [lifestyle, setLifestyle] = useState(
    (props.initialLifestyle ?? "young_professional") as LifestyleProfileId
  );
  const [strategy, setStrategy] = useState(
    (props.initialStrategy ?? "balanced") as BudgetingStrategyId
  );
  const [confidence, setConfidence] = useState(
    (props.initialConfidence ?? "moderate") as OnboardingConfidenceLevel
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
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5"
      {...(pending ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay active={pending} message="Saving budget lens…" />
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">Budget lens</h3>
        <p className="mt-1 text-xs text-zinc-600">
          Lifestyle and strategy tune recommended splits and advisor-facing
          context. Does not change existing budget line amounts automatically.
        </p>
      </div>
      <label className="block max-w-md space-y-1 text-sm">
        <span className="text-zinc-600">Lifestyle template</span>
        <select
          className={fpSelectClass}
          value={lifestyle}
          onChange={(e) =>
            setLifestyle(e.target.value as LifestyleProfileId)
          }
        >
          {LIFESTYLE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block max-w-md space-y-1 text-sm">
        <span className="text-zinc-600">Money management style</span>
        <select
          className={fpSelectClass}
          value={strategy}
          onChange={(e) =>
            setStrategy(e.target.value as BudgetingStrategyId)
          }
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
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className={fpPrimaryButtonClass}
        >
          {pending ? "Saving…" : "Save lens"}
        </button>
        {status && (
          <span
            className={
              status.startsWith("Saved")
                ? "text-sm text-emerald-800"
                : "text-sm text-red-700"
            }
          >
            {status}
          </span>
        )}
      </div>
    </form>
  );
}
