import { describe, expect, it } from "vitest";
import { sumInvestableSurplusOverHorizon } from "./investable-surplus";
import { countAnnualBonusPayoutsInHorizon } from "./sg-cpf";
import type { BudgetLineForDomain } from "./budget";

const START = "2026-01";
const PAYOUT = 12;

/** One always-applicable monthly budget line of `amount` (flat per-month spend). */
function flatExpenses(amount: number): BudgetLineForDomain[] {
  return [{ category: "expenses", cadence: "monthly", amount, calendarYear: null }];
}

describe("sumInvestableSurplusOverHorizon — gE=0 ∧ gI=0 regression baseline", () => {
  it("escalation defaults are byte-identical to the unescalated [Debts] computation (strict toBe)", () => {
    for (const k of [1, 5, 30]) {
      const months = k * 12;
      const args = {
        startYearMonth: START,
        months,
        monthlyIncome: 8000,
        domainBudgetLines: flatExpenses(3000),
        monthlyGoalContributions: 1000,
        annualBonusTakeHomeNet: 12_000,
        annualBonusPayoutMonth: PAYOUT,
      };
      // Pre-extension [Debts] formula, computed independently.
      const expected =
        Math.max(0, 8000 - 3000 - 1000) * months +
        12_000 * countAnnualBonusPayoutsInHorizon(START, months, PAYOUT);
      const defaultArgs = sumInvestableSurplusOverHorizon(args);
      const explicitZero = sumInvestableSurplusOverHorizon({
        ...args,
        incomeGrowthAnnual: 0,
        expenseGrowthAnnual: 0,
      });
      expect(defaultArgs).toBe(expected); // exact, not approx
      expect(explicitZero).toBe(defaultArgs); // fast path == untouched baseline
    }
  });

  it("months ≤ 0 or income ≤ 0 ⇒ 0 (both paths)", () => {
    const base = {
      startYearMonth: START,
      monthlyIncome: 8000,
      domainBudgetLines: flatExpenses(3000),
      monthlyGoalContributions: 1000,
    };
    expect(sumInvestableSurplusOverHorizon({ ...base, months: 0 })).toBe(0);
    expect(
      sumInvestableSurplusOverHorizon({
        ...base,
        months: 0,
        incomeGrowthAnnual: 0.03,
        expenseGrowthAnnual: 0.02,
      })
    ).toBe(0);
    expect(
      sumInvestableSurplusOverHorizon({
        ...base,
        months: 120,
        monthlyIncome: 0,
        expenseGrowthAnnual: 0.02,
      })
    ).toBe(0);
  });
});

describe("sumInvestableSurplusOverHorizon — restored Finding A cap (chart freezes at retirement)", () => {
  // dashboard.ts passes months: Math.min(p.monthsFromToday, monthsToRet); this
  // asserts the engine consequence — past retirement the value is frozen at the
  // retirement value and equals the scalar (months: monthsToRet) call exactly.
  const argsAt = (months: number, growth = {}) =>
    sumInvestableSurplusOverHorizon({
      startYearMonth: START,
      months,
      monthlyIncome: 8000,
      domainBudgetLines: flatExpenses(3000),
      monthlyGoalContributions: 1000,
      annualBonusTakeHomeNet: 12_000,
      annualBonusPayoutMonth: PAYOUT,
      ...growth,
    });

  it("gE=0 ∧ gI=0: Math.min(X, R) frozen at R for X ≥ R, strictly less for X < R", () => {
    const R = 240; // 20y
    const atRet = argsAt(R);
    for (const monthsFromToday of [240, 300, 480, 600]) {
      expect(argsAt(Math.min(monthsFromToday, R))).toBe(atRet); // frozen, exact
    }
    expect(argsAt(Math.min(60, R))).toBeLessThan(atRet); // pre-retirement < cap
  });

  it("gE/gI > 0: cap still freezes (same engine, same months at/after R)", () => {
    const R = 240;
    const g = { incomeGrowthAnnual: 0.03, expenseGrowthAnnual: 0.02 };
    const atRet = argsAt(R, g);
    for (const monthsFromToday of [240, 360, 600]) {
      expect(argsAt(Math.min(monthsFromToday, R), g)).toBe(atRet);
    }
    expect(argsAt(Math.min(120, R), g)).toBeLessThan(atRet);
  });

  it("already retired (monthsToRet=0 ⇒ Math.min(any,0)=0) ⇒ 0 at every age", () => {
    for (const monthsFromToday of [0, 120, 600]) {
      expect(argsAt(Math.min(monthsFromToday, 0))).toBe(0);
    }
  });
});

describe("sumInvestableSurplusOverHorizon — CPF-Jan escalation", () => {
  it("gE=2%, gI=0: planned spend escalates yearly; total below flat baseline", () => {
    const r = sumInvestableSurplusOverHorizon({
      startYearMonth: START,
      months: 24,
      monthlyIncome: 8000,
      domainBudgetLines: flatExpenses(3000),
      monthlyGoalContributions: 1000,
      expenseGrowthAnnual: 0.02,
    });
    // Yr0 4000/mo×12=48000; Yr1 (Jan-2027) planned 3060 ⇒ 3940/mo×12=47280.
    expect(r).toBeCloseTo(95_280, 3);
    expect(r).toBeLessThan(4000 * 24); // < flat baseline 96000
  });

  it("gE=2%, gI=3%: income + bonus escalate on the CPF Jan cadence", () => {
    const r = sumInvestableSurplusOverHorizon({
      startYearMonth: START,
      months: 24,
      monthlyIncome: 8000,
      domainBudgetLines: flatExpenses(3000),
      monthlyGoalContributions: 1000,
      annualBonusTakeHomeNet: 12_000,
      annualBonusPayoutMonth: PAYOUT,
      incomeGrowthAnnual: 0.03,
      expenseGrowthAnnual: 0.02,
    });
    // Yr0: 4000×12 + bonus 12000. Yr1: (8240−3060−1000)×12=50160 + bonus 12360.
    expect(r).toBeCloseTo(48_000 + 12_000 + 50_160 + 12_360, 2);
  });

  it("raise lands on calendar January, not the 12-month anniversary of a mid-year start", () => {
    const r = sumInvestableSurplusOverHorizon({
      startYearMonth: "2026-10",
      months: 15, // Oct26..Dec27
      monthlyIncome: 10_000,
      domainBudgetLines: flatExpenses(1_000),
      monthlyGoalContributions: 0,
      expenseGrowthAnnual: 0.1,
    });
    // Yr0 Oct–Dec26 (3mo, mul 1): 9000/mo. Jan-27 raise ⇒ 12mo at planned 1100.
    expect(r).toBeCloseTo(3 * 9_000 + 12 * 8_900, 2); // 133800
  });

  it("surplus floors at 0 once escalating spend overtakes income (no negative carry)", () => {
    const r = sumInvestableSurplusOverHorizon({
      startYearMonth: START,
      months: 36,
      monthlyIncome: 1_000,
      domainBudgetLines: flatExpenses(900),
      monthlyGoalContributions: 0,
      expenseGrowthAnnual: 0.5,
    });
    // Yr0 100/mo×12=1200. Yr1 planned 1350 ⇒ 0. Yr2 planned 2025 ⇒ 0.
    expect(r).toBe(12 * 100); // exact 1200
  });
});

describe("sumInvestableSurplusOverHorizon — [Debts] budget-line time-variation preserved", () => {
  it("debt payoff frees cash (line with endYearMonth) — exact at gE=gI=0", () => {
    const lines: BudgetLineForDomain[] = [
      { category: "living", cadence: "monthly", amount: 2000, calendarYear: null },
      {
        category: "debt",
        cadence: "monthly",
        amount: 1000,
        calendarYear: null,
        endYearMonth: "2026-06",
      },
    ];
    // Jan–Jun (6mo, debt on): surplus 2000. Jul–Dec (6mo, debt off): 3000.
    const withPayoff = sumInvestableSurplusOverHorizon({
      startYearMonth: START,
      monthlyIncome: 5000,
      monthlyGoalContributions: 0,
      months: 12,
      domainBudgetLines: lines,
    });
    expect(withPayoff).toBe(6 * 2000 + 6 * 3000); // 30000, exact

    // Control: same debt line but never ending ⇒ strictly less freed cash.
    const alwaysOn = sumInvestableSurplusOverHorizon({
      startYearMonth: START,
      monthlyIncome: 5000,
      monthlyGoalContributions: 0,
      months: 12,
      domainBudgetLines: [
        { category: "living", cadence: "monthly", amount: 2000, calendarYear: null },
        { category: "debt", cadence: "monthly", amount: 1000, calendarYear: null },
      ],
    });
    expect(alwaysOn).toBe(12 * 2000); // 24000
    expect(withPayoff).toBeGreaterThan(alwaysOn);
  });

  it("budget-line window composes with gE escalation (debt window respected, survivor escalates)", () => {
    const lines: BudgetLineForDomain[] = [
      { category: "living", cadence: "monthly", amount: 2000, calendarYear: null },
      {
        category: "debt",
        cadence: "monthly",
        amount: 1000,
        calendarYear: null,
        endYearMonth: "2026-06",
      },
    ];
    const r = sumInvestableSurplusOverHorizon({
      startYearMonth: START,
      monthlyIncome: 5000,
      monthlyGoalContributions: 0,
      months: 24,
      domainBudgetLines: lines,
      expenseGrowthAnnual: 0.1,
    });
    // Yr0: Jan–Jun planned 3000 → 2000; Jul–Dec planned 2000 → 3000 (= 30000).
    // Yr1 (Jan-27 ×1.10, debt gone): planned 2200 → 2800/mo ×12 = 33600.
    expect(r).toBeCloseTo(30_000 + 33_600, 6);
  });
});
