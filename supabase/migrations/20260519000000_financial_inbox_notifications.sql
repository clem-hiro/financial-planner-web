-- Dedupe-keyed inbox notifications. Generic shape so future producers (salary review,
-- onboarding nudges, advisor alerts) all flow through one table; idempotency comes from
-- `unique (user_id, dedupe_key)` + `ignoreDuplicates` on upsert.

begin;

create extension if not exists pgcrypto;

create table if not exists public.financial_inbox_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.financial_profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  cta_label text,
  cta_href text,
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_inbox_notifications_user_dedupe_unique
    unique (user_id, dedupe_key)
);

-- Supports the bell badge query: "unread items for this user, newest first." Partial
-- index — read rows are excluded so the hot index stays tight as history grows.
create index if not exists financial_inbox_notifications_unread_idx
  on public.financial_inbox_notifications (user_id, created_at desc)
  where read_at is null;

comment on table public.financial_inbox_notifications is
  'Generic inbox. Idempotency via unique(user_id, dedupe_key); producers upsert with ignoreDuplicates.';

alter table public.financial_inbox_notifications enable row level security;

drop policy if exists "financial_inbox_notifications_select_own" on public.financial_inbox_notifications;
drop policy if exists "financial_inbox_notifications_insert_own" on public.financial_inbox_notifications;
drop policy if exists "financial_inbox_notifications_update_own" on public.financial_inbox_notifications;
drop policy if exists "financial_inbox_notifications_delete_own" on public.financial_inbox_notifications;

create policy "financial_inbox_notifications_select_own"
  on public.financial_inbox_notifications
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "financial_inbox_notifications_insert_own"
  on public.financial_inbox_notifications
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "financial_inbox_notifications_update_own"
  on public.financial_inbox_notifications
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "financial_inbox_notifications_delete_own"
  on public.financial_inbox_notifications
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
