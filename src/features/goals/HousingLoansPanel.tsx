"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createHousingLoanAction,
  deleteHousingLoanAction,
  updateHousingLoanAction,
} from "@/server/actions";
import type { HousingLoanRow } from "@/data/supabase/types";
import { num } from "@/data/mappers";
import { formatCurrency } from "@/ui/lib/format";
import { HousingLoanQuickAddForm } from "@/features/goals/HousingLoanQuickAddForm";
import { HDB_CONCESSIONARY_RATE_ANNUAL } from "@/domain/finance/housing-loan-quick";

const initial = { error: null as string | null };

function lenderLabel(t: string): string {
  if (t === "hdb") return "HDB";
  if (t === "bank") return "Bank";
  return "Other";
}

function instalmentPresetFromShare(s: number): "cpf100" | "split50" | "cash100" | "custom" {
  if (Math.abs(s - 1) < 0.0001) return "cpf100";
  if (Math.abs(s - 0.5) < 0.0001) return "split50";
  if (s < 0.0001) return "cash100";
  return "custom";
}

function HousingLoanManualAddForm({
  formError,
  action,
}: {
  formError: string | null;
  action: (payload: FormData) => void;
}) {
  const [lender, setLender] = useState<"hdb" | "bank" | "other">("hdb");
  const [bankPct, setBankPct] = useState("3.2");
  const [otherRate, setOtherRate] = useState("0.032");
  const [inst, setInst] = useState<"cpf100" | "split50" | "cash100">("cpf100");

  const annualEff =
    lender === "hdb"
      ? HDB_CONCESSIONARY_RATE_ANNUAL
      : lender === "bank"
        ? Math.max(0, Number(bankPct) / 100 || 0)
        : Math.max(0, Number(otherRate) || 0);
  const oaEff = inst === "split50" ? 0.5 : inst === "cash100" ? 0 : 1;

  return (
    <form
      action={action}
      className="mt-3 space-y-3 rounded-lg border border-zinc-200 bg-white p-4"
    >
      <h2 className="text-sm font-semibold text-zinc-900">
        Add housing loan (manual)
      </h2>
      <p className="text-xs text-zinc-500">
        <strong>Outstanding principal</strong> is the balance when repayments
        start. <strong>HDB</strong> uses a fixed{" "}
        {(HDB_CONCESSIONARY_RATE_ANNUAL * 100).toFixed(1)}% p.a. in projections;{" "}
        <strong>bank</strong> uses the nominal % you enter (current / average
        repricing). Choose how much of each instalment comes from your OA for the
        CPF chart.
      </p>
      {formError && (
        <p className="text-sm text-red-600" role="alert">
          {formError}
        </p>
      )}
      <input type="hidden" name="lender_type" value={lender} />
      <input type="hidden" name="annual_nominal_rate" value={String(annualEff)} />
      <input type="hidden" name="oa_share_of_payment" value={String(oaEff)} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-zinc-600">Label</span>
          <input
            name="label"
            type="text"
            className="w-full rounded border border-zinc-300 px-2 py-1.5"
            placeholder="HDB concessionary loan"
          />
        </label>

        <div className="text-sm sm:col-span-2">
          <span className="mb-1 block text-zinc-600">Lender</span>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["hdb", `HDB (${(HDB_CONCESSIONARY_RATE_ANNUAL * 100).toFixed(1)}% fixed)`],
                ["bank", "Bank (you set rate %)"],
                ["other", "Other (decimal rate)"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setLender(v)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  lender === v
                    ? "bg-zinc-900 text-white"
                    : "border border-zinc-300 bg-white text-zinc-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {lender === "bank" && (
            <label className="mt-2 block text-xs">
              <span className="mb-1 block text-zinc-500">
                Nominal annual interest % (e.g. current / average repricing)
              </span>
              <input
                type="number"
                min={0}
                max={20}
                step={0.05}
                value={bankPct}
                onChange={(e) => setBankPct(e.target.value)}
                className="w-full max-w-48 rounded border border-zinc-300 px-2 py-1.5"
              />
            </label>
          )}
          {lender === "other" && (
            <label className="mt-2 block text-xs">
              <span className="mb-1 block text-zinc-500">
                Annual rate as decimal (e.g. 0.035 for 3.5%)
              </span>
              <input
                type="number"
                min={0}
                max={0.2}
                step={0.001}
                value={otherRate}
                onChange={(e) => setOtherRate(e.target.value)}
                className="w-full max-w-48 rounded border border-zinc-300 px-2 py-1.5"
              />
            </label>
          )}
        </div>

        <fieldset className="text-sm sm:col-span-2">
          <legend className="mb-1.5 text-zinc-600">
            Instalment: share from your OA (CPF projection)
          </legend>
          <div className="flex flex-col gap-2">
            <label className="inline-flex cursor-pointer items-start gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              <input
                type="radio"
                className="mt-0.5"
                checked={inst === "cpf100"}
                onChange={() => setInst("cpf100")}
              />
              <span>100% from OA</span>
            </label>
            <label className="inline-flex cursor-pointer items-start gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              <input
                type="radio"
                className="mt-0.5"
                checked={inst === "split50"}
                onChange={() => setInst("split50")}
              />
              <span>50% OA, 50% cash (or spouse — their OA not modeled)</span>
            </label>
            <label className="inline-flex cursor-pointer items-start gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              <input
                type="radio"
                className="mt-0.5"
                checked={inst === "cash100"}
                onChange={() => setInst("cash100")}
              />
              <span>
                100% cash — no instalment draw from OA (lumps above still apply)
              </span>
            </label>
          </div>
        </fieldset>

        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">
            Original loan (optional)
          </span>
          <input
            name="original_loan_principal"
            type="number"
            min={0}
            step="0.01"
            defaultValue=""
            className="w-full rounded border border-zinc-300 px-2 py-1.5"
            placeholder="Total facility if known"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-zinc-600">
            Principal repaid before schedule (optional)
          </span>
          <input
            name="principal_repaid_before_schedule"
            type="number"
            min={0}
            step="0.01"
            defaultValue="0"
            className="w-full rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-zinc-800">
            Outstanding principal
          </span>
          <input
            name="principal"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue=""
            className="w-full rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Remaining term (months)</span>
          <input
            name="term_months"
            type="number"
            min={1}
            max={600}
            required
            defaultValue={300}
            className="w-full rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Completion month (OA lumps)</span>
          <input
            name="completion_month"
            type="text"
            required
            className="w-full rounded border border-zinc-300 px-2 py-1.5 font-mono text-xs"
            placeholder="YYYY-MM"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-zinc-600">First payment month</span>
          <input
            name="first_payment_month"
            type="text"
            required
            className="w-full rounded border border-zinc-300 px-2 py-1.5 font-mono text-xs"
            placeholder="YYYY-MM"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Downpayment from OA</span>
          <input
            name="downpayment_from_oa"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue="0"
            className="w-full rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Fees from OA</span>
          <input
            name="fees_from_oa"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={0}
            className="w-full rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Max OA / month (optional)</span>
          <input
            name="max_oa_per_month"
            type="number"
            min={0}
            step="0.01"
            className="w-full rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Save loan
        </button>
      </div>
    </form>
  );
}

function HousingLoanEditForm({ L }: { L: HousingLoanRow }) {
  const [state, action] = useActionState(updateHousingLoanAction, initial);
  const initLender = (L.lender_type ?? "hdb") as "hdb" | "bank" | "other";
  const [lender, setLender] = useState<"hdb" | "bank" | "other">(initLender);
  const [bankPct, setBankPct] = useState(() =>
    initLender === "bank"
      ? String(Math.round(num(L.annual_nominal_rate) * 1000) / 10)
      : "3.2"
  );
  const [otherRate, setOtherRate] = useState(() =>
    initLender === "other" ? String(num(L.annual_nominal_rate)) : "0.032"
  );
  const [instPreset, setInstPreset] = useState(() =>
    instalmentPresetFromShare(num(L.oa_share_of_payment))
  );
  const [oaShare, setOaShare] = useState(() => num(L.oa_share_of_payment));

  useEffect(() => {
    const l = (L.lender_type ?? "hdb") as "hdb" | "bank" | "other";
    setLender(l);
    setBankPct(
      l === "bank"
        ? String(Math.round(num(L.annual_nominal_rate) * 1000) / 10)
        : "3.2"
    );
    setOtherRate(l === "other" ? String(num(L.annual_nominal_rate)) : "0.032");
    const s = num(L.oa_share_of_payment);
    setOaShare(s);
    setInstPreset(instalmentPresetFromShare(s));
  }, [
    L.id,
    L.lender_type,
    L.annual_nominal_rate,
    L.oa_share_of_payment,
  ]);

  const annualEff =
    lender === "hdb"
      ? HDB_CONCESSIONARY_RATE_ANNUAL
      : lender === "bank"
        ? Math.max(0, Number(bankPct) / 100 || 0)
        : Math.max(0, Number(otherRate) || 0);
  const oaEff =
    instPreset === "cpf100"
      ? 1
      : instPreset === "split50"
        ? 0.5
        : instPreset === "cash100"
          ? 0
          : oaShare;
  const maxOa =
    L.max_oa_per_month != null && String(L.max_oa_per_month).trim() !== ""
      ? num(L.max_oa_per_month)
      : null;
  const orig =
    L.original_loan_principal != null &&
    String(L.original_loan_principal).trim() !== ""
      ? num(L.original_loan_principal)
      : null;

  return (
    <details className="mt-2 w-full">
      <summary className="cursor-pointer text-xs font-medium text-zinc-700 hover:text-zinc-900">
        Edit loan
      </summary>
      <form
        action={action}
        className="mt-3 space-y-3 rounded border border-zinc-200 bg-white p-3"
      >
        <input type="hidden" name="id" value={L.id} />
        <input type="hidden" name="lender_type" value={lender} />
        <input type="hidden" name="annual_nominal_rate" value={String(annualEff)} />
        <input type="hidden" name="oa_share_of_payment" value={String(oaEff)} />
        {state.error && (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-zinc-600">Label</span>
            <input
              name="label"
              type="text"
              defaultValue={L.label}
              className="w-full rounded border border-zinc-300 px-2 py-1.5"
            />
          </label>
          <div className="text-sm sm:col-span-2">
            <span className="mb-1 block text-zinc-600">Lender &amp; rate</span>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["hdb", `HDB (${(HDB_CONCESSIONARY_RATE_ANNUAL * 100).toFixed(1)}% fixed)`],
                  ["bank", "Bank (% p.a.)"],
                  ["other", "Other (decimal)"],
                ] as const
              ).map(([v, lab]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setLender(v)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                    lender === v
                      ? "bg-zinc-900 text-white"
                      : "border border-zinc-300 bg-white text-zinc-700"
                  }`}
                >
                  {lab}
                </button>
              ))}
            </div>
            {lender === "hdb" && (
              <p className="mt-2 text-xs text-zinc-500">
                HDB concessionary rate is fixed at{" "}
                {(HDB_CONCESSIONARY_RATE_ANNUAL * 100).toFixed(1)}% p.a. for
                projections.
              </p>
            )}
            {lender === "bank" && (
              <label className="mt-2 block text-xs">
                <span className="mb-1 block text-zinc-500">
                  Nominal annual % (repricing / average)
                </span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  step={0.05}
                  value={bankPct}
                  onChange={(e) => setBankPct(e.target.value)}
                  className="w-full max-w-48 rounded border border-zinc-300 px-2 py-1.5"
                />
              </label>
            )}
            {lender === "other" && (
              <label className="mt-2 block text-xs">
                <span className="mb-1 block text-zinc-500">
                  Annual rate (decimal, e.g. 0.035)
                </span>
                <input
                  type="number"
                  min={0}
                  max={0.2}
                  step={0.001}
                  value={otherRate}
                  onChange={(e) => setOtherRate(e.target.value)}
                  className="w-full max-w-48 rounded border border-zinc-300 px-2 py-1.5"
                />
              </label>
            )}
          </div>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">
              Original loan (optional)
            </span>
            <input
              name="original_loan_principal"
              type="number"
              min={0}
              step="0.01"
              defaultValue={orig ?? ""}
              className="w-full rounded border border-zinc-300 px-2 py-1.5"
              placeholder="Total facility if known"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-zinc-600">
              Principal repaid before schedule (optional)
            </span>
            <input
              name="principal_repaid_before_schedule"
              type="number"
              min={0}
              step="0.01"
              defaultValue={num(L.principal_repaid_before_schedule)}
              className="w-full rounded border border-zinc-300 px-2 py-1.5"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-zinc-800">
              Outstanding principal (drives monthly payment math)
            </span>
            <input
              name="principal"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={num(L.principal)}
              className="w-full rounded border border-zinc-300 px-2 py-1.5"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">Remaining term (months)</span>
            <input
              name="term_months"
              type="number"
              min={1}
              max={600}
              required
              defaultValue={L.term_months}
              className="w-full rounded border border-zinc-300 px-2 py-1.5"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">Completion month (OA lumps)</span>
            <input
              name="completion_month"
              type="text"
              required
              defaultValue={L.completion_month}
              className="w-full rounded border border-zinc-300 px-2 py-1.5 font-mono text-xs"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-zinc-600">First payment month</span>
            <input
              name="first_payment_month"
              type="text"
              required
              defaultValue={L.first_payment_month}
              className="w-full rounded border border-zinc-300 px-2 py-1.5 font-mono text-xs"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">Downpayment from OA</span>
            <input
              name="downpayment_from_oa"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={num(L.downpayment_from_oa)}
              className="w-full rounded border border-zinc-300 px-2 py-1.5"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">Fees from OA</span>
            <input
              name="fees_from_oa"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={num(L.fees_from_oa)}
              className="w-full rounded border border-zinc-300 px-2 py-1.5"
            />
          </label>
          <fieldset className="text-sm sm:col-span-2">
            <legend className="mb-1.5 text-zinc-600">
              Instalment from your OA (CPF projection)
            </legend>
            <div className="flex flex-col gap-2">
              <label className="inline-flex cursor-pointer items-start gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
                <input
                  type="radio"
                  className="mt-0.5"
                  checked={instPreset === "cpf100"}
                  onChange={() => {
                    setInstPreset("cpf100");
                    setOaShare(1);
                  }}
                />
                <span>100% OA</span>
              </label>
              <label className="inline-flex cursor-pointer items-start gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
                <input
                  type="radio"
                  className="mt-0.5"
                  checked={instPreset === "split50"}
                  onChange={() => {
                    setInstPreset("split50");
                    setOaShare(0.5);
                  }}
                />
                <span>50% OA / 50% cash (or spouse — not modeled)</span>
              </label>
              <label className="inline-flex cursor-pointer items-start gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
                <input
                  type="radio"
                  className="mt-0.5"
                  checked={instPreset === "cash100"}
                  onChange={() => {
                    setInstPreset("cash100");
                    setOaShare(0);
                  }}
                />
                <span>100% cash — no OA instalment draw</span>
              </label>
              <label className="inline-flex cursor-pointer items-start gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
                <input
                  type="radio"
                  className="mt-0.5"
                  checked={instPreset === "custom"}
                  onChange={() => setInstPreset("custom")}
                />
                <span className="flex-1">
                  Custom OA fraction (0–1)
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={oaShare}
                    onChange={(e) => {
                      setInstPreset("custom");
                      const v = Number(e.target.value);
                      setOaShare(
                        Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0
                      );
                    }}
                    className="mt-1 block w-full max-w-40 rounded border border-zinc-300 px-2 py-1.5"
                  />
                </span>
              </label>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Spouse OA not modeled. OA lumps (downpayment/fees) still apply if set.
            </p>
          </fieldset>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-zinc-600">Max OA / month (optional)</span>
            <input
              name="max_oa_per_month"
              type="number"
              min={0}
              step="0.01"
              defaultValue={maxOa ?? ""}
              className="w-full rounded border border-zinc-300 px-2 py-1.5"
            />
          </label>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Update loan
          </button>
        </div>
      </form>
    </details>
  );
}

export function HousingLoansPanel({
  loans,
  currencyCode,
}: {
  loans: HousingLoanRow[];
  currencyCode: string;
}) {
  const [state, action] = useActionState(createHousingLoanAction, initial);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-200">
      <div className="p-4 sm:p-5">
        <HousingLoanQuickAddForm currencyCode={currencyCode} />
      </div>

      <div className="p-4 sm:p-5">
        <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-zinc-700 hover:text-zinc-900">
          Manual loan entry (edge cases)
        </summary>
        <p className="mt-2 text-xs text-zinc-500">
          Use when you already know outstanding principal, term, months, or
          principal repaid to date — same data as quick add, without the purchase
          price shortcut.
        </p>
          <HousingLoanManualAddForm formError={state.error} action={action} />
        </details>
      </div>

      {loans.length > 0 && (
        <div className="p-4 sm:p-5">
          <ul className="space-y-2 text-sm">
          {loans.map((L) => {
            const planningPrice =
              L.property_purchase_price != null &&
              String(L.property_purchase_price).trim() !== "";
            const presetLabel = (() => {
              const p = L.downpayment_guidance_preset;
              if (p === "pct_20") return "20% guidance";
              if (p === "pct_25") return "25% guidance";
              if (p === "custom") return "Custom downpayment";
              return null;
            })();
            const bsdSaved =
              L.buyers_stamp_duty != null && String(L.buyers_stamp_duty).trim() !== ""
                ? num(L.buyers_stamp_duty)
                : null;
            const incBsd = Boolean(L.financing_includes_bsd);
            const orig =
              L.original_loan_principal != null &&
              String(L.original_loan_principal).trim() !== ""
                ? num(L.original_loan_principal)
                : null;
            const repaid = num(L.principal_repaid_before_schedule);
            const lender = L.lender_type ?? "hdb";
            const oaShare = num(L.oa_share_of_payment);
            const oaPct = Math.round(oaShare * 1000) / 10;
            const oaInstalmentNote =
              oaShare < 0.0001
                ? "instalment from OA: none (cash)"
                : `your OA share of instalment ${oaPct}%`;
            return (
              <li
                key={L.id}
                className="rounded border border-zinc-100 bg-zinc-50/80 px-3 py-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-zinc-900">{L.label}</p>
                    <p className="text-xs text-zinc-600">
                      {lenderLabel(lender)} · outstanding{" "}
                      {formatCurrency(num(L.principal), currencyCode)} @{" "}
                      {(num(L.annual_nominal_rate) * 100).toFixed(2)}% ·{" "}
                      {L.term_months} mo left · {oaInstalmentNote} · completion{" "}
                      {L.completion_month} · first pay {L.first_payment_month}
                    </p>
                    {planningPrice && (
                      <p className="mt-1 text-xs text-emerald-900/90">
                        Planned purchase{" "}
                        {formatCurrency(
                          num(L.property_purchase_price ?? "0"),
                          currencyCode
                        )}
                        {presetLabel ? ` · ${presetLabel}` : ""}
                        {bsdSaved != null && (
                          <>
                            {" "}
                            · est. BSD {formatCurrency(bsdSaved, currencyCode)}
                          </>
                        )}
                        {bsdSaved != null && (
                          <span className="text-zinc-500">
                            {" "}
                            ({incBsd ? "included in loan" : "paid in cash / not in loan"})
                          </span>
                        )}
                        {L.property_kind ? (
                          <span className="text-zinc-500">
                            {" "}
                            · {L.property_kind.toUpperCase()}
                          </span>
                        ) : null}
                      </p>
                    )}
                    {(orig != null || repaid > 0) && (
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {orig != null && (
                          <>
                            Original facility {formatCurrency(orig, currencyCode)}
                            {repaid > 0 ? " · " : ""}
                          </>
                        )}
                        {repaid > 0 && (
                          <>
                            Principal repaid (recorded){" "}
                            {formatCurrency(repaid, currencyCode)}
                          </>
                        )}
                      </p>
                    )}
                  </div>
                  <form action={deleteHousingLoanAction} className="shrink-0">
                    <input type="hidden" name="id" value={L.id} />
                    <button
                      type="submit"
                      className="text-xs font-medium text-rose-700 hover:underline"
                    >
                      Delete
                    </button>
                  </form>
                </div>
                <HousingLoanEditForm L={L} />
              </li>
            );
          })}
          </ul>
        </div>
      )}
    </div>
  );
}
