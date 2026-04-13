import { describe, expect, it } from "vitest";
import {
  bodyValueEstimate,
  completedMonthsSinceReg,
  effectiveLoanBalance,
  loanMonthsRemainingResolved,
  monthsBetweenYearMonths,
  parfRebateEstimateIllustrative,
  usesDeregistrationAnchors,
  usesImplicitArfBodyFallbackOnly,
  usesMarketValueGross,
  usesNoParfBasisImplicitWithCoeTaper,
  usesPurchaseToCoeTerminalSchedule,
  usesRebateRemainingToTerminal,
  cumulativeVehicleProceedsToCash,
  vehicleGrossAssetEstimate,
  vehicleGrossFromRebatesRemainingToTerminal,
  vehicleNetEquity,
  vehicleNetListedBeforeLiquidation,
  vehicleNetProceedsAtCoeMonthEnd,
  type VehicleValuationInput,
} from "./vehicle-sg";

const base: VehicleValuationInput = {
  vehicleStatus: "active",
  currentMarketValue: null,
  firstRegistrationYm: null,
  onTheRoadPaid: 0,
  arfForParf: null,
  bodyOpenMarketAtPurchase: null,
  bodyDepreciationYears: 10,
  coeExpiryYm: null,
  terminalRecoveryAtCoeExpiry: null,
  parfIfDeregisteredToday: null,
  coeIfDeregisteredToday: null,
  bodyScrapIfDeregisteredToday: null,
  loanBalanceStored: 0,
  loanMonthlyPayment: 0,
  loanMonthsRemaining: null,
  loanEndYm: null,
  loanAnnualNominalRate: null,
  loanPreferStoredBalance: false,
  loanSimpleRemainingEstimate: false,
};

describe("monthsBetweenYearMonths", () => {
  it("counts months from registration to later month", () => {
    expect(monthsBetweenYearMonths("2024-06", "2025-07")).toBe(13);
  });
});

describe("parfRebateEstimateIllustrative", () => {
  it("drops 10% per full year up to 10 years", () => {
    const asOf = new Date(2026, 5, 15);
    expect(
      parfRebateEstimateIllustrative(50_000, "2025-06", asOf)
    ).toBeCloseTo(45_000, 5);
    expect(
      parfRebateEstimateIllustrative(50_000, "2015-06", asOf)
    ).toBe(0);
  });
});

describe("effectiveLoanBalance", () => {
  it("uses PV when payment and months are set", () => {
    const input: VehicleValuationInput = {
      ...base,
      firstRegistrationYm: "2024-01",
      onTheRoadPaid: 100_000,
      loanBalanceStored: 50_000,
      loanMonthlyPayment: 1000,
      loanMonthsRemaining: 36,
      loanAnnualNominalRate: 0.03,
    };
    const pv = effectiveLoanBalance(input);
    expect(pv).toBeGreaterThan(0);
    expect(pv).toBeLessThan(36_000);
  });

  it("derives months from loan_end_ym", () => {
    const asOf = new Date(2025, 5, 1);
    const input: VehicleValuationInput = {
      ...base,
      loanMonthlyPayment: 800,
      loanEndYm: "2026-06",
      loanAnnualNominalRate: 0.03,
      loanBalanceStored: 99_000,
    };
    expect(loanMonthsRemainingResolved(input, asOf)).toBe(12);
    const pv = effectiveLoanBalance(input, asOf);
    expect(pv).toBeGreaterThan(0);
    expect(pv).toBeLessThan(800 * 12);
  });

  it("uses stored balance only when instalment is not set (balance-only row)", () => {
    const input: VehicleValuationInput = {
      ...base,
      firstRegistrationYm: "2024-01",
      onTheRoadPaid: 100_000,
      loanBalanceStored: 42_000,
    };
    expect(effectiveLoanBalance(input)).toBe(42_000);
  });

  it("ignores typed loan balance when instalment + loan end are set and statement mode is off", () => {
    const asOf = new Date(2025, 5, 1);
    const input: VehicleValuationInput = {
      ...base,
      loanMonthlyPayment: 924,
      loanEndYm: "2026-08",
      loanBalanceStored: 99_999,
      loanPreferStoredBalance: false,
    };
    const pv = effectiveLoanBalance(input, asOf);
    expect(pv).not.toBe(99_999);
    expect(pv).toBeGreaterThan(0);
    expect(pv).toBeLessThan(924 * 20);
  });

  it("returns 0 loan when instalment is set but remaining months cannot be resolved", () => {
    const input: VehicleValuationInput = {
      ...base,
      loanMonthlyPayment: 500,
      loanEndYm: null,
      loanMonthsRemaining: null,
      loanBalanceStored: 20_000,
      loanPreferStoredBalance: false,
    };
    expect(effectiveLoanBalance(input)).toBe(0);
  });

  it("uses payment × months when loanSimpleRemainingEstimate is set", () => {
    const asOf = new Date(2025, 5, 1);
    const input: VehicleValuationInput = {
      ...base,
      loanMonthlyPayment: 924,
      loanEndYm: "2026-08",
      loanPreferStoredBalance: false,
      loanSimpleRemainingEstimate: true,
    };
    const n = loanMonthsRemainingResolved(input, asOf);
    expect(n).not.toBeNull();
    expect(effectiveLoanBalance(input, asOf)).toBeCloseTo(924 * (n as number), 5);
  });

  it("uses stored balance when loanPreferStoredBalance is set", () => {
    const asOf = new Date(2025, 5, 1);
    const input: VehicleValuationInput = {
      ...base,
      loanPreferStoredBalance: true,
      loanMonthlyPayment: 800,
      loanEndYm: "2026-06",
      loanBalanceStored: 4620,
      loanAnnualNominalRate: 0.03,
    };
    expect(effectiveLoanBalance(input, asOf)).toBe(4620);
  });
});

describe("usesMarketValueGross", () => {
  it("uses listing value as gross and overrides PARF/COE", () => {
    const input: VehicleValuationInput = {
      ...base,
      currentMarketValue: 14_300,
      parfIfDeregisteredToday: 5000,
      coeIfDeregisteredToday: 3000,
      firstRegistrationYm: "2022-01",
      coeExpiryYm: "2032-01",
      terminalRecoveryAtCoeExpiry: 1000,
    };
    expect(usesMarketValueGross(input)).toBe(true);
    expect(vehicleGrossAssetEstimate(input, new Date())).toBe(14_300);
  });

  it("does not add COE liquidation cash when gross is listing-only (no phantom bump)", () => {
    const input: VehicleValuationInput = {
      ...base,
      currentMarketValue: 14_300,
      firstRegistrationYm: "2022-01",
      coeExpiryYm: "2038-05",
      loanBalanceStored: 0,
      loanPreferStoredBalance: true,
    };
    expect(vehicleNetProceedsAtCoeMonthEnd(input)).toBe(0);
    expect(
      cumulativeVehicleProceedsToCash([input], new Date(2038, 5, 15))
    ).toBe(0);
  });
});

describe("vehicleGrossFromPurchaseToTerminalLinear", () => {
  it("starts at OTR on purchase month and reaches terminal at COE expiry", () => {
    const input: VehicleValuationInput = {
      ...base,
      firstRegistrationYm: "2024-11",
      onTheRoadPaid: 26_000,
      coeExpiryYm: "2026-08",
      terminalRecoveryAtCoeExpiry: 6000,
    };
    expect(usesPurchaseToCoeTerminalSchedule(input)).toBe(true);
    expect(
      vehicleGrossAssetEstimate(input, new Date(2024, 10, 15))
    ).toBeCloseTo(26_000, 5);
    expect(
      vehicleGrossAssetEstimate(input, new Date(2026, 7, 1))
    ).toBeCloseTo(6000, 5);
  });

  it("interpolates part-way between purchase and COE expiry", () => {
    const input: VehicleValuationInput = {
      ...base,
      firstRegistrationYm: "2024-11",
      onTheRoadPaid: 26_000,
      coeExpiryYm: "2026-08",
      terminalRecoveryAtCoeExpiry: 6000,
    };
    const totalM = 21;
    const asOf = new Date(2025, 10, 1);
    const elapsed = 12;
    const expected = 26_000 + (6000 - 26_000) * (elapsed / totalM);
    expect(vehicleGrossAssetEstimate(input, asOf)).toBeCloseTo(expected, 3);
  });

  it("uses OTR schedule when rebates are not set (even if terminal + reg + COE)", () => {
    const input: VehicleValuationInput = {
      ...base,
      firstRegistrationYm: "2024-11",
      onTheRoadPaid: 26_000,
      coeExpiryYm: "2026-08",
      terminalRecoveryAtCoeExpiry: 6000,
    };
    expect(usesRebateRemainingToTerminal(input)).toBe(false);
    const asOf = new Date(2025, 10, 1);
    expect(vehicleGrossAssetEstimate(input, asOf)).toBeCloseTo(
      26_000 + (6000 - 26_000) * (12 / 21),
      3
    );
  });
});

describe("vehicleGrossFromRebatesRemainingToTerminal", () => {
  const rebateInput = (): VehicleValuationInput => ({
    ...base,
    firstRegistrationYm: "2024-11",
    coeExpiryYm: "2026-08",
    terminalRecoveryAtCoeExpiry: 6000,
    parfIfDeregisteredToday: 5807,
    coeIfDeregisteredToday: 1891,
  });

  it("is active when terminal + PARF/COE + first reg + COE expiry are set", () => {
    expect(usesRebateRemainingToTerminal(rebateInput())).toBe(true);
  });

  it("equals terminal at COE expiry month and scales with remaining months", () => {
    const input = rebateInput();
    const S = 5807 + 1891;
    const W = 21;
    expect(
      vehicleGrossFromRebatesRemainingToTerminal(input, new Date(2026, 7, 1))
    ).toBeCloseTo(6000, 3);
    const R_nov_2024 = 21;
    expect(
      vehicleGrossFromRebatesRemainingToTerminal(input, new Date(2024, 10, 15))
    ).toBeCloseTo(6000 + (S - 6000) * (R_nov_2024 / W), 3);
    const R_apr_2026 = monthsBetweenYearMonths("2026-04", "2026-08");
    expect(
      vehicleGrossFromRebatesRemainingToTerminal(input, new Date(2026, 3, 15))
    ).toBeCloseTo(6000 + (S - 6000) * (R_apr_2026 / W), 3);
  });

  it("takes rebate ramp over OTR when PARF+COE and terminal are all set", () => {
    const input: VehicleValuationInput = {
      ...rebateInput(),
      onTheRoadPaid: 26_000,
    };
    const asOf = new Date(2025, 10, 1);
    const S = 5807 + 1891;
    const W = 21;
    const R = monthsBetweenYearMonths("2025-11", "2026-08");
    expect(vehicleGrossAssetEstimate(input, asOf)).toBeCloseTo(
      6000 + (S - 6000) * (R / W),
      3
    );
    expect(vehicleGrossAssetEstimate(input, asOf)).not.toBeCloseTo(
      26_000 + (6000 - 26_000) * (12 / 21),
      0
    );
  });
});

describe("vehicleGrossAssetEstimate with OneMotoring anchors", () => {
  it("sums PARF and COE when either is set", () => {
    const input: VehicleValuationInput = {
      ...base,
      parfIfDeregisteredToday: 25_000,
      coeIfDeregisteredToday: 12_000,
    };
    expect(usesDeregistrationAnchors(input)).toBe(true);
    expect(vehicleGrossAssetEstimate(input, new Date())).toBe(37_000);
  });

  it("adds optional body/scrap on top of PARF + COE", () => {
    const input: VehicleValuationInput = {
      ...base,
      parfIfDeregisteredToday: 5807,
      coeIfDeregisteredToday: 1891,
      bodyScrapIfDeregisteredToday: 193,
    };
    expect(vehicleGrossAssetEstimate(input, new Date())).toBeCloseTo(7891, 5);
  });
});

describe("vehicleNetEquity", () => {
  it("returns 0 for planned vehicles", () => {
    const input: VehicleValuationInput = {
      ...base,
      vehicleStatus: "planned",
      onTheRoadPaid: 150_000,
    };
    expect(vehicleNetEquity(input, new Date())).toBe(0);
  });

  it("combines body, PARF, and loan for active", () => {
    const asOf = new Date(2025, 0, 15);
    const input: VehicleValuationInput = {
      ...base,
      firstRegistrationYm: "2024-01",
      onTheRoadPaid: 120_000,
      arfForParf: 40_000,
      bodyOpenMarketAtPurchase: 70_000,
      loanBalanceStored: 60_000,
    };
    const months = completedMonthsSinceReg("2024-01", asOf);
    expect(months).toBe(12);
    const body = bodyValueEstimate(input, asOf);
    expect(body).toBeGreaterThan(0);
    const net = vehicleNetEquity(input, asOf);
    expect(net).toBeLessThan(body + 40_000);
  });
});

describe("implicit path with no ARF (e.g. motorcycle) — no phantom cash at COE", () => {
  it("tapers gross to zero by COE when ARF is unset and OneMotoring rows are blank", () => {
    const input: VehicleValuationInput = {
      ...base,
      firstRegistrationYm: "2023-06",
      onTheRoadPaid: 12_000,
      arfForParf: null,
      bodyDepreciationYears: 10,
      coeExpiryYm: "2033-06",
      loanBalanceStored: 0,
    };
    expect(usesImplicitArfBodyFallbackOnly(input)).toBe(true);
    expect(usesNoParfBasisImplicitWithCoeTaper(input)).toBe(true);
    const early = vehicleGrossAssetEstimate(input, new Date(2023, 5, 15));
    expect(early).toBeGreaterThan(0);
    const atCoe = vehicleGrossAssetEstimate(input, new Date(2033, 5, 28));
    expect(atCoe).toBe(0);
    expect(vehicleNetProceedsAtCoeMonthEnd(input)).toBe(0);
  });

  it("does not taper when ARF for PARF is set (car-style fallback)", () => {
    const input: VehicleValuationInput = {
      ...base,
      firstRegistrationYm: "2023-06",
      onTheRoadPaid: 120_000,
      arfForParf: 40_000,
      bodyOpenMarketAtPurchase: 70_000,
      bodyDepreciationYears: 10,
      coeExpiryYm: "2033-06",
      loanBalanceStored: 0,
    };
    expect(usesNoParfBasisImplicitWithCoeTaper(input)).toBe(false);
    const midLife = vehicleGrossAssetEstimate(input, new Date(2028, 5, 15));
    expect(midLife).toBeGreaterThan(25_000);
  });
});

describe("vehicle liquidation to modeled cash", () => {
  const purchaseToCoeInput = (): VehicleValuationInput => ({
    vehicleStatus: "active",
    currentMarketValue: null,
    firstRegistrationYm: "2020-01",
    onTheRoadPaid: 100_000,
    arfForParf: null,
    bodyOpenMarketAtPurchase: null,
    bodyDepreciationYears: 10,
    coeExpiryYm: "2030-06",
    terminalRecoveryAtCoeExpiry: 25_000,
    parfIfDeregisteredToday: null,
    coeIfDeregisteredToday: null,
    bodyScrapIfDeregisteredToday: null,
    loanBalanceStored: 0,
    loanMonthlyPayment: 0,
    loanMonthsRemaining: null,
    loanEndYm: null,
    loanAnnualNominalRate: null,
    loanPreferStoredBalance: true,
  });

  it("lists vehicle net before COE month, zero after", () => {
    const v = purchaseToCoeInput();
    const before = vehicleNetListedBeforeLiquidation(v, new Date(2030, 4, 15));
    expect(before).toBeGreaterThan(0);
    const after = vehicleNetListedBeforeLiquidation(v, new Date(2030, 6, 15));
    expect(after).toBe(0);
  });

  it("adds one-time proceeds to cumulative cash after COE", () => {
    const v = purchaseToCoeInput();
    const proceeds = vehicleNetProceedsAtCoeMonthEnd(v);
    expect(proceeds).toBeGreaterThanOrEqual(25_000);
    const beforeCoe = cumulativeVehicleProceedsToCash(
      [v],
      new Date(2030, 4, 15)
    );
    expect(beforeCoe).toBe(0);
    const afterCoe = cumulativeVehicleProceedsToCash(
      [v],
      new Date(2030, 7, 1)
    );
    expect(afterCoe).toBe(proceeds);
  });
});
