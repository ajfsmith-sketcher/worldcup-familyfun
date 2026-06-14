# World Cup Predictor Backlog

Last reviewed: 2026-06-14

## Current State

- App is deployed at https://worldcup-familyfun.vercel.app.
- Source is pushed to https://github.com/ajfsmith-sketcher/worldcup-familyfun.
- Supabase project `world-cup-family-fun` is connected through Vercel environment variables.
- Supabase schema is live with RLS for players, matches, and predictions.
- Predictions are private until `matches.kickoff_at <= now()`.
- Predictions turn amber two hours before kickoff and lock one hour before kickoff.
- Players sign in with Supabase magic links and create a display profile.
- Group-stage match rows are seeded with official match numbers, kickoff times, venues, and cities.
- Picks and family leaderboard are split into separate app tabs.
- The app highlights the next match or simultaneous next matches near the top of the page.
- Vercel Cron is configured to call score sync several times per day during common match-finish windows.
- Automated tests cover scoring, lock timing, reveal timing, completion, and next-match logic.
- Knockout rounds are available as bracket-placeholder fixtures.
- A scorers tab is available and wired to provider-synced scorer data.
- Group-stage and knockout predictions are split into separate tabs and progress counts.
- The next-match panel includes a privacy-safe family forecast and rotating World Cup fun facts.

## Needs Confirmation

### 1. Confirm Supabase Auth Redirect Settings

Status: confirmed

Set Supabase Auth site URL and allowed redirect URL to:

```text
https://worldcup-familyfun.vercel.app
```

Why it matters: magic-link sign-in may fail or redirect awkwardly until Supabase Auth is configured for the production domain.

Confirmed by live family sign-ins on 2026-06-08.

### 2. Confirm Admin User Model

Status: confirmed for v1

Actual score editing is currently admin-only via Supabase user metadata:

```json
{ "role": "admin" }
```

Decision: keep admin setup manual in Supabase for v1. An in-app admin management flow can stay under Better Admin Surface.

Confirmed:
- Admin UI is only shown to users with `{ "role": "admin" }`.
- Supabase RLS only allows match/result updates for users with admin app metadata.
- Manual admin score editing has been tested during Match 1 reveal testing.

### 3. Confirm Prediction Visibility Rule

Status: confirmed

Chosen rule: everyone’s predictions are private until kickoff.

Chosen rule: prediction entry turns amber two hours before kickoff and locks one hour before kickoff.

Chosen rule: after kickoff, all predictions for that match become visible even before full-time.

## Must Do Before Family Use

### 4. Verify Official Schedule Data

Status: done

Official group-stage kickoff timestamps, venues, cities, and match numbers have been added.

Notes:
- Kickoff timestamps are stored as UTC.
- This controls prediction locking, date filters, priority picks, and reveal timing.
- Re-run privacy checks after any future FIFA schedule changes.

### 5. End-to-End Auth Test

Status: done

Test the full production flow:

- Open live app.
- Request magic link.
- Return from email link.
- Create display profile.
- Save predictions.
- Refresh/browser-switch and confirm predictions persist.

Confirmed on 2026-06-08: predictions are visible across laptop and phone for the same user.

### 6. Two-User Privacy Test

Status: done

Use two separate users/browsers:

- User A saves predictions.
- User B should not see User A’s predictions before kickoff.
- Set one test match kickoff to the past.
- User B should then see User A’s prediction for that match only.

Confirmed on 2026-06-08:
- One user cannot see another user's predictions before kickoff.
- Once kickoff has passed, other family picks become visible for that match.
- Points calculate from the actual score entered by the admin.

### 7. Configure Verified Sending Provider

Status: done

Set up a verified sender before moving the family onto production auth emails.

Done via Brevo custom SMTP. Confirmed by live signup flow with 8 family users on 2026-06-08.

Why it matters: Supabase custom SMTP needs a verified sender so magic-link emails are more reliable and less likely to hit provider limits or spam filters.

### 8. Configure Custom SMTP For Auth Emails

Status: done

Supabase's built-in auth email provider has very low rate limits and can return "email rate limit exceeded" during normal family signup/testing.

Setup notes:
- Brevo custom SMTP is configured.
- Re-tested by onboarding 8 users.
- Keep the production Site URL and Redirect URLs set to `https://worldcup-familyfun.vercel.app`.

### 9. Admin Actual Score Test

Status: done

Confirm actual score entry works only for an admin user:

- Non-admin cannot edit actual scores.
- Admin can edit actual scores.
- Leaderboard updates from saved actual scores.

Confirmed by:
- Admin-only UI check in the app.
- Admin-only Supabase RLS policy on `public.matches`.
- Match 1 test score entry, reveal, points calculation, and score clearing.

## Product Backlog

### 10. Source Actual Scores Automatically

Status: implemented, monitor provider timing

Candidate: football-data.org

Useful docs:
- https://www.football-data.org/documentation
- https://www.football-data.org/coverage
- https://www.football-data.org/pricing

Why it looks promising:
- Coverage includes Worldcup on the free tier.
- FIFA World Cup uses competition code `WC`.
- Match endpoints support filters for `season`, `status`, `dateFrom`, `dateTo`, `stage`, and `group`.
- Rate limits should be fine for family use if we sync server-side instead of calling from every browser.

Caveats:
- Free-plan scores are delayed.
- Live scores appear to require the paid "Free w/ Livescores" plan.
- Odds are captured when the provider returns them, but may be null or plan-dependent.
- The API token must stay server-side, not in frontend code.
- Manual admin score editing should remain as a fallback.

Implementation notes:
- Get a football-data.org API token and set `FOOTBALL_DATA_API_TOKEN` in Vercel.
- Set `SUPABASE_SERVICE_ROLE_KEY` in Vercel for the server-side sync route.
- Test `GET https://api.football-data.org/v4/competitions/WC/matches?season=2026` once 2026 fixtures/results are available.
- External mapping fields and odds fields have been added to `matches`.
- A protected `/api/sync-scores` route pulls scores/odds and writes actual scores into Supabase for admin users.
- Vercel Cron is configured to call `/api/sync-scores` before the daily digest and at extra match-finish windows.
- Cron calls require `CRON_SECRET` as a bearer token.
- `CRON_SECRET` has been added in Vercel.
- `last_synced_at` shows when scores were last updated.
- Manual score sync has worked successfully after a finished match.

Remaining:
- Monitor how quickly football-data.org publishes final scores on the current plan.
- Odds are parked for now. football-data requires the Odds Add-On and SportsGameOdds was tested but `INTERNATIONAL_SOCCER` is unavailable on the current free tier. It may be worth revisiting for another competition or if a paid plan is ever useful.
- API-Football was tested as an alternative richer provider. The free plan is active with 100 requests/day, but World Cup 2026 is blocked on the free plan with the message: "Free plans do not have access to this season, try from 2022 to 2024." Park this for now and revisit if the paid tier, around GBP 19, becomes worthwhile.
- API-Football 2022 World Cup test confirmed useful endpoints work when the season is accessible: fixtures, livescore/status, events, lineups, top scorers, player/coach data, injuries/sidelined, statistics, predictions, standings, head-to-head, transfers/trophies, and pre-match/in-play odds.

### 11. Add Knockout Rounds

Status: mostly implemented

Current app covers all 104 tournament matches.

Implementation:
- Added matches 73-104 as bracket placeholders with known dates, kickoff times, venues, and rounds.
- Added a dedicated Knockouts tab for knockout score picks.
- Existing score prediction and lock rules apply to knockout matches.

Remaining:
- Replace bracket placeholders with real teams as the tournament progresses.
- Decide whether knockout scoring should treat extra time/penalties differently.
- Improve knockout-round filtering and layouts once the bracket starts to take shape. Likely areas: round filters, date filters, compact bracket-style grouping, clearer placeholders before teams are known, and easier scanning of pending picks/results on mobile.

### 12. Track Tournament Scorers

Status: parked on free providers

Football-data.org has a competition scorers endpoint, but plan access still needs to be confirmed with an API token.

Implementation:
- Added a separate Scorers tab.
- Added `tournament_scorers` table with RLS.
- Score sync now attempts to fetch `/v4/competitions/WC/scorers?season=2026`.
- Sync does not fail if scorers are unavailable or plan-gated.

Remaining:
- football-data.org does not provide scorers/team event data on the current free access.
- Decide whether to pay for API-Football access. If upgraded, add a `match_events` or `match_goals` table and use `/fixtures/events` for scorer, assist, minute, cards, VAR, and substitutions. Consider `/fixtures/statistics`, `/fixtures/lineups`, and `/players/topscorers` for richer match cards and the scorers tab.
- Decide whether scorer tracking is informational only or part of the family game.

### 13. Monitor Fixture Schedule Changes

Status: proposed

The official group-stage schedule has been loaded. Keep this item as a reminder to monitor for any FIFA venue/time adjustments before the tournament starts.

### 14. Family Invite / Access Model

Status: proposed

Current access is email magic-link sign-in. Anyone with access to the URL can request a link for their email.

Possible enhancements:
- Restrict allowed emails/domains.
- Add invite codes.
- Add a simple family roster managed by admin.

### 15. Custom Domain

Status: proposed

Current production URL:

```text
https://worldcup-familyfun.vercel.app
```

Optional: add a friendlier custom domain or subdomain.

### 16. Better Admin Surface

Status: partially implemented

Current admin result editing is available inline in the match table and in a dedicated Admin tab for admin users.

Implemented:
- Dedicated admin result-entry tab.
- Result filters for needs result, all unscored, scored, and all matches.
- Admin score sync button in the admin surface.
- Clear button for manually entered actual scores.

Remaining:
- Bulk import actual results.
- Audit trail for result changes.

### 17. UX Polish For Locked Matches

Status: mostly implemented

Improve the “private until kickoff” experience:

Implemented:
- Clearer labels for editable, locked, and revealed picks.
- Countdown-style lock/reveal copy on match rows.
- Next-match panel shows lock/reveal status.
- Explains that other players' exact scores stay private until kickoff.
- Countdown copy refreshes without requiring a page reload.
- Revealed family picks include a compact result-lean and points-haul summary.

Remaining:
- Consider a richer post-match chart if the family wants more detail.

### 17a. Family Forecast And Fun Facts

Status: mostly implemented

Implemented:
- Next-match cards show anonymous family forecast data when enough people have picked.
- Forecasts require at least 4 picks.
- Before kickoff, a player must make their own pick before seeing the aggregate family lean.
- Forecasts show the most popular result and top scoreline without naming individual players.
- Next-match cards show stable World Cup fun facts.
- Forecasts include compact result-split bars.
- Fun fact cards include each team's latest recorded result.

Remaining:
- Add richer country, stadium, and team-specific facts.
- Decide whether family forecast should also appear on each match row.
- Consider a post-kickoff breakdown chart once picks are public.

### 18. Mobile Pass

Status: mostly implemented

The app is responsive, but needs a proper phone walkthrough:

- Sign-in flow on mobile.
- Score input ergonomics.
- Leaderboard scanning.
- Long match list navigation.

Implemented:
- Narrow-screen spacing pass.
- Full-width quick filters on small phones.
- Stacked admin result rows on mobile.
- Tighter tab wrapping on tablet/mobile widths.
- Verified production page at 390px viewport without horizontal overflow.

Remaining:
- Verify admin-only flows on an actual phone.

### 19. Tests

Status: proposed

Add coverage for:

- Home-score scoring.
- Away-score scoring.
- Correct-result scoring.
- Draw outcome scoring.
- Amber warning two hours before kickoff.
- Locking rules before/after the one-hour cutoff.
- Supabase row mapping.

Implemented:
- Scoring rules.
- Draw outcomes.
- Completion scoring.
- Amber and lock timing.
- Reveal-at-kickoff timing.
- Next simultaneous matches and missing-picks count.

Remaining:
- Supabase row mapping and API sync route tests.

### 20. Daily Email Digest

Status: done

Implementation:
- Added `players.daily_digest_opt_in`.
- Added a profile checkbox for the 7:30am family digest.
- Added `/api/daily-digest`, protected by `CRON_SECRET`.
- Added Vercel cron for 06:30 UTC during the tournament, which is 7:30am UK time in June/July.
- Digest includes leaderboard, previous day's games, each player's picks and points, today's fixtures, and a light data-driven summary.

Remaining:
- Optional later: add an external facts/news source for richer match facts.

### 21. Dependency Audit

Status: proposed

`npm install` reported two moderate vulnerabilities in the dependency tree.

Do not run `npm audit fix --force` blindly. Review whether the affected packages are transitive and whether Next/React upgrades are safe.

## Done

- Created standalone World Cup Predictor app separate from Family Admin.
- Pushed app to GitHub.
- Deployed app to Vercel production.
- Added Supabase schema and row-level security.
- Seeded 72 group-stage matches into Supabase.
- Added Supabase client and shared-mode UI.
- Added Vercel environment variables for Supabase.
- Disabled Vercel SSO protection for family access.
- Split picks and family leaderboard into separate tabs.
- Added an up-next panel for the next match or simultaneous next matches.
- Fixed laptop-width family leaderboard overflow.
- Added automated tests for game scoring and timing rules.
- Added cron-safe score sync route and Vercel daily cron config.
- Added knockout-round fixtures and a Knockouts tab.
- Added tournament scorer storage, sync attempt, and Scorers tab.
- Split group-game and knockout prediction progress, added collapsible filters, and added missing-score quick filters.
- Added production daily digest email with opt-in setting and confirmed delivery.
- Added extra score sync cron windows for common match-finish times.
