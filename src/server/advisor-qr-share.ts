import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { QR_DEEPLINK_EXPIRY_MS } from "@/config/deeplink";
import type { AdvisorAccessKeyRow } from "@/data/supabase/types";
import { renderQrSvg } from "@/lib/qr-svg";
import { getSiteOrigin } from "@/lib/site-origin";

export type QrShareData = {
  deeplinkUrl: string;
  qrSvg: string;
  accessKey: string;
  expiresAt: Date;
  advisorDisplayName: string;
};

function newToken(): string {
  return randomBytes(16).toString("base64url");
}

/** Server-side hash stored at rest; the raw token lives only in the QR URL. */
export function tokenHash(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

async function pickOldestAvailableKey(
  supabase: SupabaseClient,
  advisorUserId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("advisor_access_keys")
    .select("access_key")
    .eq("advisor_user_id", advisorUserId)
    .eq("status", "available")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as Pick<AdvisorAccessKeyRow, "access_key"> | null)?.access_key ?? null;
}

export async function mintQrShareToken(
  supabase: SupabaseClient,
  advisorUserId: string
): Promise<{ token: string; key: string; expiresAt: Date } | null> {
  const key = await pickOldestAvailableKey(supabase, advisorUserId);
  if (!key) return null;

  const token = newToken();
  const expiresAt = new Date(Date.now() + QR_DEEPLINK_EXPIRY_MS);

  const { error } = await supabase.rpc("mint_qr_share_token", {
    p_token_hash: tokenHash(token),
    p_access_key: key,
    p_advisor_user_id: advisorUserId,
    p_expires_at: expiresAt.toISOString(),
  });
  if (error) throw error;

  return { token, key, expiresAt };
}

/**
 * Every render mints a fresh token. Since only `sha256(token)` is stored, the
 * raw token can't be reconstructed to reuse a prior QR — mint's retire-then-
 * insert retires any prior unconsumed token for the (advisor, key), so exactly
 * one QR is live at a time.
 */
export async function buildShareData(
  supabase: SupabaseClient,
  advisorUserId: string,
  advisorDisplayName: string | null
): Promise<QrShareData | null> {
  const minted = await mintQrShareToken(supabase, advisorUserId);
  if (!minted) return null;

  const origin = await getSiteOrigin();
  const deeplinkUrl = `${origin}/login?qr_token=${encodeURIComponent(minted.token)}`;
  const qrSvg = await renderQrSvg(deeplinkUrl);

  return {
    deeplinkUrl,
    qrSvg,
    accessKey: minted.key,
    expiresAt: minted.expiresAt,
    advisorDisplayName: advisorDisplayName?.trim() || "your advisor",
  };
}
