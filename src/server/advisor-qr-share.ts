import "server-only";

import { randomBytes } from "node:crypto";
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

async function peekExistingLiveToken(
  supabase: SupabaseClient,
  advisorUserId: string
): Promise<{ token: string; key: string; expiresAt: Date } | null> {
  const { data, error } = await supabase
    .from("advisor_qr_share_tokens")
    .select("token, access_key, expires_at")
    .eq("advisor_user_id", advisorUserId)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as { token: string; access_key: string; expires_at: string };
  return {
    token: row.token,
    key: row.access_key,
    expiresAt: new Date(row.expires_at),
  };
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
    p_token: token,
    p_access_key: key,
    p_advisor_user_id: advisorUserId,
    p_expires_at: expiresAt.toISOString(),
  });
  if (error) throw error;

  return { token, key, expiresAt };
}

/**
 * `refresh=false` (page render): reuse an existing live token if one exists, so
 * navigating back to the page does NOT invalidate a previously-shared QR.
 * `refresh=true` (Refresh QR button): always mint, retiring the prior token.
 */
export async function buildShareData(
  supabase: SupabaseClient,
  advisorUserId: string,
  advisorDisplayName: string | null,
  refresh = false
): Promise<QrShareData | null> {
  const existing = refresh
    ? null
    : await peekExistingLiveToken(supabase, advisorUserId);
  const minted = existing ?? (await mintQrShareToken(supabase, advisorUserId));
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
