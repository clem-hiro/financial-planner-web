"use client";

import { useActionState, useState } from "react";
import {
  createHousingLoanAction,
  deleteHousingLoanAction,
  updateHousingLoanAction,
} from "@/server/actions";
import type { HousingLoanRow, PropertyRow } from "@/data/supabase/types";
import { PropertyAddForm } from "@/features/housing/PropertyAddForm";
import { num } from "@/data/mappers";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import { formatCurrency } from "@/ui/lib/format";
import { HDB_CONCESSIONARY_RATE_ANNUAL } from "@/domain/finance/housing-loan-quick";
import {
  firstHousingInstalmentAmount,
  resolveHousingPaymentSource,
} from "@/domain/finance/housing-loan-payments";
import type { HousingPaymentSource } from "@/domain/finance/housing-loan-payments";
import { HousingPaymentSourceFields } from "@/features/goals/HousingPaymentSourceFields";

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
  pending,
  currencyCode,
}: {
  formError: string | null;
  action: (payload: FormData) => void;
  pending: boolean;
  currencyCode: string;
}) {
  const [lender, setLender] = useState<"hdb" | "bank" | "other">("hdb");
  const [bankPct, setBankPct] = useState("3.2");
  const [otherRate, setOtherRate] = useState("0.032");
  const [paymentSource, setPaymentSource] =
    useState<HousingPaymentSource>("cpf_oa");
  const [cpfOaPayment, setCpfOaPayment] = useState("");
  const [cashPayment, setCashPayment] = useState("");

  const annualEff =
    lender === "hdb"
      ? HDB_CONCESSIONARY_RATE_ANNUAL
      : lender === "bank"
        ? Math.max(0, Number(bankPct) / 100 || 0)
        : Math.max(0, Number(otherRate) || 0);
  const oaEff =
    paymentSource === "split"
      ? 0.5
      : paymentSource === "cash"
        ? 0
        : 1;

  return (
    <form
      action={action}
      className="mt-3 space-y-3 rounded-lg border border-zinc-200 bg-white p-4"
      {...(pending ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay active={pending} message="Saving mortgage…" />
      <h2 className="text-sm font-semibold text-zinc-900">
        Add mortgage (manual)
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
      <input type="hidden" name="payment_source" value={paymentSource} />

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

        <HousingPaymentSourceFields
          paymentSource={paymentSource}
          onPaymentSourceChange={setPaymentSource}
          monthlyInstalment={0}
          cpfOaPayment={cpfOaPayment}
          onCpfOaPaymentChange={setCpfOaPayment}
          cashPayment={cashPayment}
          onCashPaymentChange={setCashPayment}
          currencyCode={currencyCode}
          compact
        />

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

function HousingLoanEditForm({
  L,
  currencyCode,
}: {
  L: HousingLoanRow;
  currencyCode: string;
}) {
  const [state, action, pending] = useActionState(updateHousingLoanAction, initial);
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
  const [paymentSource, setPaymentSource] = useState<HousingPaymentSource>(() =>
    resolveHousingPaymentSource(L)
  );
  const [cpfOaPayment, setCpfOaPayment] = useState(() =>
    L.cpf_oa_payment != null && String(L.cpf_oa_payment).trim() !== ""
      ? String(num(L.cpf_oa_payment))
      : ""
  );
  const [cashPayment, setCashPayment] = useState(() =>
    L.cash_payment != null && String(L.cash_payment).trim() !== ""
      ? String(num(L.cash_payment))
      : ""
  );
  const [instPreset, setInstPreset] = useState(() =>
    instalmentPresetFromShare(num(L.oa_share_of_payment))
  );
  const [oaShare, setOaShare] = useState(() => num(L.oa_share_of_payment));

  // Reset-during-render: keep local state in sync when the loan being edited swaps to
  // another row (parent doesn't remount on id change). React-19 idiom — avoids the
  // setState-in-effect anti-pattern flagged by react-hooks/set-state-in-effect.
  const [lastSig, setLastSig] = useState(
    () => `${L.id}|${L.lender_type ?? ""}|${L.annual_nominal_rate ?? ""}|${L.oa_share_of_payment ?? ""}`
  );
  const sig = `${L.id}|${L.lender_type ?? ""}|${L.annual_nominal_rate ?? ""}|${L.oa_share_of_payment ?? ""}`;
  if (sig !== lastSig) {
    setLastSig(sig);
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
    setPaymentSource(resolveHousingPaymentSource(L));
    setCpfOaPayment(
      L.cpf_oa_payment != null && String(L.cpf_oa_payment).trim() !== ""
        ? String(num(L.cpf_oa_payment))
        : ""
    );
    setCashPayment(
      L.cash_payment != null && String(L.cash_payment).trim() !== ""
        ? String(num(L.cash_payment))
        : ""
    );
  }

  const annualEff =
    lender === "hdb"
      ? HDB_CONCESSIONARY_RATE_ANNUAL
      : lender === "bank"
        ? Math.max(0, Number(bankPct) / 100 || 0)
        : Math.max(0, Number(otherRate) || 0);
  const oaEff =
    paymentSource === "cpf_oa"
      ? 1
      : paymentSource === "cash"
        ? 0
        : paymentSource === "split"
          ? 0.5
          : instPreset === "cpf100"
            ? 1
            : instPreset === "split50"
              ? 0.5
              : instPreset === "cash100"
                ? 0
                : oaShare;
  const monthlyInstalmentEdit = firstHousingInstalmentAmount({
    principal: num(L.principal),
    annual_nominal_rate: annualEff,
    term_months: L.term_months,
    first_payment_month: L.first_payment_month,
  });
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
        {...(pending ? { inert: true } : {})}
      >
        <BlockingSubmitOverlay active={pending} message="Saving housing loan…" />
        <input type="hidden" name="id" value={L.id} />
        <input type="hidden" name="lender_type" value={lender} />
        <input type="hidden" name="annual_nominal_rate" value={String(annualEff)} />
        <input type="hidden" name="oa_share_of_payment" value={String(oaEff)} />
        <input type="hidden" name="payment_source" value={paymentSource} />
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
          <HousingPaymentSourceFields
            paymentSource={paymentSource}
            onPaymentSourceChange={setPaymentSource}
            monthlyInstalment={monthlyInstalmentEdit}
            cpfOaPayment={cpfOaPayment}
            onCpfOaPaymentChange={setCpfOaPayment}
            cashPayment={cashPayment}
            onCashPaymentChange={setCashPayment}
            currencyCode={currencyCode}
          />
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

function HousingLoanDeleteForm({ id }: { id: string }) {
  const [pending, setPending] = useState(false);

  return (
    <form
      className="shrink-0"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        deleteHousingLoanAction(new FormData(event.currentTarget)).finally(() =>
          setPending(false)
        );
      }}
      {...(pending ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay active={pending} message="Deleting mortgage…" />
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-medium text-rose-700 hover:underline"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
    </form>
  );
}

export function HousingPanel({
  loans,
  currencyCode,
}: {
  properties: PropertyRow[];
  loans: HousingLoanRow[];
  currencyCode: string;
}) {
  const [state, action, pending] = useActionState(createHousingLoanAction, initial);

  return (
    <div className="space-y-4">
      <PropertyAddForm currencyCode={currencyCode} />
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-200">
      <div className="p-4 sm:p-5">
        <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-zinc-700 hover:text-zinc-900">
          Manual mortgage entry (edge cases)
        </summary>
        <p className="mt-2 text-xs text-zinc-500">
          Use when you already know outstanding principal, term, months, or
          principal repaid to date — same data as quick add, without the purchase
          price shortcut.
        </p>
          <HousingLoanManualAddForm
            formError={state.error}
            action={action}
            pending={pending}
            currencyCode={currencyCode}
          />
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
            const bsdFromOa = Boolean(L.buyers_stamp_duty_paid_from_cpf_oa);
            const legacyBsdInLoan = Boolean(L.financing_includes_bsd);
            const orig =
              L.original_loan_principal != null &&
              String(L.original_loan_principal).trim() !== ""
                ? num(L.original_loan_principal)
                : null;
            const repaid = num(L.principal_repaid_before_schedule);
            const lender = L.lender_type ?? "hdb";
            const paymentLabel = (() => {
              const src = resolveHousingPaymentSource(L);
              if (src === "cpf_oa") return "Paid via CPF OA";
              if (src === "cash") return "Cash housing burden";
              return "Split (CPF OA + cash)";
            })();
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
                      {L.term_months} mo left · {paymentLabel} · completion{" "}
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
                            (
                            {bsdFromOa
                              ? "BSD from CPF OA"
                              : legacyBsdInLoan
                                ? "BSD was inside loan principal (legacy)"
                                : "BSD outside OA (e.g. cash)"}
                            )
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
                  <HousingLoanDeleteForm id={L.id} />
                </div>
                <HousingLoanEditForm L={L} currencyCode={currencyCode} />
              </li>
            );
          })}
          </ul>
        </div>
      )}
    </div>
    </div>
  );
}

/** @deprecated Use `HousingPanel` */
export function HousingLoansPanel(props: {
  loans: HousingLoanRow[];
  currencyCode: string;
  properties?: PropertyRow[];
}) {
  return (
    <HousingPanel
      properties={props.properties ?? []}
      loans={props.loans}
      currencyCode={props.currencyCode}
    />
  );
}
