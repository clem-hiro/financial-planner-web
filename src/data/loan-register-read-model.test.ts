import { describe, expect, it } from "vitest";
import { buildSourceOwnedLoanRegisterEntries } from "./loan-register-read-model";
import type { HousingLoanRow, VehicleRow } from "./supabase/types";

const housingLoan: HousingLoanRow = {
  id: "11111111-1111-1111-1111-111111111111",
  user_id: "user-1",
  property_id: "property-1",
  label: "Home loan",
  principal: "120000",
  annual_nominal_rate: "0",
  term_months: 120,
  completion_month: "2026-01",
  first_payment_month: "2026-01",
  downpayment_from_oa: "0",
  fees_from_oa: "0",
  oa_share_of_payment: "0.4",
  max_oa_per_month: null,
  lender_type: "bank",
  original_loan_principal: null,
  principal_repaid_before_schedule: "0",
  created_at: "2026-01-01T00:00:00.000Z",
  payment_source: "split",
  cpf_oa_payment: "400",
  cash_payment: "600",
};

const vehicleLoan: VehicleRow = {
  id: "22222222-2222-2222-2222-222222222222",
  user_id: "user-1",
  label: "Car loan",
  vehicle_status: "active",
  current_market_value: "50000",
  first_registration_ym: "2026-01",
  on_the_road_paid: "80000",
  arf_for_parf: null,
  body_open_market_at_purchase: null,
  body_depreciation_years: 10,
  coe_expiry_ym: "2036-01",
  parf_if_deregistered_today: null,
  coe_if_deregistered_today: null,
  body_scrap_if_deregistered_today: null,
  loan_balance: "20000",
  loan_monthly_payment: "1000",
  loan_months_remaining: 20,
  loan_end_ym: null,
  loan_prefer_stored_balance: true,
  loan_simple_remaining_estimate: false,
  terminal_recovery_at_coe_expiry: null,
  loan_annual_nominal_rate: "0.0278",
  display_order: 0,
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("buildSourceOwnedLoanRegisterEntries", () => {
  it("maps housing repayment source and split amounts", () => {
    const rows = buildSourceOwnedLoanRegisterEntries({
      housingLoans: [housingLoan],
      vehicleRows: [],
      asOf: new Date("2026-01-15T00:00:00.000Z"),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      sourceKey: "housing",
      displayName: "Home loan",
      balance: 120000,
      monthlyPayment: 1000,
      fundingSource: "split",
      cpfOaPayment: 400,
      cashPayment: 600,
      setupTabId: "housing",
    });
  });

  it("maps vehicle loans as cash-funded source-owned entries", () => {
    const rows = buildSourceOwnedLoanRegisterEntries({
      housingLoans: [],
      vehicleRows: [vehicleLoan],
      asOf: new Date("2026-01-15T00:00:00.000Z"),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      sourceKey: "vehicle",
      balance: 20000,
      monthlyPayment: 1000,
      fundingSource: "cash",
      setupTabId: "vehicles",
    });
  });

  it("dedupes source names against existing generic debt names", () => {
    const rows = buildSourceOwnedLoanRegisterEntries({
      housingLoans: [housingLoan],
      vehicleRows: [],
      reservedNames: ["Home loan"],
      asOf: new Date("2026-01-15T00:00:00.000Z"),
    });

    expect(rows[0].displayName).toBe("Home loan (Housing)");
  });
});
