import type { SupabaseClient } from "@supabase/supabase-js";
import type { InboxNotificationRow } from "@/data/supabase/types";

export type InboxUpsertPayload = {
  kind: string;
  title: string;
  body?: string | null;
  cta_label?: string | null;
  cta_href?: string | null;
  dedupe_key: string;
};

export async function listUnreadByUser(
  supabase: SupabaseClient,
  userId: string,
  limit = 20
): Promise<InboxNotificationRow[]> {
  const { data, error } = await supabase
    .from("financial_inbox_notifications")
    .select("*")
    .eq("user_id", userId)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as InboxNotificationRow[];
}

/** Counts unread without hydrating rows — `head:true` returns count only. */
export async function countUnreadByUser(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("financial_inbox_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

/** Keyset pagination on `created_at`. Pass `before` = the smallest seen `created_at`. */
export async function listAllByUser(
  supabase: SupabaseClient,
  userId: string,
  limit = 20,
  before?: string
): Promise<InboxNotificationRow[]> {
  let q = supabase
    .from("financial_inbox_notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) q = q.lt("created_at", before);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as InboxNotificationRow[];
}

/** Idempotent re-read: only flips rows still NULL, so re-marking a read row is a no-op. */
export async function markAsRead(
  supabase: SupabaseClient,
  userId: string,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("financial_inbox_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null)
    .in("id", ids);
  if (error) throw error;
}

export async function markAllAsRead(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("financial_inbox_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
}

/** Re-mark by dedupe_key — used by Phase 3 salary-review CTA. */
export async function markAsReadByDedupeKey(
  supabase: SupabaseClient,
  userId: string,
  dedupeKey: string
): Promise<void> {
  const { error } = await supabase
    .from("financial_inbox_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("dedupe_key", dedupeKey)
    .is("read_at", null);
  if (error) throw error;
}

/**
 * Idempotent producer. `ignoreDuplicates` is load-bearing: a redundant call must
 * NOT bump `updated_at` (which would resurrect a previously-read row to the top
 * of "unread"). On unique-violation race (Postgres `23505`), swallow — that's
 * the same logical outcome.
 */
export async function upsertByDedupeKey(
  supabase: SupabaseClient,
  userId: string,
  payload: InboxUpsertPayload
): Promise<void> {
  const { error } = await supabase
    .from("financial_inbox_notifications")
    .upsert(
      { user_id: userId, ...payload },
      { onConflict: "user_id,dedupe_key", ignoreDuplicates: true }
    );
  if (error && (error as { code?: string }).code !== "23505") {
    throw error;
  }
}
