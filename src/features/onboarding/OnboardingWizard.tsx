"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fpInputClass, fpPrimaryButtonClass } from "@/ui/input-classes";

type Props = {
  initialDisplayName: string;
  initialMonthlyIncome: number | null;
  initialBaseCurrency: string;
  initialAnnualBonus: number | null;
  initialSavingsTarget: number | null;
  initialDebtObligations: number | null;
  initialStep: number;
};

export function OnboardingWizard(props: Props) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(4, Math.max(1, props.initialStep || 1)));
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [displayName, setDisplayName] = useState(props.initialDisplayName);
  const [monthlyIncome, setMonthlyIncome] = useState(
    props.initialMonthlyIncome != null ? String(props.initialMonthlyIncome) : ""
  );
  const [currency, setCurrency] = useState(props.initialBaseCurrency);
  const [annualBonus, setAnnualBonus] = useState(
    props.initialAnnualBonus != null ? String(props.initialAnnualBonus) : ""
  );
  const [savingsTarget, setSavingsTarget] = useState(
    props.initialSavingsTarget != null ? String(props.initialSavingsTarget) : ""
  );
  const [debtObligations, setDebtObligations] = useState(
    props.initialDebtObligations != null ? String(props.initialDebtObligations) : ""
  );

  async function savePatch(patch: Record<string, unknown>) {
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error("Failed to save onboarding step");
  }

  async function onContinue() {
    setPending(true);
    setStatus(null);
    try {
      if (step === 1) {
        await savePatch({
          display_name: displayName.trim() || null,
          monthly_income: monthlyIncome.trim() === "" ? null : Number(monthlyIncome),
          base_currency: currency.trim().toUpperCase(),
          salary_frequency: "monthly",
          annual_bonus: annualBonus.trim() === "" ? null : Number(annualBonus),
          onboarding_step: 2,
        });
        setStep(2);
      } else if (step === 2) {
        await savePatch({
          savings_target_monthly: savingsTarget.trim() === "" ? null : Number(savingsTarget),
          debt_obligations_monthly:
            debtObligations.trim() === "" ? null : Number(debtObligations),
          onboarding_step: 3,
        });
        setStep(3);
      } else if (step === 3) {
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

  async function onSkip() {
    setPending(true);
    setStatus(null);
    try {
      if (step < 4) {
        await savePatch({ onboarding_step: step + 1 });
        setStep(step + 1);
      } else {
        await onContinue();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800/90">
        Step {step} of 4
      </p>
      {step === 1 && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Income</h2>
          <input className={fpInputClass} placeholder="Display name (optional)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <input className={fpInputClass} placeholder="Monthly take-home income" type="number" min={0} step="0.01" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} />
          <input className={fpInputClass} placeholder="Currency (e.g. SGD)" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
          <input className={fpInputClass} placeholder="Annual bonus (optional)" type="number" min={0} step="0.01" value={annualBonus} onChange={(e) => setAnnualBonus(e.target.value)} />
        </div>
      )}
      {step === 2 && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Monthly planning</h2>
          <input className={fpInputClass} placeholder="Savings target (optional)" type="number" min={0} step="0.01" value={savingsTarget} onChange={(e) => setSavingsTarget(e.target.value)} />
          <input className={fpInputClass} placeholder="Debt obligations (optional)" type="number" min={0} step="0.01" value={debtObligations} onChange={(e) => setDebtObligations(e.target.value)} />
        </div>
      )}
      {step === 3 && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
          <h2 className="text-lg font-semibold text-slate-900">Financial position (optional)</h2>
          <p>Add cash, investments, CPF, loans, housing, and vehicles later in Setup.</p>
          <a href="/setup" className="text-emerald-700 underline">Go to Setup</a>
        </div>
      )}
      {step === 4 && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
          <h2 className="text-lg font-semibold text-slate-900">Goals (optional)</h2>
          <p>Add emergency fund, retirement, travel, or house goals now or later.</p>
          <a href="/goals" className="text-emerald-700 underline">Go to Goals</a>
        </div>
      )}
      <div className="flex items-center gap-3">
        <button className={fpPrimaryButtonClass} disabled={pending} type="button" onClick={onContinue}>
          {step === 4 ? "Finish onboarding" : "Continue"}
        </button>
        {step >= 3 && (
          <button type="button" disabled={pending} className="text-sm text-slate-600 underline" onClick={onSkip}>
            Skip
          </button>
        )}
        {status && <span className="text-sm text-red-700">{status}</span>}
      </div>
    </div>
  );
}
