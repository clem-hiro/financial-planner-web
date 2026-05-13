import { describe, expect, it } from "vitest";
import { computeSingaporeResidentialBuyersStampDuty } from "./singapore-residential-bsd";

describe("computeSingaporeResidentialBuyersStampDuty", () => {
  it("returns 0 for non-positive prices", () => {
    expect(computeSingaporeResidentialBuyersStampDuty(0).total).toBe(0);
    expect(computeSingaporeResidentialBuyersStampDuty(-1).bands).toEqual([]);
  });

  it("matches IRAS-style tiered total for S$1,000,000", () => {
    const r = computeSingaporeResidentialBuyersStampDuty(1_000_000);
    expect(r.total).toBe(24_600);
    expect(r.bands.length).toBe(3);
    expect(r.bands[0]!.duty + r.bands[1]!.duty + r.bands[2]!.duty).toBeCloseTo(
      24_600,
      5
    );
  });

  it("applies 6% only above S$3,000,000", () => {
    const r = computeSingaporeResidentialBuyersStampDuty(3_100_000);
    const last = r.bands[r.bands.length - 1]!;
    expect(last.rate).toBe(0.06);
    expect(last.taxableAmount).toBe(100_000);
    expect(last.duty).toBe(6_000);
  });
});
