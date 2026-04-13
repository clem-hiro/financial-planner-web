"use client";

import { useActionState, useMemo, useState } from "react";
import {
  DEFAULT_BANK_MORTGAGE_RATE_ANNUAL,
  deriveQuickHousingLoanRow,
  HDB_CONCESSIONARY_RATE_ANNUAL,
  oaInstalmentShareFromPreset,
} from "@/domain/finance/housing-loan-quick";
import { buildAmortizationSchedule } from "@/domain/finance/mortgage-amortization";
import { formatYearMonth } from "@/lib/dates";
import { createHousingLoanQuickAction } from "@/server/actions";
import { formatCurrency } from "@/ui/lib/format";

const initial = { error: null as string | null };

export function HousingLoanQuickAddForm({
  currencyCode,
}: {
  currencyCode: string;
}) {
  const [state, action] = useActionState(createHousingLoanQuickAction, initial);
  const [label, setLabel] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [depositTotal, setDepositTotal] = useState("");
  const [depositFromOa, setDepositFromOa] = useState("");
  const [feesFromOa, setFeesFromOa] = useState("");
  const [loanYears, setLoanYears] = useState("25");
  const [firstPay, setFirstPay] = useState(() => formatYearMonth(new Date()));
  const [lender, setLender] = useState<"hdb" | "bank">("hdb");
  const [bankRatePct, setBankRatePct] = useState(
    String(Math.round(DEFAULT_BANK_MORTGAGE_RATE_ANNUAL * 1000) / 10)
  );
  const [oaInstMode, setOaInstMode] = useState<"cpf100" | "split50" | "cash100">(
    "cpf100"
  );

  const bankDecimal =
    lender === "bank" && bankRatePct.trim() !== ""
      ? Number(bankRatePct) / 100
      : null;

  const preview = useMemo(() => {
    const pp = Number(purchasePrice);
    const dep = Number(depositTotal);
    const dOa = depositFromOa.trim() === "" ? 0 : Number(depositFromOa);
    const fOa = feesFromOa.trim() === "" ? 0 : Number(feesFromOa);
    const years = Number(loanYears);
    if (!Number.isFinite(pp) || pp <= 0) return null;
    if (!Number.isFinite(dep) || dep < 0) return null;
    if (!Number.isFinite(years) || years <= 0) return null;
    if (
      lender === "bank" &&
      bankRatePct.trim() !== "" &&
      !Number.isFinite(Number(bankRatePct))
    ) {
      return { kind: "bad_rate" as const };
    }

    const derived = deriveQuickHousingLoanRow({
      label: label.trim() || "Home loan",
      purchasePrice: pp,
      depositTotal: dep,
      depositFromOa: Number.isFinite(dOa) ? dOa : 0,
      feesFromOa: Number.isFinite(fOa) ? fOa : 0,
      loanTermYears: years,
      firstPaymentMonth: firstPay,
      lenderType: lender,
      bankAnnualRate: lender === "hdb" ? null : bankDecimal,
      oaShareOfPayment: oaInstalmentShareFromPreset(oaInstMode),
    });
    if (!derived.ok) {
      return { kind: "error" as const, message: derived.error };
    }
    const sched = buildAmortizationSchedule({
      principal: derived.principal,
      annualNominalRate: derived.annual_nominal_rate,
      termMonths: derived.term_months,
      firstPaymentYearMonth: derived.first_payment_month,
    });
    const first = sched[0];
    const monthlyTotal = first?.totalPayment ?? 0;
    return {
      kind: "ok" as const,
      derived,
      monthlyTotal,
      monthlyYourOa: monthlyTotal * derived.oa_share_of_payment,
    };
  }, [
    purchasePrice,
    depositTotal,
    depositFromOa,
    feesFromOa,
    loanYears,
    firstPay,
    lender,
    bankRatePct,
    bankDecimal,
    oaInstMode,
    label,
  ]);

  return (
    <form
      action={action}
      className="space-y-3 rounded-lg border border-teal-200/80 bg-teal-50/40 p-4"
    >
      <input type="hidden" name="oa_inst_share" value={oaInstMode} />
      <input type="hidden" name="lender_type" value={lender} />
      <h2 className="text-sm font-semibold text-zinc-900">
        Quick add (purchase, deposit, loan length)
      </h2>
      <p className="text-xs text-zinc-600">
        We estimate financed amount as <strong>price − deposit</strong>, apply a
        market-style fixed rate (HDB concessionary{" "}
        <strong>{(HDB_CONCESSIONARY_RATE_ANNUAL * 100).toFixed(1)}% p.a.</strong>
        ; bank defaults to an illustrative rate you can edit), build the same
        amortization the CPF chart uses. Choose how much of each instalment is
        paid from <strong>your OA</strong> — the rest is treated as cash and does
        not reduce OA in the projection.
      </p>
      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-zinc-600">Label (optional)</span>
          <input
            name="label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5"
            placeholder="Our flat"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Purchase / valuation price</span>
          <input
            name="purchase_price"
            type="number"
            min={0}
            step="0.01"
            required
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Total deposit (not borrowed)</span>
          <input
            name="deposit_total"
            type="number"
            min={0}
            step="0.01"
            required
            value={depositTotal}
            onChange={(e) => setDepositTotal(e.target.value)}
            className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Of that, from your OA (optional)</span>
          <input
            name="deposit_from_oa"
            type="number"
            min={0}
            step="0.01"
            value={depositFromOa}
            onChange={(e) => setDepositFromOa(e.target.value)}
            className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5"
            placeholder="0"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Fees from OA (optional)</span>
          <input
            name="fees_from_oa"
            type="number"
            min={0}
            step="0.01"
            value={feesFromOa}
            onChange={(e) => setFeesFromOa(e.target.value)}
            className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5"
            placeholder="0"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Loan length (years)</span>
          <input
            name="loan_term_years"
            type="number"
            min={1}
            max={50}
            step={1}
            required
            value={loanYears}
            onChange={(e) => setLoanYears(e.target.value)}
            className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">First repayment month</span>
          <input
            name="first_payment_month"
            type="text"
            required
            value={firstPay}
            onChange={(e) => setFirstPay(e.target.value)}
            className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs"
            placeholder="YYYY-MM"
          />
        </label>
        <div className="text-sm sm:col-span-2">
          <span className="mb-1 block text-zinc-600">Lender &amp; interest</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLender("hdb")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                lender === "hdb"
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-300 bg-white text-zinc-700"
              }`}
            >
              HDB ({(HDB_CONCESSIONARY_RATE_ANNUAL * 100).toFixed(1)}% p.a.)
            </button>
            <button
              type="button"
              onClick={() => setLender("bank")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                lender === "bank"
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-300 bg-white text-zinc-700"
              }`}
            >
              Bank (custom rate)
            </button>
          </div>
          {lender === "bank" && (
            <label className="mt-2 block">
              <span className="mb-1 block text-xs text-zinc-500">
                Nominal annual % (illustrative; use your LO)
              </span>
              <input
                name="bank_rate_percent"
                type="number"
                min={0}
                max={20}
                step={0.05}
                value={bankRatePct}
                onChange={(e) => setBankRatePct(e.target.value)}
                className="w-full max-w-[12rem] rounded border border-zinc-300 bg-white px-2 py-1.5"
              />
            </label>
          )}
        </div>

        <fieldset className="text-sm sm:col-span-2">
          <legend className="mb-1.5 text-zinc-600">
            Each instalment: how much from your OA (CPF)?
          </legend>
          <div className="flex flex-col gap-2">
            <label className="inline-flex cursor-pointer items-start gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2">
              <input
                type="radio"
                className="mt-0.5"
                checked={oaInstMode === "cpf100"}
                onChange={() => setOaInstMode("cpf100")}
              />
              <span>
                <strong>100% from OA</strong> — full instalment reduces OA in CPF
                projection.
              </span>
            </label>
            <label className="inline-flex cursor-pointer items-start gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2">
              <input
                type="radio"
                className="mt-0.5"
                checked={oaInstMode === "split50"}
                onChange={() => setOaInstMode("split50")}
              />
              <span>
                <strong>50% OA, 50% cash</strong> (or spouse pays their half in
                cash / their OA — not modeled) — half the instalment hits your OA.
              </span>
            </label>
            <label className="inline-flex cursor-pointer items-start gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2">
              <input
                type="radio"
                className="mt-0.5"
                checked={oaInstMode === "cash100"}
                onChange={() => setOaInstMode("cash100")}
              />
              <span>
                <strong>100% cash</strong> — instalments do not reduce OA; CPF
                projection ignores mortgage payments (OA lumps from downpayment /
                fees above still apply if you entered them).
              </span>
            </label>
          </div>
        </fieldset>
      </div>

      <div className="rounded-md border border-zinc-200 bg-white p-3 text-xs text-zinc-700">
        {!preview && <p className="text-zinc-500">Enter price and deposit for a preview.</p>}
        {preview?.kind === "bad_rate" && (
          <p className="text-amber-800">Enter a valid bank rate %.</p>
        )}
        {preview?.kind === "error" && (
          <p className="text-amber-800">{preview.message}</p>
        )}
        {preview?.kind === "ok" && (
          <ul className="space-y-1">
            <li>
              <strong>Financed amount:</strong>{" "}
              {formatCurrency(preview.derived.principal, currencyCode)}
            </li>
            <li>
              <strong>Rate:</strong>{" "}
              {(preview.derived.annual_nominal_rate * 100).toFixed(2)}% p.a. ·{" "}
              <strong>Term:</strong> {preview.derived.term_months} months
            </li>
            <li>
              <strong>Approx. monthly instalment (total):</strong>{" "}
              {formatCurrency(preview.monthlyTotal, currencyCode)}
            </li>
            <li>
              <strong>From your OA (first month):</strong>{" "}
              {formatCurrency(preview.monthlyYourOa, currencyCode)}
            </li>
            <li className="text-zinc-500">
              Completion month for OA lumps:{" "}
              <span className="font-mono">{preview.derived.completion_month}</span> ·
              First payment:{" "}
              <span className="font-mono">{preview.derived.first_payment_month}</span>
            </li>
          </ul>
        )}
      </div>

      <button
        type="submit"
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
      >
        Save quick loan
      </button>
    </form>
  );
}
