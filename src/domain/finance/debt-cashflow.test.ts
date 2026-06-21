import { describe, expect, it } from "vitest";
import {
  buildDebtPaymentSchedule,
  createDebtProjectionStates,
  debtPaymentDueForMonth,
  settleDebtPayment,
  type DebtObligationInput,
} from "./debt-cashflow";

const baseDebt = (over: Partial<DebtObligationInput>): DebtObligationInput => ({
  id: "debt-1",
  label: "Loan",
  kind: "liability",
  balance: 12_000,
  loanType: "amortized",
  annualInterestRate: 0.12,
  termMonths: 12,
  startMonth: 0,
  fundingSource: "cash",
  ...over,
});

describe("debt-cashflow", () => {
  it("builds an amortized schedule that pays interest then principal", () => {
    const schedule = buildDebtPaymentSchedule({
      obligation: baseDebt({ balance: 12_000, annualInterestRate: 0.12 }),
      horizonMonths: 12,
    });

    expect(schedule).toHaveLength(12);
    expect(schedule[0].interestDue).toBe(120);
    expect(schedule[0].fundedPrincipal).toBeGreaterThan(940);
    expect(schedule[11].balanceAfter).toBe(0);
  });

  it("keeps flat-rate interest level instead of recomputing on declining balance", () => {
    const schedule = buildDebtPaymentSchedule({
      obligation: baseDebt({
        balance: 12_000,
        loanType: "flat_rate",
        annualInterestRate: 0.12,
      }),
      horizonMonths: 3,
    });

    expect(schedule[0].interestDue).toBe(120);
    expect(schedule[1].interestDue).toBe(120);
    expect(schedule[2].interestDue).toBe(120);
    expect(schedule[0].totalPayment).toBe(1_120);
    expect(schedule[1].totalPayment).toBe(1_120);
    expect(schedule[2].totalPayment).toBe(1_120);
  });

  it("handles zero-interest loans without interest leakage", () => {
    const schedule = buildDebtPaymentSchedule({
      obligation: baseDebt({
        balance: 1_200,
        annualInterestRate: 0,
        termMonths: 12,
      }),
      horizonMonths: 12,
    });

    expect(schedule[0].interestDue).toBe(0);
    expect(schedule[0].principalDue).toBe(100);
    expect(schedule[11].balanceAfter).toBe(0);
  });

  it("honors start month and configured payoff window", () => {
    const schedule = buildDebtPaymentSchedule({
      obligation: baseDebt({
        balance: 1_000,
        annualInterestRate: 0,
        termMonths: 2,
        startMonth: 3,
      }),
      horizonMonths: 8,
    });

    expect(schedule.map((row) => row.month)).toEqual([3, 4]);
    expect(schedule[1].balanceAfter).toBe(0);
  });

  it("uses override repayment amounts before estimated instalments", () => {
    const due = debtPaymentDueForMonth(
      createDebtProjectionStates([
        baseDebt({
          balance: 1_000,
          annualInterestRate: 0,
          termMonths: 10,
          monthlyPayment: 250,
        }),
      ])[0],
      0
    );

    expect(due?.totalPayment).toBe(250);
    expect(due?.principalDue).toBe(250);
  });

  it("applies partial payments interest-first and only funded principal reduces balance", () => {
    const [state] = createDebtProjectionStates([
      baseDebt({
        balance: 1_000,
        annualInterestRate: 0.12,
        termMonths: 10,
        monthlyPayment: 200,
      }),
    ]);
    const due = debtPaymentDueForMonth(state, 0);
    expect(due).not.toBeNull();

    const settled = settleDebtPayment(state, due!, 50);

    expect(settled.interestDue).toBe(10);
    expect(settled.fundedInterest).toBe(10);
    expect(settled.fundedPrincipal).toBe(40);
    expect(settled.unfunded).toBe(150);
    expect(settled.balanceAfter).toBe(960);
  });
});
