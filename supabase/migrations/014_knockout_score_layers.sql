alter table public.matches
  add column if not exists score_duration text,
  add column if not exists score_winner text,
  add column if not exists normal_time_home_score integer check (normal_time_home_score >= 0),
  add column if not exists normal_time_away_score integer check (normal_time_away_score >= 0),
  add column if not exists after_extra_time_home_score integer check (after_extra_time_home_score >= 0),
  add column if not exists after_extra_time_away_score integer check (after_extra_time_away_score >= 0),
  add column if not exists penalties_home_score integer check (penalties_home_score >= 0),
  add column if not exists penalties_away_score integer check (penalties_away_score >= 0),
  add column if not exists advancing_team_code text,
  add column if not exists advancing_team_name text;

update public.matches
set
  score_duration = coalesce(score_duration, 'REGULAR'),
  normal_time_home_score = coalesce(normal_time_home_score, home_score),
  normal_time_away_score = coalesce(normal_time_away_score, away_score)
where home_score is not null
and away_score is not null;
