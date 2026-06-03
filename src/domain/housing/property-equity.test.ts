import { describe, expect, it } from "vitest";
import type { HousingLoanRow, PropertyRow } from "@/data/supabase/types";
import {
  buildPropertyEquityBreakdown,
  normalizePropertyOwnership,
} from "@/domain/housing/property-equity";

function property(overrides: Partial<PropertyRow> = {}): PropertyRow {
  return {
    id: "prop-1",
    user_id: "user-1",
    name: "Home",
    property_type: "hdb",
    purchase_price: "500000",
    purchase_year: 2026,
    current_valuation: "600000",
    ownership_percent: "1",
    status: "living_in",
    rental_income_monthly: "0",
    planning_scope: "current",
    display_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function housingLoan(overrides: Partial<HousingLoanRow> = {}): HousingLoanRow {
  return {
    id: "loan-1",
    user_id: "user-1",
    property_id: "prop-1",
    label: "Mortgage",
    principal: "120000",
    annual_nominal_rate: "0",
    term_months: 12,
    completion_month: "2026-01",
    first_payment_month: "2026-01",
    downpayment_from_oa: "0",
    fees_from_oa: "0",
    oa_share_of_payment: "1",
    max_oa_per_month: null,
    lender_type: "hdb",
    original_loan_principal: "120000",
    principal_repaid_before_schedule: "0",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("normalizePropertyOwnership", () => {
  it("accepts stored fractions and percent-style values defensively", () => {
    expect(normalizePropertyOwnership("0.5")).toBe(0.5);
    expect(normalizePropertyOwnership("50")).toBe(0.5);
    expect(normalizePropertyOwnership("100")).toBe(1);
  });

  it("clamps invalid values to zero", () => {
    expect(normalizePropertyOwnership("")).toBe(0);
    expect(normalizePropertyOwnership("-1")).toBe(0);
    expect(normalizePropertyOwnership("not-a-number")).toBe(0);
  });
});

describe("buildPropertyEquityBreakdown", () => {
  it("uses current valuation and ownership to compute gross property value", () => {
    const result = buildPropertyEquityBreakdown({
      properties: [property({ ownership_percent: "0.5" })],
      housingLoans: [],
      asOfYearMonth: "2026-06",
    });

    expect(result).toEqual({
      propertiesGrossAsset: 300000,
      propertiesLoan: 0,
      propertiesNet: 300000,
      propertyCount: 1,
    });
  });

  it("falls back to purchase price when current valuation is missing", () => {
    const result = buildPropertyEquityBreakdown({
      properties: [
        property({
          current_valuation: null,
          purchase_price: "500000",
          ownership_percent: "100",
        }),
      ],
      housingLoans: [],
      asOfYearMonth: "2026-06",
    });

    expect(result.propertiesGrossAsset).toBe(500000);
    expect(result.propertiesNet).toBe(500000);
  });

  it("subtracts all linked loan balances and ignores unlinked loans", () => {
    const result = buildPropertyEquityBreakdown({
      properties: [property()],
      housingLoans: [
        housingLoan({ id: "loan-1", principal: "120000" }),
        housingLoan({ id: "loan-2", principal: "60000" }),
        housingLoan({ id: "orphan", property_id: null, principal: "999999" }),
      ],
      asOfYearMonth: "2025-12",
    });

    expect(result.propertiesGrossAsset).toBe(600000);
    expect(result.propertiesLoan).toBe(180000);
    expect(result.propertiesNet).toBe(420000);
  });

  it("reduces linked loan balance across projection months", () => {
    const start = buildPropertyEquityBreakdown({
      properties: [property()],
      housingLoans: [housingLoan({ principal: "120000", term_months: 12 })],
      asOfYearMonth: "2026-01",
    });
    const later = buildPropertyEquityBreakdown({
      properties: [property()],
      housingLoans: [housingLoan({ principal: "120000", term_months: 12 })],
      asOfYearMonth: "2026-06",
    });
    const afterMaturity = buildPropertyEquityBreakdown({
      properties: [property()],
      housingLoans: [housingLoan({ principal: "120000", term_months: 12 })],
      asOfYearMonth: "2027-01",
    });

    expect(start.propertiesLoan).toBe(110000);
    expect(later.propertiesLoan).toBe(60000);
    expect(afterMaturity.propertiesLoan).toBe(0);
    expect(later.propertiesNet).toBeGreaterThan(start.propertiesNet);
  });

  it("excludes future-simulation properties", () => {
    const result = buildPropertyEquityBreakdown({
      properties: [property({ planning_scope: "future_simulation" })],
      housingLoans: [housingLoan()],
      asOfYearMonth: "2026-06",
    });

    expect(result).toEqual({
      propertiesGrossAsset: 0,
      propertiesLoan: 0,
      propertiesNet: 0,
      propertyCount: 0,
    });
  });
});
