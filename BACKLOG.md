# World Cup Predictor Backlog

Last reviewed: 2026-06-08

## Current State

- App is deployed at https://worldcup-familyfun.vercel.app.
- Source is pushed to https://github.com/ajfsmith-sketcher/worldcup-familyfun.
- Supabase project `world-cup-family-fun` is connected through Vercel environment variables.
- Supabase schema is live with RLS for players, matches, and predictions.
- Predictions are private until `matches.kickoff_at <= now()`.
- Predictions turn amber two hours before kickoff and lock one hour before kickoff.
- Players sign in with Supabase magic links and create a display profile.
- Group-stage match rows are seeded with official match numbers, kickoff times, venues, and cities.

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

Status: not confirmed

Actual score editing is currently admin-only via Supabase user metadata:

```json
{ "role": "admin" }
```

Decision needed: who should be admin, and should admin setup remain manual in Supabase or get an in-app admin flow later?

### 3. Confirm Prediction Visibility Rule

Status: mostly confirmed

Chosen rule: everyone’s predictions are private until kickoff.

Chosen rule: prediction entry turns amber two hours before kickoff and locks one hour before kickoff.

Still to confirm: after kickoff, should all predictions become visible even before full-time, or only after the match finishes?

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

Status: partially done

Use two separate users/browsers:

- User A saves predictions.
- User B should not see User A’s predictions before kickoff.
- Set one test match kickoff to the past.
- User B should then see User A’s prediction for that match only.

Confirmed on 2026-06-08: one user cannot see another user's predictions before kickoff. Still to test: reveal behavior once a match kickoff has passed.

### 7. Buy And Verify Resend Sending Domain

Status: high priority

Set up a custom sending domain before moving the family onto production auth emails.

Recommendation:
- Buy a simple domain through Cloudflare, Porkbun, Namecheap, or another DNS-friendly registrar.
- Add a sending subdomain in Resend, such as `mail.yourdomain.com`.
- Verify the DKIM, SPF, and MX DNS records that Resend generates.
- Use a sender like `World Cup Family Fun <no-reply@mail.yourdomain.com>`.

Why it matters: Supabase custom SMTP needs a verified sender domain so magic-link emails are more reliable and less likely to hit provider limits or spam filters.

### 8. Configure Custom SMTP For Auth Emails

Status: open

Supabase's built-in auth email provider has very low rate limits and can return "email rate limit exceeded" during normal family signup/testing.

Setup notes:
- Use Resend if the sending domain setup above is complete, or choose another SMTP/email provider such as Postmark or SendGrid.
- Configure Supabase `Authentication` -> `SMTP Settings`.
- Confirm auth email rate limits under `Authentication` -> `Rate Limits`.
- Re-test magic-link sign-in from phone and laptop after SMTP is configured.
- Keep the production Site URL and Redirect URLs set to `https://worldcup-familyfun.vercel.app`.

### 9. Admin Actual Score Test

Status: open

Confirm actual score entry works only for an admin user:

- Non-admin cannot edit actual scores.
- Admin can edit actual scores.
- Leaderboard updates from saved actual scores.

## Product Backlog

### 10. Source Actual Scores Automatically

Status: proposed - candidate API identified

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
- The API token must stay server-side, not in frontend code.
- Manual admin score editing should remain as a fallback.

Implementation notes:
- Get a football-data.org API token.
- Test `GET https://api.football-data.org/v4/competitions/WC/matches?season=2026` once 2026 fixtures/results are available.
- Add external mapping fields to `matches`, such as `external_provider`, `external_match_id`, and `last_synced_at`.
- Add a protected `/api/sync-scores` route that pulls scores and writes actual scores into Supabase.
- Add Vercel Cron to run syncs more frequently on matchdays.
- Keep a small audit trail or timestamp so we can see when scores were last updated.

### 11. Add Knockout Rounds

Status: proposed

Current app covers the 72 group-stage games only.

Future work:
- Add bracket/knockout matches.
- Decide whether players predict knockout scorelines before the tournament or round-by-round.
- Handle extra time/penalties scoring rules.

### 12. Track Tournament Scorers

Status: proposed

Football-data.org has a competition scorers endpoint, but plan access still needs to be confirmed with an API token.

Future work:
- Confirm whether World Cup scorers are available on the free plan.
- Add a separate scorers tab.
- Store scorer rows from the provider if we want historical snapshots.
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

Status: proposed

Current admin result editing is inline in the match table.

Possible admin improvements:
- Dedicated result-entry page.
- Only show finished/unscored matches.
- Bulk import actual results.
- Audit trail for result changes.

### 17. UX Polish For Locked Matches

Status: proposed

Improve the “private until kickoff” experience:

- Clearer labels for locked picks.
- “Revealed” view after kickoff.
- Explain why another player’s pick is hidden.
- Show countdown to kickoff.

### 18. Mobile Pass

Status: proposed

The app is responsive, but needs a proper phone walkthrough:

- Sign-in flow on mobile.
- Score input ergonomics.
- Leaderboard scanning.
- Long match list navigation.

### 19. Tests

Status: proposed

Add coverage for:

- Exact-score scoring.
- Correct-winner scoring.
- Draw outcome scoring.
- Locking rules before/after the two-hour cutoff.
- Supabase row mapping.

### 20. Dependency Audit

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
