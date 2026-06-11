create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  request_count integer not null default 0,
  object_count integer not null default 0,
  matched_count integer not null default 0,
  updated_count integer not null default 0,
  error text,
  created_at timestamptz not null default now()
);

alter table public.sync_runs enable row level security;

drop policy if exists "Admins can read sync runs" on public.sync_runs;
create policy "Admins can read sync runs"
  on public.sync_runs
  for select
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
