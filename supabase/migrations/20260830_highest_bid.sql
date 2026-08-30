alter table public.marketplace_jobs
  add column if not exists highest_bid numeric;
