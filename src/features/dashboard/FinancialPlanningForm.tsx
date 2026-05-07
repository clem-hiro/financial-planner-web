"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fpInputClass, fpPrimaryButtonClass, fpSelectClass } from "@/ui/input-classes";

export function FinancialPlanningForm({
  initialCurrency,
  initialSalaryFrequency,
  initialAnnualBonus,
  initialSavingsTarget,
  initialDebtObligations,
}: {
  initialCurrency: string;
  initialSalaryFrequency: "monthly" | "biweekly" | "weekly" | "annual" | null;
  initialAnnualBonus: number | null;
  initialSavingsTarget: number | null;
  initialDebtObligations: number | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [currency, setCurrency] = useState(initialCurrency);
  const [salaryFrequency, setSalaryFrequency] = useState(
    initialSalaryFrequency ?? "monthly"
  );
  const [annualBonus, setAnnualBonus] = useState(
    initialAnnualBonus != null ? String(initialAnnualBonus) : ""
  );
  const [savingsTarget, setSavingsTarget] = useState(
    initialSavingsTarget != null ? String(initialSavingsTarget) : ""
  );
  const [debtObligations, setDebtObligations] = useState(
    initialDebtObligations != null ? String(initialDebtObligations) : ""
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base_currency: currency.trim().toUpperCase(),
        salary_frequency: salaryFrequency,
        annual_bonus: annualBonus.trim() === "" ? null : Number(annualBonus),
        savings_target_monthly:
          savingsTarget.trim() === "" ? null : Number(savingsTarget),
        debt_obligations_monthly:
          debtObligations.trim() === "" ? null : Number(debtObligations),
      }),
      credentials: "include",
    });
    if (!res.ok) {
      setStatus("Failed to save");
      return;
    }
    setStatus("Saved");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Currency</span>
          <input
            className={fpInputClass}
            maxLength={3}
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Salary frequency</span>
          <select
            className={fpSelectClass}
            value={salaryFrequency}
            onChange={(e) => setSalaryFrequency(e.target.value as typeof salaryFrequency)}
          >
            <option value="monthly">Monthly</option>
            <option value="biweekly">Biweekly</option>
            <option value="weekly">Weekly</option>
            <option value="annual">Annual</option>
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={fpInputClass} placeholder="Annual bonus (optional)" type="number" min={0} step="0.01" value={annualBonus} onChange={(e) => setAnnualBonus(e.target.value)} />
        <input className={fpInputClass} placeholder="Savings target (optional)" type="number" min={0} step="0.01" value={savingsTarget} onChange={(e) => setSavingsTarget(e.target.value)} />
      </div>
      <input className={fpInputClass} placeholder="Debt obligations (optional)" type="number" min={0} step="0.01" value={debtObligations} onChange={(e) => setDebtObligations(e.target.value)} />
      <div className="flex items-center gap-3">
        <button type="submit" className={fpPrimaryButtonClass}>Save planning defaults</button>
        {status && <span className="text-sm text-slate-600">{status}</span>}
      </div>
    </form>
  );
}
