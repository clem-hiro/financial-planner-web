import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockHeaders = Record<string, string>;

let currentHeaders: MockHeaders = {};
function setHeaders(h: MockHeaders) {
  currentHeaders = h;
}

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => currentHeaders[name.toLowerCase()] ?? null,
  }),
}));

async function importFresh() {
  vi.resetModules();
  return import("@/lib/site-origin");
}

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
  delete process.env.VERCEL_ENV;
  delete process.env.SITE_URL;
  currentHeaders = {};
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("getSiteOrigin", () => {
  it("returns SITE_URL origin when VERCEL_ENV=production and SITE_URL is set", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.SITE_URL = "https://app.example.com";
    const { getSiteOrigin } = await importFresh();
    await expect(getSiteOrigin()).resolves.toBe("https://app.example.com");
  });

  it("throws in production when SITE_URL is missing", async () => {
    process.env.VERCEL_ENV = "production";
    const { getSiteOrigin } = await importFresh();
    await expect(getSiteOrigin()).rejects.toThrow(/SITE_URL/);
  });

  it("derives http://localhost:3000 in dev from forwarded headers", async () => {
    setHeaders({ "x-forwarded-host": "localhost:3000", "x-forwarded-proto": "http" });
    const { getSiteOrigin } = await importFresh();
    await expect(getSiteOrigin()).resolves.toBe("http://localhost:3000");
  });

  it("allows a *.vercel.app preview host with https", async () => {
    setHeaders({ "x-forwarded-host": "preview-abc.vercel.app", "x-forwarded-proto": "https" });
    const { getSiteOrigin } = await importFresh();
    await expect(getSiteOrigin()).resolves.toBe("https://preview-abc.vercel.app");
  });

  it("rejects an untrusted host", async () => {
    setHeaders({ "x-forwarded-host": "evil.example.com", "x-forwarded-proto": "https" });
    const { getSiteOrigin } = await importFresh();
    await expect(getSiteOrigin()).rejects.toThrow(/Untrusted host/);
  });

  it("falls back to SITE_URL host outside production", async () => {
    process.env.SITE_URL = "https://app.example.com";
    setHeaders({ "x-forwarded-host": "app.example.com", "x-forwarded-proto": "https" });
    const { getSiteOrigin } = await importFresh();
    await expect(getSiteOrigin()).resolves.toBe("https://app.example.com");
  });
});
