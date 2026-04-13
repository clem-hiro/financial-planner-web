import { describe, expect, it } from "vitest";
import { buildCpfMonthlyProjectionSeries } from "./cpf-monthly-projection";

describe("buildCpfMonthlyProjectionSeries", () => {
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
});
