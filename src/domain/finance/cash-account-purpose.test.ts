import { describe, expect, it } from "vitest";
import {
  cashPurposeSortOrder,
  parseCashAccountPurpose,
} from "./cash-account-purpose";

describe("parseCashAccountPurpose", () => {
  it("accepts known purposes", () => {
    expect(parseCashAccountPurpose("emergency_fund")).toBe("emergency_fund");
  });

  it("rejects unknown values", () => {
    expect(parseCashAccountPurpose("savings")).toBeNull();
  });
});

describe("cashPurposeSortOrder", () => {
  it("orders emergency fund before other", () => {
    expect(
      cashPurposeSortOrder("emergency_fund") <
        cashPurposeSortOrder("other")
    ).toBe(true);
  });
});
