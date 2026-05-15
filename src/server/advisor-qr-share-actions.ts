"use server";

import { createSupabaseServerClient } from "@/data/supabase/server";
import { getProfileById } from "@/data/repositories/profiles";
import { isAdvisor } from "@/lib/profile-role";
import { qrShareTokenSchema } from "@/lib/validation";
import { buildShareData, type QrShareData } from "@/server/advisor-qr-share";

export type RefreshAdvisorQrShareResult =
  | { ok: true; data: SerializableQrShareData }
  | { ok: false; reason: "unauthorized" | "no_keys" | "error" };

export type SerializableQrShareData = Omit<QrShareData, "expiresAt"> & {
  expiresAt: string;
};

export async function refreshAdvisorQrShareAction(): Promise<RefreshAdvisorQrShareResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "unauthorized" };

  const profile = await getProfileById(supabase, user.id);
  if (!isAdvisor(profile)) return { ok: false, reason: "unauthorized" };

  try {
    const data = await buildShareData(
      supabase,
      user.id,
      profile?.display_name ?? null,
      true
    );
    if (!data) return { ok: false, reason: "no_keys" };
    return {
      ok: true,
      data: { ...data, expiresAt: data.expiresAt.toISOString() },
    };
  } catch (e) {
    console.error("refreshAdvisorQrShareAction failed", e);
    return { ok: false, reason: "error" };
  }
}

/**
 * POST-time atomic consume, invoked from the signup submit handler. Splitting
 * consume out of the /login GET render prevents link-preview prefetch from
 * burning the token before the human submits.
 */
export async function consumeQrTokenAction(
  token: string
): Promise<{ ok: true; accessKey: string } | { ok: false }> {
  const parsed = qrShareTokenSchema.safeParse(token);
  if (!parsed.success) return { ok: false };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("consume_qr_share_token", {
      p_token: parsed.data,
    });
    if (error || typeof data !== "string" || !data) return { ok: false };
    return { ok: true, accessKey: data };
  } catch (e) {
    console.error("consumeQrTokenAction failed", e);
    return { ok: false };
  }
}
