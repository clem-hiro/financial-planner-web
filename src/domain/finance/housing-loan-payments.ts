import { buildAmortizationSchedule } from "./mortgage-amortization";

export type HousingPaymentSource = "cash" | "cpf_oa" | "split";

export type HousingLoanPaymentFields = {
  payment_source?: string | null;
  oa_share_of_payment: string | number;
  cpf_oa_payment?: string | number | null;
  cash_payment?: string | number | null;
  principal: string | number;
  annual_nominal_rate: string | number;
  term_months: number;
  first_payment_month: string;
  max_oa_per_month?: string | number | null;
};

export type HousingInstalmentSplit = {
  paymentSource: HousingPaymentSource;
  monthlyInstalment: number;
  cashPayment: number;
  cpfOaPayment: number;
  /** Fraction of instalment from OA for CPF projection (0–1). */
  oaShareForCpf: number;
};

function parseAmount(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }
  const t = String(raw).trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseShare(raw: string | number): number {
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0, n));
}

export function resolveHousingPaymentSourceExplicit(
  row: Pick<HousingLoanPaymentFields, "payment_source">
): HousingPaymentSource | null {
  const ps = row.payment_source;
  if (ps === "cash" || ps === "cpf_oa" || ps === "split") return ps;
  return null;
}

/**
 * Cash-flow path: legacy rows without `payment_source` default to full cash
 * instalment (per product requirement).
 */
export function resolveHousingPaymentSourceForCash(
  row: Pick<HousingLoanPaymentFields, "payment_source" | "oa_share_of_payment">
): HousingPaymentSource {
  const explicit = resolveHousingPaymentSourceExplicit(row);
  if (explicit != null) return explicit;
  return "cash";
}

/**
 * UI / display: infer preset from stored fields (explicit source or legacy share).
 */
export function resolveHousingPaymentSource(
  row: Pick<HousingLoanPaymentFields, "payment_source" | "oa_share_of_payment">
): HousingPaymentSource {
  const explicit = resolveHousingPaymentSourceExplicit(row);
  if (explicit != null) return explicit;

  const share = parseShare(row.oa_share_of_payment);
  if (share >= 0.999) return "cpf_oa";
  if (share <= 0.001) return "cash";
  return "split";
}

export function firstHousingInstalmentAmount(
  row: Pick<
    HousingLoanPaymentFields,
    | "principal"
    | "annual_nominal_rate"
    | "term_months"
    | "first_payment_month"
  >
): number {
  const principal = parseAmount(row.principal) ?? 0;
  const rate = parseAmount(row.annual_nominal_rate) ?? 0;
  const termMonths = row.term_months;
  if (principal <= 0 || termMonths <= 0) return 0;
  const sched = buildAmortizationSchedule({
    principal,
    annualNominalRate: rate,
    termMonths,
    firstPaymentYearMonth: row.first_payment_month,
  });
  return sched[0]?.totalPayment ?? 0;
}

export function housingInstalmentForMonth(
  row: Pick<
    HousingLoanPaymentFields,
    | "principal"
    | "annual_nominal_rate"
    | "term_months"
    | "first_payment_month"
  >,
  yearMonth: string
): number {
  const principal = parseAmount(row.principal) ?? 0;
  const rate = parseAmount(row.annual_nominal_rate) ?? 0;
  if (principal <= 0 || row.term_months <= 0) return 0;
  const sched = buildAmortizationSchedule({
    principal,
    annualNominalRate: rate,
    termMonths: row.term_months,
    firstPaymentYearMonth: row.first_payment_month,
  });
  const hit = sched.find((p) => p.yearMonth === yearMonth);
  return hit?.totalPayment ?? 0;
}

/**
 * Splits a monthly instalment into cash vs CPF OA portions and derives the OA
 * share used by `buildCpfMonthlyProjectionSeries`.
 */
export function splitHousingInstalment(
  row: HousingLoanPaymentFields,
  monthlyInstalment: number
): HousingInstalmentSplit {
  const paymentSource = resolveHousingPaymentSourceForCash(row);
  const instalment = Math.max(0, monthlyInstalment);

  if (paymentSource === "cash") {
    return {
      paymentSource,
      monthlyInstalment: instalment,
      cashPayment: instalment,
      cpfOaPayment: 0,
      oaShareForCpf: 0,
    };
  }

  if (paymentSource === "cpf_oa") {
    return {
      paymentSource,
      monthlyInstalment: instalment,
      cashPayment: 0,
      cpfOaPayment: instalment,
      oaShareForCpf: instalment > 0 ? 1 : 0,
    };
  }

  const storedCpf = parseAmount(row.cpf_oa_payment);
  const storedCash = parseAmount(row.cash_payment);

  let cpfOa = storedCpf;
  let cash = storedCash;

  if (cpfOa != null && cash == null) {
    cash = Math.max(0, instalment - cpfOa);
  } else if (cash != null && cpfOa == null) {
    cpfOa = Math.max(0, instalment - cash);
  } else if (cpfOa == null && cash == null) {
    const share = parseShare(row.oa_share_of_payment);
    cpfOa = instalment * share;
    cash = instalment - cpfOa;
  }

  cpfOa = Math.min(Math.max(0, cpfOa ?? 0), instalment);
  cash = Math.min(Math.max(0, cash ?? 0), instalment);

  const sum = cpfOa + cash;
  if (sum > instalment + 1e-6) {
    const scale = instalment / sum;
    cpfOa *= scale;
    cash *= scale;
  } else if (sum < instalment - 1e-6) {
    cash += instalment - sum;
  }

  return {
    paymentSource,
    monthlyInstalment: instalment,
    cashPayment: cash,
    cpfOaPayment: cpfOa,
    oaShareForCpf: instalment > 0 ? cpfOa / instalment : 0,
  };
}

export function oaShareForCpfProjection(row: HousingLoanPaymentFields): number {
  const explicit = resolveHousingPaymentSourceExplicit(row);
  if (explicit != null) {
    const instalment = firstHousingInstalmentAmount(row);
    return splitHousingInstalment(row, instalment).oaShareForCpf;
  }
  return parseShare(row.oa_share_of_payment);
}

export function sumHousingCashInstalmentsForMonth(
  loans: HousingLoanPaymentFields[],
  yearMonth: string
): number {
  let total = 0;
  for (const loan of loans) {
    const due = housingInstalmentForMonth(loan, yearMonth);
    if (due <= 0) continue;
    total += splitHousingInstalment(loan, due).cashPayment;
  }
  return total;
}

export function paymentSourceFromLegacyPreset(
  preset: string
): HousingPaymentSource {
  const t = preset.trim().toLowerCase();
  if (t === "cash100" || t === "cash") return "cash";
  if (t === "split50" || t === "half" || t === "split") return "split";
  return "cpf_oa";
}

/** Persisted `oa_share_of_payment` kept in sync with payment_source on save. */
export function oaShareForStoredHousingLoan(
  row: HousingLoanPaymentFields,
  monthlyInstalment?: number
): number {
  const instalment =
    monthlyInstalment ?? firstHousingInstalmentAmount(row);
  return splitHousingInstalment(row, instalment).oaShareForCpf;
}

export function buildHousingPaymentInsights(
  loans: HousingLoanPaymentFields[],
  yearMonth: string,
  currencyCode: string
): string[] {
  const insights: string[] = [];
  let cashBurden = 0;
  let cpfFunded = 0;
  let cpfOnlyCount = 0;

  for (const loan of loans) {
    const due = housingInstalmentForMonth(loan, yearMonth);
    if (due <= 0) continue;
    const explicit = resolveHousingPaymentSourceExplicit(loan);
    if (explicit != null) {
      const split = splitHousingInstalment(loan, due);
      cashBurden += split.cashPayment;
      cpfFunded += split.cpfOaPayment;
      if (explicit === "cpf_oa" && split.cpfOaPayment > 0) {
        cpfOnlyCount += 1;
      }
    } else {
      const share = parseShare(loan.oa_share_of_payment);
      cashBurden += due;
      cpfFunded += due * share;
      if (share >= 0.999) cpfOnlyCount += 1;
    }
  }

  if (cashBurden > 0) {
    insights.push(
      `Cash housing burden: ${formatInsightMoney(cashBurden, currencyCode)} this month from loan schedules (cash portion only).`
    );
  }
  if (cpfFunded > 0) {
    insights.push(
      `CPF-funded housing: ${formatInsightMoney(cpfFunded, currencyCode)} from OA this month in your CPF projection.`
    );
  }
  if (cpfOnlyCount > 0) {
    insights.push(
      cpfOnlyCount === 1
        ? "Paid via CPF OA — one housing loan has no cash instalment in this month's budget."
        : `Paid via CPF OA — ${cpfOnlyCount} housing loans have no cash instalment in this month's budget.`
    );
  }

  return insights;
}

export type NormalizedHousingPaymentPersist = {
  payment_source: HousingPaymentSource;
  cpf_oa_payment: number | null;
  cash_payment: number | null;
  oa_share_of_payment: number;
};

/**
 * Validates and normalizes payment fields for insert/update.
 */
export function normalizeHousingPaymentForPersist(
  row: HousingLoanPaymentFields,
  input: {
    paymentSource: HousingPaymentSource;
    cpfOaPayment: number | null;
    cashPayment: number | null;
  }
): NormalizedHousingPaymentPersist | { error: string } {
  const instalment = firstHousingInstalmentAmount(row);
  const draft: HousingLoanPaymentFields = {
    ...row,
    payment_source: input.paymentSource,
    cpf_oa_payment: input.cpfOaPayment,
    cash_payment: input.cashPayment,
  };
  const split = splitHousingInstalment(draft, instalment);

  if (input.paymentSource === "split") {
    if (instalment <= 0) {
      return { error: "Cannot set split payment without a valid instalment" };
    }
    const sum = split.cashPayment + split.cpfOaPayment;
    if (Math.abs(sum - instalment) > 0.02) {
      return {
        error: "CPF OA and cash portions must add up to the monthly instalment",
      };
    }
    if (split.cpfOaPayment < 0 || split.cashPayment < 0) {
      return { error: "Payment portions must be ≥ 0" };
    }
  }

  return {
    payment_source: input.paymentSource,
    cpf_oa_payment:
      input.paymentSource === "split" ? split.cpfOaPayment : null,
    cash_payment:
      input.paymentSource === "split" ? split.cashPayment : null,
    oa_share_of_payment: split.oaShareForCpf,
  };
}

function formatInsightMoney(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currencyCode} ${Math.round(amount).toLocaleString()}`;
  }
}
