-- Remove planning milestones; enrich housing loans for HDB/bank context

alter table public.housing_loans
  drop constraint if exists housing_loans_milestone_id_fkey;

drop index if exists public.housing_loans_milestone_id_idx;

alter table public.housing_loans
  drop column if exists milestone_id;

drop policy if exists "planning_milestones_select_own" on public.planning_milestones;
drop policy if exists "planning_milestones_insert_own" on public.planning_milestones;
drop policy if exists "planning_milestones_update_own" on public.planning_milestones;
drop policy if exists "planning_milestones_delete_own" on public.planning_milestones;

drop table if exists public.planning_milestones;

alter table public.housing_loans
  add column if not exists lender_type text not null default 'hdb'
    check (lender_type in ('hdb', 'bank', 'other'));

alter table public.housing_loans
  add column if not exists original_loan_principal numeric(14, 2)
    check (original_loan_principal is null or original_loan_principal > 0);

alter table public.housing_loans
  add column if not exists principal_repaid_before_schedule numeric(14, 2) not null default 0
    check (principal_repaid_before_schedule >= 0);
