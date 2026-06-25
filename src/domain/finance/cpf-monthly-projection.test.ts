import { describe, expect, it } from "vitest";
import {
  basicHealthcareSumForYearSg,
  buildCpfMonthlyProjectionSeries,
} from "./cpf-monthly-projection";

describe("buildCpfMonthlyProjectionSeries", () => {
  it("uses 2026 CPF allocation ratios for age 35 and below", () => {
    const series = buildCpfMonthlyProjectionSeries({
      startYearMonth: "2026-06",
      horizonMonths: 1,
      birthDate: "1995-01-15",
      grossMonthly: 7_000,
      initial: {
        oa: 0,
        sa: 0,
        ma: 0,
        oaAnnualRate: 0,
        saAnnualRate: 0,
        maAnnualRate: 0,
        cpfisMonthlyFromOa: 0,
        cpfisNotionalBalance: 0,
        cpfisAnnualReturn: 0,
      },
      housingLoans: [],
    });

    expect(series[0].oa).toBeCloseTo(1_610.2, 2);
    expect(series[0].sa).toBeCloseTo(419.84, 2);
    expect(series[0].ma).toBeCloseTo(559.96, 2);
  });

  it("moves the retirement allocation to RA after 55", () => {
    const series = buildCpfMonthlyProjectionSeries({
      startYearMonth: "2026-06",
      horizonMonths: 1,
      birthDate: "1970-01-15",
      grossMonthly: 7_000,
      initial: {
        oa: 0,
        sa: 0,
        ma: 0,
        ra: 0,
        oaAnnualRate: 0,
        saAnnualRate: 0,
        maAnnualRate: 0,
        cpfisMonthlyFromOa: 0,
        cpfisNotionalBalance: 0,
        cpfisAnnualReturn: 0,
      },
      housingLoans: [],
    });

    expect(series[0].oa).toBeCloseTo(840.14, 2);
    expect(series[0].sa).toBe(0);
    expect(series[0].ra).toBeCloseTo(804.92, 2);
    expect(series[0].ma).toBeCloseTo(734.94, 2);
  });

  it("applies the next CPF age band from the month after the birthday month", () => {
    const series = buildCpfMonthlyProjectionSeries({
      startYearMonth: "2026-05",
      horizonMonths: 2,
      birthDate: "1971-05-01",
      grossMonthly: 7_000,
      initial: {
        oa: 0,
        sa: 0,
        ma: 0,
        ra: 0,
        oaAnnualRate: 0,
        saAnnualRate: 0,
        maAnnualRate: 0,
        cpfisMonthlyFromOa: 0,
        cpfisNotionalBalance: 0,
        cpfisAnnualReturn: 0,
      },
      housingLoans: [],
    });

    expect(series[0].yearMonth).toBe("2026-05");
    expect(series[0].oa).toBeCloseTo(1_050.25, 2);
    expect(series[0].sa).toBeCloseTo(804.97, 2);
    expect(series[0].ra).toBe(0);
    expect(series[1].yearMonth).toBe("2026-06");
    expect(series[1].ra).toBeCloseTo(804.92, 2);
  });

  it("reduces OA by downpayment in completion month", () => {
    const series = buildCpfMonthlyProjectionSeries({
      startYearMonth: "2026-01",
      horizonMonths: 6,
      birthDate: "1990-01-15",
      grossMonthly: 0,
      initial: {
        oa: 50_000,
        sa: 0,
        ma: 0,
        oaAnnualRate: 0,
        saAnnualRate: 0,
        maAnnualRate: 0,
        cpfisMonthlyFromOa: 0,
        cpfisNotionalBalance: 0,
        cpfisAnnualReturn: 0,
      },
      housingLoans: [
        {
          completionMonth: "2026-03",
          firstPaymentMonth: "2026-06",
          downpaymentFromOa: 20_000,
          feesFromOa: 0,
          principal: 400_000,
          annualNominalRate: 0.03,
          termMonths: 12,
          oaShareOfPayment: 1,
          maxOaPerMonth: null,
        },
      ],
    });
    const feb = series.find((p) => p.yearMonth === "2026-02");
    const mar = series.find((p) => p.yearMonth === "2026-03");
    expect(feb?.oa).toBe(50_000);
    expect(mar?.oa).toBeCloseTo(30_000, 5);
  });

  it("uses explicit housing upfront OA event months when present", () => {
    const series = buildCpfMonthlyProjectionSeries({
      startYearMonth: "2026-01",
      horizonMonths: 5,
      birthDate: "1990-01-15",
      grossMonthly: 0,
      initial: {
        oa: 50_000,
        sa: 0,
        ma: 0,
        oaAnnualRate: 0,
        saAnnualRate: 0,
        maAnnualRate: 0,
        cpfisMonthlyFromOa: 0,
        cpfisNotionalBalance: 0,
        cpfisAnnualReturn: 0,
      },
      housingLoans: [
        {
          completionMonth: "2026-03",
          firstPaymentMonth: "2026-06",
          downpaymentFromOa: 40_000,
          feesFromOa: 5_000,
          upfrontOaEvents: [
            { yearMonth: "2026-02", amount: 10_000 },
            { yearMonth: "2026-04", amount: 12_000 },
          ],
          principal: 400_000,
          annualNominalRate: 0.03,
          termMonths: 12,
          oaShareOfPayment: 1,
          maxOaPerMonth: null,
        },
      ],
    });
    expect(series.find((p) => p.yearMonth === "2026-02")?.oa).toBe(40_000);
    expect(series.find((p) => p.yearMonth === "2026-03")?.oa).toBe(40_000);
    expect(series.find((p) => p.yearMonth === "2026-04")?.oa).toBe(28_000);
  });

  it("caps OA toward mortgage payment when OA is low", () => {
    const series = buildCpfMonthlyProjectionSeries({
      startYearMonth: "2026-01",
      horizonMonths: 4,
      birthDate: "1990-01-15",
      grossMonthly: 0,
      initial: {
        oa: 500,
        sa: 0,
        ma: 0,
        oaAnnualRate: 0,
        saAnnualRate: 0,
        maAnnualRate: 0,
        cpfisMonthlyFromOa: 0,
        cpfisNotionalBalance: 0,
        cpfisAnnualReturn: 0,
      },
      housingLoans: [
        {
          completionMonth: "2026-01",
          firstPaymentMonth: "2026-01",
          downpaymentFromOa: 0,
          feesFromOa: 0,
          principal: 10_000,
          annualNominalRate: 0,
          termMonths: 10,
          oaShareOfPayment: 1,
          maxOaPerMonth: null,
        },
      ],
    });
    const jan = series[0];
    expect(jan.oa).toBeLessThanOrEqual(0);
  });

  it("can leave recurring mortgage payments to the debt ledger while keeping upfront OA events", () => {
    const series = buildCpfMonthlyProjectionSeries({
      startYearMonth: "2026-01",
      horizonMonths: 2,
      birthDate: "1990-01-15",
      grossMonthly: 0,
      deductRecurringHousingPayments: false,
      initial: {
        oa: 50_000,
        sa: 0,
        ma: 0,
        oaAnnualRate: 0,
        saAnnualRate: 0,
        maAnnualRate: 0,
        cpfisMonthlyFromOa: 0,
        cpfisNotionalBalance: 0,
        cpfisAnnualReturn: 0,
      },
      housingLoans: [
        {
          completionMonth: "2026-01",
          firstPaymentMonth: "2026-01",
          downpaymentFromOa: 10_000,
          feesFromOa: 0,
          principal: 12_000,
          annualNominalRate: 0,
          termMonths: 12,
          oaShareOfPayment: 1,
          maxOaPerMonth: null,
        },
      ],
    });

    expect(series[0].oa).toBe(40_000);
    expect(series[1].oa).toBe(40_000);
  });

  it("applies annual salary growth on January after the start month", () => {
    const initial = {
      oa: 1_000,
      sa: 500,
      ma: 500,
      oaAnnualRate: 0,
      saAnnualRate: 0,
      maAnnualRate: 0,
      cpfisMonthlyFromOa: 0,
      cpfisNotionalBalance: 0,
      cpfisAnnualReturn: 0,
    };
    // Gross below OW monthly ceiling so a raise increases OW subject (at 8k gross the ceiling binds).
    const flat = buildCpfMonthlyProjectionSeries({
      startYearMonth: "2026-01",
      horizonMonths: 14,
      birthDate: "1990-01-15",
      grossMonthly: 5_000,
      annualSalaryGrowthNominal: 0,
      initial,
      housingLoans: [],
    });
    const raised = buildCpfMonthlyProjectionSeries({
      startYearMonth: "2026-01",
      horizonMonths: 14,
      birthDate: "1990-01-15",
      grossMonthly: 5_000,
      annualSalaryGrowthNominal: 0.5,
      initial,
      housingLoans: [],
    });
    expect(raised[13].totalCpf).toBeGreaterThan(flat[13].totalCpf);
  });

  it("adds annual bonus CPF in the payout month", () => {
    const series = buildCpfMonthlyProjectionSeries({
      startYearMonth: "2026-01",
      horizonMonths: 12,
      birthDate: "1990-01-15",
      grossMonthly: 5_000,
      annualBonus: 20_000,
      annualBonusPayoutMonth: 12,
      annualSalaryGrowthNominal: 0,
      initial: {
        oa: 0,
        sa: 0,
        ma: 0,
        oaAnnualRate: 0,
        saAnnualRate: 0,
        maAnnualRate: 0,
        cpfisMonthlyFromOa: 0,
        cpfisNotionalBalance: 0,
        cpfisAnnualReturn: 0,
      },
      housingLoans: [],
    });
    const nov = series.find((p) => p.yearMonth === "2026-11");
    const dec = series.find((p) => p.yearMonth === "2026-12");
    expect(dec?.totalCpf ?? 0).toBeGreaterThan(nov?.totalCpf ?? 0);
  });

  it("stops salary and bonus CPF inflows after employment ends while keeping non-employment flows", () => {
    const series = buildCpfMonthlyProjectionSeries({
      startYearMonth: "2026-01",
      horizonMonths: 3,
      birthDate: "1990-01-15",
      grossMonthly: 5_000,
      annualBonus: 20_000,
      annualBonusPayoutMonth: 2,
      employmentContributionEndMonth: 1,
      annualSalaryGrowthNominal: 0,
      initial: {
        oa: 10_000,
        sa: 0,
        ma: 0,
        oaAnnualRate: 0,
        saAnnualRate: 0,
        maAnnualRate: 0,
        cpfisMonthlyFromOa: 0,
        cpfisNotionalBalance: 0,
        cpfisAnnualReturn: 0,
      },
      housingLoans: [
        {
          completionMonth: "2026-01",
          firstPaymentMonth: "2026-02",
          downpaymentFromOa: 0,
          feesFromOa: 0,
          principal: 2_000,
          annualNominalRate: 0,
          termMonths: 2,
          oaShareOfPayment: 1,
          maxOaPerMonth: null,
        },
      ],
    });

    const jan = series.find((p) => p.yearMonth === "2026-01");
    const feb = series.find((p) => p.yearMonth === "2026-02");
    const mar = series.find((p) => p.yearMonth === "2026-03");

    expect(jan?.totalCpf ?? 0).toBeGreaterThan(10_000);
    expect(feb?.sa).toBe(jan?.sa);
    expect(feb?.ma).toBe(jan?.ma);
    expect(feb?.oa).toBeCloseTo((jan?.oa ?? 0) - 1_000, 2);
    expect(mar?.totalCpf).toBeCloseTo((feb?.totalCpf ?? 0) - 1_000, 2);
  });

  it("caps MA at the 2026 Basic Healthcare Sum and overflows excess to SA", () => {
    const series = buildCpfMonthlyProjectionSeries({
      startYearMonth: "2026-06",
      horizonMonths: 1,
      birthDate: "1995-01-15",
      grossMonthly: 7_000,
      initial: {
        oa: 0,
        sa: 10_000,
        ma: 79_000,
        oaAnnualRate: 0,
        saAnnualRate: 0,
        maAnnualRate: 0,
        cpfisMonthlyFromOa: 0,
        cpfisNotionalBalance: 0,
        cpfisAnnualReturn: 0,
      },
      housingLoans: [],
    });

    expect(series[0].ma).toBe(79_000);
    expect(series[0].sa).toBeCloseTo(10_419.84 + 559.96, 2);
  });

  it("estimates future Basic Healthcare Sum values at 4% per year", () => {
    expect(basicHealthcareSumForYearSg(2026)).toEqual({
      amount: 79_000,
      policyYear: 2026,
      isEstimated: false,
    });
    expect(basicHealthcareSumForYearSg(2027)).toEqual({
      amount: 82_160,
      policyYear: 2027,
      isEstimated: true,
    });
  });

  it("respects annual wage cap when bonus exceeds AW headroom", () => {
    const noBonus = buildCpfMonthlyProjectionSeries({
      startYearMonth: "2026-01",
      horizonMonths: 12,
      birthDate: "1990-01-15",
      grossMonthly: 8_000,
      annualBonus: 0,
      initial: {
        oa: 0,
        sa: 0,
        ma: 0,
        oaAnnualRate: 0,
        saAnnualRate: 0,
        maAnnualRate: 0,
        cpfisMonthlyFromOa: 0,
        cpfisNotionalBalance: 0,
        cpfisAnnualReturn: 0,
      },
      housingLoans: [],
    });
    const hugeBonus = buildCpfMonthlyProjectionSeries({
      startYearMonth: "2026-01",
      horizonMonths: 12,
      birthDate: "1990-01-15",
      grossMonthly: 8_000,
      annualBonus: 1_000_000,
      initial: {
        oa: 0,
        sa: 0,
        ma: 0,
        oaAnnualRate: 0,
        saAnnualRate: 0,
        maAnnualRate: 0,
        cpfisMonthlyFromOa: 0,
        cpfisNotionalBalance: 0,
        cpfisAnnualReturn: 0,
      },
      housingLoans: [],
    });
    // At 8k monthly OW for 12 months, only 6k AW remains under 102k annual wage cap.
    expect((hugeBonus[11]?.totalCpf ?? 0) - (noBonus[11]?.totalCpf ?? 0)).toBeCloseTo(
      2_220,
      1
    );
  });

  it("deducts a future OA single premium and returns maturity proceeds to OA", () => {
    const series = buildCpfMonthlyProjectionSeries({
      startYearMonth: "2026-01",
      horizonMonths: 4,
      birthDate: "1990-01-15",
      grossMonthly: 0,
      initial: {
        oa: 10_000,
        sa: 0,
        ma: 0,
        oaAnnualRate: 0,
        saAnnualRate: 0,
        maAnnualRate: 0,
        cpfisMonthlyFromOa: 0,
        cpfisNotionalBalance: 0,
        cpfisAnnualReturn: 0,
      },
      housingLoans: [],
      cpfInvestments: [
        {
          account: "oa",
          purchaseMonth: "2026-02",
          premiumType: "single",
          amount: 1_000,
          projectedGrowthAnnual: 0.12,
          maturityMonth: "2026-04",
        },
      ],
    });

    expect(series.find((p) => p.yearMonth === "2026-02")?.oa).toBe(9_000);
    expect(series.find((p) => p.yearMonth === "2026-02")?.cpfis).toBe(1_000);
    expect(series.find((p) => p.yearMonth === "2026-04")?.oa).toBeCloseTo(
      10_020.1,
      2
    );
    expect(series.find((p) => p.yearMonth === "2026-04")?.cpfis).toBe(0);
  });

  it("routes SA investment maturity to RA first after age 55, then OA", () => {
    const series = buildCpfMonthlyProjectionSeries({
      startYearMonth: "2026-01",
      horizonMonths: 3,
      birthDate: "1970-01-15",
      grossMonthly: 0,
      initial: {
        oa: 1_000,
        sa: 100_000,
        ma: 0,
        ra: 180_000,
        oaAnnualRate: 0,
        saAnnualRate: 0,
        maAnnualRate: 0,
        cpfisMonthlyFromOa: 0,
        cpfisNotionalBalance: 0,
        cpfisAnnualReturn: 0,
      },
      housingLoans: [],
      cpfRaTargetAt55: 220_400,
      cpfInvestments: [
        {
          account: "sa",
          purchaseMonth: "2025-01",
          premiumType: "single",
          amount: 100_000,
          projectedGrowthAnnual: 0,
          maturityMonth: "2026-02",
        },
      ],
    });

    const feb = series.find((p) => p.yearMonth === "2026-02");
    expect(feb?.sa).toBe(100_000);
    expect(feb?.ra).toBe(220_400);
    expect(feb?.oa).toBe(60_600);
    expect(feb?.cpfis).toBe(0);
  });

  it("returns SA investment maturity to SA before age 55", () => {
    const series = buildCpfMonthlyProjectionSeries({
      startYearMonth: "2026-01",
      horizonMonths: 3,
      birthDate: "1980-01-15",
      grossMonthly: 0,
      initial: {
        oa: 0,
        sa: 50_000,
        ma: 0,
        oaAnnualRate: 0,
        saAnnualRate: 0,
        maAnnualRate: 0,
        cpfisMonthlyFromOa: 0,
        cpfisNotionalBalance: 0,
        cpfisAnnualReturn: 0,
      },
      housingLoans: [],
      cpfInvestments: [
        {
          account: "sa",
          purchaseMonth: "2025-01",
          premiumType: "single",
          amount: 20_000,
          projectedGrowthAnnual: 0,
          maturityMonth: "2026-02",
        },
      ],
    });

    const feb = series.find((p) => p.yearMonth === "2026-02");
    expect(feb?.sa).toBe(70_000);
    expect(feb?.ra).toBe(0);
    expect(feb?.oa).toBe(0);
  });
});
