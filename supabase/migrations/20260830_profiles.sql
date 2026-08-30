create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Owner-driver',
  home_city text not null default 'Birmingham',
  starting_city text not null default 'Manchester',
  vehicle_type text not null default '7.5t',
  payload_kg numeric not null default 3500,
  mpg numeric not null default 14,
  fuel_price_per_litre numeric not null default 1.49,
  running_cost_per_mile numeric not null default 0.28,
  driver_hourly_cost numeric not null default 18,
  marketplace_fee_percent numeric not null default 3.5,
  target_profit_per_hour numeric not null default 55,
  min_profit numeric not null default 250,
  max_dead_miles numeric not null default 40,
  working_hours numeric not null default 10,
  updated_at timestamptz not null default now(),
  constraint profiles_vehicle_type_check check (
    vehicle_type in ('van', 'luton', '7.5t', '18t', 'artic', 'car_transporter')
  )
);

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

grant select, insert, update on public.profiles to authenticated;

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute procedure public.set_profiles_updated_at();
