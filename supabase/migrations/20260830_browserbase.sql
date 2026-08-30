alter table public.marketplace_connections
  add column if not exists browserbase_context_id text,
  add column if not exists browserbase_session_id text;
