-- Advisor roster, RPCs, and RLS all key off financial_profiles.advisor_user_id = issuing advisor.
-- advisor_access_keys already stores the correct advisor on each key; claimed_by_user_id points
-- at the client. If those ever drift (manual edits, old bugs), the advisor workspace shows
-- "keys claimed" > 0 but "total clients" = 0. Align client rows from the claimed key.

begin;

update public.financial_profiles fp
set advisor_user_id = a.advisor_user_id
from public.advisor_access_keys a
where a.claimed_by_user_id = fp.id
  and a.status = 'claimed'
  and fp.profile_type = 'client'
  and fp.advisor_user_id is distinct from a.advisor_user_id;

commit;
