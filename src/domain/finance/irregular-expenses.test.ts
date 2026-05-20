import { describe, expect, it } from "vitest";
import {
  annualAmountFromIrregularInput,
  buildIrregularExpenseReserves,
} from "./irregular-expenses";

describe("annualAmountFromIrregularInput", () => {
  it("converts quarterly and semi-annual occurrence amounts into annual totals", () => {
    expect(
      annualAmountFromIrregularInput({ amount: 300, cadence: "quarterly" })
    ).toBe(1200);
    expect(
      annualAmountFromIrregularInput({ amount: 600, cadence: "semi_annual" })
    ).toBe(1200);
  });

  it("converts monthly set-aside into an annual target", () => {
    expect(
      annualAmountFromIrregularInput({
        amount: 100,
        cadence: "monthly_set_aside",
      })
    ).toBe(1200);
  });
});

describe("buildIrregularExpenseReserves", () => {
  it("shows monthly set-aside and catch-up reserve for the rest of the year", () => {
    const [reserve] = buildIrregularExpenseReserves({
      viewingMonth: "2026-05",
      annual: {
        totals: { budget: 1200, spent: 300, remaining: 900 },
        lines: [
          {
            categoryLabel: "insurance",
            categoryKey: "insurance",
            budget: 1200,
            spent: 300,
            remaining: 900,
            over: false,
          },
        ],
      },
    });

    expect(reserve).toMatchObject({
      categoryLabel: "insurance",
      annualBudget: 1200,
      spent: 300,
      remaining: 900,
      monthlySetAside: 100,
      remainingMonthsInYear: 8,
      reserveNeededPerRemainingMonth: 112.5,
      progressRatio: 0.25,
    });
  });

  it("floors remaining reserve at zero when the annual line is over plan", () => {
    const [reserve] = buildIrregularExpenseReserves({
      viewingMonth: "2026-12",
      annual: {
        totals: { budget: 1000, spent: 1200, remaining: -200 },
        lines: [
          {
            categoryLabel: "travel",
            categoryKey: "travel",
            budget: 1000,
            spent: 1200,
            remaining: -200,
            over: true,
          },
        ],
      },
    });

    expect(reserve.remaining).toBe(0);
    expect(reserve.reserveNeededPerRemainingMonth).toBe(0);
    expect(reserve.progressRatio).toBe(1);
  });
});
