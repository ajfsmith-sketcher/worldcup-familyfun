alter table public.players
  add column if not exists daily_digest_opt_in boolean not null default false;
