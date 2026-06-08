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
      and matches.kickoff_at > now() + interval '1 hour'
    )
  );

drop policy if exists "Players can update their own predictions before lock deadline" on public.predictions;
create policy "Players can update their own predictions before lock deadline"
  on public.predictions for update
  to authenticated
  using (
    player_id = auth.uid()
    and exists (
      select 1
      from public.matches
      where matches.id = match_id
      and matches.kickoff_at > now() + interval '1 hour'
    )
  )
  with check (
    player_id = auth.uid()
    and exists (
      select 1
      from public.matches
      where matches.id = match_id
      and matches.kickoff_at > now() + interval '1 hour'
    )
  );
