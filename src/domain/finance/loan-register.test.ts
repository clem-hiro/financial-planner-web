import { describe, expect, it } from "vitest";
import {
  dedupeSourceOwnedLoanNames,
  type SourceOwnedLoanRegisterEntry,
} from "./loan-register";

function entry(
  rawName: string,
  sourceKey: SourceOwnedLoanRegisterEntry["sourceKey"],
  sourceLabel: string,
  sourceRowId: string
): SourceOwnedLoanRegisterEntry {
  return {
    id: `${sourceKey}:${sourceRowId}`,
    sourceKey,
    sourceRowId,
    sourceLabel,
    rawName,
    displayName: rawName,
    balance: 1,
    monthlyPayment: null,
    annualInterestRate: null,
    remainingTenureMonths: null,
    loanType: "amortized",
    fundingSource: "cash",
    cpfOaPayment: null,
    cashPayment: null,
    setupTabId: sourceKey === "housing" ? "housing" : "vehicles",
    details: [],
  };
}

describe("dedupeSourceOwnedLoanNames", () => {
  it("leaves unique names unchanged", () => {
    const rows = dedupeSourceOwnedLoanNames([
      entry("Home loan", "housing", "Housing", "1"),
      entry("Car loan", "vehicle", "Vehicles", "2"),
    ]);

    expect(rows.map((row) => row.displayName)).toEqual([
      "Home loan",
      "Car loan",
    ]);
  });

  it("adds source labels when a source-owned name collides with a generic debt", () => {
    const rows = dedupeSourceOwnedLoanNames(
      [entry("Home loan", "housing", "Housing", "1")],
      ["home   loan"]
    );

    expect(rows[0].displayName).toBe("Home loan (Housing)");
  });

  it("adds source ordinals when duplicate names come from the same source", () => {
    const rows = dedupeSourceOwnedLoanNames([
      entry("Loan", "housing", "Housing", "1"),
      entry(" Loan ", "housing", "Housing", "2"),
    ]);

    expect(rows.map((row) => row.displayName)).toEqual([
      "Loan (Housing)",
      "Loan (Housing 2)",
    ]);
  });
});
