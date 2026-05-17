import { describe, expect, it } from "vitest";
import { formatRelativeTimeAgo } from "@/lib/relative-time";

describe("formatRelativeTimeAgo", () => {
  it("returns null for missing input", () => {
    expect(formatRelativeTimeAgo(null)).toBeNull();
  });

  it("labels recent days", () => {
    const now = new Date("2026-05-17T12:00:00Z");
    expect(
      formatRelativeTimeAgo("2026-05-15T12:00:00Z", now)
    ).toBe("2 days ago");
  });
});
