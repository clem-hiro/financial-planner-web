-- Advisors may read financial_profiles for clients they invited (advisor_user_id = self).
-- Combined with existing "own row" select policy via OR semantics.

begin;

drop policy if exists "financial_profiles_select_advisor_clients" on public.financial_profiles;

create policy "financial_profiles_select_advisor_clients"
  on public.financial_profiles
  for select
  using (
    profile_type = 'client'
    and advisor_user_id = (select auth.uid())
  );

commit;
