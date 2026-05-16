import { describe, expect, it } from "vitest";
import { buildAgeAssetProjection } from "./age-asset-projection";

// currentAge 40, retire 65 ⇒ monthsToRet = 25·12 = 300. Ages step yearly, so
// monthsFromToday is always a multiple of 12 (matches the real chart). No
// vehicles ⇒ vehicleSaleCash = 0 at every age, so the cash freeze is exact.
const MONTHS_TO_RET = 300;
const base = {
  agePoints: [
    { age: 40, monthsFromToday: 0 },
    { age: 50, monthsFromToday: 120 },
    { age: 65, monthsFromToday: 300 }, // == retirement
    { age: 80, monthsFromToday: 480 }, // post-retirement
  ],
  asOf: new Date("2026-01-15T00:00:00Z"),
  monthsToRet: MONTHS_TO_RET,
  cashTotal: 50_000,
  vehicleValuationInputs: [],
  monthlyIncome: 8_000,
  monthlyExpenses: 3_000,
  monthlyGoalContrib: 1_000,
  annualBonusNet: 12_000,
  bonusPayoutMonth: 12,
  startYearMonth: "2026-01",
};

const retPoint = (r: ReturnType<typeof buildAgeAssetProjection>) =>
  r.perAge.find((p) => p.monthsFromToday === MONTHS_TO_RET)!;
const postPoint = (r: ReturnType<typeof buildAgeAssetProjection>) =>
  r.perAge.find((p) => p.monthsFromToday === 480)!;
const prePoint = (r: ReturnType<typeof buildAgeAssetProjection>) =>
  r.perAge.find((p) => p.monthsFromToday === 120)!;

describe("buildAgeAssetProjection — chart cash == scalar at retirement", () => {
  it("gE=0 ∧ gI=0: retirement-age chart cash equals the scalar exactly", () => {
    const r = buildAgeAssetProjection({
      ...base,
      incomeGrowthAnnual: 0,
      expenseGrowthAnnual: 0,
    });
    // surplus 4000/mo · 300 + bonus 12000 · 25 Decembers = 1,500,000.
    expect(r.surplusAccrualToRet).toBe(1_500_000);
    expect(r.cashAtRetirementHorizon).toBe(1_550_000);
    const ret = retPoint(r);
    expect(ret.surplusAccrual).toBe(r.surplusAccrualToRet);
    expect(ret.cash).toBe(r.cashAtRetirementHorizon);
  });

  it("gE=0 ∧ gI=0: post-retirement point is frozen at the retirement value", () => {
    const r = buildAgeAssetProjection({
      ...base,
      incomeGrowthAnnual: 0,
      expenseGrowthAnnual: 0,
    });
    const post = postPoint(r);
    expect(post.surplusAccrual).toBe(r.surplusAccrualToRet);
    expect(post.cash).toBe(r.cashAtRetirementHorizon); // no vehicles ⇒ exact
  });

  it("gE/gI > 0: invariant still holds (same helper, capped months)", () => {
    const r = buildAgeAssetProjection({
      ...base,
      incomeGrowthAnnual: 0.03,
      expenseGrowthAnnual: 0.02,
    });
    const ret = retPoint(r);
    const post = postPoint(r);
    expect(ret.surplusAccrual).toBe(r.surplusAccrualToRet);
    expect(ret.cash).toBe(r.cashAtRetirementHorizon);
    // Frozen past retirement.
    expect(post.surplusAccrual).toBe(r.surplusAccrualToRet);
    expect(post.cash).toBe(r.cashAtRetirementHorizon);
  });

  it("pre-retirement point is NOT frozen (sanity — below the retirement value)", () => {
    for (const growth of [
      { incomeGrowthAnnual: 0, expenseGrowthAnnual: 0 },
      { incomeGrowthAnnual: 0.03, expenseGrowthAnnual: 0.02 },
    ]) {
      const r = buildAgeAssetProjection({ ...base, ...growth });
      const pre = prePoint(r);
      expect(pre.surplusAccrual).toBeLessThan(r.surplusAccrualToRet);
      expect(pre.cash).toBeLessThan(r.cashAtRetirementHorizon);
    }
  });

  it("already retired (monthsToRet=0): zero accrual, chart agrees with scalar", () => {
    const r = buildAgeAssetProjection({
      ...base,
      monthsToRet: 0,
      incomeGrowthAnnual: 0.03,
      expenseGrowthAnnual: 0.02,
    });
    expect(r.surplusAccrualToRet).toBe(0);
    expect(r.cashAtRetirementHorizon).toBe(base.cashTotal);
    for (const p of r.perAge) {
      expect(p.surplusAccrual).toBe(0);
      expect(p.cash).toBe(base.cashTotal);
    }
  });
});
