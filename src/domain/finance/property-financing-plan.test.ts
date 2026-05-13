import { describe, expect, it } from "vitest";
import {
  estimateFinancingNeed,
  resolveGuidedCashDownpayment,
} from "./property-financing-plan";

describe("resolveGuidedCashDownpayment", () => {
  it("resolves 25% and 20%", () => {
    expect(
      resolveGuidedCashDownpayment({
        purchasePrice: 1_000_000,
        preset: "pct_25",
        customPercent: null,
        customAmount: null,
      })
    ).toEqual({ ok: true, depositTotal: 250_000 });
    expect(
      resolveGuidedCashDownpayment({
        purchasePrice: 1_000_000,
        preset: "pct_20",
        customPercent: null,
        customAmount: null,
      })
    ).toEqual({ ok: true, depositTotal: 200_000 });
  });

  it("uses custom amount when provided", () => {
    const r = resolveGuidedCashDownpayment({
      purchasePrice: 800_000,
      preset: "custom",
      customPercent: null,
      customAmount: 120_000,
    });
    expect(r).toEqual({ ok: true, depositTotal: 120_000 });
  });
});

describe("estimateFinancingNeed", () => {
  it("subtracts BSD only when flag is on", () => {
    expect(
      estimateFinancingNeed({
        purchasePrice: 1_000_000,
        cashDownpayment: 250_000,
        buyersStampDuty: 24_600,
        includeBuyersStampDutyInLoan: true,
      })
    ).toEqual({ ok: true, loanPrincipal: 725_400 });
    expect(
      estimateFinancingNeed({
        purchasePrice: 1_000_000,
        cashDownpayment: 250_000,
        buyersStampDuty: 24_600,
        includeBuyersStampDutyInLoan: false,
      })
    ).toEqual({ ok: true, loanPrincipal: 750_000 });
  });
});
