import { describe, expect, it } from "vitest";
import { buildWhatsAppChatUrl } from "@/lib/whatsapp-link";

describe("buildWhatsAppChatUrl", () => {
  it("builds a wa.me URL from E.164 input", () => {
    expect(buildWhatsAppChatUrl("+6591234567")).toBe("https://wa.me/6591234567");
  });

  it("includes an encoded starter message when provided", () => {
    expect(buildWhatsAppChatUrl("+6591234567", "Hello advisor")).toBe(
      "https://wa.me/6591234567?text=Hello+advisor"
    );
  });

  it("rejects invalid numbers", () => {
    expect(buildWhatsAppChatUrl("91234567")).toBeNull();
  });
});
