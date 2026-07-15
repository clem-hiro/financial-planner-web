import { describe, expect, it } from "vitest";
import {
  buildRetirementCashflowProjection,
  type ProjectionInvestmentComponent,
  type ProjectionLedgerEntry,
} from "./retirement-cashflow-projection";
import type { DebtObligationInput } from "./debt-cashflow";

const base = {
  startYearMonth: "2026-01",
  horizonMonths: 24,
  targetRetirementMonth: 120,
  initialCash: 50_000,
  initialInvestmentPrincipal: 0,
  liabilities: 0,
  investmentComponents: [
    component({
      id: "brokerage",
      initialPrincipal: 100_000,
      annualGrowthRate: 0.12,
      investmentIncomeRateAnnual: 0.06,
    }),
  ],
  samplePoints: [
    { age: 60, monthsFromToday: 0 },
    { age: 61, monthsFromToday: 12 },
    { age: 62, monthsFromToday: 24 },
  ],
  externalAssetSnapshots: [],
};

function component(
  partial: Partial<ProjectionInvestmentComponent> &
    Pick<ProjectionInvestmentComponent, "id" | "initialPrincipal">
): ProjectionInvestmentComponent {
  return {
    label: partial.id,
    kind: "pure_investment",
    annualGrowthRate: 0,
    investmentIncomeRateAnnual: 0,
    annualWithdrawal: 0,
    withdrawalStartMonth: null,
    maturityMonth: null,
    ...partial,
  };
}

function monthlyEntry(
  partial: Partial<ProjectionLedgerEntry> & Pick<ProjectionLedgerEntry, "id">
): ProjectionLedgerEntry {
  return {
    sourceType: "other",
    label: partial.id,
    direction: "inflow",
    cashAccess: "cash",
    phase: "both",
    cadence: "monthly",
    startMonth: 0,
    amount: 0,
    ...partial,
  };
}

function debt(over: Partial<DebtObligationInput>): DebtObligationInput {
  return {
    id: "debt-1",
    label: "Debt",
    kind: "liability",
    balance: 1_000,
    annualInterestRate: 0,
    loanType: "amortized",
    termMonths: 10,
    startMonth: 0,
    fundingSource: "cash",
    ...over,
  };
}

describe("buildRetirementCashflowProjection", () => {
  it("groups regular inflows before touching component principal", () => {
    const result = buildRetirementCashflowProjection({
      ...base,
      investmentComponents: [component({ id: "cashless", initialPrincipal: 0 })],
      ledger: [
        monthlyEntry({ id: "income", direction: "inflow", amount: 10_000 }),
        monthlyEntry({ id: "spend", direction: "outflow", amount: 6_000 }),
      ],
    });

    const row = result.periods[1];
    expect(row.cashAccessibleInflow).toBe(10_000);
    expect(row.requiredOutflow).toBe(6_000);
    expect(row.prePortfolioGap).toBe(4_000);
    expect(row.principalWithdrawn).toBe(0);
    expect(row.goalsGap).toBe(0);
    expect(row.cash).toBe(54_000);
  });

  it("pays pure-investment income in December after growth", () => {
    const result = buildRetirementCashflowProjection({
      ...base,
      ledger: [],
    });

    const december = result.periods[12];
    const principalAfterGrowth = 100_000 * 1.01 ** 12;
    expect(december.investmentPrincipal).toBeCloseTo(principalAfterGrowth, 5);
    expect(december.investmentDividendInflow).toBeCloseTo(
      principalAfterGrowth * 0.06,
      5
    );
    expect(december.cashAccessibleInflow).toBeCloseTo(
      principalAfterGrowth * 0.06,
      5
    );
  });

  it("pre-retirement deficits use reserve cash before GoalsGap", () => {
    const result = buildRetirementCashflowProjection({
      ...base,
      horizonMonths: 1,
      targetRetirementMonth: 12,
      initialCash: 80,
      investmentComponents: [component({ id: "brokerage", initialPrincipal: 100 })],
      ledger: [
        monthlyEntry({
          id: "spend",
          direction: "outflow",
          amount: 100,
        }),
      ],
    });

    const row = result.periods[1];
    expect(row.cashReserveDrawdown).toBe(80);
    expect(row.principalWithdrawn).toBe(0);
    expect(row.goalsGap).toBe(20);
    expect(row.cash).toBe(0);
    expect(row.investmentPrincipal).toBe(100);
  });

  it("principal withdrawals reduce the next December income base", () => {
    const result = buildRetirementCashflowProjection({
      ...base,
      targetRetirementMonth: 0,
      ledger: [
        monthlyEntry({
          id: "spend",
          direction: "outflow",
          cadence: "one_off",
          startMonth: 0,
          amount: 20_000,
        }),
      ],
    });

    const january = result.periods[1];
    const december = result.periods[12];
    const principalAfterDrawAndGrowth = 80_000 * 1.01 ** 12;
    expect(january.principalWithdrawn).toBe(20_000);
    expect(december.investmentPrincipal).toBeCloseTo(
      principalAfterDrawAndGrowth,
      5
    );
    expect(december.investmentDividendInflow).toBeCloseTo(
      principalAfterDrawAndGrowth * 0.06,
      5
    );
  });

  it("uses pure investments before matured ILP principal", () => {
    const result = buildRetirementCashflowProjection({
      ...base,
      horizonMonths: 1,
      targetRetirementMonth: 0,
      investmentComponents: [
        component({ id: "brokerage", initialPrincipal: 100 }),
        component({
          id: "ilp",
          kind: "ilp",
          initialPrincipal: 100,
          maturityMonth: 0,
        }),
      ],
      ledger: [
        monthlyEntry({
          id: "spend",
          direction: "outflow",
          amount: 150,
        }),
      ],
    });

    const row = result.periods[1];
    expect(row.investmentPrincipalWithdrawn).toBe(100);
    expect(row.ilpPrincipalWithdrawn).toBe(50);
    expect(row.principalWithdrawn).toBe(150);
    expect(row.investmentPrincipal).toBe(50);
  });

  it("can use reserve cash after investments and matured ILP in post-retirement", () => {
    const result = buildRetirementCashflowProjection({
      ...base,
      horizonMonths: 1,
      targetRetirementMonth: 0,
      initialCash: 40,
      useCashReserveForDeficits: true,
      investmentComponents: [
        component({ id: "brokerage", initialPrincipal: 30 }),
        component({
          id: "ilp",
          kind: "ilp",
          initialPrincipal: 20,
          maturityMonth: 0,
        }),
      ],
      ledger: [
        monthlyEntry({
          id: "spend",
          direction: "outflow",
          amount: 100,
        }),
      ],
    });

    const row = result.periods[1];
    expect(row.investmentPrincipalWithdrawn).toBe(30);
    expect(row.ilpPrincipalWithdrawn).toBe(20);
    expect(row.cashReserveDrawdown).toBe(40);
    expect(row.goalsGap).toBe(10);
    expect(row.cash).toBe(0);
  });

  it("gates ILP income and principal until maturity", () => {
    const result = buildRetirementCashflowProjection({
      ...base,
      targetRetirementMonth: 0,
      investmentComponents: [
        component({
          id: "ilp",
          kind: "ilp",
          initialPrincipal: 100_000,
          investmentIncomeRateAnnual: 0.04,
          maturityMonth: 12,
        }),
      ],
      ledger: [
        monthlyEntry({
          id: "spend-before-maturity",
          direction: "outflow",
          cadence: "one_off",
          startMonth: 0,
          amount: 10_000,
        }),
      ],
    });

    expect(result.periods[1].ilpPrincipalWithdrawn).toBe(0);
    expect(result.periods[1].goalsGap).toBe(10_000);
    expect(result.periods[12].ilpIncomeInflow).toBe(0);
    expect(result.periods[24].ilpIncomeInflow).toBeCloseTo(4_000, 5);
  });

  it("records GoalsGap when eligible assets cannot fund the shortfall", () => {
    const result = buildRetirementCashflowProjection({
      ...base,
      horizonMonths: 1,
      targetRetirementMonth: 0,
      investmentComponents: [component({ id: "small", initialPrincipal: 50 })],
      ledger: [
        monthlyEntry({
          id: "spend",
          direction: "outflow",
          amount: 100,
        }),
      ],
    });

    const row = result.periods[1];
    expect(row.principalWithdrawn).toBe(50);
    expect(row.goalsGap).toBe(50);
    expect(row.cumulativeGoalsGap).toBe(50);
  });

  it("treats yearly withdrawals as December cash inflow and principal reduction", () => {
    const result = buildRetirementCashflowProjection({
      ...base,
      investmentComponents: [
        component({
          id: "brokerage",
          initialPrincipal: 100_000,
          annualWithdrawal: 12_000,
          withdrawalStartMonth: 0,
        }),
      ],
      ledger: [],
    });

    const december = result.periods[12];
    expect(december.investmentWithdrawalInflow).toBe(12_000);
    expect(december.cashAccessibleInflow).toBe(12_000);
    expect(december.investmentPrincipal).toBe(88_000);
  });

  it("tracks CPF LIFE and rental inflow breakdowns without changing inflow grouping", () => {
    const result = buildRetirementCashflowProjection({
      ...base,
      investmentComponents: [],
      ledger: [
        monthlyEntry({
          id: "cpf-life",
          sourceType: "cpf_life",
          direction: "inflow",
          amount: 2_500,
        }),
        monthlyEntry({
          id: "rental",
          sourceType: "rental_income",
          direction: "inflow",
          amount: 1_000,
        }),
      ],
    });

    const row = result.periods[1];
    expect(row.cashAccessibleInflow).toBe(3_500);
    expect(row.cpfLifeInflow).toBe(2_500);
    expect(row.rentalInflow).toBe(1_000);
  });

  it("itemizes employment + bonus into employmentInflow without changing the inflow total", () => {
    const result = buildRetirementCashflowProjection({
      ...base,
      investmentComponents: [],
      ledger: [
        monthlyEntry({
          id: "salary",
          sourceType: "employment_income",
          direction: "inflow",
          amount: 8_000,
        }),
        monthlyEntry({
          id: "bonus",
          sourceType: "bonus_income",
          direction: "inflow",
          amount: 1_500,
        }),
        monthlyEntry({
          id: "cpf-life",
          sourceType: "cpf_life",
          direction: "inflow",
          amount: 2_500,
        }),
      ],
    });

    const row = result.periods[1];
    expect(row.cashAccessibleInflow).toBe(12_000);
    expect(row.employmentInflow).toBe(9_500);
    expect(row.cpfLifeInflow).toBe(2_500);
  });

  it("reduces projected liabilities only by funded principal", () => {
    const result = buildRetirementCashflowProjection({
      ...base,
      horizonMonths: 1,
      initialCash: 50,
      investmentComponents: [],
      ledger: [],
      liabilities: 1_000,
      debtObligations: [
        debt({
          balance: 1_000,
          annualInterestRate: 0.12,
          monthlyPayment: 200,
        }),
      ],
    });

    const row = result.periods[1];
    expect(row.requiredDebtRepayment).toBe(200);
    expect(row.fundedDebtRepayment).toBe(50);
    expect(row.debtInterestPaid).toBe(10);
    expect(row.debtPrincipalPaid).toBe(40);
    expect(row.unfundedDebtRepayment).toBe(150);
    expect(row.projectedLiabilities).toBe(960);
    expect(row.netWorth).toBe(-960);
  });

  it("funds CPF OA-designated debt from OA without cash shortfall", () => {
    const result = buildRetirementCashflowProjection({
      ...base,
      horizonMonths: 1,
      initialCash: 0,
      investmentComponents: [],
      ledger: [],
      liabilities: 0,
      externalAssetSnapshots: [
        { month: 0, cpf: 1_000, cpfOa: 1_000 },
        { month: 1, cpf: 1_000, cpfOa: 1_000 },
      ],
      debtObligations: [
        debt({
          id: "home-loan",
          label: "Home loan",
          kind: "housing",
          balance: 1_000,
          termMonths: 10,
          fundingSource: "cpf_oa",
        }),
      ],
    });

    const row = result.periods[1];
    expect(row.requiredDebtRepayment).toBe(100);
    expect(row.fundedDebtRepayment).toBe(100);
    expect(row.unfundedDebtRepayment).toBe(0);
    expect(row.debtCpfOaDrawdown).toBe(100);
    expect(row.cashReserveDrawdown).toBe(0);
    expect(row.goalsGap).toBe(0);
    expect(row.cpfOa).toBe(900);
    expect(row.projectedHousingLiabilities).toBe(900);
  });

  it("falls back after CPF OA is insufficient for designated debt", () => {
    const result = buildRetirementCashflowProjection({
      ...base,
      horizonMonths: 1,
      initialCash: 30,
      investmentComponents: [],
      ledger: [],
      liabilities: 0,
      externalAssetSnapshots: [
        { month: 0, cpf: 50, cpfOa: 50 },
        { month: 1, cpf: 50, cpfOa: 50 },
      ],
      debtObligations: [
        debt({
          id: "home-loan",
          label: "Home loan",
          kind: "housing",
          balance: 1_000,
          termMonths: 10,
          fundingSource: "cpf_oa",
        }),
      ],
    });

    const row = result.periods[1];
    expect(row.debtCpfOaDrawdown).toBe(50);
    expect(row.cashReserveDrawdown).toBe(30);
    expect(row.fundedDebtRepayment).toBe(80);
    expect(row.unfundedDebtRepayment).toBe(20);
    expect(row.goalsGap).toBe(20);
    expect(row.projectedHousingLiabilities).toBe(920);
  });

  it("prioritizes debt repayment before living expenses when funding is scarce", () => {
    const result = buildRetirementCashflowProjection({
      ...base,
      horizonMonths: 1,
      initialCash: 0,
      investmentComponents: [],
      ledger: [
        monthlyEntry({ id: "income", direction: "inflow", amount: 100 }),
        monthlyEntry({ id: "living", direction: "outflow", amount: 50 }),
      ],
      liabilities: 0,
      debtObligations: [
        debt({
          balance: 800,
          termMonths: 10,
          monthlyPayment: 80,
        }),
      ],
    });

    const row = result.periods[1];
    expect(row.requiredDebtRepayment).toBe(80);
    expect(row.fundedDebtRepayment).toBe(80);
    expect(row.requiredLivingOutflow).toBe(50);
    expect(row.fundedLivingOutflow).toBe(20);
    expect(row.unfundedLivingOutflow).toBe(30);
    expect(row.goalsGap).toBe(30);
    expect(row.unfundedOutflow).toBe(30);
  });

  it("amortizes vehicle debt into vehiclesNet without double-counting liabilities", () => {
    const result = buildRetirementCashflowProjection({
      ...base,
      horizonMonths: 12,
      initialCash: 5_000,
      investmentComponents: [],
      ledger: [
        monthlyEntry({ id: "income", direction: "inflow", amount: 500 }),
      ],
      liabilities: 0,
      debtObligations: [
        debt({
          id: "vehicle-car",
          label: "Car loan",
          kind: "vehicle",
          balance: 1_200,
          annualInterestRate: 0,
          termMonths: 12,
          monthlyPayment: 100,
        }),
      ],
      externalAssetSnapshots: Array.from({ length: 13 }, (_, month) => ({
        month,
        vehiclesNet: 0,
      })),
    });

    const start = result.periods[0];
    expect(start.vehiclesNet).toBe(-1_200);
    expect(start.liabilities).toBe(0);
    expect(start.projectedNonHousingLiabilities).toBe(0);

    const afterOneYear = result.periods[12];
    expect(afterOneYear.vehiclesNet).toBe(0);
    expect(afterOneYear.liabilities).toBe(0);
    expect(afterOneYear.projectedLiabilities).toBe(0);
  });
});
