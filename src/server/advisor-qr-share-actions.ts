"use server";

import { createSupabaseServerClient } from "@/data/supabase/server";
import { getProfileById } from "@/data/repositories/profiles";
import { isAdvisor } from "@/lib/profile-role";
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
      profile?.display_name ?? null
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
