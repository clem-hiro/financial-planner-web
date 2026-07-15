export type DebtProjectionKind = "liability" | "housing" | "vehicle";
export type DebtFundingSource = "cash" | "cpf_oa" | "split";
export type DebtLoanType = "amortized" | "flat_rate" | "revolving";

export interface DebtObligationInput {
  id: string;
  label: string;
  kind: DebtProjectionKind;
  balance: number;
  annualInterestRate?: number | null;
  loanType?: DebtLoanType | null;
  /** First repayment month as an offset from the projection start. */
  startMonth?: number | null;
  /** Scheduled repayment count from `startMonth`; null keeps revolving debts open. */
  termMonths?: number | null;
  /** User-entered fixed repayment. When absent, term loans are estimated. */
  monthlyPayment?: number | null;
  fundingSource?: DebtFundingSource | null;
  /** For split-funded debts, fraction of each instalment intended for CPF OA. */
  cpfOaShare?: number | null;
  maxCpfOaMonthly?: number | null;
}

export interface DebtPaymentDue {
  debtId: string;
  label: string;
  kind: DebtProjectionKind;
  month: number;
  scheduledPaymentIndex: number;
  totalPayment: number;
  interestDue: number;
  principalDue: number;
  preferredCpfOa: number;
  balanceBefore: number;
}

export interface DebtPaymentSettlement extends DebtPaymentDue {
  funded: number;
  fundedInterest: number;
  fundedPrincipal: number;
  unfunded: number;
  balanceAfter: number;
}

export interface DebtProjectionState {
  obligation: DebtObligationInput;
  balance: number;
  paymentsElapsed: number;
  flatInterestPerPayment: number;
  scheduledPayment: number;
}

const MONEY_EPSILON = 0.005;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function nonNegativeFinite(n: number | null | undefined): number {
  return Number.isFinite(n ?? Number.NaN) ? Math.max(0, n as number) : 0;
}

function positiveFinite(n: number | null | undefined): number | null {
  if (!Number.isFinite(n ?? Number.NaN) || (n as number) <= 0) return null;
  return n as number;
}

function safeRate(n: number | null | undefined): number {
  if (!Number.isFinite(n ?? Number.NaN)) return 0;
  return Math.max(0, n as number);
}

function clampShare(n: number | null | undefined): number {
  if (!Number.isFinite(n ?? Number.NaN)) return 0;
  return Math.max(0, Math.min(1, n as number));
}

function startMonthForDebt(input: DebtObligationInput): number {
  if (!Number.isFinite(input.startMonth ?? Number.NaN)) return 0;
  return Math.max(0, Math.trunc(input.startMonth as number));
}

function termMonthsForDebt(input: DebtObligationInput): number | null {
  if (!Number.isFinite(input.termMonths ?? Number.NaN)) return null;
  const n = Math.trunc(input.termMonths as number);
  return n > 0 ? n : null;
}

function remainingPayments(state: DebtProjectionState): number | null {
  const term = termMonthsForDebt(state.obligation);
  if (term == null) return null;
  return Math.max(0, term - state.paymentsElapsed);
}

function amortizedPayment(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return roundMoney(principal / termMonths);
  const pow = (1 + r) ** termMonths;
  return roundMoney((principal * r * pow) / (pow - 1));
}

function flatRatePayment(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  const totalInterest = principal * annualRate * (termMonths / 12);
  return roundMoney((principal + totalInterest) / termMonths);
}

function initialScheduledPayment(
  obligation: DebtObligationInput,
  balance: number
): number {
  const override = positiveFinite(obligation.monthlyPayment);
  if (override != null) return override;

  const term = termMonthsForDebt(obligation);
  if (term == null || term <= 0) return 0;
  const loanType = obligation.loanType ?? "amortized";
  const rate = safeRate(obligation.annualInterestRate);
  if (loanType === "flat_rate") {
    return flatRatePayment(balance, rate, term);
  }
  if (loanType === "revolving") return 0;
  return amortizedPayment(balance, rate, term);
}

function scheduledPaymentForState(state: DebtProjectionState): number {
  return state.scheduledPayment;
}

function preferredCpfOaForPayment(
  obligation: DebtObligationInput,
  payment: number
): number {
  const source = obligation.fundingSource ?? "cash";
  if (source === "cash") return 0;

  let preferred = payment;
  if (source === "split") {
    preferred = payment * clampShare(obligation.cpfOaShare);
  }

  const cap = positiveFinite(obligation.maxCpfOaMonthly);
  if (cap != null) preferred = Math.min(preferred, cap);
  return roundMoney(Math.min(payment, Math.max(0, preferred)));
}

export function createDebtProjectionStates(
  obligations: DebtObligationInput[] | undefined
): DebtProjectionState[] {
  return (obligations ?? [])
    .map((obligation) => {
      const balance = roundMoney(nonNegativeFinite(obligation.balance));
      const term = termMonthsForDebt(obligation);
      const flatInterestPerPayment =
        obligation.loanType === "flat_rate" && term != null
          ? roundMoney(
              (balance * safeRate(obligation.annualInterestRate) * (term / 12)) /
                term
            )
          : 0;
      return {
        obligation,
        balance,
        paymentsElapsed: 0,
        flatInterestPerPayment,
        scheduledPayment: initialScheduledPayment(obligation, balance),
      };
    })
    .filter((state) => state.balance > MONEY_EPSILON);
}

export function debtPaymentDueForMonth(
  state: DebtProjectionState,
  month: number
): DebtPaymentDue | null {
  if (state.balance <= MONEY_EPSILON) return null;
  if (month < startMonthForDebt(state.obligation)) return null;

  const remaining = remainingPayments(state);
  if (remaining != null && remaining <= 0) return null;

  const scheduledPayment = scheduledPaymentForState(state);
  if (scheduledPayment <= MONEY_EPSILON) return null;

  const rate = safeRate(state.obligation.annualInterestRate);
  const loanType = state.obligation.loanType ?? "amortized";
  const interestDue =
    loanType === "flat_rate"
      ? Math.min(state.flatInterestPerPayment, scheduledPayment)
      : roundMoney(state.balance * (rate / 12));
  const cappedPayment = roundMoney(
    Math.min(scheduledPayment, state.balance + interestDue)
  );
  const principalDue = roundMoney(
    Math.min(state.balance, Math.max(0, cappedPayment - interestDue))
  );

  return {
    debtId: state.obligation.id,
    label: state.obligation.label,
    kind: state.obligation.kind,
    month,
    scheduledPaymentIndex: state.paymentsElapsed,
    totalPayment: cappedPayment,
    interestDue,
    principalDue,
    preferredCpfOa: preferredCpfOaForPayment(
      state.obligation,
      cappedPayment
    ),
    balanceBefore: state.balance,
  };
}

export function settleDebtPayment(
  state: DebtProjectionState,
  due: DebtPaymentDue,
  fundedAmount: number
): DebtPaymentSettlement {
  const funded = roundMoney(
    Math.min(due.totalPayment, nonNegativeFinite(fundedAmount))
  );
  const fundedInterest = roundMoney(Math.min(funded, due.interestDue));
  const fundedPrincipal = roundMoney(
    Math.min(due.principalDue, Math.max(0, funded - fundedInterest))
  );
  state.balance = roundMoney(Math.max(0, state.balance - fundedPrincipal));
  state.paymentsElapsed += 1;

  return {
    ...due,
    funded,
    fundedInterest,
    fundedPrincipal,
    unfunded: roundMoney(Math.max(0, due.totalPayment - funded)),
    balanceAfter: state.balance,
  };
}

export function buildDebtPaymentSchedule(input: {
  obligation: DebtObligationInput;
  horizonMonths: number;
  fundedAmountForDue?: (due: DebtPaymentDue) => number;
}): DebtPaymentSettlement[] {
  const [state] = createDebtProjectionStates([input.obligation]);
  if (!state) return [];

  const out: DebtPaymentSettlement[] = [];
  const horizonMonths = Math.max(0, Math.trunc(input.horizonMonths));
  for (let month = 0; month < horizonMonths; month++) {
    const due = debtPaymentDueForMonth(state, month);
    if (!due) continue;
    const fundedAmount = input.fundedAmountForDue
      ? input.fundedAmountForDue(due)
      : due.totalPayment;
    out.push(settleDebtPayment(state, due, fundedAmount));
  }
  return out;
}
