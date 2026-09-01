-- Admin read for aruotu@gmail.com, plus anonymous click/page logging.

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'aruotu@gmail.com';
$$;

alter table public.profiles add column if not exists email text;

create table if not exists public.site_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null,
  path text not null,
  href text,
  label text,
  referrer text,
  ip text,
  country text,
  region text,
  city text,
  user_agent text,
  user_id uuid,
  session_id text,
  constraint site_events_kind_check check (kind in ('page', 'click'))
);

create index if not exists site_events_created_at on public.site_events (created_at desc);
create index if not exists site_events_kind_created on public.site_events (kind, created_at desc);
create index if not exists site_events_path_created on public.site_events (path, created_at desc);

alter table public.site_events enable row level security;

drop policy if exists site_events_insert_any on public.site_events;
create policy site_events_insert_any
  on public.site_events
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists site_events_select_admin on public.site_events;
create policy site_events_select_admin
  on public.site_events
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists site_events_delete_admin on public.site_events;
create policy site_events_delete_admin
  on public.site_events
  for delete
  to authenticated
  using (public.is_admin());

grant insert on public.site_events to anon, authenticated;
grant select, delete on public.site_events to authenticated;

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists connections_select_admin on public.marketplace_connections;
create policy connections_select_admin
  on public.marketplace_connections
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists jobs_select_admin on public.marketplace_jobs;
create policy jobs_select_admin
  on public.marketplace_jobs
  for select
  to authenticated
  using (public.is_admin());

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'marketplace_interest'
  ) then
    execute 'drop policy if exists interest_select_admin on public.marketplace_interest';
    execute $p$
      create policy interest_select_admin
        on public.marketplace_interest
        for select
        to authenticated
        using (public.is_admin())
    $p$;
  end if;
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'job_outcomes'
  ) then
    execute 'drop policy if exists outcomes_select_admin on public.job_outcomes';
    execute $p$
      create policy outcomes_select_admin
        on public.job_outcomes
        for select
        to authenticated
        using (public.is_admin())
    $p$;
  end if;
end $$;
