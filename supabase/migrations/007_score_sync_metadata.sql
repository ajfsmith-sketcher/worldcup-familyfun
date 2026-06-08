alter table public.matches
  add column if not exists external_provider text,
  add column if not exists external_match_id text,
  add column if not exists score_status text,
  add column if not exists odds_home_win numeric,
  add column if not exists odds_draw numeric,
  add column if not exists odds_away_win numeric,
  add column if not exists last_synced_at timestamptz;

create index if not exists matches_external_provider_match_id_idx
  on public.matches (external_provider, external_match_id);
