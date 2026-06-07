import { describe, expect, it } from "vitest";
import { SETUP_MODULES, SETUP_MODULE_BY_ID } from "@/domain/setup/modules";

describe("advisor_proposal setup module wiring", () => {
  it("is registered in SETUP_MODULES under the advisor_system group", () => {
    const m = SETUP_MODULES.find((x) => x.id === "advisor_proposal");
    expect(m).toBeTruthy();
    expect(m?.group).toBe("advisor_system");
  });

  it("links to the advisor-proposals setup tab with the expected card copy", () => {
    const m = SETUP_MODULE_BY_ID.advisor_proposal;
    expect(m.href).toBe("/setup?tab=advisor-proposals");
    expect(m.title).toBe("Advisor Proposals");
    expect(m.ctaLabel.length).toBeGreaterThan(0);
    expect(m.description.length).toBeGreaterThan(0);
  });

  it("SETUP_MODULE_BY_ID is total over SETUP_MODULES (advisor_proposal resolvable)", () => {
    for (const def of SETUP_MODULES) {
      expect(SETUP_MODULE_BY_ID[def.id]).toBe(def);
    }
  });
});
