drop function if exists public.player_prediction_status();

create function public.player_prediction_status()
returns table (
  player_id uuid,
  prediction_count integer,
  group_prediction_count integer,
  knockout_prediction_count integer,
  next_pending_count integer
)
language sql
security definer
set search_path = public
as $$
  with next_kickoff as (
    select min(kickoff_at) as kickoff_at
    from public.matches
    where kickoff_at > now()
  ),
  next_matches as (
    select id
    from public.matches
    where kickoff_at = (select kickoff_at from next_kickoff)
  )
  select
    players.id as player_id,
    count(distinct all_predictions.match_id)::integer as prediction_count,
    count(distinct all_predictions.match_id) filter (where matches.round = 'Group stage')::integer as group_prediction_count,
    count(distinct all_predictions.match_id) filter (where matches.round <> 'Group stage')::integer as knockout_prediction_count,
    count(distinct next_matches.id) filter (where next_predictions.match_id is null)::integer as next_pending_count
  from public.players
  left join public.predictions as all_predictions
    on all_predictions.player_id = players.id
  left join public.matches
    on matches.id = all_predictions.match_id
  left join next_matches
    on true
  left join public.predictions as next_predictions
    on next_predictions.player_id = players.id
    and next_predictions.match_id = next_matches.id
  group by players.id;
$$;

revoke all on function public.player_prediction_status() from public;
grant execute on function public.player_prediction_status() to authenticated;
