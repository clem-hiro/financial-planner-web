-- Profile acknowledgement for investment balance / return assumption reviews.
-- Nullable so existing rows are unaffected; pairs with inbox `investment_review_due:*`.

begin;

alter table public.financial_profiles
  add column if not exists last_investment_review_at timestamptz;

comment on column public.financial_profiles.last_investment_review_at is
  'When the user last confirmed investment balances and return assumptions are still accurate.';

commit;
