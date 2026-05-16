"use client";

import { useActionState, useMemo, useState } from "react";
import {
  type HousingDownpaymentGuidancePreset,
  resolveGuidedCashDownpayment,
} from "@/domain/finance/property-financing-plan";
import {
  DEFAULT_BANK_MORTGAGE_RATE_ANNUAL,
  deriveQuickHousingLoanRow,
  HDB_CONCESSIONARY_RATE_ANNUAL,
  oaInstalmentShareFromPreset,
} from "@/domain/finance/housing-loan-quick";
import { buildAmortizationSchedule } from "@/domain/finance/mortgage-amortization";
import { computeSingaporeResidentialBuyersStampDuty } from "@/domain/finance/singapore-residential-bsd";
import { formatYearMonth } from "@/lib/dates";
import { createHousingLoanQuickAction } from "@/server/actions";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import { formatCurrency } from "@/ui/lib/format";

const initial = { error: null as string | null };

const PROPERTY_KIND_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "hdb", label: "HDB" },
  { value: "condo", label: "Private condo" },
  { value: "ec", label: "Executive condo (EC)" },
  { value: "landed", label: "Landed" },
] as const;

export function HousingLoanQuickAddForm({
  currencyCode,
}: {
  currencyCode: string;
}) {
  const [state, action, pending] = useActionState(createHousingLoanQuickAction, initial);
  const [label, setLabel] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [dpPreset, setDpPreset] = useState<HousingDownpaymentGuidancePreset>("pct_25");
  const [customDpMode, setCustomDpMode] = useState<"percent" | "amount">(
    "percent"
  );
  const [customDpPercent, setCustomDpPercent] = useState("30");
  const [customDpAmount, setCustomDpAmount] = useState("");
  /** BSD is always separate from the loan; this only affects CPF OA in projection. */
  const [bsdPayment, setBsdPayment] = useState<"cpf_oa" | "cash">("cpf_oa");
  const [propertyKind, setPropertyKind] = useState("");
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

  const pp = Number(purchasePrice);
  const bsdResult = useMemo(() => {
    if (!Number.isFinite(pp) || pp <= 0) {
      return { total: 0, bands: [] as ReturnType<typeof computeSingaporeResidentialBuyersStampDuty>["bands"] };
    }
    return computeSingaporeResidentialBuyersStampDuty(pp);
  }, [pp]);

  const depositResolution = useMemo(() => {
    if (!Number.isFinite(pp) || pp <= 0) return null;
    const pctField =
      customDpMode === "percent" && dpPreset === "custom"
        ? Number(customDpPercent) / 100
        : null;
    const amtField =
      customDpMode === "amount" && dpPreset === "custom"
        ? customDpAmount.trim() === ""
          ? null
          : Number(customDpAmount)
        : null;
    return resolveGuidedCashDownpayment({
      purchasePrice: pp,
      preset: dpPreset,
      customPercent: pctField,
      customAmount: amtField,
    });
  }, [pp, dpPreset, customDpMode, customDpPercent, customDpAmount]);

  const preview = useMemo(() => {
    if (!Number.isFinite(pp) || pp <= 0) return null;
    if (!depositResolution?.ok) {
      return depositResolution
        ? { kind: "error" as const, message: depositResolution.error }
        : null;
    }
    const depositTotal = depositResolution.depositTotal;
    const years = Number(loanYears);
    if (!Number.isFinite(years) || years <= 0) return null;
    if (
      lender === "bank" &&
      bankRatePct.trim() !== "" &&
      !Number.isFinite(Number(bankRatePct))
    ) {
      return { kind: "bad_rate" as const };
    }

    const dOa = depositFromOa.trim() === "" ? 0 : Number(depositFromOa);
    const fOa = feesFromOa.trim() === "" ? 0 : Number(feesFromOa);

    const derived = deriveQuickHousingLoanRow({
      label: label.trim() || "Home loan",
      purchasePrice: pp,
      depositTotal,
      depositFromOa: Number.isFinite(dOa) ? dOa : 0,
      feesFromOa: Number.isFinite(fOa) ? fOa : 0,
      loanTermYears: years,
      firstPaymentMonth: firstPay,
      lenderType: lender,
      bankAnnualRate: lender === "hdb" ? null : bankDecimal,
      oaShareOfPayment: oaInstalmentShareFromPreset(oaInstMode),
      buyersStampDuty: bsdResult.total,
      payBuyersStampDutyFromCpfOa: bsdPayment === "cpf_oa",
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
      depositTotal,
      monthlyTotal,
      monthlyYourOa: monthlyTotal * derived.oa_share_of_payment,
    };
  }, [
    pp,
    depositResolution,
    loanYears,
    firstPay,
    lender,
    bankRatePct,
    bankDecimal,
    oaInstMode,
    label,
    depositFromOa,
    feesFromOa,
    bsdResult.total,
    bsdPayment,
  ]);

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-emerald-200/70 bg-linear-to-br from-emerald-50/50 via-white to-white p-4 shadow-sm sm:p-5"
      {...(pending ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay active={pending} message="Saving property plan…" />
      <input type="hidden" name="oa_inst_share" value={oaInstMode} />
      <input type="hidden" name="lender_type" value={lender} />
      <input type="hidden" name="guided_dp_preset" value={dpPreset} />
      <input type="hidden" name="guided_dp_custom_mode" value={customDpMode} />
      <input type="hidden" name="guided_dp_custom_percent" value={customDpPercent} />
      <input type="hidden" name="guided_dp_custom_amount" value={customDpAmount} />
      <input type="hidden" name="bsd_payment" value={bsdPayment} />
      <input type="hidden" name="property_kind" value={propertyKind} />

      <div>
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">
          Property affordability planner
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-600">
          Start with a purchase price. We estimate your downpayment, Buyer&apos;s
          Stamp Duty (BSD, an extra upfront tax on top of the price), and loan size
          (price minus downpayment) — then run the same amortization the CPF
          projection uses. Figures are <strong>planning estimates</strong>, not
          bank offers.
        </p>
      </div>

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-zinc-800">Label (optional)</span>
          <input
            name="label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm"
            placeholder="Our next home"
          />
        </label>

        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-zinc-800">
            Purchase / valuation price
          </span>
          <input
            name="purchase_price"
            type="number"
            min={0}
            step="0.01"
            required
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm"
          />
        </label>

        <div className="text-sm sm:col-span-2">
          <span className="mb-2 block font-medium text-zinc-800">
            Downpayment (cash, not borrowed)
          </span>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["pct_25", "25%"],
                ["pct_20", "20%"],
                ["custom", "Custom"],
              ] as const
            ).map(([v, lab]) => (
              <button
                key={v}
                type="button"
                onClick={() => setDpPreset(v)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  dpPreset === v
                    ? "bg-emerald-800 text-white shadow"
                    : "border border-zinc-200 bg-white text-zinc-700 hover:border-emerald-300"
                }`}
              >
                {lab}
              </button>
            ))}
          </div>
          {dpPreset === "custom" && (
            <div className="mt-3 space-y-2 rounded-lg border border-zinc-100 bg-zinc-50/80 p-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCustomDpMode("percent")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    customDpMode === "percent"
                      ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200"
                      : "text-zinc-600"
                  }`}
                >
                  By %
                </button>
                <button
                  type="button"
                  onClick={() => setCustomDpMode("amount")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    customDpMode === "amount"
                      ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200"
                      : "text-zinc-600"
                  }`}
                >
                  By amount
                </button>
              </div>
              {customDpMode === "percent" ? (
                <label className="block text-xs">
                  <span className="mb-1 block text-zinc-500">Downpayment % of price</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={customDpPercent}
                    onChange={(e) => setCustomDpPercent(e.target.value)}
                    className="w-full max-w-40 rounded-lg border border-zinc-200 bg-white px-2 py-1.5"
                  />
                </label>
              ) : (
                <label className="block text-xs">
                  <span className="mb-1 block text-zinc-500">Downpayment amount</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={customDpAmount}
                    onChange={(e) => setCustomDpAmount(e.target.value)}
                    className="w-full max-w-48 rounded-lg border border-zinc-200 bg-white px-2 py-1.5"
                    placeholder="e.g. 200000"
                  />
                </label>
              )}
            </div>
          )}
        </div>

        <fieldset className="rounded-lg border border-zinc-100 bg-white/80 px-3 py-2.5 text-sm sm:col-span-2">
          <legend className="font-medium text-zinc-800">
            Estimated BSD: how do you pay it?
          </legend>
          <p className="mt-1 text-xs text-zinc-500">
            BSD is separate from the mortgage. The loan is always{" "}
            <span className="font-medium text-zinc-700">price − downpayment</span>.
            Choose whether we reduce your OA in the projection by the estimated BSD.
          </p>
          <div className="mt-2 flex flex-col gap-2">
            <label className="inline-flex cursor-pointer items-start gap-2 rounded-md border border-zinc-100 bg-zinc-50/80 px-2.5 py-2">
              <input
                type="radio"
                className="mt-0.5"
                name="bsd_payment_ui"
                checked={bsdPayment === "cpf_oa"}
                onChange={() => setBsdPayment("cpf_oa")}
              />
              <span className="text-xs">
                <strong>From CPF OA</strong> — typical for first-time buyers; we
                deduct the estimated BSD from OA in the completion month (same as
                other OA fees).
              </span>
            </label>
            <label className="inline-flex cursor-pointer items-start gap-2 rounded-md border border-zinc-100 bg-zinc-50/80 px-2.5 py-2">
              <input
                type="radio"
                className="mt-0.5"
                name="bsd_payment_ui"
                checked={bsdPayment === "cash"}
                onChange={() => setBsdPayment("cash")}
              />
              <span className="text-xs">
                <strong>Cash</strong> — we do not reduce OA for BSD (useful if you
                pay stamp duty outside CPF).
              </span>
            </label>
          </div>
        </fieldset>

        {Number.isFinite(pp) && pp > 0 && (
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-3">
            <div className="rounded-lg border border-emerald-100 bg-white p-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/90">
                Cash downpayment
              </p>
              <p className="mt-1 text-lg font-semibold text-zinc-900">
                {depositResolution?.ok
                  ? formatCurrency(depositResolution.depositTotal, currencyCode)
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-white p-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/90">
                Est. BSD
              </p>
              <p className="mt-1 text-lg font-semibold text-zinc-900">
                {formatCurrency(bsdResult.total, currencyCode)}
              </p>
              <details className="mt-1.5 text-[11px] text-zinc-600">
                <summary className="cursor-pointer font-medium text-emerald-800 hover:underline">
                  View breakdown
                </summary>
                <ul className="mt-2 space-y-1 border-t border-zinc-100 pt-2">
                  {bsdResult.bands.map((b, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="min-w-0 flex-1">{b.label}</span>
                      <span className="shrink-0 tabular-nums">
                        {(b.rate * 100).toFixed(0)}% on{" "}
                        {formatCurrency(b.taxableAmount, currencyCode)} →{" "}
                        {formatCurrency(b.duty, currencyCode)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[10px] text-zinc-400">
                  Singapore residential BSD tiers (IRAS). Rounded estimate only.
                </p>
              </details>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-white p-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/90">
                Est. loan
              </p>
              <p className="mt-1 text-lg font-semibold text-zinc-900">
                {preview?.kind === "ok"
                  ? formatCurrency(preview.derived.principal, currencyCode)
                  : "—"}
              </p>
              <p className="mt-1 text-[10px] text-zinc-500">Price − downpayment</p>
            </div>
          </div>
        )}
      </div>

      <details className="group rounded-lg border border-zinc-200 bg-zinc-50/50">
        <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-semibold text-zinc-800 marker:hidden [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600">
              Advanced
            </span>
            Loan, rates &amp; CPF usage
          </span>
        </summary>
        <div className="space-y-3 border-t border-zinc-200 bg-white px-3 py-3">
          <div className="grid gap-3 sm:grid-cols-2">
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
                className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
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
                className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 font-mono text-xs"
                placeholder="YYYY-MM"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-zinc-600">Property type (optional)</span>
              <select
                value={propertyKind}
                onChange={(e) => setPropertyKind(e.target.value)}
                className="w-full max-w-md rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm"
              >
                {PROPERTY_KIND_OPTIONS.map((o) => (
                  <option key={o.value === "" ? "unset" : o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-zinc-500">
                Used for future LTV and grant rules; does not change maths yet.
              </p>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-zinc-600">Of downpayment, from your OA</span>
              <input
                name="deposit_from_oa"
                type="number"
                min={0}
                step="0.01"
                value={depositFromOa}
                onChange={(e) => setDepositFromOa(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
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
                className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
                placeholder="0"
              />
              {bsdPayment === "cpf_oa" && Number.isFinite(pp) && pp > 0 && (
                <p className="mt-1 text-[11px] text-zinc-500">
                  Estimated BSD is added to this OA lump automatically when you pay BSD
                  from OA (do not type BSD here again).
                </p>
              )}
            </label>
          </div>

          <div className="text-sm">
            <span className="mb-1 block font-medium text-zinc-800">Lender &amp; interest</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setLender("hdb")}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  lender === "hdb"
                    ? "bg-zinc-900 text-white"
                    : "border border-zinc-200 bg-zinc-50 text-zinc-700"
                }`}
              >
                HDB ({(HDB_CONCESSIONARY_RATE_ANNUAL * 100).toFixed(1)}% p.a.)
              </button>
              <button
                type="button"
                onClick={() => setLender("bank")}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  lender === "bank"
                    ? "bg-zinc-900 text-white"
                    : "border border-zinc-200 bg-zinc-50 text-zinc-700"
                }`}
              >
                Bank (custom rate)
              </button>
            </div>
            {lender === "bank" && (
              <label className="mt-2 block text-xs">
                <span className="mb-1 block text-zinc-500">
                  Nominal annual % (illustrative; confirm with your LO)
                </span>
                <input
                  name="bank_rate_percent"
                  type="number"
                  min={0}
                  max={20}
                  step={0.05}
                  value={bankRatePct}
                  onChange={(e) => setBankRatePct(e.target.value)}
                  className="w-full max-w-48 rounded-lg border border-zinc-200 px-2 py-1.5"
                />
              </label>
            )}
          </div>

          <fieldset className="text-sm">
            <legend className="mb-2 font-medium text-zinc-800">
              Each instalment: share from your OA
            </legend>
            <div className="flex flex-col gap-2">
              <label className="inline-flex cursor-pointer items-start gap-2 rounded-md border border-zinc-100 bg-zinc-50/80 px-3 py-2">
                <input
                  type="radio"
                  className="mt-0.5"
                  checked={oaInstMode === "cpf100"}
                  onChange={() => setOaInstMode("cpf100")}
                />
                <span className="text-xs">
                  <strong>100% from OA</strong> — full instalment reduces OA in CPF
                  projection.
                </span>
              </label>
              <label className="inline-flex cursor-pointer items-start gap-2 rounded-md border border-zinc-100 bg-zinc-50/80 px-3 py-2">
                <input
                  type="radio"
                  className="mt-0.5"
                  checked={oaInstMode === "split50"}
                  onChange={() => setOaInstMode("split50")}
                />
                <span className="text-xs">
                  <strong>50% OA, 50% cash</strong> — half the instalment hits your OA.
                </span>
              </label>
              <label className="inline-flex cursor-pointer items-start gap-2 rounded-md border border-zinc-100 bg-zinc-50/80 px-3 py-2">
                <input
                  type="radio"
                  className="mt-0.5"
                  checked={oaInstMode === "cash100"}
                  onChange={() => setOaInstMode("cash100")}
                />
                <span className="text-xs">
                  <strong>100% cash</strong> — instalments do not reduce OA (OA lumps
                  above still apply).
                </span>
              </label>
            </div>
          </fieldset>

          <ul className="space-y-1 rounded-md border border-dashed border-amber-200/80 bg-amber-50/40 px-3 py-2 text-[11px] text-amber-950/90">
            <li>CPF OA usage modelling — deeper planning coming soon.</li>
            <li>ABSD planning — coming soon.</li>
            <li>Refinancing tools — coming soon.</li>
          </ul>
        </div>
      </details>

      <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-700">
        {!preview && (
          <p className="text-zinc-500">Enter a purchase price to see estimates.</p>
        )}
        {preview?.kind === "bad_rate" && (
          <p className="text-amber-800">Enter a valid bank rate %.</p>
        )}
        {preview?.kind === "error" && (
          <p className="text-amber-800">{preview.message}</p>
        )}
        {preview?.kind === "ok" && (
          <ul className="space-y-1.5">
            <li>
              <strong>Rate:</strong>{" "}
              {(preview.derived.annual_nominal_rate * 100).toFixed(2)}% p.a. ·{" "}
              <strong>Term:</strong> {preview.derived.term_months} months
            </li>
            <li>
              <strong>Estimated monthly instalment (total):</strong>{" "}
              {formatCurrency(preview.monthlyTotal, currencyCode)}
              <span className="ml-1 text-zinc-500">— estimated only</span>
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

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-950"
        >
          Save loan
        </button>
      </div>
    </form>
  );
}
