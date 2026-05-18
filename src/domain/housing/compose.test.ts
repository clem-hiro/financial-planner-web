import { describe, expect, it } from "vitest";
import { composeHousingPropertyViews } from "@/domain/housing/compose";
import type { HousingLoanRow, PropertyRow } from "@/data/supabase/types";

const baseProperty = (over: Partial<PropertyRow>): PropertyRow => ({
  id: "prop-1",
  user_id: "u1",
  name: "My flat",
  property_type: "hdb",
  purchase_price: "500000",
  current_valuation: null,
  ownership_percent: "1",
  status: "living_in",
  rental_income_monthly: "0",
  planning_scope: "current",
  display_order: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...over,
});

const baseLoan = (over: Partial<HousingLoanRow>): HousingLoanRow => ({
  id: "loan-1",
  user_id: "u1",
  property_id: "prop-1",
  label: "HDB loan",
  principal: "400000",
  annual_nominal_rate: "0.026",
  term_months: 240,
  completion_month: "2020-01",
  first_payment_month: "2020-02",
  downpayment_from_oa: "0",
  fees_from_oa: "0",
  oa_share_of_payment: "1",
  max_oa_per_month: null,
  lender_type: "hdb",
  original_loan_principal: null,
  principal_repaid_before_schedule: "0",
  created_at: "2026-01-01T00:00:00Z",
  ...over,
});

describe("composeHousingPropertyViews", () => {
  it("joins property with linked mortgage", () => {
    const views = composeHousingPropertyViews(
      [baseProperty({})],
      [baseLoan({})]
    );
    expect(views).toHaveLength(1);
    expect(views[0]!.mortgage?.id).toBe("loan-1");
    expect(views[0]!.linkedDebtIds).toEqual(["loan-1"]);
  });

  it("synthesizes legacy loan without property_id", () => {
    const views = composeHousingPropertyViews(
      [],
      [baseLoan({ property_id: null, id: "orphan" })]
    );
    expect(views).toHaveLength(1);
    expect(views[0]!.isLegacySynthetic).toBe(true);
    expect(views[0]!.id).toBe("legacy-loan-orphan");
  });

  it("includes property without mortgage", () => {
    const views = composeHousingPropertyViews(
      [baseProperty({ id: "paid", status: "fully_paid" })],
      []
    );
    expect(views).toHaveLength(1);
    expect(views[0]!.mortgage).toBeNull();
  });
});
