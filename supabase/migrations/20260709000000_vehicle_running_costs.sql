-- Vehicle running costs + budget-line linkage for auto-synced expense lines.

alter table public.financial_vehicles
  add column if not exists monthly_petrol_cashcard numeric(14, 2) not null default 0
    check (monthly_petrol_cashcard >= 0),
  add column if not exists annual_insurance numeric(14, 2) not null default 0
    check (annual_insurance >= 0),
  add column if not exists annual_road_tax numeric(14, 2) not null default 0
    check (annual_road_tax >= 0),
  add column if not exists annual_maintenance numeric(14, 2) not null default 0
    check (annual_maintenance >= 0);

alter table public.financial_budget_lines
  add column if not exists source_vehicle_id uuid
    references public.financial_vehicles (id) on delete cascade,
  add column if not exists vehicle_budget_slot text null
    check (
      vehicle_budget_slot is null
      or vehicle_budget_slot in (
        'loan_repayment',
        'petrol',
        'insurance',
        'road_tax',
        'maintenance'
      )
    );

create index if not exists financial_budget_lines_source_vehicle_id_idx
  on public.financial_budget_lines (source_vehicle_id)
  where source_vehicle_id is not null;

create unique index if not exists financial_budget_lines_vehicle_slot_uidx
  on public.financial_budget_lines (source_vehicle_id, vehicle_budget_slot)
  where source_vehicle_id is not null and vehicle_budget_slot is not null;
