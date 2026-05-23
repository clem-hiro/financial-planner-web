import { describe, expect, it } from "vitest";
import { shortDate, summarize } from "./proposal-format";

// Locale-formatted output (toLocaleDateString "en-SG") depends on the
// runtime's ICU data, so we assert structure + determinism, not a pinned
// localized string (that would be a cross-env flakiness source). The
// sentinels and summarize logic ARE fully deterministic → asserted exactly.
describe("shortDate", () => {
  it("returns the em-dash sentinel for null", () => {
    expect(shortDate(null)).toBe("—");
  });

  it("formats a real ISO date: non-empty, deterministic, includes day + 4-digit year", () => {
    const out = shortDate("2026-01-02T00:00:00Z");
    expect(out).not.toBe("—");
    expect(out.length).toBeGreaterThan(0);
    expect(out).toBe(shortDate("2026-01-02T00:00:00Z")); // deterministic
    expect(out).toMatch(/\b2026\b/);
    expect(out).toMatch(/\b2\b/);
  });

  it("distinguishes different dates", () => {
    expect(shortDate("2026-01-02T00:00:00Z")).not.toBe(
      shortDate("2026-12-30T00:00:00Z")
    );
  });
});

describe("summarize", () => {
  it("null / empty / whitespace → em-dash", () => {
    expect(summarize(null)).toBe("—");
    expect(summarize("")).toBe("—");
    expect(summarize("   ")).toBe("—");
  });

  it("trims and returns short notes unchanged", () => {
    expect(summarize("  Rebalance to 60/40  ")).toBe("Rebalance to 60/40");
  });

  it("boundary: exactly 80 chars is NOT truncated (predicate is > 80)", () => {
    const s80 = "a".repeat(80);
    expect(summarize(s80)).toBe(s80);
  });

  it("boundary: 81 chars truncates to first 79 + ellipsis", () => {
    const s81 = "b".repeat(81);
    const out = summarize(s81);
    expect(out).toBe(`${"b".repeat(79)}…`);
    expect(out.length).toBe(80);
  });
});
