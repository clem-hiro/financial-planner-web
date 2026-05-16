import { describe, expect, it } from "vitest";
import { formatSignupError } from "./signup-error";

const QR_COPY =
  "This invite link has expired or was already used — ask your advisor for a new QR code.";

describe("formatSignupError", () => {
  it("maps a bare qr_token_invalid raise to the expired-link copy", () => {
    expect(formatSignupError("qr_token_invalid")).toBe(QR_COPY);
  });

  it("maps the Supabase-wrapped qr_token_invalid variant", () => {
    expect(
      formatSignupError(
        'Database error saving new user: ... RAISE: qr_token_invalid'
      )
    ).toBe(QR_COPY);
  });

  it("qr_token_invalid wins over the generic database-error branch", () => {
    expect(formatSignupError("database error: qr_token_invalid")).toBe(QR_COPY);
  });

  it("passes through the manual-key trigger messages unchanged", () => {
    const m = "Invalid, already used, or expired access key. Ask your advisor for a new key.";
    expect(formatSignupError(m)).toBe(m);
  });

  it("maps a generic database error to the access-key hint", () => {
    expect(formatSignupError("Database error saving new user")).toBe(
      "Could not complete signup. If you are a client, confirm your access key with your advisor and try again."
    );
  });

  it("returns an unrecognized message verbatim", () => {
    expect(formatSignupError("Network request failed")).toBe(
      "Network request failed"
    );
  });
});
