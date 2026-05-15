"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { num } from "@/data/mappers";
import type { IncomeTaxConfigRow } from "@/data/supabase/types";
import { appCardClass, appCardPadding } from "@/ui/surface-classes";
import { fpInputClass, fpPrimaryButtonClass, fpSelectClass } from "@/ui/input-classes";
import { formatCurrency } from "@/ui/lib/format";

type ReliefFieldKey =
  // family
  | "spouse_relief_sgd"
  | "qualifying_child_relief_sgd"
  | "handicapped_child_relief_sgd"
  | "working_mother_child_relief_sgd"
  | "parent_relief_sgd"
  | "grandparent_caregiver_relief_sgd"
  | "handicapped_sibling_relief_sgd"
  // cpf / srs
  | "cpf_cash_topup_self_sgd"
  | "cpf_cash_topup_family_sgd"
  | "srs_contribution_sgd"
  | "cpf_medisave_voluntary_sgd"
  // ns
  | "nsman_self_relief_sgd"
  | "nsman_wife_relief_sgd"
  | "nsman_parent_relief_sgd"
  // career / other
  | "course_fees_relief_sgd"
  | "life_insurance_relief_sgd"
  | "other_reliefs_amount_sgd";

type FieldDef = { key: ReliefFieldKey; label: string; max: number };

const FAMILY: FieldDef[] = [
  { key: "spouse_relief_sgd", label: "Spouse relief", max: 2_000 },
  { key: "qualifying_child_relief_sgd", label: "Qualifying child relief", max: 40_000 },
  { key: "handicapped_child_relief_sgd", label: "Handicapped child relief", max: 60_000 },
  { key: "working_mother_child_relief_sgd", label: "Working mother child relief", max: 50_000 },
  { key: "parent_relief_sgd", label: "Parent relief", max: 36_000 },
  { key: "grandparent_caregiver_relief_sgd", label: "Grandparent caregiver relief", max: 3_000 },
  { key: "handicapped_sibling_relief_sgd", label: "Handicapped sibling relief", max: 20_000 },
];
const CPF_SRS: FieldDef[] = [
  { key: "cpf_cash_topup_self_sgd", label: "CPF cash top-up (self)", max: 8_000 },
  { key: "cpf_cash_topup_family_sgd", label: "CPF cash top-up (family)", max: 8_000 },
  { key: "srs_contribution_sgd", label: "SRS contribution", max: 35_700 },
  { key: "cpf_medisave_voluntary_sgd", label: "MediSave voluntary", max: 37_740 },
];
const NS: FieldDef[] = [
  { key: "nsman_self_relief_sgd", label: "NSman self relief", max: 5_000 },
  { key: "nsman_wife_relief_sgd", label: "NSman wife relief", max: 750 },
  { key: "nsman_parent_relief_sgd", label: "NSman parent relief", max: 750 },
];
const CAREER_OTHER: FieldDef[] = [
  { key: "course_fees_relief_sgd", label: "Course fees relief", max: 5_500 },
  { key: "life_insurance_relief_sgd", label: "Life insurance relief", max: 5_000 },
  { key: "other_reliefs_amount_sgd", label: "Other reliefs (free-form)", max: 80_000 },
];

const ALL_FIELDS = [...FAMILY, ...CPF_SRS, ...NS, ...CAREER_OTHER];

type ReliefValues = Record<ReliefFieldKey, string>;

type AutoAppliedRow = {
  label: string;
  value: number;
  caption: string;
};

type AutoAppliedProp = {
  mandatoryCpfSgd: number;
  earnedIncomeSgd: number;
  age: number;
} | null;

function initialValues(config: IncomeTaxConfigRow | null): ReliefValues {
  const out = {} as ReliefValues;
  for (const f of ALL_FIELDS) {
    const raw = config ? config[f.key] : null;
    out[f.key] = raw != null && raw !== "" ? String(num(raw)) : "";
  }
  return out;
}

function parseNullable(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function IncomeTaxForm({
  config,
  autoApplied,
}: {
  config: IncomeTaxConfigRow | null;
  autoApplied: AutoAppliedProp;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ReliefValues>(initialValues(config));
  const [notes, setNotes] = useState(config?.other_reliefs_notes ?? "");
  const [paymentMethod, setPaymentMethod] = useState<"monthly_giro" | "one_time">(
    config?.payment_method ?? "monthly_giro"
  );
  const [rebateOn, setRebateOn] = useState(
    config?.tax_rebate_percent != null && config?.tax_rebate_cap_sgd != null
  );
  const [rebatePercent, setRebatePercent] = useState(
    config?.tax_rebate_percent != null ? String(num(config.tax_rebate_percent)) : ""
  );
  const [rebateCap, setRebateCap] = useState(
    config?.tax_rebate_cap_sgd != null ? String(num(config.tax_rebate_cap_sgd)) : ""
  );
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isRefreshing, startTransition] = useTransition();
  const isBusy = submitting || isRefreshing;

  function setField(key: ReliefFieldKey, raw: string) {
    setValues((v) => ({ ...v, [key]: raw }));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus(null);
    setSubmitting(true);
    try {
      const patch: Record<string, unknown> = { payment_method: paymentMethod };
      for (const f of ALL_FIELDS) {
        patch[f.key] = parseNullable(values[f.key]);
      }
      patch.other_reliefs_notes = notes.trim() === "" ? null : notes.trim();
      if (rebateOn) {
        const p = parseNullable(rebatePercent);
        const c = parseNullable(rebateCap);
        if (p == null || c == null) {
          setStatus("Enter both rebate percent and rebate cap, or switch the rebate off.");
          setSubmitting(false);
          return;
        }
        patch.tax_rebate_percent = p;
        patch.tax_rebate_cap_sgd = c;
      } else {
        patch.tax_rebate_percent = null;
        patch.tax_rebate_cap_sgd = null;
      }

      const res = await fetch("/api/income-tax", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
        credentials: "include",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as {
          error?: string;
          details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
        } | null;
        const zod =
          (j?.details?.fieldErrors &&
            Object.values(j.details.fieldErrors).flat().join(" ")) ||
          j?.details?.formErrors?.join(" ");
        setStatus(zod || j?.error || "Failed to save");
        return;
      }
      setStatus("Saved");
      startTransition(() => router.refresh());
    } catch {
      setStatus("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const earnedIncomeRow: AutoAppliedRow | null = autoApplied
    ? {
        label: "Earned income relief",
        value: autoApplied.earnedIncomeSgd,
        caption: `Auto-applied · age ${autoApplied.age} tier`,
      }
    : null;
  const mandatoryCpfRow: AutoAppliedRow | null = autoApplied
    ? {
        label: "Mandatory CPF (employee share)",
        value: autoApplied.mandatoryCpfSgd,
        caption: "Auto-applied by IRAS via your employer's IR8S filing",
      }
    : null;

  return (
    <form onSubmit={onSubmit} className={`${appCardClass} ${appCardPadding} space-y-4`}>
      <FieldGroup
        title="Earned income"
        defaultOpen
        autoAppliedRows={earnedIncomeRow ? [earnedIncomeRow] : []}
        autoAppliedHint={
          autoApplied
            ? null
            : "Set your birth date and CPF age band on the Profile tab to see this auto-derived."
        }
        fields={[]}
        values={values}
        onChange={setField}
      />
      <FieldGroup
        title="CPF / SRS"
        defaultOpen
        autoAppliedRows={mandatoryCpfRow ? [mandatoryCpfRow] : []}
        autoAppliedHint={
          autoApplied
            ? null
            : "Set your monthly gross salary, birth date, and CPF age band on the Profile tab to see your mandatory CPF here."
        }
        fields={CPF_SRS}
        values={values}
        onChange={setField}
      />
      <FieldGroup title="Family" fields={FAMILY} values={values} onChange={setField} />
      <FieldGroup title="NS" fields={NS} values={values} onChange={setField} />
      <FieldGroup
        title="Career & other"
        fields={CAREER_OTHER}
        values={values}
        onChange={setField}
      />

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-800">
          Notes on &ldquo;Other reliefs&rdquo;
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="e.g. donations not auto-deducted, foreign maid levy concession"
          className={`${fpInputClass} max-w-full`}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-800">
          Payment method
        </label>
        <select
          value={paymentMethod}
          onChange={(e) =>
            setPaymentMethod(e.target.value as "monthly_giro" | "one_time")
          }
          className={fpSelectClass}
        >
          <option value="monthly_giro">Monthly GIRO (12 instalments)</option>
          <option value="one_time">One-time annual payment</option>
        </select>
      </div>

      <details open={rebateOn} className="rounded-xl border border-slate-200/80 p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-800">
          Optional rebate (e.g. YA 2026)
        </summary>
        <div className="mt-3 space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={rebateOn}
              onChange={(e) => setRebateOn(e.target.checked)}
            />
            Apply a personal income tax rebate
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="block text-xs text-slate-600">Rebate percent</span>
              <input
                type="number"
                step="0.01"
                min={0}
                max={100}
                disabled={!rebateOn}
                value={rebatePercent}
                onChange={(e) => setRebatePercent(e.target.value)}
                className={fpInputClass}
                placeholder="e.g. 60"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-slate-600">Rebate cap (SGD)</span>
              <input
                type="number"
                step="0.01"
                min={0}
                disabled={!rebateOn}
                value={rebateCap}
                onChange={(e) => setRebateCap(e.target.value)}
                className={fpInputClass}
                placeholder="e.g. 200"
              />
            </label>
          </div>
        </div>
      </details>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={isBusy} className={fpPrimaryButtonClass}>
          {submitting ? "Saving..." : "Save income tax inputs"}
        </button>
        {status ? (
          <span className="text-sm text-slate-600" role="status">
            {status}
          </span>
        ) : null}
      </div>
    </form>
  );
}

function FieldGroup({
  title,
  fields,
  values,
  onChange,
  defaultOpen = false,
  autoAppliedRows = [],
  autoAppliedHint = null,
}: {
  title: string;
  fields: FieldDef[];
  values: ReliefValues;
  onChange: (key: ReliefFieldKey, raw: string) => void;
  defaultOpen?: boolean;
  autoAppliedRows?: AutoAppliedRow[];
  autoAppliedHint?: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-slate-200/80 p-4"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <span className="inline-block text-slate-400 transition-transform group-open:rotate-90">
            ▸
          </span>
          {title}
        </span>
        {autoAppliedRows.length > 0 ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
            auto
          </span>
        ) : null}
      </summary>
      <div className="mt-3 space-y-3">
        {autoAppliedRows.length > 0 ? (
          <div className="space-y-2 rounded-lg bg-slate-50/80 p-3 ring-1 ring-slate-200/60">
            {autoAppliedRows.map((r) => (
              <div key={r.label} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-slate-700">
                    {r.label}
                  </span>
                  <span className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                    {formatCurrency(r.value)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">{r.caption}</p>
              </div>
            ))}
          </div>
        ) : null}
        {autoAppliedHint ? (
          <p className="rounded-lg bg-amber-50/80 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200/70">
            {autoAppliedHint}
          </p>
        ) : null}
        {fields.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <label key={f.key} className="block">
                <span className="block text-xs text-slate-600">
                  {f.label}{" "}
                  <span className="text-slate-400">(max {f.max.toLocaleString()})</span>
                </span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={f.max}
                  value={values[f.key]}
                  onChange={(e) => onChange(f.key, e.target.value)}
                  className={fpInputClass}
                  placeholder="0"
                />
              </label>
            ))}
          </div>
        ) : null}
      </div>
    </details>
  );
}
