create table if not exists public.job_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id text not null,
  kind text not null,
  route text not null default '',
  profit numeric,
  revenue numeric,
  recorded_at timestamptz not null default now(),
  constraint job_outcomes_kind_check check (
    kind in ('quoted', 'won', 'lost', 'skipped')
  )
);

create index if not exists job_outcomes_user_recorded
  on public.job_outcomes (user_id, recorded_at desc);

alter table public.job_outcomes enable row level security;

drop policy if exists outcomes_own on public.job_outcomes;
create policy outcomes_own
  on public.job_outcomes
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.job_outcomes to authenticated;
