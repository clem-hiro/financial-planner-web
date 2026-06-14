"use client";

import Link from "next/link";
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
import {
  fpInputClass,
  fpNumberNoSpinnerClass,
  fpPrimaryButtonClass,
} from "@/ui/input-classes";
import { formatCurrency } from "@/ui/lib/format";
import { BonusMonthSelector } from "@/features/onboarding/BonusMonthSelector";
import {
  onboardingStepToStore,
  onboardingUiStepFromStored,
} from "@/features/onboarding/onboarding-profile-hints";
import { OnboardingProgress } from "@/features/onboarding/OnboardingProgress";
import {
  onboardingCardClass,
  onboardingChoiceChipClass,
  onboardingStrategyCardClass,
} from "@/features/onboarding/onboarding-ui";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { appEmeraldPanelClass } from "@/ui/surface-classes";
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
  return (
    s != null &&
    (s === "under_300" ||
      s === "range_300_600" ||
      s === "range_600_1000" ||
      s === "above_1000" ||
      s === "unknown")
  );
}

function parsePositive(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function OnboardingWizard(props: Props) {
  const router = useRouter();
  const cpfYearMonth = useMemo(() => formatYearMonth(new Date()), []);
  const [step, setStep] = useState(
    onboardingUiStepFromStored(props.initialStep || 1)
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
  const lifestyle: LifestyleProfileId = isLifestyleId(
    props.initialLifestyleProfile
  )
    ? props.initialLifestyleProfile
    : "young_professional";
  const foodBand: FoodSpendBandId = isFoodBand(props.initialFoodSpendBand)
    ? props.initialFoodSpendBand
    : "unknown";
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
      await savePatch({ onboarding_step: onboardingStepToStore(prev) });
      setStep(prev);
    } catch (e) {
      console.error(e);
      setStatus("Could not go back. Please try again.");
    } finally {
      setPending(false);
    }
  }

  /** Jump to step 1 without walking back through intermediate steps. */
  async function goToIncomeStep() {
    if (step === 1 || pending) return;
    setPending(true);
    setStatus(null);
    try {
      await savePatch({ onboarding_step: 1 });
      setStep(1);
    } catch (e) {
      console.error(e);
      setStatus("Could not open income step. Please try again.");
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
            onboarding_step: onboardingStepToStore(2),
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
            onboarding_step: onboardingStepToStore(2),
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
            onboarding_step: onboardingStepToStore(2),
          });
        }
        setStep(2);
      } else if (step === 2) {
        await persistStrategyAndOptionalCommitments();
        await savePatch({ onboarding_step: onboardingStepToStore(3) });
        setStep(3);
      } else {
        await savePatch({
          onboarding_required: false,
          onboarding_completed_at: new Date().toISOString(),
          onboarding_step: onboardingStepToStore(3),
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
      await savePatch({ onboarding_step: onboardingStepToStore(3) });
      setStep(3);
    } catch (e) {
      console.error(e);
      setStatus("Could not create budget lines. Try again or skip for now.");
    } finally {
      setPending(false);
    }
  }

  const stepHeadline =
    step === 1
      ? "Start with your income"
      : step === 2
        ? "How do you usually manage money?"
        : "You're ready to go";

  const stepBlurb =
    step === 1
      ? "One gross salary is enough — we'll estimate CPF and take-home. Refine the rest later in Settings."
      : step === 2
        ? "We'll draft a starting monthly plan from your income and style."
        : "Add goals and balances when you're ready — your dashboard is set up.";

  const navBackBase =
    "inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 min-w-[7.5rem]";
  const navBackClass = `${navBackBase} flex-1 sm:flex-initial`;
  const navPrimaryClass = `${fpPrimaryButtonClass} inline-flex min-h-11 flex-1 items-center justify-center disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial sm:min-w-[9.5rem]`;
  const navPrimaryFullClass = `${fpPrimaryButtonClass} flex min-h-11 w-full items-center justify-center disabled:cursor-not-allowed disabled:opacity-50`;
  const navSkipClass =
    "inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div
      className={`mx-auto max-w-xl space-y-8 ${step === 2 ? "pb-44" : "pb-28"}`}
    >
      <BlockingSubmitOverlay
        active={pending}
        message={
          step === 2 ? "Creating your illustrated budget…" : "Saving onboarding…"
        }
      />
      <header className="space-y-6">
        <OnboardingProgress step={step} />
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.75rem]">
            {stepHeadline}
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">{stepBlurb}</p>
        </div>
      </header>

      {step >= 2 && step <= 3 && (
        <div
          className={
            takeHomeForBudget > 0
              ? `flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm ${appEmeraldPanelClass}`
              : "rounded-xl border border-amber-200/80 bg-amber-50/95 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-200/60"
          }
        >
          {takeHomeForBudget > 0 ? (
            <p className="text-slate-700">
              Income:{" "}
              {grossNum != null ? (
                <>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(grossNum, currency)}
                  </span>{" "}
                  gross
                  {estimatedTakeHome != null && (
                    <>
                      {" "}
                      → ~
                      <span className="font-medium tabular-nums">
                        {formatCurrency(estimatedTakeHome, currency)}
                      </span>{" "}
                      take-home/mo
                    </>
                  )}
                </>
              ) : (
                <>
                  ~
                  <span className="font-medium tabular-nums">
                    {formatCurrency(takeHomeForBudget, currency)}
                  </span>{" "}
                  take-home/mo
                </>
              )}
            </p>
          ) : (
            <p>Add your gross monthly income to preview and create a plan.</p>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => void goToIncomeStep()}
            className={
              takeHomeForBudget > 0
                ? `shrink-0 ${appInlineLinkClass}`
                : "shrink-0 rounded-full bg-amber-900/90 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-950 disabled:opacity-50"
            }
          >
            {takeHomeForBudget > 0 ? "Edit income" : "Add gross income"}
          </button>
        </div>
      )}

      {step === 1 && (
        <div className={`space-y-8 ${onboardingCardClass}`}>
          {props.initialLegacyTakeHomeMonthly != null && grossNum == null && (
            <p className="rounded-xl border border-amber-200/80 bg-amber-50/95 px-4 py-3 text-sm leading-relaxed text-amber-950 ring-1 ring-amber-200/60">
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

          <label className="block space-y-3">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Gross monthly income
            </span>
            <div className="flex overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-900/5 ring-1 ring-slate-900/5 focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/15">
              <span
                className="flex shrink-0 items-center border-r border-slate-200/90 bg-slate-50/90 px-4 text-sm font-semibold tracking-wide text-slate-600"
                aria-hidden
              >
                {currency.trim() || "SGD"}
              </span>
              <input
                className={`min-w-0 flex-1 border-0 bg-transparent px-4 py-4 text-2xl font-semibold tabular-nums text-slate-900 outline-none placeholder:text-slate-300 ${fpNumberNoSpinnerClass}`}
                placeholder="5,000"
                type="number"
                min={0}
                step="0.01"
                value={grossMonthly}
                onChange={(e) => setGrossMonthly(e.target.value)}
                aria-describedby="gross-income-hint take-home-preview"
              />
            </div>
            <p id="gross-income-hint" className="text-xs leading-relaxed text-slate-500">
              We&apos;ll estimate CPF contributions and take-home pay automatically.
            </p>
            {estimatedTakeHome != null && grossNum != null && (
              <div
                id="take-home-preview"
                className={`${appEmeraldPanelClass} px-4 py-3 text-sm text-slate-800`}
                aria-live="polite"
              >
                <p className="font-medium text-emerald-950">Estimated take-home</p>
                <p className="mt-0.5 tabular-nums text-lg font-semibold text-slate-900">
                  ~{formatCurrency(estimatedTakeHome, currency)}
                  <span className="text-sm font-normal text-slate-600"> / month after CPF</span>
                </p>
              </div>
            )}
          </label>

          <div className="space-y-5 border-t border-slate-100 pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Optional details
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              <label className="flex flex-col gap-3 sm:col-span-2">
                <span className="block text-xs font-medium text-slate-600">
                  Display name
                </span>
                <input
                  className={`${fpInputClass} w-full max-w-none`}
                  placeholder="How we greet you"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-3">
                <span className="block text-xs font-medium text-slate-600">
                  Currency code
                </span>
                <input
                  className={`${fpInputClass} w-full max-w-none sm:max-w-[8rem]`}
                  placeholder="SGD"
                  maxLength={3}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                />
              </label>
            </div>
            <BonusMonthSelector
              preset={bonusPreset}
              customAmount={bonusCustomAmount}
              onPresetChange={setBonusPreset}
              onCustomAmountChange={setBonusCustomAmount}
              disabled={pending}
            />
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-6">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
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
                  className={onboardingChoiceChipClass(confidence === id, "md")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <p className="rounded-xl border border-dashed border-slate-200/90 bg-slate-50/60 px-4 py-3 text-xs leading-relaxed text-slate-600">
            <span className="font-semibold text-slate-700">Coming soon:</span>{" "}
            household income and shared budgets — add more detail later in Setup.
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className={`${onboardingCardClass} space-y-4`}>
            <p className="text-sm font-semibold text-slate-900">
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
                  className={onboardingStrategyCardClass(strategy === p.id)}
                >
                  <span className="font-semibold text-slate-900">
                    {p.label}
                  </span>
                  <span className="text-xs text-slate-600">{p.subtitle}</span>
                </button>
              ))}
            </div>
          </div>
          <div className={`${onboardingCardClass} space-y-4`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">
                Illustrated monthly plan
              </p>
              {takeHomeForBudget > 0 && (
                <span className="text-xs text-slate-500">
                  Preview · {currency}
                </span>
              )}
            </div>
            {takeHomeForBudget <= 0 ? (
              <div className="space-y-3 rounded-xl border border-amber-200/80 bg-amber-50/60 px-3 py-3 text-sm text-amber-900">
                <p>
                  Add a positive gross monthly income to preview amounts.
                </p>
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-full bg-amber-900/90 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-950 disabled:opacity-50"
                  onClick={() => void goToIncomeStep()}
                >
                  Add gross monthly income
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/90 bg-slate-50/40">
                {previewLines.map((l) => (
                  <li
                    key={l.category}
                    className="flex items-center justify-between bg-white/80 px-4 py-2.5 text-sm"
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
          {status && (
            <p className="text-sm text-red-700" role="alert">
              {status}
            </p>
          )}
          <p className="text-center text-[11px] text-slate-500">
            Create or skip your illustrated plan using the actions at the bottom
            of the screen. If you already have monthly budget lines, choose Skip
            — we will not duplicate them.
          </p>
        </div>
      )}

      {step === 3 && (
        <div className={`${onboardingCardClass} space-y-5 text-sm text-slate-700`}>
          <div
            className={`${appEmeraldPanelClass} px-4 py-4 text-center`}
            role="status"
          >
            <p className="text-lg font-semibold text-emerald-950">
              Your plan foundation is in place
            </p>
            <p className="mt-1 text-sm text-slate-700">
              Safe-to-spend and monthly review will sharpen as you add expenses.
            </p>
          </div>
          <p>
            Add goals, balances, and projections when you&apos;re ready. Your
            advisor sees the same structure — no perfect spreadsheet required.
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

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/90 bg-white/95 px-4 py-3 shadow-[0_-8px_32px_-12px_rgba(12,25,47,0.12)] backdrop-blur-md supports-backdrop-filter:bg-white/85 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        aria-label="Onboarding navigation"
      >
        <div className="mx-auto flex max-w-xl flex-col gap-2">
          {status && (
            <p className="text-center text-sm text-red-700" role="alert">
              {status}
            </p>
          )}
          {step === 2 ? (
            <div className="flex w-full flex-col gap-2">
              <button
                type="button"
                className={navPrimaryFullClass}
                disabled={pending || takeHomeForBudget <= 0}
                onClick={() => void onCreateIllustratedBudget()}
              >
                Create my illustrated budget
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  className={navBackBase}
                  disabled={pending}
                  onClick={() => void onBack()}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  className={navSkipClass}
                  disabled={pending}
                  onClick={() => void onContinue()}
                >
                  Skip lines for now
                </button>
              </div>
            </div>
          ) : (
            <div
              className={
                step === 1 ? "flex justify-end" : "flex items-stretch gap-3"
              }
            >
              {step > 1 && (
                <button
                  type="button"
                  className={navBackClass}
                  disabled={pending}
                  onClick={() => void onBack()}
                >
                  ← Back
                </button>
              )}
              <button
                type="button"
                className={navPrimaryClass}
                disabled={pending}
                onClick={() => void onContinue()}
              >
                {step === 3 ? "Finish onboarding" : "Continue"}
              </button>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}
