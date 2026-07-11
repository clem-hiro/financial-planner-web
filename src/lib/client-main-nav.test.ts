import { describe, expect, it } from "vitest";
import { CLIENT_MAIN_NAV } from "@/lib/client-main-nav";

function activeIds(pathname: string): string[] {
  return CLIENT_MAIN_NAV.filter((item) => item.activeMatch(pathname)).map(
    (item) => item.id
  );
}

describe("CLIENT_MAIN_NAV activeMatch", () => {
  it("highlights only financial_setup on the setup hub", () => {
    expect(activeIds("/setup/overview")).toEqual(["financial_setup"]);
  });

  it("highlights financial_setup on legacy planning redirect paths", () => {
    expect(activeIds("/planning/setup")).toEqual(["financial_setup"]);
    expect(activeIds("/planning/wealth")).toEqual(["financial_setup"]);
    expect(activeIds("/planning/overview")).toEqual(["financial_setup"]);
  });

  it("highlights financial_setup on classic aliases", () => {
    expect(activeIds("/goals")).toEqual(["financial_setup"]);
    expect(activeIds("/balances")).toEqual(["financial_setup"]);
    expect(activeIds("/budget")).toEqual(["financial_setup"]);
  });

  it("highlights financial_setup on classic /setup", () => {
    expect(activeIds("/setup")).toEqual(["financial_setup"]);
    expect(activeIds("/setup/cpf")).toEqual(["financial_setup"]);
  });

  it("does not include a planning nav item", () => {
    expect(CLIENT_MAIN_NAV.map((item) => item.id)).toEqual([
      "home",
      "financial_setup",
      "activity",
      "more",
    ]);
  });
});
