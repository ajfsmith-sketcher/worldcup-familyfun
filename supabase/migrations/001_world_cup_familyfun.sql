create table if not exists public.players (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matches (
  id text primary key,
  group_id text not null,
  label text not null,
  home_code text not null,
  home_name text not null,
  home_flag text not null,
  away_code text not null,
  away_name text not null,
  away_flag text not null,
  kickoff_at timestamptz not null,
  home_score integer check (home_score >= 0),
  away_score integer check (away_score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.predictions (
  player_id uuid not null references public.players(id) on delete cascade,
  match_id text not null references public.matches(id) on delete cascade,
  home_score integer not null check (home_score >= 0),
  away_score integer not null check (away_score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (player_id, match_id)
);

alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;

drop policy if exists "Players are visible to signed-in users" on public.players;
create policy "Players are visible to signed-in users"
  on public.players for select
  to authenticated
  using (true);

drop policy if exists "Players can create their own profile" on public.players;
create policy "Players can create their own profile"
  on public.players for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "Players can update their own profile" on public.players;
create policy "Players can update their own profile"
  on public.players for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "Matches are visible to signed-in users" on public.matches;
create policy "Matches are visible to signed-in users"
  on public.matches for select
  to authenticated
  using (true);

drop policy if exists "Admins can manage matches and results" on public.matches;
create policy "Admins can manage matches and results"
  on public.matches for all
  to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

drop policy if exists "Players can create their own predictions" on public.predictions;
create policy "Players can create their own predictions"
  on public.predictions for insert
  to authenticated
  with check (
    player_id = auth.uid()
    and exists (
      select 1
      from public.matches
      where matches.id = match_id
      and matches.kickoff_at > now()
    )
  );

drop policy if exists "Players can update their own predictions before kickoff" on public.predictions;
create policy "Players can update their own predictions before kickoff"
  on public.predictions for update
  to authenticated
  using (
    player_id = auth.uid()
    and exists (
      select 1
      from public.matches
      where matches.id = match_id
      and matches.kickoff_at > now()
    )
  )
  with check (
    player_id = auth.uid()
    and exists (
      select 1
      from public.matches
      where matches.id = match_id
      and matches.kickoff_at > now()
    )
  );

drop policy if exists "Predictions are private until kickoff" on public.predictions;
create policy "Predictions are private until kickoff"
  on public.predictions for select
  to authenticated
  using (
    player_id = auth.uid()
    or exists (
      select 1
      from public.matches
      where matches.id = match_id
      and matches.kickoff_at <= now()
    )
  );

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_players_updated_at on public.players;
create trigger set_players_updated_at
  before update on public.players
  for each row execute function public.set_updated_at();

drop trigger if exists set_matches_updated_at on public.matches;
create trigger set_matches_updated_at
  before update on public.matches
  for each row execute function public.set_updated_at();

drop trigger if exists set_predictions_updated_at on public.predictions;
create trigger set_predictions_updated_at
  before update on public.predictions
  for each row execute function public.set_updated_at();

-- Add a separate seed migration for matches once kickoff times are finalized.
-- The privacy policy above depends on accurate matches.kickoff_at values.
