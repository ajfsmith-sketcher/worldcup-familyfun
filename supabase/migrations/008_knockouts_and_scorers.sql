alter table public.matches add column if not exists round text not null default 'Group stage';

update public.matches
set round = 'Group stage'
where round is null or round = '';

with knockout_matches (id, match_number, round, label, home_code, home_name, home_flag, away_code, away_name, away_flag, kickoff_at, venue, city) as (
  values
    ('KO-73',73,'Round of 32','Match 73','GROUP-A-RUNNERS-U','Group A runners-up','•','GROUP-B-RUNNERS-U','Group B runners-up','•','2026-06-28 19:00:00+00','Los Angeles Stadium','Los Angeles'),
    ('KO-74',74,'Round of 32','Match 74','GROUP-E-WINNERS','Group E winners','•','GROUP-A-B-C-D-F-T','Group A/B/C/D/F third place','•','2026-06-29 20:30:00+00','Boston Stadium','Boston'),
    ('KO-75',75,'Round of 32','Match 75','GROUP-F-WINNERS','Group F winners','•','GROUP-C-RUNNERS-U','Group C runners-up','•','2026-06-30 01:00:00+00','Monterrey Stadium','Monterrey'),
    ('KO-76',76,'Round of 32','Match 76','GROUP-C-WINNERS','Group C winners','•','GROUP-F-RUNNERS-U','Group F runners-up','•','2026-06-29 17:00:00+00','Houston Stadium','Houston'),
    ('KO-77',77,'Round of 32','Match 77','GROUP-I-WINNERS','Group I winners','•','GROUP-C-D-F-G-H-T','Group C/D/F/G/H third place','•','2026-06-30 21:00:00+00','New York New Jersey Stadium','New York/New Jersey'),
    ('KO-78',78,'Round of 32','Match 78','GROUP-E-RUNNERS-U','Group E runners-up','•','GROUP-I-RUNNERS-U','Group I runners-up','•','2026-06-30 17:00:00+00','Dallas Stadium','Dallas'),
    ('KO-79',79,'Round of 32','Match 79','GROUP-A-WINNERS','Group A winners','•','GROUP-C-E-F-H-I-T','Group C/E/F/H/I third place','•','2026-07-01 01:00:00+00','Mexico City Stadium','Mexico City'),
    ('KO-80',80,'Round of 32','Match 80','GROUP-L-WINNERS','Group L winners','•','GROUP-E-H-I-J-K-T','Group E/H/I/J/K third place','•','2026-07-01 16:00:00+00','Atlanta Stadium','Atlanta'),
    ('KO-81',81,'Round of 32','Match 81','GROUP-D-WINNERS','Group D winners','•','GROUP-B-E-F-I-J-T','Group B/E/F/I/J third place','•','2026-07-02 00:00:00+00','San Francisco Bay Area Stadium','San Francisco Bay Area'),
    ('KO-82',82,'Round of 32','Match 82','GROUP-G-WINNERS','Group G winners','•','GROUP-A-E-H-I-J-T','Group A/E/H/I/J third place','•','2026-07-01 20:00:00+00','Seattle Stadium','Seattle'),
    ('KO-83',83,'Round of 32','Match 83','GROUP-K-RUNNERS-U','Group K runners-up','•','GROUP-L-RUNNERS-U','Group L runners-up','•','2026-07-02 23:00:00+00','Toronto Stadium','Toronto'),
    ('KO-84',84,'Round of 32','Match 84','GROUP-H-WINNERS','Group H winners','•','GROUP-J-RUNNERS-U','Group J runners-up','•','2026-07-02 19:00:00+00','Los Angeles Stadium','Los Angeles'),
    ('KO-85',85,'Round of 32','Match 85','GROUP-B-WINNERS','Group B winners','•','GROUP-E-F-G-I-J-T','Group E/F/G/I/J third place','•','2026-07-03 03:00:00+00','Vancouver Stadium','Vancouver'),
    ('KO-86',86,'Round of 32','Match 86','GROUP-J-WINNERS','Group J winners','•','GROUP-H-RUNNERS-U','Group H runners-up','•','2026-07-03 22:00:00+00','Miami Stadium','Miami'),
    ('KO-87',87,'Round of 32','Match 87','GROUP-K-WINNERS','Group K winners','•','GROUP-D-E-I-J-L-T','Group D/E/I/J/L third place','•','2026-07-04 01:30:00+00','Kansas City Stadium','Kansas City'),
    ('KO-88',88,'Round of 32','Match 88','GROUP-D-RUNNERS-U','Group D runners-up','•','GROUP-G-RUNNERS-U','Group G runners-up','•','2026-07-03 18:00:00+00','Dallas Stadium','Dallas'),
    ('KO-89',89,'Round of 16','Match 89','WINNER-MATCH-74','Winner Match 74','•','WINNER-MATCH-77','Winner Match 77','•','2026-07-04 21:00:00+00','Philadelphia Stadium','Philadelphia'),
    ('KO-90',90,'Round of 16','Match 90','WINNER-MATCH-73','Winner Match 73','•','WINNER-MATCH-75','Winner Match 75','•','2026-07-04 17:00:00+00','Houston Stadium','Houston'),
    ('KO-91',91,'Round of 16','Match 91','WINNER-MATCH-76','Winner Match 76','•','WINNER-MATCH-78','Winner Match 78','•','2026-07-05 20:00:00+00','New York New Jersey Stadium','New York/New Jersey'),
    ('KO-92',92,'Round of 16','Match 92','WINNER-MATCH-79','Winner Match 79','•','WINNER-MATCH-80','Winner Match 80','•','2026-07-06 00:00:00+00','Mexico City Stadium','Mexico City'),
    ('KO-93',93,'Round of 16','Match 93','WINNER-MATCH-83','Winner Match 83','•','WINNER-MATCH-84','Winner Match 84','•','2026-07-06 19:00:00+00','Dallas Stadium','Dallas'),
    ('KO-94',94,'Round of 16','Match 94','WINNER-MATCH-81','Winner Match 81','•','WINNER-MATCH-82','Winner Match 82','•','2026-07-07 00:00:00+00','Seattle Stadium','Seattle'),
    ('KO-95',95,'Round of 16','Match 95','WINNER-MATCH-86','Winner Match 86','•','WINNER-MATCH-88','Winner Match 88','•','2026-07-07 16:00:00+00','Atlanta Stadium','Atlanta'),
    ('KO-96',96,'Round of 16','Match 96','WINNER-MATCH-85','Winner Match 85','•','WINNER-MATCH-87','Winner Match 87','•','2026-07-07 20:00:00+00','Vancouver Stadium','Vancouver'),
    ('KO-97',97,'Quarter-final','Match 97','WINNER-MATCH-89','Winner Match 89','•','WINNER-MATCH-90','Winner Match 90','•','2026-07-09 20:00:00+00','Boston Stadium','Boston'),
    ('KO-98',98,'Quarter-final','Match 98','WINNER-MATCH-93','Winner Match 93','•','WINNER-MATCH-94','Winner Match 94','•','2026-07-10 19:00:00+00','Los Angeles Stadium','Los Angeles'),
    ('KO-99',99,'Quarter-final','Match 99','WINNER-MATCH-91','Winner Match 91','•','WINNER-MATCH-92','Winner Match 92','•','2026-07-11 21:00:00+00','Miami Stadium','Miami'),
    ('KO-100',100,'Quarter-final','Match 100','WINNER-MATCH-95','Winner Match 95','•','WINNER-MATCH-96','Winner Match 96','•','2026-07-12 01:00:00+00','Kansas City Stadium','Kansas City'),
    ('KO-101',101,'Semi-final','Match 101','WINNER-MATCH-97','Winner Match 97','•','WINNER-MATCH-98','Winner Match 98','•','2026-07-14 19:00:00+00','Dallas Stadium','Dallas'),
    ('KO-102',102,'Semi-final','Match 102','WINNER-MATCH-99','Winner Match 99','•','WINNER-MATCH-100','Winner Match 100','•','2026-07-15 19:00:00+00','Atlanta Stadium','Atlanta'),
    ('KO-103',103,'Third place','Match 103','LOSER-MATCH-101','Loser Match 101','•','LOSER-MATCH-102','Loser Match 102','•','2026-07-18 21:00:00+00','Miami Stadium','Miami'),
    ('KO-104',104,'Final','Match 104','WINNER-MATCH-101','Winner Match 101','•','WINNER-MATCH-102','Winner Match 102','•','2026-07-19 19:00:00+00','New York New Jersey Stadium','New York/New Jersey')
)
insert into public.matches (id, match_number, group_id, round, label, home_code, home_name, home_flag, away_code, away_name, away_flag, kickoff_at, venue, city)
select id, match_number, 'KO', round, label, home_code, home_name, home_flag, away_code, away_name, away_flag, kickoff_at::timestamptz, venue, city
from knockout_matches
on conflict (id) do update
set match_number = excluded.match_number,
    group_id = excluded.group_id,
    round = excluded.round,
    label = excluded.label,
    home_code = excluded.home_code,
    home_name = excluded.home_name,
    home_flag = excluded.home_flag,
    away_code = excluded.away_code,
    away_name = excluded.away_name,
    away_flag = excluded.away_flag,
    kickoff_at = excluded.kickoff_at,
    venue = excluded.venue,
    city = excluded.city;

create table if not exists public.tournament_scorers (
  id bigint generated by default as identity primary key,
  player_name text not null,
  team_name text,
  team_code text,
  goals integer not null default 0 check (goals >= 0),
  assists integer check (assists >= 0),
  penalties integer check (penalties >= 0),
  played_matches integer check (played_matches >= 0),
  external_player_id text,
  external_team_id text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_name, team_name)
);

alter table public.tournament_scorers enable row level security;

drop policy if exists "Tournament scorers are visible to signed-in users" on public.tournament_scorers;
create policy "Tournament scorers are visible to signed-in users"
  on public.tournament_scorers for select
  to authenticated
  using (true);

drop policy if exists "Admins can manage tournament scorers" on public.tournament_scorers;
create policy "Admins can manage tournament scorers"
  on public.tournament_scorers for all
  to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

drop trigger if exists set_tournament_scorers_updated_at on public.tournament_scorers;
create trigger set_tournament_scorers_updated_at
  before update on public.tournament_scorers
  for each row execute function public.set_updated_at();
