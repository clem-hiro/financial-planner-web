import { describe, expect, it } from "vitest";
import {
  cumulativeVehicleProceedsToCash,
  effectiveLoanBalance,
  loanMonthsRemainingResolved,
  vehicleGrossAssetEstimate,
  vehicleNetEquity,
  vehicleNetListedBeforeLiquidation,
  vehicleNetProceedsAtCoeMonthEnd,
  type VehicleValuationInput,
} from "./vehicle-sg";

const base: VehicleValuationInput = {
  vehicleStatus: "active",
  loanBalanceStored: 20_000,
  loanMonthlyPayment: 1_000,
  loanMonthsRemaining: null,
  loanEndYm: "2028-06",
};

describe("loanMonthsRemainingResolved", () => {
  it("derives months from loan end month", () => {
    const n = loanMonthsRemainingResolved(base, new Date(2026, 5, 15));
    expect(n).toBe(24);
  });

  it("falls back to manual months remaining", () => {
    const input: VehicleValuationInput = {
      ...base,
      loanEndYm: null,
      loanMonthsRemaining: 12,
    };
    expect(loanMonthsRemainingResolved(input, new Date())).toBe(12);
  });
});

describe("effectiveLoanBalance", () => {
  it("uses stored outstanding balance when set", () => {
    expect(effectiveLoanBalance(base, new Date())).toBe(20_000);
  });

  it("estimates from instalment × months when balance is zero", () => {
    const input: VehicleValuationInput = {
      ...base,
      loanBalanceStored: 0,
    };
    expect(effectiveLoanBalance(input, new Date(2026, 5, 15))).toBe(24_000);
  });
});

describe("vehicleNetEquity", () => {
  it("is liability-only (negative loan balance)", () => {
    expect(vehicleNetEquity(base, new Date())).toBe(-20_000);
  });

  it("is zero for planned vehicles", () => {
    expect(
      vehicleNetEquity({ ...base, vehicleStatus: "planned" }, new Date())
    ).toBe(0);
  });

  it("matches listed before liquidation", () => {
    expect(vehicleNetListedBeforeLiquidation(base, new Date())).toBe(-20_000);
  });
});

describe("deprecated valuation paths", () => {
  it("returns zero gross asset and proceeds", () => {
    expect(vehicleGrossAssetEstimate(base, new Date())).toBe(0);
    expect(vehicleNetProceedsAtCoeMonthEnd(base)).toBe(0);
    expect(cumulativeVehicleProceedsToCash([base], new Date())).toBe(0);
  });
});

