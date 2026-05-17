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

  it("does not highlight planning on legacy hub redirect path", () => {
    expect(activeIds("/planning/setup")).toEqual(["financial_setup"]);
  });

  it("highlights only planning on section workspaces", () => {
    expect(activeIds("/planning/wealth")).toEqual(["planning"]);
    expect(activeIds("/planning/overview")).toEqual(["planning"]);
  });

  it("highlights financial_setup on classic /setup", () => {
    expect(activeIds("/setup")).toEqual(["financial_setup"]);
    expect(activeIds("/setup/cpf")).toEqual(["financial_setup"]);
  });
});
