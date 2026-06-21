"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { createHousingPropertyAction } from "@/server/actions";
import {
  HDB_CONCESSIONARY_RATE_ANNUAL,
} from "@/domain/finance/housing-loan-quick";
import type { HousingPaymentSource } from "@/domain/finance/housing-loan-payments";
import { buildAmortizationSchedule } from "@/domain/finance/mortgage-amortization";
import { computeSingaporeResidentialBuyersStampDuty } from "@/domain/finance/singapore-residential-bsd";
import { HousingPaymentSourceFields } from "@/features/goals/HousingPaymentSourceFields";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import { fpInputClass } from "@/ui/input-classes";
import { appCardClass } from "@/ui/surface-classes";
import { formatCurrency } from "@/ui/lib/format";

const initial = { error: null as string | null, savedName: null as string | null };
const OPTION_FEE_DEFAULT_BTO = 2_000;
const LEGAL_FEE_ESTIMATE = 3_000;

const PROPERTY_TYPES = [
  ["bto", "BTO", false],
  ["resale_hdb", "Resale HDB", false],
  ["resale_ec_condo", "Resale EC/Condo", true],
  ["new_launch_ec_condo", "New Launch EC/Condo", true],
  ["landed", "Landed", true],
] as const;

const CURRENT_YEAR = new Date().getFullYear();

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function moneyValue(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function monthHint(): string {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getFullYear()
  ).slice(2)}`;
}

function monthlyInstalment(
  principal: number,
  annualRate: number,
  months: number
) {
  if (principal <= 0 || months <= 0 || annualRate < 0) return 0;
  return (
    buildAmortizationSchedule({
      principal,
      annualNominalRate: annualRate,
      termMonths: months,
      firstPaymentYearMonth: `${CURRENT_YEAR}-01`,
    })[0]?.totalPayment ?? 0
  );
}

function defaultOptionFee(propertyType: "bto" | "resale_hdb") {
  if (propertyType === "bto") {
    return {
      total: String(OPTION_FEE_DEFAULT_BTO),
      cpf: "0",
      cash: String(OPTION_FEE_DEFAULT_BTO),
    };
  }
  return { total: "0", cpf: "0", cash: "0" };
}

export function PropertyAddForm({ currencyCode }: { currencyCode: string }) {
  const router = useRouter();
  const wrappedCreate = async (
    prev: typeof initial,
    formData: FormData
  ): Promise<typeof initial> => {
    const res = await createHousingPropertyAction(prev, formData);
    if (res.error === null) {
      router.refresh();
      const savedName =
        String(formData.get("name") ?? "").trim() || "Property";
      return { error: null, savedName };
    }
    return { error: res.error, savedName: null };
  };
  const [state, action, pending] = useActionState(wrappedCreate, initial);
  const [propertyType, setPropertyType] = useState<"bto" | "resale_hdb">("bto");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseYear, setPurchaseYear] = useState(String(CURRENT_YEAR));
  const [firstTotalTouched, setFirstTotalTouched] = useState(false);
  const [firstTotal, setFirstTotal] = useState("");
  const [firstCpfTouched, setFirstCpfTouched] = useState(false);
  const [firstCpf, setFirstCpf] = useState("");
  const [firstCash, setFirstCash] = useState("0");
  const [firstMonth, setFirstMonth] = useState(monthHint);
  const [optionTotalTouched, setOptionTotalTouched] = useState(false);
  const [optionTotal, setOptionTotal] = useState(
    String(OPTION_FEE_DEFAULT_BTO)
  );
  const [optionCpf, setOptionCpf] = useState("0");
  const [optionCash, setOptionCash] = useState(String(OPTION_FEE_DEFAULT_BTO));
  const [optionMonth, setOptionMonth] = useState(monthHint);
  const [bsdTotalTouched, setBsdTotalTouched] = useState(false);
  const [bsdTotal, setBsdTotal] = useState("");
  const [bsdCpfTouched, setBsdCpfTouched] = useState(false);
  const [bsdCpf, setBsdCpf] = useState("");
  const [bsdCash, setBsdCash] = useState("0");
  const [bsdMonth, setBsdMonth] = useState(monthHint);
  const [legalTotalTouched, setLegalTotalTouched] = useState(false);
  const [legalTotal, setLegalTotal] = useState(String(LEGAL_FEE_ESTIMATE));
  const [legalCpfTouched, setLegalCpfTouched] = useState(false);
  const [legalCpf, setLegalCpf] = useState(String(LEGAL_FEE_ESTIMATE));
  const [legalCash, setLegalCash] = useState("0");
  const [legalMonth, setLegalMonth] = useState(monthHint);
  const [secondTotal, setSecondTotal] = useState("0");
  const [secondCpfTouched, setSecondCpfTouched] = useState(false);
  const [secondCpf, setSecondCpf] = useState("0");
  const [secondCash, setSecondCash] = useState("0");
  const [secondMonth, setSecondMonth] = useState("");
  const [loanAmountTouched, setLoanAmountTouched] = useState(false);
  const [loanAmount, setLoanAmount] = useState("");
  const [termMonths, setTermMonths] = useState("300");
  const [firstPaymentMonth, setFirstPaymentMonth] = useState(currentYearMonth);
  const [lenderType, setLenderType] = useState<"hdb" | "bank">("hdb");
  const [bankRatePct, setBankRatePct] = useState("");
  const [paymentSource, setPaymentSource] =
    useState<HousingPaymentSource>("cpf_oa");
  const [cpfOaPayment, setCpfOaPayment] = useState("");
  const [cashPayment, setCashPayment] = useState("");

  const pp = moneyValue(purchasePrice);
  const py = Number(purchaseYear);
  const firstDefault = pp * (propertyType === "bto" ? 0.1 : 0.25);
  const effectiveFirstTotal = firstTotalTouched ? moneyValue(firstTotal) : firstDefault;
  const bsd = useMemo(
    () =>
      computeSingaporeResidentialBuyersStampDuty(pp, {
        purchaseYear: Number.isFinite(py) ? py : null,
      }),
    [pp, py]
  );
  const effectiveBsdTotal = bsdTotalTouched ? moneyValue(bsdTotal) : bsd.total;
  const effectiveLegalTotal = legalTotalTouched
    ? moneyValue(legalTotal)
    : LEGAL_FEE_ESTIMATE;
  const effectiveFirstCpf = firstCpfTouched ? moneyValue(firstCpf) : effectiveFirstTotal;
  const effectiveBsdCpf = bsdCpfTouched ? moneyValue(bsdCpf) : effectiveBsdTotal;
  const effectiveLegalCpf = legalCpfTouched
    ? moneyValue(legalCpf)
    : effectiveLegalTotal;
  const effectiveSecondCpf = secondCpfTouched
    ? moneyValue(secondCpf)
    : moneyValue(secondTotal);
  const derivedLoan = Math.max(
    0,
    pp - effectiveFirstTotal - moneyValue(secondTotal)
  );
  const effectiveLoanAmount = loanAmountTouched ? moneyValue(loanAmount) : derivedLoan;
  const annualRate =
    lenderType === "hdb"
      ? HDB_CONCESSIONARY_RATE_ANNUAL
      : bankRatePct.trim() === ""
        ? NaN
        : Number(bankRatePct) / 100;
  const monthlyTotal = monthlyInstalment(
    effectiveLoanAmount,
    annualRate,
    Math.round(moneyValue(termMonths))
  );
  const oaShare =
    paymentSource === "split" ? 0.5 : paymentSource === "cash" ? 0 : 1;
  const bsdTierHint =
    pp > 0
      ? bsd.bands
          .map(
            (b) =>
              `${b.label}: ${(b.rate * 100).toFixed(0)}% on ${formatCurrency(
                b.taxableAmount,
                currencyCode
              )}`
          )
          .join(" · ")
      : "Enter purchase price to estimate BSD tiers (BTO stays under S$1M).";

  useEffect(() => {
    if (bsdTotalTouched) return;
    setBsdTotal(pp > 0 ? String(bsd.total) : "");
    if (!bsdCpfTouched) {
      setBsdCpf(pp > 0 ? String(bsd.total) : "");
    }
  }, [bsd.total, bsdCpfTouched, bsdTotalTouched, pp]);

  function onPropertyTypeChange(next: "bto" | "resale_hdb") {
    setPropertyType(next);
    setFirstTotalTouched(false);
    setFirstCpfTouched(false);
    setLoanAmountTouched(false);
    setOptionTotalTouched(false);
    const optionDefaults = defaultOptionFee(next);
    setOptionTotal(optionDefaults.total);
    setOptionCpf(optionDefaults.cpf);
    setOptionCash(optionDefaults.cash);
  }

  return (
    <form
      action={action}
      className={`${appCardClass} relative space-y-5 p-4 sm:p-5`}
      {...(pending ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay active={pending} message="Saving HDB home…" />
      <input type="hidden" name="has_loan" value="yes" />
      <input type="hidden" name="status" value="living_in" />
      <input type="hidden" name="current_valuation" value={purchasePrice} />
      <input type="hidden" name="ownership_percent" value="100" />
      <input type="hidden" name="rental_income_monthly" value="0" />
      <input type="hidden" name="lender_type" value={lenderType} />
      <input
        type="hidden"
        name="annual_nominal_rate"
        value={
          lenderType === "hdb"
            ? String(HDB_CONCESSIONARY_RATE_ANNUAL)
            : bankRatePct.trim() === ""
              ? ""
              : String(Number(bankRatePct) / 100)
        }
      />
      <input type="hidden" name="oa_share_of_payment" value={String(oaShare)} />
      <input type="hidden" name="payment_source" value={paymentSource} />
      <input
        type="hidden"
        name="original_loan_principal"
        value={String(effectiveLoanAmount)}
      />
      <input type="hidden" name="max_oa_per_month" value="" />
      <input type="hidden" name="principal_repaid_before_schedule" value="0" />

      <div>
        <h2 className="text-sm font-semibold text-zinc-900">Add HDB home</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Plan before key collection or refine after — every amount and date stays
          editable. CPF OA is deducted in the month you enter for each payment
          (option fee, BSD, legal, downpayments).
        </p>
      </div>

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.savedName && !state.error && (
        <p className="text-sm text-emerald-800" role="status">
          Saved {state.savedName}. It appears in Your homes below.
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-zinc-600">Name of property</span>
          <input
            name="name"
            type="text"
            required
            className={fpInputClass}
            placeholder="Tengah BTO"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Property type</span>
          <select
            name="property_type"
            value={propertyType}
            onChange={(e) =>
              onPropertyTypeChange(e.target.value as "bto" | "resale_hdb")
            }
            className={fpInputClass}
          >
            {PROPERTY_TYPES.map(([value, label, planned]) => (
              <option key={value} value={value} disabled={planned}>
                {planned ? `${label} (planned)` : label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Purchase year</span>
          <input
            name="purchase_year"
            type="number"
            min={1960}
            max={2100}
            required
            value={purchaseYear}
            onChange={(e) => setPurchaseYear(e.target.value)}
            className={fpInputClass}
          />
        </label>

        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-zinc-600">
            Purchase price ({currencyCode})
          </span>
          <input
            name="purchase_price"
            type="number"
            min={1}
            step="0.01"
            required
            value={purchasePrice}
            onChange={(e) => {
              setPurchasePrice(e.target.value);
              if (!firstTotalTouched) setFirstCpfTouched(false);
              if (!loanAmountTouched) setCpfOaPayment("");
              if (!bsdTotalTouched) setBsdCpfTouched(false);
            }}
            className={fpInputClass}
          />
        </label>
      </section>

      <PaymentEvent
        title="Option fee"
        defaultHint={`Default ${formatCurrency(
          OPTION_FEE_DEFAULT_BTO,
          currencyCode
        )} cash for BTO — adjust if your booking fee differs.`}
        totalName="option_fee_total"
        total={optionTotalTouched ? optionTotal : defaultOptionFee(propertyType).total}
        setTotal={(value) => {
          setOptionTotalTouched(true);
          setOptionTotal(value);
        }}
        monthName="option_fee_paid_month"
        month={optionMonth}
        setMonth={setOptionMonth}
        cpfName="option_fee_cpf_oa"
        cpf={optionCpf}
        setCpf={setOptionCpf}
        cashName="option_fee_cash"
        cash={optionCash}
        setCash={setOptionCash}
        currencyCode={currencyCode}
      />

      <PaymentEvent
        title="Buyer's stamp duty (BSD)"
        defaultHint={`${bsd.scheduleLabel}. ${bsdTierHint} Only you know your split with a co-owner — adjust CPF vs cash.`}
        totalName="bsd_total"
        total={
          bsdTotalTouched ? bsdTotal : pp > 0 ? String(bsd.total) : "0"
        }
        setTotal={(value) => {
          setBsdTotalTouched(true);
          setBsdTotal(value);
          if (!bsdCpfTouched) setBsdCpf(value);
        }}
        monthName="bsd_paid_month"
        month={bsdMonth}
        setMonth={setBsdMonth}
        cpfName="bsd_cpf_oa"
        cpf={
          bsdCpfTouched ? bsdCpf : pp > 0 ? String(Math.round(effectiveBsdCpf)) : "0"
        }
        setCpf={(value) => {
          setBsdCpfTouched(true);
          setBsdCpf(value);
        }}
        cashName="bsd_cash"
        cash={bsdCash}
        setCash={setBsdCash}
        currencyCode={currencyCode}
      />

      <PaymentEvent
        title="Legal fees"
        defaultHint={`Estimate ${formatCurrency(
          LEGAL_FEE_ESTIMATE,
          currencyCode
        )} — confirm with your solicitor or bank panel. Split CPF vs cash to match your arrangement.`}
        totalName="legal_fee_total"
        total={
          legalTotalTouched ? legalTotal : String(LEGAL_FEE_ESTIMATE)
        }
        setTotal={(value) => {
          setLegalTotalTouched(true);
          setLegalTotal(value);
          if (!legalCpfTouched) setLegalCpf(value);
        }}
        monthName="legal_fee_paid_month"
        month={legalMonth}
        setMonth={setLegalMonth}
        cpfName="legal_fee_cpf_oa"
        cpf={
          legalCpfTouched
            ? legalCpf
            : String(Math.round(effectiveLegalTotal))
        }
        setCpf={(value) => {
          setLegalCpfTouched(true);
          setLegalCpf(value);
        }}
        cashName="legal_fee_cash"
        cash={legalCash}
        setCash={setLegalCash}
        currencyCode={currencyCode}
      />

      <PaymentEvent
        title="1st downpayment / upfront payment"
        defaultHint={
          propertyType === "bto"
            ? "Auto-filled at 10% for BTO — usually at signing after balloting"
            : "Auto-filled at 25% for resale HDB"
        }
        totalName="first_downpayment_total"
        total={firstTotalTouched ? firstTotal : String(Math.round(effectiveFirstTotal))}
        setTotal={(value) => {
          setFirstTotalTouched(true);
          setFirstTotal(value);
          if (!firstCpfTouched) setFirstCpf(value);
          setLoanAmountTouched(false);
        }}
        monthName="first_downpayment_paid_month"
        month={firstMonth}
        setMonth={setFirstMonth}
        cpfName="first_downpayment_cpf_oa"
        cpf={firstCpfTouched ? firstCpf : String(Math.round(effectiveFirstCpf))}
        setCpf={(value) => {
          setFirstCpfTouched(true);
          setFirstCpf(value);
        }}
        cashName="first_downpayment_cash"
        cash={firstCash}
        setCash={setFirstCash}
        currencyCode={currencyCode}
      />

      <PaymentEvent
        title="2nd downpayment"
        defaultHint="Usually at BTO key collection — leave 0 if not applicable yet"
        totalName="second_downpayment_total"
        total={secondTotal}
        setTotal={(value) => {
          setSecondTotal(value);
          if (!secondCpfTouched) setSecondCpf(value);
          setLoanAmountTouched(false);
        }}
        monthName="second_downpayment_paid_month"
        month={secondMonth}
        setMonth={setSecondMonth}
        cpfName="second_downpayment_cpf_oa"
        cpf={secondCpfTouched ? secondCpf : String(Math.round(effectiveSecondCpf))}
        setCpf={(value) => {
          setSecondCpfTouched(true);
          setSecondCpf(value);
        }}
        cashName="second_downpayment_cash"
        cash={secondCash}
        setCash={setSecondCash}
        currencyCode={currencyCode}
      />

      <section className="space-y-3 border-t border-zinc-100 pt-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Remaining loan amount & monthly instalment
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              Loan = purchase price minus downpayments (BSD, legal, and option fee
              stay outside the facility).
            </p>
          </div>
          <div className="text-right text-xs text-zinc-500">
            <p>Remaining loan</p>
            <p className="text-base font-semibold text-zinc-900">
              {formatCurrency(effectiveLoanAmount, currencyCode)}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">Lender</span>
            <select
              value={lenderType}
              onChange={(e) =>
                setLenderType(e.target.value as "hdb" | "bank")
              }
              className={fpInputClass}
            >
              <option value="hdb">
                HDB loan ({(HDB_CONCESSIONARY_RATE_ANNUAL * 100).toFixed(1)}% p.a.)
              </option>
              <option value="bank">Bank loan</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">
              {lenderType === "hdb"
                ? "Interest rate (fixed default)"
                : "Bank interest rate (% p.a.)"}
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              readOnly={lenderType === "hdb"}
              value={
                lenderType === "hdb"
                  ? (HDB_CONCESSIONARY_RATE_ANNUAL * 100).toFixed(1)
                  : bankRatePct
              }
              onChange={(e) => setBankRatePct(e.target.value)}
              placeholder={lenderType === "bank" ? "Enter your bank rate" : undefined}
              className={fpInputClass}
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">
              Total original loan ({currencyCode})
            </span>
            <input
              name="principal"
              type="number"
              min={1}
              step="0.01"
              value={
                loanAmountTouched ? loanAmount : Math.round(effectiveLoanAmount)
              }
              onChange={(e) => {
                setLoanAmountTouched(true);
                setLoanAmount(e.target.value);
              }}
              className={fpInputClass}
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
              value={termMonths}
              onChange={(e) => setTermMonths(e.target.value)}
              className={fpInputClass}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">First instalment (YYYY-MM)</span>
            <input
              name="first_payment_month"
              type="text"
              required
              value={firstPaymentMonth}
              onChange={(e) => setFirstPaymentMonth(e.target.value)}
              className={`${fpInputClass} font-mono text-xs`}
              placeholder="2027-07"
            />
          </label>
        </div>

        <input type="hidden" name="completion_month" value="" />
        <input type="hidden" name="loan_label" value="" />

        <div className="rounded-md border border-zinc-100 bg-zinc-50 p-3">
          <HousingPaymentSourceFields
            paymentSource={paymentSource}
            onPaymentSourceChange={setPaymentSource}
            monthlyInstalment={monthlyTotal}
            cpfOaPayment={cpfOaPayment}
            onCpfOaPaymentChange={setCpfOaPayment}
            cashPayment={cashPayment}
            onCashPaymentChange={setCashPayment}
            currencyCode={currencyCode}
            compact
          />
        </div>
      </section>

      <div className="grid gap-2 rounded-md border border-zinc-100 bg-zinc-50 p-3 text-xs text-zinc-600 sm:grid-cols-3">
        <SummaryPill
          label="Estimated BSD"
          value={formatCurrency(effectiveBsdTotal, currencyCode)}
        />
        <SummaryPill
          label="Monthly instalment"
          value={
            lenderType === "bank" && bankRatePct.trim() === ""
              ? "Enter bank rate"
              : formatCurrency(monthlyTotal, currencyCode)
          }
        />
        <SummaryPill
          label="CPF OA upfront tracked"
          value={formatCurrency(
            moneyValue(optionCpf) +
              effectiveBsdCpf +
              effectiveLegalCpf +
              effectiveFirstCpf +
              effectiveSecondCpf,
            currencyCode
          )}
        />
      </div>

      <div className="flex justify-end border-t border-zinc-100 pt-3">
        <button
          type="submit"
          disabled={
            pending ||
            effectiveLoanAmount <= 0 ||
            (lenderType === "bank" && bankRatePct.trim() === "")
          }
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save HDB home"}
        </button>
      </div>
    </form>
  );
}

function PaymentEvent({
  title,
  defaultHint,
  totalName,
  total,
  setTotal,
  monthName,
  month,
  setMonth,
  cpfName,
  cpf,
  setCpf,
  cashName,
  cash,
  setCash,
  currencyCode,
}: {
  title: string;
  defaultHint: string;
  totalName: string;
  total: string;
  setTotal: (value: string) => void;
  monthName: string;
  month: string;
  setMonth: (value: string) => void;
  cpfName: string;
  cpf: string;
  setCpf: (value: string) => void;
  cashName: string;
  cash: string;
  setCash: (value: string) => void;
  currencyCode: string;
}) {
  return (
    <section className="space-y-3 border-t border-zinc-100 pt-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {title}
        </h3>
        <p className="mt-1 text-xs text-zinc-500">{defaultHint}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">
            Total paid ({currencyCode})
          </span>
          <input
            name={totalName}
            type="number"
            min={0}
            step="0.01"
            required
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            className={fpInputClass}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Date paid (MMYY)</span>
          <input
            name={monthName}
            type="text"
            inputMode="numeric"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className={`${fpInputClass} font-mono text-xs`}
            placeholder="MMYY"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Using CPF OA</span>
          <input
            name={cpfName}
            type="number"
            min={0}
            step="0.01"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            className={fpInputClass}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Using cash</span>
          <input
            name={cashName}
            type="number"
            min={0}
            step="0.01"
            value={cash}
            onChange={(e) => setCash(e.target.value)}
            className={fpInputClass}
          />
        </label>
      </div>
    </section>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-medium text-zinc-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
