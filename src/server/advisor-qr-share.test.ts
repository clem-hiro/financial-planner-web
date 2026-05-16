import { describe, expect, it, vi } from "vitest";

// advisor-qr-share.ts is "server-only"; stub the guard so the pure helper is
// importable under the node test env. vi.mock is hoisted above the import.
vi.mock("server-only", () => ({}));

import { tokenHash } from "./advisor-qr-share";

describe("tokenHash", () => {
  it("is deterministic for the same input", () => {
    expect(tokenHash("abcDEF123_-XYZabcdefgh")).toBe(
      tokenHash("abcDEF123_-XYZabcdefgh")
    );
  });

  it("matches the canonical sha256 hex vector (DB encode() parity)", () => {
    // sha256("") — must equal Postgres encode(extensions.digest('','sha256'),'hex').
    expect(tokenHash("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  it("emits 64-char lowercase hex (matches Postgres encode(...,'hex'))", () => {
    expect(tokenHash("a".repeat(22))).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs for different tokens", () => {
    expect(tokenHash("token-a")).not.toBe(tokenHash("token-b"));
  });
});
