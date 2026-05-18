begin;

alter table public.financial_profiles
  add column if not exists lifestyle_profile text,
  add column if not exists budgeting_strategy text,
  add column if not exists onboarding_confidence_level text,
  add column if not exists budget_generation_source text,
  add column if not exists estimated_budget_mode boolean not null default false,
  add column if not exists food_spend_band text;

alter table public.financial_profiles
  drop constraint if exists financial_profiles_lifestyle_profile_check,
  add constraint financial_profiles_lifestyle_profile_check check (
    lifestyle_profile is null
    or lifestyle_profile in (
      'student',
      'fresh_graduate',
      'young_professional',
      'married_couple',
      'young_family',
      'high_saver',
      'flexible_lifestyle',
      'freelancer',
      'business_owner'
    )
  ),
  drop constraint if exists financial_profiles_budgeting_strategy_check,
  add constraint financial_profiles_budgeting_strategy_check check (
    budgeting_strategy is null
    or budgeting_strategy in (
      'balanced',
      'aggressive_saver',
      'flexible_lifestyle',
      'custom'
    )
  ),
  drop constraint if exists financial_profiles_onboarding_confidence_level_check,
  add constraint financial_profiles_onboarding_confidence_level_check check (
    onboarding_confidence_level is null
    or onboarding_confidence_level in ('rough', 'moderate', 'detailed')
  ),
  drop constraint if exists financial_profiles_budget_generation_source_check,
  add constraint financial_profiles_budget_generation_source_check check (
    budget_generation_source is null
    or budget_generation_source in (
      'user_manual',
      'guided_setup',
      'advisor_recommended',
      'ai_suggested'
    )
  ),
  drop constraint if exists financial_profiles_food_spend_band_check,
  add constraint financial_profiles_food_spend_band_check check (
    food_spend_band is null
    or food_spend_band in (
      'under_300',
      'range_300_600',
      'range_600_1000',
      'above_1000',
      'unknown'
    )
  );

commit;
