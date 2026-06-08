# World Cup 2026 Predictor

A private family score predictor for the FIFA World Cup 2026.

Players predict the score for each group-stage match. The leaderboard awards:

- 1 point for the correct home-team score
- 1 point for the correct away-team score
- 1 point for the correct match result, including a draw

In production, predictions and results are stored in Supabase. The app can still fall back to browser `localStorage`
when Supabase environment variables are not configured.

## Run Locally

```bash
npm install
npm run dev
```

The app runs on `http://localhost:3002` by default.

## Deploy

Import this repository into Vercel as a Next.js project. Use the default build command:

```bash
npm run build
```

## Shared Data

The app can be backed by Supabase so predictions work across devices and family members.

The first migration in `supabase/migrations` creates:

- `players`, linked to Supabase Auth users
- `matches`, including official group-stage kickoffs, venues, cities, and actual scores
- `predictions`, linked to players and matches

Row-level security keeps each player's predictions private until the related match has kicked off:

- players can create and edit only their own predictions
- predictions turn amber two hours before kickoff
- predictions can be changed only until one hour before kickoff
- other players' predictions are readable only after `matches.kickoff_at <= now()`

Create a dedicated Supabase project for this app, apply the migrations, then add these Vercel environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
FOOTBALL_DATA_API_TOKEN=
```

`SUPABASE_SERVICE_ROLE_KEY` and `FOOTBALL_DATA_API_TOKEN` are server-only values used by the admin score-sync route.
Do not expose them with `NEXT_PUBLIC_`.

The match seed includes the official group-stage schedule in UTC. Kickoff times drive prediction locking,
date filters, priority picks, and prediction visibility.

In Supabase Auth settings, set the site URL and allowed redirect URLs to your Vercel domain, for example:

```text
https://worldcup-familyfun.vercel.app
```
