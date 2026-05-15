import { describe, expect, it } from "vitest";
import {
  incomeTaxConfigPatchSchema,
  qrShareTokenSchema,
} from "@/lib/validation";

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

describe("incomeTaxConfigPatchSchema relief coercion", () => {
  it("coerces an explicit null relief to 0 (the 23502 bug)", () => {
    const parsed = incomeTaxConfigPatchSchema.parse({ spouse_relief_sgd: null });
    expect(parsed.spouse_relief_sgd).toBe(0);
  });

  it("leaves an omitted relief key absent (untouched-column semantics)", () => {
    const parsed = incomeTaxConfigPatchSchema.parse({
      payment_method: "monthly_giro",
    });
    expect("spouse_relief_sgd" in parsed).toBe(false);
    expect(parsed.spouse_relief_sgd).toBeUndefined();
  });

  it("passes a valid relief number through unchanged", () => {
    const parsed = incomeTaxConfigPatchSchema.parse({ spouse_relief_sgd: 1500 });
    expect(parsed.spouse_relief_sgd).toBe(1500);
  });

  it("rejects out-of-range relief values", () => {
    expect(
      incomeTaxConfigPatchSchema.safeParse({ spouse_relief_sgd: -1 }).success
    ).toBe(false);
    // spouse_relief_sgd max is 2_000.
    expect(
      incomeTaxConfigPatchSchema.safeParse({ spouse_relief_sgd: 2001 }).success
    ).toBe(false);
  });

  it("keeps the rebate-pair superRefine intact", () => {
    expect(
      incomeTaxConfigPatchSchema.safeParse({ tax_rebate_percent: 60 }).success
    ).toBe(false);
    expect(
      incomeTaxConfigPatchSchema.safeParse({
        tax_rebate_percent: 60,
        tax_rebate_cap_sgd: 200,
      }).success
    ).toBe(true);
    expect(
      incomeTaxConfigPatchSchema.safeParse({
        tax_rebate_percent: null,
        tax_rebate_cap_sgd: null,
      }).success
    ).toBe(true);
  });
});
