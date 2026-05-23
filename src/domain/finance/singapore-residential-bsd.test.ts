import { describe, expect, it } from "vitest";
import {
  computeSingaporeResidentialBuyersStampDuty,
  singaporeResidentialBsdScheduleForPurchaseYear,
} from "./singapore-residential-bsd";

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

  it("uses pre-2018 residential BSD rates by purchase year", () => {
    const r = computeSingaporeResidentialBuyersStampDuty(1_000_000, {
      purchaseYear: 2017,
    });
    expect(r.scheduleLabel).toBe("Before 20 Feb 2018");
    expect(r.total).toBe(24_600);
    expect(r.bands.at(-1)?.rate).toBe(0.03);
  });

  it("uses 2018 to early-2023 residential BSD rates by purchase year", () => {
    const r = computeSingaporeResidentialBuyersStampDuty(2_000_000, {
      purchaseYear: 2022,
    });
    expect(r.scheduleLabel).toBe("20 Feb 2018 to 14 Feb 2023");
    expect(r.total).toBe(64_600);
    expect(r.bands.at(-1)?.rate).toBe(0.04);
  });

  it("selects the current schedule for 2023 and later purchase years", () => {
    expect(
      singaporeResidentialBsdScheduleForPurchaseYear(2026).effectiveLabel
    ).toBe("On or after 15 Feb 2023");
  });
});
