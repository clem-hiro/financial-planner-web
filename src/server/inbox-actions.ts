"use server";

import { revalidatePath } from "next/cache";
import {
  markAllAsRead,
  markAsRead,
  markAsReadByDedupeKey,
} from "@/data/repositories/inbox-notifications";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { markInboxItemReadSchema } from "@/lib/validation";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

export async function markInboxItemReadAction(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "Unauthorized" };

  const parsed = markInboxItemReadSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Invalid id" };

  await markAsRead(ctx.supabase, ctx.user.id, [parsed.data.id]);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markAllInboxReadAction(): Promise<ActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "Unauthorized" };

  await markAllAsRead(ctx.supabase, ctx.user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markInboxItemReadByDedupeKeyAction(
  dedupeKey: string
): Promise<ActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "Unauthorized" };

  if (typeof dedupeKey !== "string" || dedupeKey.length === 0) {
    return { ok: false, error: "Invalid dedupe key" };
  }
  await markAsReadByDedupeKey(ctx.supabase, ctx.user.id, dedupeKey);
  revalidatePath("/", "layout");
  return { ok: true };
}
