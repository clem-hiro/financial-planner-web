import { describe, expect, it } from "vitest";
import { e164ToDigits, isValidE164, normalizeE164 } from "@/lib/phone-format";

describe("phone-format", () => {
  it("normalizes E.164 numbers", () => {
    expect(normalizeE164(" +6591234567 ")).toBe("+6591234567");
    expect(normalizeE164("+12025550123")).toBe("+12025550123");
  });

  it("rejects non-E.164 values", () => {
    expect(isValidE164("91234567")).toBe(false);
    expect(isValidE164("+0123")).toBe(false);
    expect(isValidE164("+65abc")).toBe(false);
  });

  it("converts verified E.164 numbers to WhatsApp digits", () => {
    expect(e164ToDigits("+6591234567")).toBe("6591234567");
  });
});
