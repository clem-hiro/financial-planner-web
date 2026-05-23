"use client";

import { useActionState, useMemo, useState } from "react";
import { createHousingPropertyAction } from "@/server/actions";
import { HDB_CONCESSIONARY_RATE_ANNUAL } from "@/domain/finance/housing-loan-quick";
import type { HousingPaymentSource } from "@/domain/finance/housing-loan-payments";
import { buildAmortizationSchedule } from "@/domain/finance/mortgage-amortization";
import { computeSingaporeResidentialBuyersStampDuty } from "@/domain/finance/singapore-residential-bsd";
import { HousingPaymentSourceFields } from "@/features/goals/HousingPaymentSourceFields";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import { fpInputClass } from "@/ui/input-classes";
import { appCardClass } from "@/ui/surface-classes";
import { formatCurrency } from "@/ui/lib/format";

const initial = { error: null as string | null };
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

function monthlyInstalment(principal: number, annualRate: number, months: number) {
  if (principal <= 0 || months <= 0) return 0;
  return (
    buildAmortizationSchedule({
      principal,
      annualNominalRate: annualRate,
      termMonths: months,
      firstPaymentYearMonth: `${CURRENT_YEAR}-01`,
    })[0]?.totalPayment ?? 0
  );
}

export function PropertyAddForm({ currencyCode }: { currencyCode: string }) {
  const [state, action, pending] = useActionState(
    createHousingPropertyAction,
    initial
  );
  const [propertyType, setPropertyType] = useState<"bto" | "resale_hdb">("bto");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseYear, setPurchaseYear] = useState(String(CURRENT_YEAR));
  const [firstTotalTouched, setFirstTotalTouched] = useState(false);
  const [firstTotal, setFirstTotal] = useState("");
  const [firstCpfTouched, setFirstCpfTouched] = useState(false);
  const [firstCpf, setFirstCpf] = useState("");
  const [firstCash, setFirstCash] = useState("0");
  const [firstMonth, setFirstMonth] = useState(monthHint);
  const [bsdCpfTouched, setBsdCpfTouched] = useState(false);
  const [bsdCpf, setBsdCpf] = useState("");
  const [bsdCash, setBsdCash] = useState("0");
  const [bsdMonth, setBsdMonth] = useState(monthHint);
  const [secondTotal, setSecondTotal] = useState("0");
  const [secondCpfTouched, setSecondCpfTouched] = useState(false);
  const [secondCpf, setSecondCpf] = useState("0");
  const [secondCash, setSecondCash] = useState("0");
  const [secondMonth, setSecondMonth] = useState("");
  const [loanAmountTouched, setLoanAmountTouched] = useState(false);
  const [loanAmount, setLoanAmount] = useState("");
  const [termMonths, setTermMonths] = useState("300");
  const [firstPaymentMonth, setFirstPaymentMonth] = useState(currentYearMonth);
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
  const bsdLegalTotal = bsd.total + LEGAL_FEE_ESTIMATE;
  const effectiveFirstCpf = firstCpfTouched ? moneyValue(firstCpf) : effectiveFirstTotal;
  const effectiveBsdCpf = bsdCpfTouched ? moneyValue(bsdCpf) : bsdLegalTotal;
  const effectiveSecondCpf = secondCpfTouched
    ? moneyValue(secondCpf)
    : moneyValue(secondTotal);
  const derivedLoan = Math.max(
    0,
    pp - effectiveFirstTotal - moneyValue(secondTotal)
  );
  const effectiveLoanAmount = loanAmountTouched ? moneyValue(loanAmount) : derivedLoan;
  const monthlyTotal = monthlyInstalment(
    effectiveLoanAmount,
    HDB_CONCESSIONARY_RATE_ANNUAL,
    Math.round(moneyValue(termMonths))
  );
  const oaShare =
    paymentSource === "split" ? 0.5 : paymentSource === "cash" ? 0 : 1;

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
      <input type="hidden" name="lender_type" value="hdb" />
      <input
        type="hidden"
        name="annual_nominal_rate"
        value={String(HDB_CONCESSIONARY_RATE_ANNUAL)}
      />
      <input type="hidden" name="oa_share_of_payment" value={String(oaShare)} />
      <input type="hidden" name="payment_source" value={paymentSource} />
      <input type="hidden" name="principal" value={String(effectiveLoanAmount)} />
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
          Built for existing BTO and resale HDB homeowners first. Upfront CPF OA
          outflows are saved by paid month so CPF projections start accruing from
          the right point.
        </p>
      </div>

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
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
            onChange={(e) => {
              setPropertyType(e.target.value as "bto" | "resale_hdb");
              setFirstTotalTouched(false);
              setFirstCpfTouched(false);
              setLoanAmountTouched(false);
            }}
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
            }}
            className={fpInputClass}
          />
        </label>
      </section>

      <PaymentEvent
        title="1st downpayment / upfront payment"
        defaultHint={
          propertyType === "bto"
            ? "Auto-filled at 10% for BTO"
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
        title="BSD & legal fees"
        defaultHint={`BSD uses ${bsd.scheduleLabel}; legal fee estimate ${formatCurrency(
          LEGAL_FEE_ESTIMATE,
          currencyCode
        )}`}
        totalName="bsd_legal_total"
        total={String(Math.round(bsdLegalTotal))}
        setTotal={() => undefined}
        monthName="bsd_legal_paid_month"
        month={bsdMonth}
        setMonth={setBsdMonth}
        cpfName="bsd_legal_cpf_oa"
        cpf={bsdCpfTouched ? bsdCpf : String(Math.round(effectiveBsdCpf))}
        setCpf={(value) => {
          setBsdCpfTouched(true);
          setBsdCpf(value);
        }}
        cashName="bsd_legal_cash"
        cash={bsdCash}
        setCash={setBsdCash}
        currencyCode={currencyCode}
        readOnlyTotal
      />

      <PaymentEvent
        title="2nd downpayment"
        defaultHint="Usually applicable for BTO key collection; leave 0 if not relevant"
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
              Loan & monthly instalment
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              HDB concessionary rate is set to{" "}
              {(HDB_CONCESSIONARY_RATE_ANNUAL * 100).toFixed(1)}% p.a.
            </p>
          </div>
          <div className="text-right text-xs text-zinc-500">
            <p>Total original loan</p>
            <p className="text-base font-semibold text-zinc-900">
              {formatCurrency(effectiveLoanAmount, currencyCode)}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">
              Total original loan ({currencyCode})
            </span>
            <input
              type="number"
              min={1}
              step="0.01"
              value={loanAmountTouched ? loanAmount : Math.round(effectiveLoanAmount)}
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
            <span className="mb-1 block text-zinc-600">Starting date (YYYY-MM)</span>
            <input
              name="first_payment_month"
              type="text"
              required
              value={firstPaymentMonth}
              onChange={(e) => setFirstPaymentMonth(e.target.value)}
              className={`${fpInputClass} font-mono text-xs`}
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
          value={formatCurrency(bsd.total, currencyCode)}
        />
        <SummaryPill
          label="Monthly instalment"
          value={formatCurrency(monthlyTotal, currencyCode)}
        />
        <SummaryPill
          label="CPF upfront tracked"
          value={formatCurrency(
            effectiveFirstCpf + effectiveBsdCpf + effectiveSecondCpf,
            currencyCode
          )}
        />
      </div>

      <div className="flex justify-end border-t border-zinc-100 pt-3">
        <button
          type="submit"
          disabled={pending || effectiveLoanAmount <= 0}
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
  readOnlyTotal = false,
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
  readOnlyTotal?: boolean;
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
            readOnly={readOnlyTotal}
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
