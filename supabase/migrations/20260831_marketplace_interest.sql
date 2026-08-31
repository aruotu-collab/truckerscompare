create table if not exists public.marketplace_interest (
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, source)
);

alter table public.marketplace_interest enable row level security;

drop policy if exists interest_own on public.marketplace_interest;
create policy interest_own
  on public.marketplace_interest
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.marketplace_interest to authenticated;
