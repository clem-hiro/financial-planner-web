import { describe, expect, it } from "vitest";
import type { HousingLoanRow } from "@/data/supabase/types";
import { housingUpfrontOaEvents } from "./upfront-oa-events";

function row(partial: Partial<HousingLoanRow>): HousingLoanRow {
  return {
    id: "loan-1",
    user_id: "user-1",
    label: "Test",
    principal: "400000",
    annual_nominal_rate: "0.026",
    term_months: 300,
    completion_month: "2027-06",
    first_payment_month: "2027-07",
    downpayment_from_oa: "0",
    fees_from_oa: "0",
    oa_share_of_payment: "1",
    max_oa_per_month: null,
    lender_type: "hdb",
    created_at: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

describe("housingUpfrontOaEvents", () => {
  it("returns split BSD and legal events with separate months", () => {
    const events = housingUpfrontOaEvents(
      row({
        bsd_total: "24600",
        bsd_paid_month: "2027-03",
        bsd_cpf_oa: "12000",
        bsd_cash: "12600",
        legal_fee_total: "3000",
        legal_fee_paid_month: "2027-06",
        legal_fee_cpf_oa: "1500",
        legal_fee_cash: "1500",
      })
    );
    expect(events).toEqual([
      { yearMonth: "2027-03", amount: 12000 },
      { yearMonth: "2027-06", amount: 1500 },
    ]);
  });

  it("falls back to legacy bsd_legal event when split columns are absent", () => {
    const events = housingUpfrontOaEvents(
      row({
        bsd_legal_paid_month: "2027-04",
        bsd_legal_cpf_oa: "27600",
      })
    );
    expect(events).toEqual([{ yearMonth: "2027-04", amount: 27600 }]);
  });

  it("includes option fee OA when set", () => {
    const events = housingUpfrontOaEvents(
      row({
        option_fee_paid_month: "2026-08",
        option_fee_cpf_oa: "500",
      })
    );
    expect(events).toEqual([{ yearMonth: "2026-08", amount: 500 }]);
  });
});
