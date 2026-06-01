import { describe, expect, it } from "vitest";
import {
  clientAccessKeyInputSchema,
  entityNameCollides,
  entityNameUniquenessError,
  incomeTaxConfigPatchSchema,
  normalizeEntityName,
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

  it("rejects exactly 21 chars (off-by-one under)", () => {
    expect(qrShareTokenSchema.safeParse("a".repeat(21)).success).toBe(false);
  });

  it("rejects exactly 23 and 24 chars (former tolerated padding range)", () => {
    expect(qrShareTokenSchema.safeParse("a".repeat(23)).success).toBe(false);
    expect(qrShareTokenSchema.safeParse("a".repeat(24)).success).toBe(false);
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

describe("clientAccessKeyInputSchema", () => {
  // Contract: must accept the format emitted by both prod
  // `fulfill_access_key_purchase` and the dev seed `genKey()` —
  // 32-char hex from gen_random_bytes(16) / randomBytes(16).
  it("accepts a 32-char uppercase hex key (prod / seed format)", () => {
    const key = "35B6549F0A1C4D2E8F90AB12CD34EF56";
    expect(key).toMatch(/^[A-F0-9]{32}$/);
    const parsed = clientAccessKeyInputSchema.safeParse(key);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toBe(key);
  });

  it("uppercases a lowercase hex key", () => {
    const parsed = clientAccessKeyInputSchema.safeParse(
      "35b6549f0a1c4d2e8f90ab12cd34ef56"
    );
    expect(parsed.success).toBe(true);
    if (parsed.success)
      expect(parsed.data).toBe("35B6549F0A1C4D2E8F90AB12CD34EF56");
  });

  it("trims surrounding whitespace before validating", () => {
    const parsed = clientAccessKeyInputSchema.safeParse(
      "  35B6549F0A1C4D2E8F90AB12CD34EF56  "
    );
    expect(parsed.success).toBe(true);
    if (parsed.success)
      expect(parsed.data).toBe("35B6549F0A1C4D2E8F90AB12CD34EF56");
  });

  it("rejects the legacy DEV- prefixed format (hyphen is non-hex)", () => {
    const parsed = clientAccessKeyInputSchema.safeParse("DEV-35B6549F");
    expect(parsed.success).toBe(false);
    if (!parsed.success)
      expect(parsed.error.issues[0]?.message).toBe(
        "Invalid access key format"
      );
  });

  it("rejects keys shorter than 8 chars", () => {
    expect(clientAccessKeyInputSchema.safeParse("A1B2C3").success).toBe(false);
  });

  it("rejects keys longer than 64 chars", () => {
    expect(
      clientAccessKeyInputSchema.safeParse("A".repeat(65)).success
    ).toBe(false);
  });

  it("rejects non-hex characters", () => {
    expect(
      clientAccessKeyInputSchema.safeParse("GHIJKLMNOPQRSTUV").success
    ).toBe(false);
  });
});

describe("entity name uniqueness (mirrors DB lower(btrim) index)", () => {
  it("normalizeEntityName lowercases and trims", () => {
    expect(normalizeEntityName("  ILP2 ")).toBe("ilp2");
    expect(normalizeEntityName("Home Loan")).toBe("home loan");
  });

  it("detects a case-insensitive collision", () => {
    expect(entityNameCollides("ilp2", ["ILP2"])).toBe(true);
  });

  it("detects a whitespace-only collision (leading/trailing)", () => {
    expect(entityNameCollides("  ilp2  ", ["ilp2"])).toBe(true);
  });

  it("detects a combined case + whitespace collision", () => {
    expect(entityNameCollides(" Ilp2 ", ["iLp2"])).toBe(true);
  });

  it("does not flag a genuinely distinct name", () => {
    expect(entityNameCollides("ilp3", ["ilp2", "srs"])).toBe(false);
  });

  it("does not collide on an empty existing list", () => {
    expect(entityNameCollides("ilp2", [])).toBe(false);
  });

  it("preserves interior whitespace (not collapsed)", () => {
    // btrim only strips ends; 'a  b' and 'a b' stay distinct.
    expect(entityNameCollides("a  b", ["a b"])).toBe(false);
  });

  it("uniquenessError returns a friendly message with the trimmed name", () => {
    const msg = entityNameUniquenessError("  ILP2 ", ["ilp2"], "an investment");
    expect(msg).toContain("an investment");
    expect(msg).toContain("ILP2");
    expect(msg).not.toMatch(/^\s/);
  });

  it("uniquenessError returns null when the name is free", () => {
    expect(entityNameUniquenessError("ilp3", ["ilp2"], "an investment")).toBe(
      null
    );
  });
});
