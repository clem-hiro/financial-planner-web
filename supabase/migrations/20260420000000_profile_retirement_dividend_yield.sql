-- Optional annual dividend yield assumption for retirement (0–1, e.g. 0.02 = 2%).

alter table public.profiles
  add column if not exists retirement_dividend_yield_annual numeric(6, 4)
    check (
      retirement_dividend_yield_annual is null
      or (
        retirement_dividend_yield_annual >= 0
        and retirement_dividend_yield_annual <= 0.25
      )
    );
