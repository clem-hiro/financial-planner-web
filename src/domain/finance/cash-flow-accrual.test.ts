import { describe, expect, it } from "vitest";
import { accrueTakeHomeSurplus } from "./cash-flow-accrual";
import { countAnnualBonusPayoutsInHorizon } from "./sg-cpf";

const START = "2026-01";
const PAYOUT = 12;

// Shared inputs: surplus = max(0, 8000 - 3000 - 1000) = 4000.
const base = {
  monthlyIncome: 8000,
  monthlyExpenses: 3000,
  monthlyGoalContrib: 1000,
  annualBonusNet: 12_000,
  bonusPayoutMonth: PAYOUT,
  startYearMonth: START,
} as const;

const SURPLUS = 4000;

function expectedFlat(months: number, bonus = base.annualBonusNet): number {
  return (
    SURPLUS * months +
    (bonus > 0
      ? bonus * countAnnualBonusPayoutsInHorizon(START, months, PAYOUT)
      : 0)
  );
}

describe("accrueTakeHomeSurplus — Phase 1 (growth=0)", () => {
  it("(a) exact-regression invariant: months = k·12 equals flat formula exactly", () => {
    for (const k of [0, 1, 5, 30]) {
      const months = k * 12;
      // Strict equality (toBe), not approximate — this is the regression guard.
      expect(accrueTakeHomeSurplus({ ...base, months })).toBe(
        expectedFlat(months)
      );
    }
  });

  it("(b) cap behavior: months past retirement frozen at monthsToRet", () => {
    const monthsToRet = 240; // 20y
    const atRet = accrueTakeHomeSurplus({ ...base, months: monthsToRet });
    for (const monthsFromToday of [240, 300, 480, 600]) {
      const capped = Math.min(monthsFromToday, monthsToRet);
      expect(accrueTakeHomeSurplus({ ...base, months: capped })).toBe(atRet);
    }
  });

  it("(c) monthlyIncome == null ⇒ zero surplus, bonus still counted, no NaN", () => {
    const months = 120;
    const r = accrueTakeHomeSurplus({
      ...base,
      months,
      monthlyIncome: null,
    });
    expect(Number.isNaN(r)).toBe(false);
    expect(r).toBe(
      base.annualBonusNet *
        countAnnualBonusPayoutsInHorizon(START, months, PAYOUT)
    );
  });

  it("(d) already retired (months = 0) ⇒ zero accrual", () => {
    expect(accrueTakeHomeSurplus({ ...base, months: 0 })).toBe(0);
  });

  it("(e) pre-retirement (months < monthsToRet) matches hand-computed flat", () => {
    const months = 60; // 5y, below a 240-month retirement horizon
    expect(accrueTakeHomeSurplus({ ...base, months })).toBe(
      expectedFlat(months)
    );
  });

  it("(f) surplus floors at 0 when expenses + goalContrib exceed income", () => {
    const months = 120;
    const r = accrueTakeHomeSurplus({
      ...base,
      months,
      monthlyIncome: 2000,
      monthlyExpenses: 3000,
      monthlyGoalContrib: 500,
    });
    // Surplus contributes nothing; only the bonus accrues.
    expect(r).toBe(
      base.annualBonusNet *
        countAnnualBonusPayoutsInHorizon(START, months, PAYOUT)
    );
    // Boundary: income exactly equals expenses + goalContrib ⇒ surplus 0.
    expect(
      accrueTakeHomeSurplus({
        ...base,
        months,
        monthlyIncome: 3500,
        monthlyExpenses: 3000,
        monthlyGoalContrib: 500,
        annualBonusNet: 0,
      })
    ).toBe(0);
  });

  it("non-positive bonus is not accrued", () => {
    const months = 36;
    expect(
      accrueTakeHomeSurplus({ ...base, months, annualBonusNet: 0 })
    ).toBe(SURPLUS * months);
    expect(
      accrueTakeHomeSurplus({ ...base, months, annualBonusNet: -500 })
    ).toBe(SURPLUS * months);
  });
});

describe("accrueTakeHomeSurplus — Phase 2 (escalation, CPF Jan cadence)", () => {
  it("gE=0 ∧ gI=0 is byte-identical to the flat fast path (exact regression guard)", () => {
    for (const k of [0, 1, 5, 30]) {
      const months = k * 12;
      const explicit = accrueTakeHomeSurplus({
        ...base,
        months,
        incomeGrowthAnnual: 0,
        expenseGrowthAnnual: 0,
      });
      expect(explicit).toBe(expectedFlat(months)); // exact, not approx
      expect(explicit).toBe(accrueTakeHomeSurplus({ ...base, months })); // == default-args
    }
  });

  it("gE=2%, gI=0: surplus shrinks yearly, total below the flat baseline", () => {
    // start 2026-01, 24mo. Yr0: 4000/mo ×12 = 48000.
    // Yr1 (Jan-2027 raise): expenses 3000·1.02=3060 ⇒ 3940/mo ×12 = 47280.
    const r = accrueTakeHomeSurplus({
      ...base,
      months: 24,
      annualBonusNet: 0,
      expenseGrowthAnnual: 0.02,
    });
    expect(r).toBeCloseTo(95_280, 3);
    expect(r).toBeLessThan(SURPLUS * 24); // < flat baseline 96000
  });

  it("gE=2%, gI=3%: surplus and bonus escalate on the CPF Jan cadence", () => {
    // 24mo, bonus 12000 paid Dec. Yr0: surplus 4000×12=48000, bonus 12000 (base).
    // Yr1 (Jan-2027): income 8240, expenses 3060 ⇒ 4180×12=50160, bonus 12000·1.03=12360.
    const r = accrueTakeHomeSurplus({
      ...base,
      months: 24,
      incomeGrowthAnnual: 0.03,
      expenseGrowthAnnual: 0.02,
    });
    expect(r).toBeCloseTo(48_000 + 12_000 + 50_160 + 12_360, 2);
  });

  it("raise lands on calendar January, not the 12-month anniversary of a mid-year start", () => {
    // start 2026-10, 15mo (Oct26..Dec27), gE=10%. Yr0 = Oct,Nov,Dec 2026 (3mo,
    // expenseMul 1). Jan-2027 raise ⇒ remaining 12mo at expenseMul 1.10.
    const r = accrueTakeHomeSurplus({
      months: 15,
      monthlyIncome: 10_000,
      monthlyExpenses: 1_000,
      monthlyGoalContrib: 0,
      annualBonusNet: 0,
      bonusPayoutMonth: PAYOUT,
      startYearMonth: "2026-10",
      expenseGrowthAnnual: 0.1,
    });
    expect(r).toBeCloseTo(3 * 9_000 + 12 * 8_900, 2); // 133800
  });

  it("surplus floors at 0 once escalating expenses overtake income (no negative carry)", () => {
    // income 1000, expenses 900, gE=50%. Yr0 surplus 100/mo. Yr1 exp 1350, Yr2 exp 2025 ⇒ 0.
    const r = accrueTakeHomeSurplus({
      months: 36,
      monthlyIncome: 1_000,
      monthlyExpenses: 900,
      monthlyGoalContrib: 0,
      annualBonusNet: 0,
      bonusPayoutMonth: PAYOUT,
      startYearMonth: START,
      expenseGrowthAnnual: 0.5,
    });
    expect(r).toBe(12 * 100); // exact: 1200, years 1–2 floor at 0
  });

  it("monthlyIncome == null with escalation ⇒ 0 surplus, bonus still counted and escalated", () => {
    // bonus 12000 Dec, gI=3%. Yr0 bonus 12000 (base), Yr1 bonus 12000·1.03.
    const r = accrueTakeHomeSurplus({
      ...base,
      months: 24,
      monthlyIncome: null,
      incomeGrowthAnnual: 0.03,
      expenseGrowthAnnual: 0.02,
    });
    expect(Number.isNaN(r)).toBe(false);
    expect(r).toBeCloseTo(12_000 + 12_360, 6);
  });
});
