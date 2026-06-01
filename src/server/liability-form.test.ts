import { describe, expect, it } from "vitest";
import { parseLiabilityFormData } from "./liability-form";

function baseFormData() {
  const fd = new FormData();
  fd.set("name", "Home loan");
  fd.set("balance", "500000");
  fd.set("loan_type", "amortized");
  return fd;
}

describe("parseLiabilityFormData", () => {
  it("combines remaining tenure years and months", () => {
    const fd = baseFormData();
    fd.set("remaining_tenure_years", "24");
    fd.set("remaining_tenure_months", "6");

    const parsed = parseLiabilityFormData(fd);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.remaining_tenure_months).toBe(294);
    }
  });

  it("accepts month overflow as extra total tenure months", () => {
    const fd = baseFormData();
    fd.set("remaining_tenure_years", "24");
    fd.set("remaining_tenure_months", "18");

    const parsed = parseLiabilityFormData(fd);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.remaining_tenure_months).toBe(306);
    }
  });

  it("treats a default zero month field as empty when years are blank", () => {
    const fd = baseFormData();
    fd.set("remaining_tenure_months", "0");

    const parsed = parseLiabilityFormData(fd);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.remaining_tenure_months).toBeNull();
    }
  });
});
