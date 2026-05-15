import { describe, expect, it } from "vitest";
import { qrShareTokenSchema } from "@/lib/validation";

describe("qrShareTokenSchema", () => {
  it("accepts a 22-char base64url string (unpadded 128-bit)", () => {
    const sample = "abcDEF123_-XYZabcdefgh";
    expect(sample.length).toBe(22);
    expect(qrShareTokenSchema.safeParse(sample).success).toBe(true);
  });

  it("rejects shorter strings", () => {
    expect(qrShareTokenSchema.safeParse("abc").success).toBe(false);
  });

  it("rejects longer strings (>24)", () => {
    expect(qrShareTokenSchema.safeParse("a".repeat(25)).success).toBe(false);
  });

  it("rejects disallowed characters", () => {
    expect(qrShareTokenSchema.safeParse("+".repeat(22)).success).toBe(false);
    expect(qrShareTokenSchema.safeParse("/".repeat(22)).success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(qrShareTokenSchema.safeParse("").success).toBe(false);
  });
});
