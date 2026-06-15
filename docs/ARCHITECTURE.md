# World Cup Family Fun Architecture

This document captures the current product shape, technical design, and key decisions for the World Cup 2026 family predictor app. It is intended as a shareable handover note for future development.

## Product Summary

World Cup Family Fun is a private family game for predicting every FIFA World Cup 2026 match.

Players enter exact score predictions before each match locks. The app keeps picks private until kickoff, reveals family picks once the match starts, and calculates points when actual scores are available.

The current scoring model is:

- 1 point for the correct home-team score
- 1 point for the correct away-team score
- 1 point for the correct match result

This means a perfect score earns 3 points.

## Core User Flows

- Sign in with Supabase magic-link authentication.
- Set or update a display name.
- Pick scores for group-stage and knockout matches.
- See today's matches and yesterday's matches on the Family table tab.
- See family forecasts once enough private picks exist.
- View revealed family picks after kickoff.
- Track standings, missed picks, correct goals, and points.
- Opt into the 7:30am UK family digest email.
- Admins can sync scores, enter or clear actual scores, send test digests, and review missing picks.

## Key Product Decisions

- Predictions are private until kickoff.
- Predictions lock 1 hour before kickoff.
- The UI turns amber 2 hours before kickoff as a warning.
- Matchday grouping for dashboard "today" and "yesterday" uses `America/Los_Angeles`, because several games are played late in North America and otherwise appear awkwardly split for UK users.
- The daily digest runs at 7:30am UK time so late North American matches have more time to finish and sync.
- Group-stage and knockout matches are separated in the UI.
- Knockout matches are seeded as placeholders until qualified teams are known.
- Family forecasts are aggregate-only before kickoff and require a minimum number of picks before display.
- Admin status is controlled manually through Supabase user `app_metadata`.
- Actual score editing stays admin-only.
- A local/fallback mode exists through browser storage when Supabase is not configured, but production uses Supabase.

## Application Stack

- Next.js App Router
- React and TypeScript
- Supabase Auth, Postgres, Row Level Security, and RPC functions
- Vercel hosting and cron jobs
- Brevo transactional email for daily digests
- football-data.org for fixture/result sync

## Important Files

- `components/WorldCupPredictor.tsx`
  Main client component. Handles tabs, prediction entry, leaderboard, admin surface, family forecast display, scorer tab, settings, and Supabase client interactions.

- `lib/gameRules.ts`
  Shared rules for scoring, lock timing, result helpers, date grouping, odds formatting, and match state helpers.

- `lib/worldCup2026.ts`
  Static tournament data, seeded schedule data, team metadata, and local fallback helpers.

- `lib/supabaseClient.ts`
  Browser Supabase client factory.

- `app/api/sync-scores/route.ts`
  Protected score-sync route. Pulls football-data.org World Cup matches and scorers, updates Supabase, and records sync metadata.

- `app/api/daily-digest/route.ts`
  Protected daily digest route. Builds and sends the Brevo email to opted-in players.

- `app/api/admin-missing-picks/route.ts`
  Admin-only route for listing who has not picked today's matches.

- `app/api/predictions/clear/route.ts`
  Server-side route for clearing a user's own prediction before lock. This exists because client-side delete is not exposed through the current RLS policy.

- `app/globals.css`
  Main styling for the app.

- `supabase/migrations/*`
  Database schema, policies, functions, seed data, and later feature migrations.

## Supabase Design

The app uses Supabase as the production source of truth.

### Main Tables

- `players`
  One row per authenticated user. Stores display name and daily digest opt-in state.

- `matches`
  One row per World Cup match. Stores match number, group/round, teams, flags, kickoff, venue, city, actual scores, external provider IDs, provider status, odds fields, and sync timestamps.

- `predictions`
  One row per player per match. Stores predicted home and away scores.

- `tournament_scorers`
  Stores Golden Boot/scorer data when a provider can supply it. The table exists, but football-data.org free access currently does not provide enough scorer/event detail for the desired feature.

- `sync_runs`
  Stores score-sync activity for admin visibility, including provider, request count, matched count, updated count, and errors.

### RLS And Privacy

Supabase Row Level Security is central to the game:

- Signed-in users can read players and matches.
- Players can create and update only their own profile.
- Players can create and update only their own predictions before lock.
- Other players' predictions become readable only after kickoff.
- Match/result management is limited to admins.

Admin users are identified by this Supabase Auth app metadata:

```json
{ "role": "admin" }
```

Server-only routes use the Supabase service role key for actions that cannot safely be done from the browser, such as cron score sync, digest generation, admin missing-pick checks, and clearing prediction rows.

## API Integrations

### football-data.org

Used by `/api/sync-scores` with the `FOOTBALL_DATA_API_TOKEN` environment variable.

Current use:

- World Cup fixtures
- Match status
- Actual scores
- Provider sync metadata

Known notes:

- Scores can be delayed depending on football-data.org plan/coverage.
- Odds fields are supported in our database and UI, but football-data.org odds require an add-on/package.
- Scorers are attempted in the sync route, but the free tier has not provided the detailed event/scorer data needed for the planned scorer experience.

### API-Football

This was researched and tested as a future option. It appears to provide richer data, including events, lineups, top scorers, statistics, predictions, injuries, and odds, but World Cup 2026 access appears to require a paid plan. This is parked in the backlog.

### Brevo

Used by `/api/daily-digest` for the daily family email.

The digest includes:

- League table
- Recent results
- Player picks and points for those results
- Upcoming fixtures before the next digest
- A light-hearted summary

The sender email must be verified in Brevo.

### News And Gossip

Not implemented yet. The backlog proposes using RSS feeds and APIs such as Guardian Open Platform, avoiding direct scraping, then caching normalized news items in Supabase for a future News/Gossip page and richer digest summaries.

## Vercel Design

The app is deployed to Vercel as a Next.js project.

Production URL:

```text
https://worldcup-familyfun.vercel.app/world-cup-2026
```

### Cron Jobs

Defined in `vercel.json`.

Score sync:

- `15 21 * * *`
- `15 0 * * *`
- `15 3 * * *`
- `50 5 * * *`

Daily digest:

- `30 6 * * *`

These schedules are UTC. During UK summer time, `30 6 * * *` sends at roughly 7:30am UK time.

### Environment Variables

Required production values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
FOOTBALL_DATA_API_TOKEN=
CRON_SECRET=
BREVO_API_KEY=
DIGEST_SENDER_EMAIL=
DIGEST_SENDER_NAME=
NEXT_PUBLIC_SITE_URL=
```

Server-only values must not use the `NEXT_PUBLIC_` prefix:

- `SUPABASE_SERVICE_ROLE_KEY`
- `FOOTBALL_DATA_API_TOKEN`
- `CRON_SECRET`
- `BREVO_API_KEY`

`NEXT_PUBLIC_SITE_URL` should point at the public Vercel URL.

## Admin Surface

Admin users see an Admin tab in the app.

Current admin capabilities:

- Sync scores manually.
- Send a test daily digest.
- Review score-sync call counts and latest sync status.
- See missing picks for today's matches.
- Enter actual scores.
- Clear actual scores.
- Filter admin result-entry rows.

Admin access is enforced both in the UI and in Supabase/API checks. The UI check alone is not treated as security.

## UI Structure

The app currently has these primary tabs:

- Family table
- Group games
- Knockouts
- Scorers
- Admin

On mobile, the tab buttons use icons to save vertical space.

Family table is the dashboard-style view. It includes today's matches, yesterday's matches, league table, and bragging rights. Sections can be minimized and the state is remembered locally.

Group games and knockouts focus on prediction entry and filtering. Family picks are minimized by default to reduce scrolling.

The Scorers tab currently reads from `tournament_scorers`; it is ready for richer provider data if a suitable API is enabled.

## Testing And Deployment

Useful local commands:

```bash
npm run test
npm run build
npm run dev
```

Production deploy:

```bash
npx vercel --prod --yes
```

The test suite currently covers core tournament/rules logic. UI behavior is mostly verified manually in the browser.

## Known Limitations

- Scorer/event detail is not complete on the current free football-data.org access.
- Odds are parked unless football-data.org odds add-on or another paid provider is enabled.
- Knockout team resolution still needs future work once group outcomes are known.
- News/gossip digest enhancements are planned but not implemented.
- The app has grown quickly, so some UI sections are still being polished for small portrait phone screens.

## Future Improvements

The backlog remains the source of truth for planned work. The main themes are:

- Better knockout-round UX and filtering.
- Richer scorer and match-event data if a suitable API is enabled.
- News/gossip page and digest enrichment.
- Additional mobile UI polish.
- More automated tests around API routes and privacy-sensitive behavior.
