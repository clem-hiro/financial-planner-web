import { describe, expect, it } from "vitest";
import {
  annualRateForQuickLender,
  deriveQuickHousingLoanRow,
  HDB_CONCESSIONARY_RATE_ANNUAL,
  oaInstalmentShareFromPreset,
} from "./housing-loan-quick";

describe("oaInstalmentShareFromPreset", () => {
  it("maps cash and split presets", () => {
    expect(oaInstalmentShareFromPreset("cash100")).toBe(0);
    expect(oaInstalmentShareFromPreset("split50")).toBe(0.5);
    expect(oaInstalmentShareFromPreset("cpf100")).toBe(1);
    expect(oaInstalmentShareFromPreset("full")).toBe(1);
  });
});

describe("annualRateForQuickLender", () => {
  it("uses 2.6% for HDB", () => {
    expect(annualRateForQuickLender("hdb", null)).toBe(HDB_CONCESSIONARY_RATE_ANNUAL);
  });

  it("uses override for bank when provided", () => {
    expect(annualRateForQuickLender("bank", 0.035)).toBe(0.035);
  });
});

describe("deriveQuickHousingLoanRow", () => {
  it("derives loan and completion month before first payment when OA lump", () => {
    const r = deriveQuickHousingLoanRow({
      label: "Test",
      purchasePrice: 500_000,
      depositTotal: 100_000,
      depositFromOa: 40_000,
      feesFromOa: 0,
      loanTermYears: 25,
      firstPaymentMonth: "2026-03",
      lenderType: "hdb",
      bankAnnualRate: null,
      oaShareOfPayment: 0.5,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.principal).toBe(400_000);
    expect(r.term_months).toBe(300);
    expect(r.annual_nominal_rate).toBe(0.026);
    expect(r.oa_share_of_payment).toBe(0.5);
    expect(r.completion_month).toBe("2026-02");
    expect(r.first_payment_month).toBe("2026-03");
  });

  it("aligns completion with first payment when no OA lump", () => {
    const r = deriveQuickHousingLoanRow({
      label: "x",
      purchasePrice: 400_000,
      depositTotal: 80_000,
      depositFromOa: 0,
      feesFromOa: 0,
      loanTermYears: 20,
      firstPaymentMonth: "2026-01",
      lenderType: "bank",
      bankAnnualRate: null,
      oaShareOfPayment: 1,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.completion_month).toBe("2026-01");
  });

  it("subtracts BSD from financed amount when flag is on", () => {
    const purchase = 1_000_000;
    const deposit = 250_000;
    const bsd = 24_600;
    const r = deriveQuickHousingLoanRow({
      label: "bsd",
      purchasePrice: purchase,
      depositTotal: deposit,
      depositFromOa: 0,
      feesFromOa: 0,
      loanTermYears: 25,
      firstPaymentMonth: "2026-03",
      lenderType: "hdb",
      bankAnnualRate: null,
      oaShareOfPayment: 1,
      buyersStampDuty: bsd,
      includeBuyersStampDutyInLoan: true,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.principal).toBe(purchase - deposit - bsd);
  });
});
