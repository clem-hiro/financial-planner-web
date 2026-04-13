import { describe, expect, it } from "vitest";
import {
  estimateFromOriginalLoanAndPrincipalRepaid,
  estimateFromPriceAndLoanPercentOfPrice,
  estimateFromPriceAndTotalDeposit,
  exceedsTypicalMaxLoan,
} from "./housing-loan-estimate";

describe("estimateFromPriceAndTotalDeposit", () => {
  it("derives original as price minus deposit and outstanding after repaid", () => {
    const r = estimateFromPriceAndTotalDeposit({
      purchasePrice: 500_000,
      totalDepositPaid: 100_000,
      cumulativePrincipalRepaid: 40_000,
    });
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.originalLoanPrincipal).toBe(400_000);
    expect(r.outstandingPrincipal).toBe(360_000);
    expect(r.impliedTotalDeposit).toBe(100_000);
  });

  it("errors when deposit exceeds price", () => {
    const r = estimateFromPriceAndTotalDeposit({
      purchasePrice: 100_000,
      totalDepositPaid: 120_000,
      cumulativePrincipalRepaid: 0,
    });
    expect("error" in r).toBe(true);
  });
});

describe("estimateFromPriceAndLoanPercentOfPrice", () => {
  it("uses loan % and implied deposit", () => {
    const r = estimateFromPriceAndLoanPercentOfPrice({
      purchasePrice: 400_000,
      loanPercentOfPrice: 75,
      cumulativePrincipalRepaid: 10_000,
    });
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.originalLoanPrincipal).toBe(300_000);
    expect(r.impliedTotalDeposit).toBe(100_000);
    expect(r.outstandingPrincipal).toBe(290_000);
  });
});

describe("estimateFromOriginalLoanAndPrincipalRepaid", () => {
  it("subtracts cumulative principal from original", () => {
    const r = estimateFromOriginalLoanAndPrincipalRepaid({
      originalLoanPrincipal: 350_000,
      cumulativePrincipalRepaid: 50_000,
    });
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.outstandingPrincipal).toBe(300_000);
  });
});

describe("exceedsTypicalMaxLoan", () => {
  it("flags when implied loan is above lender default cap", () => {
    expect(
      exceedsTypicalMaxLoan(500_000, 500_000 * 0.81, "hdb")
    ).toBe(true);
    expect(
      exceedsTypicalMaxLoan(500_000, 500_000 * 0.79, "hdb")
    ).toBe(false);
  });
});
