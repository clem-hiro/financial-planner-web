import { describe, expect, it } from "vitest";
import {
  EARNED_INCOME_RELIEF_BY_AGE,
  INCOME_TAX_YA_2026,
  TOTAL_RELIEF_CAP_SGD,
  applyRebate,
  chargeableIncomeFromReliefs,
  computeAnnualTax,
  earnedIncomeReliefForAge,
  grossTaxForChargeableIncome,
  monthlyGiroFromNetTax,
  type IncomeTaxReliefBundle,
} from "./sg-income-tax";

const ZERO_RELIEFS: IncomeTaxReliefBundle = {
  spouseReliefSgd: 0,
  qualifyingChildReliefSgd: 0,
  handicappedChildReliefSgd: 0,
  workingMotherChildReliefSgd: 0,
  parentReliefSgd: 0,
  grandparentCaregiverReliefSgd: 0,
  handicappedSiblingReliefSgd: 0,
  cpfCashTopupSelfSgd: 0,
  cpfCashTopupFamilySgd: 0,
  srsContributionSgd: 0,
  nsmanSelfReliefSgd: 0,
  nsmanWifeReliefSgd: 0,
  nsmanParentReliefSgd: 0,
  courseFeesReliefSgd: 0,
  lifeInsuranceReliefSgd: 0,
  cpfMedisaveVoluntarySgd: 0,
  otherReliefsAmountSgd: 0,
};

describe("INCOME_TAX_YA_2026 bracket table", () => {
  it("covers 13 brackets with a final open-ended one", () => {
    expect(INCOME_TAX_YA_2026).toHaveLength(13);
    expect(INCOME_TAX_YA_2026[0]!.lowerSgd).toBe(0);
    expect(INCOME_TAX_YA_2026[12]!.upperSgd).toBeNull();
    expect(INCOME_TAX_YA_2026[12]!.rate).toBe(0.24);
  });

  it("exposes the $80K relief cap constant", () => {
    expect(TOTAL_RELIEF_CAP_SGD).toBe(80_000);
  });

  it("exposes earned-income relief amounts by age band", () => {
    expect(EARNED_INCOME_RELIEF_BY_AGE.under55).toBe(1_000);
    expect(EARNED_INCOME_RELIEF_BY_AGE.age55to59).toBe(6_000);
    expect(EARNED_INCOME_RELIEF_BY_AGE.age60Plus).toBe(8_000);
  });
});

describe("grossTaxForChargeableIncome — bracket boundaries", () => {
  it("returns 0 for chargeable income of 0", () => {
    expect(grossTaxForChargeableIncome(0)).toBe(0);
  });

  it("returns 0 at the top of the zero-tax band ($20,000)", () => {
    expect(grossTaxForChargeableIncome(20_000)).toBe(0);
  });

  it("returns $0.02 at $20,001 (one dollar into the 2% band)", () => {
    expect(grossTaxForChargeableIncome(20_001)).toBeCloseTo(0.02, 6);
  });

  it("returns $200 at $30,000 (cum at 30K boundary)", () => {
    expect(grossTaxForChargeableIncome(30_000)).toBe(200);
  });

  it("returns $3,350 at $80,000 (cum at 80K boundary)", () => {
    expect(grossTaxForChargeableIncome(80_000)).toBe(3_350);
  });

  it("returns $7,950 at $120,000 (cum at 120K boundary)", () => {
    expect(grossTaxForChargeableIncome(120_000)).toBe(7_950);
  });

  it("returns $44,550 at $320,000 (cum at 320K boundary)", () => {
    expect(grossTaxForChargeableIncome(320_000)).toBe(44_550);
  });

  it("returns $84,150 at $500,000 (cum at 500K boundary)", () => {
    expect(grossTaxForChargeableIncome(500_000)).toBe(84_150);
  });

  it("returns $199,150 at $1,000,000 (cum at 1M boundary)", () => {
    expect(grossTaxForChargeableIncome(1_000_000)).toBe(199_150);
  });

  it("returns $199,150.24 at $1,000,001 (one dollar into the 24% top band)", () => {
    expect(grossTaxForChargeableIncome(1_000_001)).toBeCloseTo(199_150.24, 6);
  });

  it("returns 0 for negative chargeable income (defensive)", () => {
    expect(grossTaxForChargeableIncome(-5_000)).toBe(0);
  });
});

describe("earnedIncomeReliefForAge — age boundaries", () => {
  it("returns $1,000 at age 54 (under 55)", () => {
    expect(earnedIncomeReliefForAge(54)).toBe(1_000);
  });

  it("returns $6,000 at age 55 (55-59 band lower edge)", () => {
    expect(earnedIncomeReliefForAge(55)).toBe(6_000);
  });

  it("returns $6,000 at age 59 (55-59 band upper edge)", () => {
    expect(earnedIncomeReliefForAge(59)).toBe(6_000);
  });

  it("returns $8,000 at age 60 (60+ band lower edge)", () => {
    expect(earnedIncomeReliefForAge(60)).toBe(8_000);
  });
});

describe("chargeableIncomeFromReliefs — $80K cap edges", () => {
  it("does not apply cap when reliefs sum to 79,999", () => {
    const r = chargeableIncomeFromReliefs({
      annualIncomeSgd: 200_000,
      totalReliefsSgd: 79_999,
    });
    expect(r.totalReliefBeforeCap).toBe(79_999);
    expect(r.totalReliefAfterCap).toBe(79_999);
    expect(r.reliefCapApplied).toBe(false);
    expect(r.chargeableIncome).toBe(120_001);
  });

  it("does not apply cap when reliefs sum to exactly 80,000", () => {
    const r = chargeableIncomeFromReliefs({
      annualIncomeSgd: 200_000,
      totalReliefsSgd: 80_000,
    });
    expect(r.reliefCapApplied).toBe(false);
    expect(r.totalReliefAfterCap).toBe(80_000);
    expect(r.chargeableIncome).toBe(120_000);
  });

  it("applies cap when reliefs sum to 80,001", () => {
    const r = chargeableIncomeFromReliefs({
      annualIncomeSgd: 200_000,
      totalReliefsSgd: 80_001,
    });
    expect(r.totalReliefBeforeCap).toBe(80_001);
    expect(r.totalReliefAfterCap).toBe(80_000);
    expect(r.reliefCapApplied).toBe(true);
    expect(r.chargeableIncome).toBe(120_000);
  });

  it("clamps chargeable income to 0 when reliefs exceed annual income", () => {
    const r = chargeableIncomeFromReliefs({
      annualIncomeSgd: 30_000,
      totalReliefsSgd: 50_000,
    });
    expect(r.chargeableIncome).toBe(0);
  });
});

describe("applyRebate — YA 2026-style percent + cap", () => {
  it("caps rebate at the configured maximum when percent yield exceeds it", () => {
    // 60% of $1000 = $600, but cap is $200 → rebate clamped to $200
    const r = applyRebate(1_000, 60, 200);
    expect(r.rebateApplied).toBe(200);
    expect(r.netTax).toBe(800);
  });

  it("uses the percent yield when it stays under the cap", () => {
    // 60% of $100 = $60 ≤ $200 cap
    const r = applyRebate(100, 60, 200);
    expect(r.rebateApplied).toBe(60);
    expect(r.netTax).toBe(40);
  });

  it("is a no-op when percent is null (no rebate configured)", () => {
    const r = applyRebate(500, null, null);
    expect(r.rebateApplied).toBe(0);
    expect(r.netTax).toBe(500);
  });

  it("produces zero rebate and zero net tax when gross tax is zero", () => {
    const r = applyRebate(0, 60, 200);
    expect(r.rebateApplied).toBe(0);
    expect(r.netTax).toBe(0);
  });
});

describe("monthlyGiroFromNetTax — 2dp rounding", () => {
  it("splits $12,000 evenly to $1,000.00 per month", () => {
    expect(monthlyGiroFromNetTax(12_000)).toBe(1_000);
  });

  it("rounds $100 / 12 to $8.33", () => {
    expect(monthlyGiroFromNetTax(100)).toBe(8.33);
  });

  it("returns 0 for zero net tax", () => {
    expect(monthlyGiroFromNetTax(0)).toBe(0);
  });
});

describe("computeAnnualTax — orchestrator", () => {
  it("auto-derives earned-income relief even when typed reliefs and CPF are zero", () => {
    // age 30, $50K income, no CPF (somehow), no typed reliefs.
    // Earned-income relief alone = 1,000. Chargeable = 49,000.
    // Tax: cum at $40K (550) + (9000 × 7%) = 550 + 630 = 1180.
    const r = computeAnnualTax({
      annualIncomeSgd: 50_000,
      age: 30,
      cpfReliefSgd: 0,
      reliefs: ZERO_RELIEFS,
      rebatePercent: null,
      rebateCapSgd: null,
    });
    expect(r.earnedIncomeReliefSgd).toBe(1_000);
    expect(r.totalReliefBeforeCapSgd).toBe(1_000);
    expect(r.totalReliefAfterCapSgd).toBe(1_000);
    expect(r.reliefCapApplied).toBe(false);
    expect(r.chargeableIncomeSgd).toBe(49_000);
    expect(r.grossTaxSgd).toBeCloseTo(1_180, 6);
    expect(r.rebateAppliedSgd).toBe(0);
    expect(r.netTaxSgd).toBeCloseTo(1_180, 6);
  });

  it("sums CPF + earned-income + typed reliefs before applying the $80K cap", () => {
    // age 30 (earned-income 1K), CPF 37,740, typed reliefs sum to 50K.
    // Total before cap = 1000 + 37,740 + 50,000 = 88,740 → after cap = 80,000.
    // Chargeable = 200,000 - 80,000 = 120,000 → gross tax = 7,950.
    const r = computeAnnualTax({
      annualIncomeSgd: 200_000,
      age: 30,
      cpfReliefSgd: 37_740,
      reliefs: { ...ZERO_RELIEFS, spouseReliefSgd: 2_000, parentReliefSgd: 9_000, srsContributionSgd: 15_300, cpfCashTopupSelfSgd: 16_000, cpfMedisaveVoluntarySgd: 7_700 },
      rebatePercent: null,
      rebateCapSgd: null,
    });
    expect(r.totalReliefBeforeCapSgd).toBe(88_740);
    expect(r.totalReliefAfterCapSgd).toBe(80_000);
    expect(r.reliefCapApplied).toBe(true);
    expect(r.chargeableIncomeSgd).toBe(120_000);
    expect(r.grossTaxSgd).toBe(7_950);
    expect(r.netTaxSgd).toBe(7_950);
    expect(r.monthlyGiroSgd).toBe(662.5);
  });

  it("applies the YA 2026 rebate (60% / $200 cap) and reports monthly GIRO", () => {
    // age 30, $50K income, CPF $0, zero typed reliefs.
    // Chargeable = 49,000 → gross = 1,180. Rebate = min(0.6*1180=708, 200) = 200.
    // Net = 980. Monthly = 81.666... → 81.67.
    const r = computeAnnualTax({
      annualIncomeSgd: 50_000,
      age: 30,
      cpfReliefSgd: 0,
      reliefs: ZERO_RELIEFS,
      rebatePercent: 60,
      rebateCapSgd: 200,
    });
    expect(r.grossTaxSgd).toBeCloseTo(1_180, 6);
    expect(r.rebateAppliedSgd).toBe(200);
    expect(r.netTaxSgd).toBeCloseTo(980, 6);
    expect(r.monthlyGiroSgd).toBe(81.67);
  });
});
