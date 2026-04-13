-- App default currency: Singapore dollars (employee take-home context).
alter table public.profiles
  alter column base_currency set default 'SGD';

update public.profiles
set base_currency = 'SGD'
where base_currency <> 'SGD';
