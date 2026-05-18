"use client";

import { useActionState, useState } from "react";
import { createHousingPropertyAction } from "@/server/actions";
import { HDB_CONCESSIONARY_RATE_ANNUAL } from "@/domain/finance/housing-loan-quick";
import type { HousingPaymentSource } from "@/domain/finance/housing-loan-payments";
import { HousingPaymentSourceFields } from "@/features/goals/HousingPaymentSourceFields";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
const fieldClass = "w-full rounded border border-zinc-300 px-2 py-1.5";
const selectClass = fieldClass;

const initial = { error: null as string | null };

const PROPERTY_TYPES = [
  ["hdb", "HDB"],
  ["condo", "Condo"],
  ["ec", "EC"],
  ["landed", "Landed"],
  ["overseas", "Overseas"],
  ["other", "Other"],
] as const;

const PROPERTY_STATUSES = [
  ["living_in", "Living in"],
  ["renting_out", "Renting out"],
  ["under_construction", "Under construction"],
  ["fully_paid", "Fully paid"],
] as const;

export function PropertyAddForm({ currencyCode }: { currencyCode: string }) {
  const [state, action, pending] = useActionState(
    createHousingPropertyAction,
    initial
  );
  const [hasLoan, setHasLoan] = useState<"no" | "yes">("yes");
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
    paymentSource === "split" ? 0.5 : paymentSource === "cash" ? 0 : 1;

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5"
      {...(pending ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay active={pending} message="Saving property…" />
      <FormIntro
        title="Add property"
        subtitle="Capture what you own first. Add a linked mortgage only if you still have a loan."
      />
      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Property details
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-zinc-600">Property name</span>
            <input
              name="name"
              type="text"
              required
              className={fieldClass}
              placeholder="My home"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">Property type</span>
            <select name="property_type" className={selectClass} defaultValue="hdb">
              {PROPERTY_TYPES.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">Status</span>
            <select name="status" className={selectClass} defaultValue="living_in">
              {PROPERTY_STATUSES.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">
              Purchase price ({currencyCode}, optional)
            </span>
            <input
              name="purchase_price"
              type="number"
              min={0}
              step="0.01"
              className={fieldClass}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">
              Current valuation ({currencyCode}, optional)
            </span>
            <input
              name="current_valuation"
              type="number"
              min={0}
              step="0.01"
              className={fieldClass}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">Ownership %</span>
            <input
              name="ownership_percent"
              type="number"
              min={1}
              max={100}
              step={0.01}
              defaultValue={100}
              className={fieldClass}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">
              Rental income / month ({currencyCode}, optional)
            </span>
            <input
              name="rental_income_monthly"
              type="number"
              min={0}
              step="0.01"
              defaultValue={0}
              className={fieldClass}
            />
          </label>
        </div>
      </section>

      <section className="space-y-3 border-t border-zinc-100 pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Financing
        </h3>
        <p className="text-xs text-zinc-500">
          Does this property have a loan? We create the mortgage automatically — no
          separate linking step.
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["no", "No loan"],
              ["yes", "Yes, has a mortgage"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setHasLoan(v)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                hasLoan === v
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-300 bg-white text-zinc-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input type="hidden" name="has_loan" value={hasLoan} />

        {hasLoan === "yes" && (
          <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-zinc-100 bg-zinc-50/60 p-3">
            <input type="hidden" name="lender_type" value={lender} />
            <input type="hidden" name="annual_nominal_rate" value={String(annualEff)} />
            <input type="hidden" name="oa_share_of_payment" value={String(oaEff)} />
            <input type="hidden" name="payment_source" value={paymentSource} />

            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-zinc-600">Mortgage label (optional)</span>
              <input
                name="loan_label"
                type="text"
                className={fieldClass}
                placeholder="Same as property name"
              />
            </label>

            <LenderPicker
              lender={lender}
              setLender={setLender}
              bankPct={bankPct}
              setBankPct={setBankPct}
              otherRate={otherRate}
              setOtherRate={setOtherRate}
            />

            <div className="sm:col-span-2">
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
            </div>

            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-zinc-800">
                Outstanding principal ({currencyCode})
              </span>
              <input
                name="principal"
                type="number"
                min={0}
                step="0.01"
                required
                className={fieldClass}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-zinc-600">Remaining tenure (months)</span>
              <input
                name="term_months"
                type="number"
                min={1}
                max={600}
                required
                defaultValue={300}
                className={fieldClass}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-zinc-600">Completion month (OA lumps)</span>
              <input
                name="completion_month"
                type="text"
                required
                placeholder="YYYY-MM"
                className={`${fieldClass} font-mono text-xs`}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-zinc-600">First payment month</span>
              <input
                name="first_payment_month"
                type="text"
                required
                placeholder="YYYY-MM"
                className={`${fieldClass} font-mono text-xs`}
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
                defaultValue={0}
                className={fieldClass}
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
                className={fieldClass}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-zinc-600">Max OA / month (optional)</span>
              <input
                name="max_oa_per_month"
                type="number"
                min={0}
                step="0.01"
                className={fieldClass}
              />
            </label>
          </div>
        )}
      </section>

      <div className="flex justify-end border-t border-zinc-100 pt-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save property"}
        </button>
      </div>
    </form>
  );
}

function FormIntro({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
      <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
    </div>
  );
}

function LenderPicker({
  lender,
  setLender,
  bankPct,
  setBankPct,
  otherRate,
  setOtherRate,
}: {
  lender: "hdb" | "bank" | "other";
  setLender: (v: "hdb" | "bank" | "other") => void;
  bankPct: string;
  setBankPct: (v: string) => void;
  otherRate: string;
  setOtherRate: (v: string) => void;
}) {
  return (
    <div className="sm:col-span-2 text-sm">
      <span className="mb-1 block text-zinc-600">Lender</span>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["hdb", `HDB (${(HDB_CONCESSIONARY_RATE_ANNUAL * 100).toFixed(1)}%)`],
            ["bank", "Bank"],
            ["other", "Other"],
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
        <input
          type="number"
          min={0}
          max={20}
          step={0.05}
          value={bankPct}
          onChange={(e) => setBankPct(e.target.value)}
          className={`${fieldClass} mt-2 max-w-48`}
          aria-label="Bank rate percent"
        />
      )}
      {lender === "other" && (
        <input
          type="number"
          min={0}
          max={0.2}
          step={0.001}
          value={otherRate}
          onChange={(e) => setOtherRate(e.target.value)}
          className={`${fieldClass} mt-2 max-w-48`}
          aria-label="Other lender rate"
        />
      )}
    </div>
  );
}
