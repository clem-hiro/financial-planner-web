"use server";

import { revalidatePath } from "next/cache";
import {
  insertAdvisorAccessKeys,
  listAdvisorAccessKeysForAdvisor,
} from "@/data/repositories/advisor-access-keys";
import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import {
  ADVISOR_ACCESS_KEY_BATCH_POC,
  generateUniqueAdvisorAccessKeys,
} from "@/lib/advisor-access-key-token";
import { isAdvisor } from "@/lib/profile-role";

export type GenerateAdvisorKeysFormState = {
  error: string | null;
  info: string | null;
};

export async function generateAdvisorAccessKeysPocFormAction(
  _prev: GenerateAdvisorKeysFormState,
  _formData: FormData
): Promise<GenerateAdvisorKeysFormState> {
  const r = await generateAdvisorAccessKeysPocAction();
  if (!r.ok) {
    return { error: r.error ?? "Could not generate keys", info: null };
  }
  return {
    error: null,
    info: `Added ${r.generated} new keys.`,
  };
}

export async function generateAdvisorAccessKeysPocAction(): Promise<{
  ok: boolean;
  error: string | null;
  generated: number;
}> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in required", generated: 0 };
  }

  const profile = await getProfileById(supabase, user.id);
  if (!isAdvisor(profile)) {
    return { ok: false, error: "Only financial advisors can generate keys.", generated: 0 };
  }

  const existingKeys = await listAdvisorAccessKeysForAdvisor(supabase, user.id);
  const existing = new Set(existingKeys.map((r) => r.access_key));
  const batch = generateUniqueAdvisorAccessKeys(ADVISOR_ACCESS_KEY_BATCH_POC, existing);

  try {
    await insertAdvisorAccessKeys(supabase, user.id, batch);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save keys";
    return { ok: false, error: message, generated: 0 };
  }

  revalidatePath("/advisor/access-keys");
  revalidatePath("/advisor");
  return { ok: true, error: null, generated: batch.length };
}
