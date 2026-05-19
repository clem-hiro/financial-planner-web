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
import {
  BONUS_MONTH_PRESETS,
  ONBOARDING_DEFAULT_CPF_BAND,
  annualBonusFromGrossAndMonths,
  estimateOnboardingTakeHomeMonthly,
  inferBonusMonthPreset,
  type BonusMonthPresetId,
} from "@/domain/finance/onboarding-income";
import { formatYearMonth } from "@/lib/dates";
import { applyGuidedBudgetLinesAction } from "@/server/actions";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import { fpInputClass, fpPrimaryButtonClass } from "@/ui/input-classes";
import { formatCurrency } from "@/ui/lib/format";
import { BonusMonthSelector } from "@/features/onboarding/BonusMonthSelector";
// Module sync map: see onboarding-module-sync.ts (profile columns → Income, Budget, Goals).

type Props = {
  initialDisplayName: string;
  initialGrossMonthly: number | null;
  /** Pre-gross UX: stored take-home only; shown as hint, not prefilled as gross. */
  initialLegacyTakeHomeMonthly: number | null;
  initialBaseCurrency: string;
  initialAnnualBonus: number | null;
  initialAnnualBonusMonths: number | null;
  initialSavingsTarget: number | null;
  initialDebtObligations: number | null;
  initialStep: number;
  initialLifestyleProfile: string | null;
  initialBudgetingStrategy: string | null;
  initialConfidenceLevel: string | null;
  initialFoodSpendBand: string | null;
  initialEstimatedBudgetMode: boolean;
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

function isConfidence(
  s: string | null
): s is OnboardingConfidenceLevel {
  return s === "rough" || s === "moderate" || s === "detailed";
}

function isFoodBand(s: string | null): s is FoodSpendBandId {
  return s != null && FOOD_SPEND_BAND_PRESETS.some((b) => b.id === s);
}

function parsePositive(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function OnboardingWizard(props: Props) {
  const router = useRouter();
  const cpfYearMonth = useMemo(() => formatYearMonth(new Date()), []);
  const [step, setStep] = useState(
    Math.min(4, Math.max(1, props.initialStep || 1))
  );
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [displayName, setDisplayName] = useState(props.initialDisplayName);
  const [grossMonthly, setGrossMonthly] = useState(
    props.initialGrossMonthly != null ? String(props.initialGrossMonthly) : ""
  );
  const [currency, setCurrency] = useState(props.initialBaseCurrency);
  const initialBonus = useMemo(
    () =>
      inferBonusMonthPreset(
        props.initialAnnualBonus,
        props.initialGrossMonthly,
        props.initialAnnualBonusMonths
      ),
    [
      props.initialAnnualBonus,
      props.initialGrossMonthly,
      props.initialAnnualBonusMonths,
    ]
  );
  const [bonusPreset, setBonusPreset] = useState<BonusMonthPresetId>(
    initialBonus.preset
  );
  const [bonusCustomAmount, setBonusCustomAmount] = useState(
    initialBonus.customAmount
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

  const grossNum = useMemo(
    () => parsePositive(grossMonthly),
    [grossMonthly]
  );

  const estimatedTakeHome = useMemo(() => {
    if (grossNum == null) return null;
    return estimateOnboardingTakeHomeMonthly(grossNum, cpfYearMonth);
  }, [grossNum, cpfYearMonth]);

  /** Budget previews use take-home (derived or legacy), never gross. */
  const takeHomeForBudget = useMemo(() => {
    if (estimatedTakeHome != null) return estimatedTakeHome;
    if (grossNum == null && props.initialLegacyTakeHomeMonthly != null) {
      return props.initialLegacyTakeHomeMonthly;
    }
    return 0;
  }, [estimatedTakeHome, grossNum, props.initialLegacyTakeHomeMonthly]);

  const previewLines = useMemo(() => {
    if (takeHomeForBudget <= 0) return [];
    return generateGuidedMonthlyBudgetLines({
      monthlyIncome: takeHomeForBudget,
      lifestyle,
      strategy,
      foodSpendBand: foodBand,
    });
  }, [takeHomeForBudget, lifestyle, strategy, foodBand]);

  function resolveBonusPayload(gross: number | null): {
    annual_bonus: number | null;
    annual_bonus_months: number | null;
  } {
    const presetDef = BONUS_MONTH_PRESETS.find((p) => p.id === bonusPreset);
    if (bonusPreset === "none") {
      return { annual_bonus: null, annual_bonus_months: 0 };
    }
    if (bonusPreset === "custom") {
      const custom = bonusCustomAmount.trim();
      if (custom === "") {
        return { annual_bonus: null, annual_bonus_months: null };
      }
      const amount = Number(custom);
      if (!Number.isFinite(amount) || amount < 0) {
        return { annual_bonus: null, annual_bonus_months: null };
      }
      return { annual_bonus: amount, annual_bonus_months: null };
    }
    const months = presetDef?.months ?? null;
    if (months == null || months <= 0 || gross == null) {
      return { annual_bonus: null, annual_bonus_months: months };
    }
    return {
      annual_bonus: annualBonusFromGrossAndMonths(gross, months),
      annual_bonus_months: months,
    };
  }

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

  async function onBack() {
    if (step <= 1 || pending) return;
    const prev = step - 1;
    setPending(true);
    setStatus(null);
    try {
      await savePatch({ onboarding_step: prev });
      setStep(prev);
    } catch (e) {
      console.error(e);
      setStatus("Could not go back. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function onContinue() {
    setPending(true);
    setStatus(null);
    try {
      if (step === 1) {
        const bonus = resolveBonusPayload(grossNum);
        if (grossNum != null) {
          await savePatch({
            display_name: displayName.trim() || null,
            monthly_gross_salary: grossNum,
            cpf_age_band: ONBOARDING_DEFAULT_CPF_BAND,
            annual_bonus: bonus.annual_bonus,
            annual_bonus_months: bonus.annual_bonus_months,
            base_currency: currency.trim().toUpperCase(),
            salary_frequency: "monthly",
            onboarding_confidence_level: confidence,
            estimated_budget_mode: confidence === "rough",
            onboarding_step: 2,
          });
        } else if (props.initialLegacyTakeHomeMonthly != null) {
          await savePatch({
            display_name: displayName.trim() || null,
            monthly_income: props.initialLegacyTakeHomeMonthly,
            annual_bonus: bonus.annual_bonus,
            annual_bonus_months: bonus.annual_bonus_months,
            base_currency: currency.trim().toUpperCase(),
            salary_frequency: "monthly",
            onboarding_confidence_level: confidence,
            estimated_budget_mode: confidence === "rough",
            onboarding_step: 2,
          });
        } else {
          await savePatch({
            display_name: displayName.trim() || null,
            monthly_income: null,
            annual_bonus: bonus.annual_bonus,
            annual_bonus_months: bonus.annual_bonus_months,
            base_currency: currency.trim().toUpperCase(),
            salary_frequency: "monthly",
            onboarding_confidence_level: confidence,
            estimated_budget_mode: confidence === "rough",
            onboarding_step: 2,
          });
        }
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

  async function onCreateIllustratedBudget() {
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

  const backButtonClass =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600";

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div className="flex items-start gap-3">
        {step > 1 && (
          <button
            type="button"
            className={`${backButtonClass} shrink-0`}
            disabled={pending}
            onClick={() => void onBack()}
            aria-label="Go back to previous step"
          >
            ← Back
          </button>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-800/90">
            Guided setup · Step {step} of 4
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.65rem]">
            {step === 1 && "Start with your income"}
            {step === 2 && "Pick a lifestyle lens"}
            {step === 3 && "How do you usually manage money?"}
            {step === 4 && "You are ready to go"}
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            {step === 1 &&
              "One number is enough to begin. Refine CPF, bonuses, and household later."}
            {step === 2 &&
              "Templates tune category weights — nothing is locked. Edit anytime in Budget."}
            {step === 3 &&
              "Based on your income and selected style. You can customise everything later."}
            {step === 4 &&
              "Your dashboard and safe-to-spend view will pick up this plan as you add expenses."}
          </p>
        </div>
      </div>

      {step === 1 && (
        <div className={`space-y-6 ${cardClass}`}>
          {props.initialLegacyTakeHomeMonthly != null && grossNum == null && (
            <p className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
              You previously saved take-home pay of{" "}
              <span className="font-semibold tabular-nums">
                {formatCurrency(
                  props.initialLegacyTakeHomeMonthly,
                  currency
                )}
              </span>
              /month. Enter your{" "}
              <span className="font-medium">gross monthly salary</span> below for
              automatic CPF estimates.
            </p>
          )}
          <label className="block space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Gross monthly income
            </span>
            <input
              className={`${fpInputClass} max-w-none text-lg font-medium tabular-nums`}
              placeholder="e.g. 5000"
              type="number"
              min={0}
              step="0.01"
              value={grossMonthly}
              onChange={(e) => setGrossMonthly(e.target.value)}
              aria-describedby="gross-income-hint take-home-preview"
            />
            <p id="gross-income-hint" className="text-xs text-slate-500">
              We&apos;ll estimate CPF and take-home automatically.
            </p>
            {estimatedTakeHome != null && grossNum != null && (
              <p
                id="take-home-preview"
                className="text-sm text-slate-700"
                aria-live="polite"
              >
                Estimated take-home:{" "}
                <span className="font-medium tabular-nums text-emerald-900">
                  ~{formatCurrency(estimatedTakeHome, currency)}
                </span>
                /month after CPF
              </p>
            )}
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
            <div className="col-span-2 sm:col-span-1">
              <BonusMonthSelector
                preset={bonusPreset}
                customAmount={bonusCustomAmount}
                onPresetChange={setBonusPreset}
                onCustomAmountChange={setBonusCustomAmount}
                disabled={pending}
              />
            </div>
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
        <div className="space-y-6" {...(pending ? { inert: true } : {})}>
          <BlockingSubmitOverlay active={pending} message="Saving onboarding…" />
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
              {FOOD_SPEND_BAND_PRESETS.map((b) => (
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
            <p className="text-xs text-slate-500">
              We&apos;ll draft a starting plan you can adjust anytime.
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
                Illustrated monthly plan
              </p>
              {takeHomeForBudget > 0 && (
                <span className="text-xs text-slate-500">
                  Preview · {currency}
                </span>
              )}
            </div>
            {takeHomeForBudget <= 0 ? (
              <p className="text-sm text-amber-800">
                Add a positive gross monthly income in step 1 to preview amounts.
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
              disabled={pending || takeHomeForBudget <= 0}
              className={fpPrimaryButtonClass}
              onClick={() => void onCreateIllustratedBudget()}
            >
              Create my illustrated budget
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
            <Link
              href="/planning/future"
              className="font-medium text-emerald-800 underline decoration-emerald-600/40 underline-offset-2"
            >
              Open Goals
            </Link>
            <Link
              href="/budget"
              className="font-medium text-emerald-800 underline decoration-emerald-600/40 underline-offset-2"
            >
              Review Budget
            </Link>
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
