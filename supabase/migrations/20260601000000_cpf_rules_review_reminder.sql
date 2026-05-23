-- Tracks user acknowledgement that CPF assumptions/calculations were reviewed
-- against the app's current CPF rules baseline.

alter table public.financial_profiles
  add column if not exists last_cpf_rules_review_at timestamptz,
  add column if not exists last_cpf_rules_review_version text;

comment on column public.financial_profiles.last_cpf_rules_review_at is
  'ISO timestamp of the most recent CPF rules/assumptions acknowledgement.';

comment on column public.financial_profiles.last_cpf_rules_review_version is
  'App CPF rules baseline version acknowledged by the user/advisor.';
