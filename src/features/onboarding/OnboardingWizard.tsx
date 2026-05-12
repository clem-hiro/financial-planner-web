"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  BUDGET_STRATEGY_PRESETS,
  LIFESTYLE_PRESETS,
  generateGuidedMonthlyBudgetLines,
  type BudgetingStrategyId,
  type FoodSpendBandId,
  type LifestyleProfileId,
  type OnboardingConfidenceLevel,
} from "@/domain/finance/budget-guided-setup";
import { applyGuidedBudgetLinesAction } from "@/server/actions";
import { fpInputClass, fpPrimaryButtonClass } from "@/ui/input-classes";
import { formatCurrency } from "@/ui/lib/format";

type Props = {
  initialDisplayName: string;
  initialMonthlyIncome: number | null;
  initialBaseCurrency: string;
  initialAnnualBonus: number | null;
  initialSavingsTarget: number | null;
  initialDebtObligations: number | null;
  initialStep: number;
  initialLifestyleProfile: string | null;
  initialBudgetingStrategy: string | null;
  initialConfidenceLevel: string | null;
  initialFoodSpendBand: string | null;
  initialEstimatedBudgetMode: boolean;
};

const FOOD_BANDS: ReadonlyArray<{
  id: FoodSpendBandId;
  label: string;
}> = [
  { id: "under_300", label: "Under S$300" },
  { id: "range_300_600", label: "S$300–600" },
  { id: "range_600_1000", label: "S$600–1,000" },
  { id: "above_1000", label: "Above S$1,000" },
  { id: "unknown", label: "Not sure yet" },
];

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

function isConfidence(
  s: string | null
): s is OnboardingConfidenceLevel {
  return s === "rough" || s === "moderate" || s === "detailed";
}

function isFoodBand(s: string | null): s is FoodSpendBandId {
  return s != null && FOOD_BANDS.some((b) => b.id === s);
}

export function OnboardingWizard(props: Props) {
  const router = useRouter();
  const [step, setStep] = useState(
    Math.min(4, Math.max(1, props.initialStep || 1))
  );
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [displayName, setDisplayName] = useState(props.initialDisplayName);
  const [monthlyIncome, setMonthlyIncome] = useState(
    props.initialMonthlyIncome != null
      ? String(props.initialMonthlyIncome)
      : ""
  );
  const [currency, setCurrency] = useState(props.initialBaseCurrency);
  const [annualBonus, setAnnualBonus] = useState(
    props.initialAnnualBonus != null ? String(props.initialAnnualBonus) : ""
  );
  const [savingsTarget, setSavingsTarget] = useState(
    props.initialSavingsTarget != null
      ? String(props.initialSavingsTarget)
      : ""
  );
  const [debtObligations, setDebtObligations] = useState(
    props.initialDebtObligations != null
      ? String(props.initialDebtObligations)
      : ""
  );
  const [lifestyle, setLifestyle] = useState<LifestyleProfileId>(
    isLifestyleId(props.initialLifestyleProfile)
      ? props.initialLifestyleProfile
      : "young_professional"
  );
  const [strategy, setStrategy] = useState<BudgetingStrategyId>(
    isStrategyId(props.initialBudgetingStrategy)
      ? props.initialBudgetingStrategy
      : "balanced"
  );
  const [confidence, setConfidence] = useState<OnboardingConfidenceLevel>(
    isConfidence(props.initialConfidenceLevel)
      ? props.initialConfidenceLevel
      : props.initialEstimatedBudgetMode
        ? "rough"
        : "moderate"
  );
  const [foodBand, setFoodBand] = useState<FoodSpendBandId>(
    isFoodBand(props.initialFoodSpendBand)
      ? props.initialFoodSpendBand
      : "unknown"
  );

  const incomeNum = useMemo(() => {
    const n = Number(monthlyIncome);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [monthlyIncome]);

  const previewLines = useMemo(() => {
    if (incomeNum <= 0) return [];
    return generateGuidedMonthlyBudgetLines({
      monthlyIncome: incomeNum,
      lifestyle,
      strategy,
      foodSpendBand: foodBand,
    });
  }, [incomeNum, lifestyle, strategy, foodBand]);

  async function savePatch(patch: Record<string, unknown>) {
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error("Failed to save onboarding step");
  }

  async function persistStrategyAndOptionalCommitments() {
    await savePatch({
      budgeting_strategy: strategy,
      savings_target_monthly:
        savingsTarget.trim() === "" ? null : Number(savingsTarget),
      debt_obligations_monthly:
        debtObligations.trim() === "" ? null : Number(debtObligations),
    });
  }

  async function onContinue() {
    setPending(true);
    setStatus(null);
    try {
      if (step === 1) {
        await savePatch({
          display_name: displayName.trim() || null,
          monthly_income:
            monthlyIncome.trim() === "" ? null : Number(monthlyIncome),
          base_currency: currency.trim().toUpperCase(),
          salary_frequency: "monthly",
          annual_bonus: annualBonus.trim() === "" ? null : Number(annualBonus),
          onboarding_confidence_level: confidence,
          estimated_budget_mode: confidence === "rough",
          onboarding_step: 2,
        });
        setStep(2);
      } else if (step === 2) {
        await savePatch({
          lifestyle_profile: lifestyle,
          food_spend_band: foodBand,
          onboarding_step: 3,
        });
        setStep(3);
      } else if (step === 3) {
        await persistStrategyAndOptionalCommitments();
        await savePatch({ onboarding_step: 4 });
        setStep(4);
      } else {
        await savePatch({
          onboarding_required: false,
          onboarding_completed_at: new Date().toISOString(),
          onboarding_step: 4,
        });
        router.push("/dashboard");
        router.refresh();
      }
    } catch (e) {
      console.error(e);
      setStatus("Could not save. Please check your values and try again.");
    } finally {
      setPending(false);
    }
  }

  async function onCreateRecommendedBudget() {
    setPending(true);
    setStatus(null);
    try {
      await persistStrategyAndOptionalCommitments();
      const result = await applyGuidedBudgetLinesAction(
        { error: null },
        new FormData()
      );
      if (result.error) {
        setStatus(result.error);
        return;
      }
      await savePatch({ onboarding_step: 4 });
      setStep(4);
    } catch (e) {
      console.error(e);
      setStatus("Could not create budget lines. Try again or skip for now.");
    } finally {
      setPending(false);
    }
  }

  const cardClass =
    "rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm shadow-slate-900/5";

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-800/90">
          Guided setup · Step {step} of 4
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.65rem]">
          {step === 1 && "Start with your income"}
          {step === 2 && "Pick a lifestyle lens"}
          {step === 3 && "Choose how you want to allocate"}
          {step === 4 && "You are ready to go"}
        </h1>
        <p className="text-sm leading-relaxed text-slate-600">
          {step === 1 &&
            "One number is enough to begin. Refine CPF, bonuses, and household later."}
          {step === 2 &&
            "Templates tune category weights — nothing is locked. Edit anytime in Budget."}
          {step === 3 &&
            "We draft a Singapore-friendly starter mix. React to suggestions instead of building from zero."}
          {step === 4 &&
            "Your dashboard and safe-to-spend view will pick up this plan as you add expenses."}
        </p>
      </div>

      {step === 1 && (
        <div className={`space-y-6 ${cardClass}`}>
          <label className="block space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Monthly take-home
            </span>
            <input
              className={`${fpInputClass} max-w-none text-lg font-medium tabular-nums`}
              placeholder="e.g. 4800"
              type="number"
              min={0}
              step="0.01"
              value={monthlyIncome}
              onChange={(e) => setMonthlyIncome(e.target.value)}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-xs font-medium text-slate-500">
              Display name{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <input
              className={`${fpInputClass} max-w-none`}
              placeholder="How we greet you"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-xs font-medium text-slate-500">
                Currency
              </span>
              <input
                className={fpInputClass}
                placeholder="SGD"
                maxLength={3}
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-medium text-slate-500">
                Annual bonus{" "}
                <span className="font-normal text-slate-400">(optional)</span>
              </span>
              <input
                className={fpInputClass}
                type="number"
                min={0}
                step="0.01"
                value={annualBonus}
                onChange={(e) => setAnnualBonus(e.target.value)}
              />
            </label>
          </div>
          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              How precise do you want to be right now?
            </span>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["rough", "Rough is fine"],
                  ["moderate", "Balanced"],
                  ["detailed", "More detail"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setConfidence(id)}
                  className={
                    confidence === id
                      ? "rounded-full border border-emerald-500 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-950"
                      : "rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 hover:bg-white"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Coming soon:</span>{" "}
            household income and shared budgets — add more detail later in
            Setup.
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className={`${cardClass} space-y-4`}>
            <p className="text-sm font-medium text-slate-800">Lifestyle</p>
            <div className="grid max-h-[min(52vh,22rem)] gap-2 overflow-y-auto pr-1 sm:max-h-none sm:grid-cols-2">
              {LIFESTYLE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setLifestyle(p.id)}
                  className={
                    lifestyle === p.id
                      ? "rounded-xl border-2 border-emerald-500 bg-emerald-50/60 p-3 text-left text-sm"
                      : "rounded-xl border border-slate-200 bg-white p-3 text-left text-sm hover:border-slate-300"
                  }
                >
                  <span className="font-semibold text-slate-900">
                    {p.label}
                  </span>
                  <span className="mt-1 block text-xs leading-snug text-slate-600">
                    {p.blurb}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className={`${cardClass} space-y-3`}>
            <p className="text-sm font-medium text-slate-800">
              Roughly, monthly food (dining + groceries)
            </p>
            <div className="flex flex-wrap gap-2">
              {FOOD_BANDS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setFoodBand(b.id)}
                  className={
                    foodBand === b.id
                      ? "rounded-full border border-emerald-500 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-950"
                      : "rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700"
                  }
                >
                  {b.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Ranges keep things light — you will tune categories on the Budget
              page.
            </p>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div className={`${cardClass} space-y-4`}>
            <p className="text-sm font-medium text-slate-800">
              Money management style
            </p>
            <div className="space-y-2">
              {BUDGET_STRATEGY_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setStrategy(p.id)}
                  className={
                    strategy === p.id
                      ? "flex w-full flex-col rounded-xl border-2 border-emerald-500 bg-emerald-50/50 px-4 py-3 text-left"
                      : "flex w-full flex-col rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-slate-300"
                  }
                >
                  <span className="font-semibold text-slate-900">
                    {p.label}
                  </span>
                  <span className="text-xs text-slate-600">{p.subtitle}</span>
                </button>
              ))}
            </div>
          </div>
          <div className={`${cardClass} space-y-4`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-slate-800">
                Recommended monthly plan
              </p>
              {incomeNum > 0 && (
                <span className="text-xs text-slate-500">
                  Preview · {currency}
                </span>
              )}
            </div>
            {incomeNum <= 0 ? (
              <p className="text-sm text-amber-800">
                Add a positive monthly income in step 1 to preview amounts.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                {previewLines.map((l) => (
                  <li
                    key={l.category}
                    className="flex items-center justify-between px-3 py-2 text-sm"
                  >
                    <span className="capitalize text-slate-800">
                      {l.category}
                    </span>
                    <span className="tabular-nums text-slate-700">
                      {formatCurrency(l.amount, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs text-slate-500">
                  Savings target (optional)
                </span>
                <input
                  className={`${fpInputClass} max-w-none`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={savingsTarget}
                  onChange={(e) => setSavingsTarget(e.target.value)}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-slate-500">
                  Debt payments (optional)
                </span>
                <input
                  className={`${fpInputClass} max-w-none`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={debtObligations}
                  onChange={(e) => setDebtObligations(e.target.value)}
                />
              </label>
            </div>
            <p className="text-xs text-slate-500">
              Improve accuracy later: investments, insurance, CPF, and debt
              detail live in Setup —{" "}
              <span className="font-medium text-slate-700">Work in progress</span>{" "}
              sections stay optional.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              disabled={pending || incomeNum <= 0}
              className={fpPrimaryButtonClass}
              onClick={() => void onCreateRecommendedBudget()}
            >
              Create my recommended budget
            </button>
            <button
              type="button"
              disabled={pending}
              className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
              onClick={() => void onContinue()}
            >
              Skip lines for now
            </button>
          </div>
          <p className="text-center text-[11px] text-slate-500">
            If you already have monthly budget lines, continue on the Budget
            page — we will not duplicate them.
          </p>
        </div>
      )}

      {step === 4 && (
        <div className={`${cardClass} space-y-4 text-sm text-slate-700`}>
          <p>
            You can add goals, balances, and projections when you are ready.
            Your advisor sees the same structure — no perfect spreadsheet
            required.
          </p>
          <ul className="space-y-2 text-xs text-slate-600">
            <li>
              <span className="font-semibold text-slate-800">Coming soon:</span>{" "}
              AI tuning from your spending patterns.
            </li>
            <li>
              <span className="font-semibold text-slate-800">Coming soon:</span>{" "}
              Advisor-adjusted plan templates.
            </li>
          </ul>
          <div className="flex flex-wrap gap-3 text-sm">
            <a
              href="/setup?tab=goals"
              className="font-medium text-emerald-800 underline decoration-emerald-600/40 underline-offset-2"
            >
              Open Goals
            </a>
            <a
              href="/budget"
              className="font-medium text-emerald-800 underline decoration-emerald-600/40 underline-offset-2"
            >
              Review Budget
            </a>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {step !== 3 && (
          <button
            className={fpPrimaryButtonClass}
            disabled={pending}
            type="button"
            onClick={() => void onContinue()}
          >
            {step === 4 ? "Finish onboarding" : "Continue"}
          </button>
        )}
        {status && (
          <span className="text-sm text-red-700" role="alert">
            {status}
          </span>
        )}
      </div>
    </div>
  );
}
