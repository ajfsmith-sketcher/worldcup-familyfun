create or replace function public.family_match_forecasts(minimum_picks integer default 4)
returns table (
  match_id text,
  total_picks integer,
  home_result_picks integer,
  draw_result_picks integer,
  away_result_picks integer,
  top_score_home integer,
  top_score_away integer,
  top_score_picks integer
)
language sql
security definer
set search_path = public
as $$
  with visible_matches as (
    select matches.id
    from public.matches
    where
      matches.kickoff_at <= now()
      or exists (
        select 1
        from public.predictions own_predictions
        where own_predictions.match_id = matches.id
        and own_predictions.player_id = auth.uid()
      )
  ),
  prediction_groups as (
    select
      predictions.match_id,
      predictions.home_score,
      predictions.away_score,
      count(*)::integer as score_picks,
      row_number() over (
        partition by predictions.match_id
        order by count(*) desc, predictions.home_score asc, predictions.away_score asc
      ) as score_rank
    from public.predictions
    join visible_matches
      on visible_matches.id = predictions.match_id
    group by predictions.match_id, predictions.home_score, predictions.away_score
  ),
  match_totals as (
    select
      predictions.match_id,
      count(*)::integer as total_picks,
      count(*) filter (where predictions.home_score > predictions.away_score)::integer as home_result_picks,
      count(*) filter (where predictions.home_score = predictions.away_score)::integer as draw_result_picks,
      count(*) filter (where predictions.home_score < predictions.away_score)::integer as away_result_picks
    from public.predictions
    join visible_matches
      on visible_matches.id = predictions.match_id
    group by predictions.match_id
  )
  select
    match_totals.match_id,
    match_totals.total_picks,
    match_totals.home_result_picks,
    match_totals.draw_result_picks,
    match_totals.away_result_picks,
    prediction_groups.home_score as top_score_home,
    prediction_groups.away_score as top_score_away,
    prediction_groups.score_picks as top_score_picks
  from match_totals
  left join prediction_groups
    on prediction_groups.match_id = match_totals.match_id
    and prediction_groups.score_rank = 1
  where match_totals.total_picks >= greatest(minimum_picks, 2);
$$;

revoke all on function public.family_match_forecasts(integer) from public;
grant execute on function public.family_match_forecasts(integer) to authenticated;
