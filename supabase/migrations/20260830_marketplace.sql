create table if not exists public.marketplace_connections (
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null default 'Shiply',
  status text not null default 'disconnected',
  last_synced_at timestamptz,
  last_error text,
  job_count integer not null default 0,
  primary key (user_id, source),
  constraint marketplace_connections_status_check check (
    status in ('disconnected', 'connected', 'needs_reconnect')
  )
);

create table if not exists public.marketplace_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null default 'Shiply',
  external_id text not null,
  listing_url text,
  pickup_city text not null,
  delivery_city text not null,
  category text not null default 'General',
  vehicle_required text not null default '7.5t',
  revenue numeric not null,
  weight_kg numeric,
  collection_window text not null default '',
  delivery_window text not null default '',
  posted_minutes_ago integer not null default 0,
  quote_count integer not null default 0,
  description text not null default '',
  loading_minutes_known boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

alter table public.marketplace_connections enable row level security;
alter table public.marketplace_jobs enable row level security;

drop policy if exists connections_own on public.marketplace_connections;
create policy connections_own
  on public.marketplace_connections
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists jobs_own on public.marketplace_jobs;
create policy jobs_own
  on public.marketplace_jobs
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.marketplace_connections to authenticated;
grant select, insert, update, delete on public.marketplace_jobs to authenticated;
