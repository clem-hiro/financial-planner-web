import { headers } from "next/headers";

const STATIC_ALLOWED_HOSTS = new Set([
  "localhost:3000",
  "127.0.0.1:3000",
]);

function isAllowedHost(host: string, siteUrlHost: string | null): boolean {
  if (STATIC_ALLOWED_HOSTS.has(host)) return true;
  if (host.endsWith(".vercel.app")) return true;
  if (siteUrlHost && host === siteUrlHost) return true;
  return false;
}

function parseSiteUrlHost(siteUrl: string | undefined): {
  url: URL | null;
  host: string | null;
} {
  if (!siteUrl) return { url: null, host: null };
  try {
    const u = new URL(siteUrl);
    return { url: u, host: u.host };
  } catch {
    return { url: null, host: null };
  }
}

/**
 * Production canonical origin. Otherwise derives from forwarded headers
 * (validated against an allowlist to defuse Host header injection).
 */
export async function getSiteOrigin(): Promise<string> {
  const vercelEnv = process.env.VERCEL_ENV;
  const siteUrl = process.env.SITE_URL?.trim() || undefined;
  const parsedSiteUrl = parseSiteUrlHost(siteUrl);

  if (vercelEnv === "production") {
    if (!parsedSiteUrl.url) {
      throw new Error("SITE_URL must be set in production");
    }
    return parsedSiteUrl.url.origin;
  }

  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").trim();
  if (!host) {
    throw new Error("Cannot determine request host");
  }
  if (!isAllowedHost(host, parsedSiteUrl.host)) {
    throw new Error(`Untrusted host: ${host}`);
  }

  const forwardedProto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto =
    forwardedProto ||
    (host === "localhost:3000" || host === "127.0.0.1:3000" ? "http" : "https");
  return `${proto}://${host}`;
}
