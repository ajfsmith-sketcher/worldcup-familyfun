import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

type SupabaseSyncClient = ReturnType<typeof createClient<any>>;

type LocalMatch = {
  away_code: string;
  away_name: string;
  external_match_id: string | null;
  home_code: string;
  home_name: string;
  id: string;
  kickoff_at: string;
};

type FootballDataMatch = {
  id: number;
  utcDate: string;
  status: string;
  homeTeam?: {
    name?: string;
    tla?: string;
  };
  awayTeam?: {
    name?: string;
    tla?: string;
  };
  score?: {
    fullTime?: {
      home?: number | null;
      away?: number | null;
    };
  };
  odds?: {
    homeWin?: number | null;
    draw?: number | null;
    awayWin?: number | null;
  };
};

type FootballDataScorer = {
  assists?: number | null;
  goals?: number | null;
  penalties?: number | null;
  playedMatches?: number | null;
  player?: {
    id?: number | null;
    name?: string;
  };
  team?: {
    id?: number | null;
    name?: string;
    tla?: string;
  };
};

type RateLimitInfo = {
  limit?: string;
  remaining?: string;
  reset?: string;
  warning?: string;
};

const headerValue = (headers: Headers, names: string[]) => {
  for (const name of names) {
    const value = headers.get(name);
    if (value) return value;
  }
  return undefined;
};

const footballDataRateLimitInfo = (headers: Headers): RateLimitInfo => {
  const remaining = headerValue(headers, [
    "x-requests-available-minute",
    "x-requests-available",
    "x-ratelimit-remaining",
    "x-rate-limit-remaining"
  ]);
  const limit = headerValue(headers, ["x-ratelimit-limit", "x-rate-limit-limit"]);
  const reset = headerValue(headers, [
    "x-requestcounter-reset",
    "x-ratelimit-reset",
    "x-rate-limit-reset",
    "retry-after"
  ]);
  const remainingCount = remaining ? Number(remaining) : Number.NaN;

  return {
    limit,
    remaining,
    reset,
    warning: Number.isFinite(remainingCount) && remainingCount <= 2 ? "football-data.org request allowance is low." : undefined
  };
};

type SyncContext = {
  footballDataToken: string;
  supabase: SupabaseSyncClient;
};

const normalize = (value: string | undefined) =>
  (value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    .trim();

const teamMatches = (localCode: string, localName: string, apiTeam?: { name?: string; tla?: string }) => {
  const apiCode = normalize(apiTeam?.tla);
  const apiName = normalize(apiTeam?.name);
  return apiCode === normalize(localCode) || apiName === normalize(localName) || apiName.includes(normalize(localName));
};

const findLocalMatch = (apiMatch: FootballDataMatch, localMatches: LocalMatch[]) => {
  const externalMatch = localMatches.find((match) => match.external_match_id === String(apiMatch.id));
  if (externalMatch) return externalMatch;

  return localMatches.find((match) => {
    const sameKickoff = new Date(match.kickoff_at).getTime() === new Date(apiMatch.utcDate).getTime();
    return (
      sameKickoff &&
      teamMatches(match.home_code, match.home_name, apiMatch.homeTeam) &&
      teamMatches(match.away_code, match.away_name, apiMatch.awayTeam)
    );
  });
};

const syncScores = async ({ footballDataToken, supabase }: SyncContext) => {
  const [localResponse, apiResponse, scorersResponse] = await Promise.all([
    supabase.from("matches").select("id, kickoff_at, home_code, home_name, away_code, away_name, external_match_id"),
    fetch("https://api.football-data.org/v4/competitions/WC/matches?season=2026", {
      headers: { "X-Auth-Token": footballDataToken },
      next: { revalidate: 0 }
    }),
    fetch("https://api.football-data.org/v4/competitions/WC/scorers?season=2026", {
      headers: { "X-Auth-Token": footballDataToken },
      next: { revalidate: 0 }
    })
  ]);

  if (localResponse.error) {
    return NextResponse.json({ error: localResponse.error.message }, { status: 500 });
  }

  const rateLimit = footballDataRateLimitInfo(apiResponse.headers);

  if (!apiResponse.ok) {
    const body = await apiResponse.text();
    return NextResponse.json({ error: `football-data.org returned ${apiResponse.status}`, body, rateLimit }, { status: 502 });
  }

  const apiPayload = (await apiResponse.json()) as { matches?: FootballDataMatch[] };
  const scorerRateLimit = footballDataRateLimitInfo(scorersResponse.headers);
  const localMatches = (localResponse.data ?? []) as LocalMatch[];
  const updates = [];
  const unmatched = [];
  let scorerError: string | undefined;
  let scorersUpdated = 0;

  for (const apiMatch of apiPayload.matches ?? []) {
    const localMatch = findLocalMatch(apiMatch, localMatches);
    if (!localMatch) {
      unmatched.push({
        away: apiMatch.awayTeam?.name,
        home: apiMatch.homeTeam?.name,
        id: apiMatch.id,
        utcDate: apiMatch.utcDate
      });
      continue;
    }

    const fullTime = apiMatch.score?.fullTime;
    const hasScore = typeof fullTime?.home === "number" && typeof fullTime?.away === "number";

    const update: Record<string, number | string | null> = {
      external_match_id: String(apiMatch.id),
      external_provider: "football-data.org",
      last_synced_at: new Date().toISOString(),
      odds_away_win: apiMatch.odds?.awayWin ?? null,
      odds_draw: apiMatch.odds?.draw ?? null,
      odds_home_win: apiMatch.odds?.homeWin ?? null,
      score_status: apiMatch.status
    };

    if (hasScore) {
      update.home_score = fullTime.home ?? null;
      update.away_score = fullTime.away ?? null;
    }

    updates.push(supabase.from("matches").update(update).eq("id", localMatch.id));
  }

  const results = await Promise.all(updates);
  const failed = results.filter((result) => result.error).map((result) => result.error?.message);

  if (scorersResponse.ok) {
    const scorerPayload = (await scorersResponse.json()) as { scorers?: FootballDataScorer[] };
    const scorerRows = (scorerPayload.scorers ?? [])
      .filter((scorer) => scorer.player?.name)
      .map((scorer) => ({
        assists: scorer.assists ?? null,
        external_player_id: scorer.player?.id ? String(scorer.player.id) : null,
        external_team_id: scorer.team?.id ? String(scorer.team.id) : null,
        goals: scorer.goals ?? 0,
        last_synced_at: new Date().toISOString(),
        penalties: scorer.penalties ?? null,
        played_matches: scorer.playedMatches ?? null,
        player_name: scorer.player?.name ?? "Unknown player",
        team_code: scorer.team?.tla ?? null,
        team_name: scorer.team?.name ?? null
      }));

    if (scorerRows.length > 0) {
      const scorerResult = await supabase.from("tournament_scorers").upsert(scorerRows, { onConflict: "player_name,team_name" });
      if (scorerResult.error) {
        scorerError = scorerResult.error.message;
      } else {
        scorersUpdated = scorerRows.length;
      }
    }
  } else {
    scorerError = `football-data.org scorers returned ${scorersResponse.status}`;
  }

  return NextResponse.json({
    failed,
    matched: updates.length,
    rateLimit,
    scorerError,
    scorerRateLimit,
    scorersUpdated,
    unmatched,
    updated: updates.length - failed.length
  });
};

const createSyncContext = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const footballDataToken = process.env.FOOTBALL_DATA_API_TOKEN;

  if (!supabaseUrl || !serviceRoleKey || !footballDataToken) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or FOOTBALL_DATA_API_TOKEN." },
      { status: 500 }
    );
  }

  return {
    context: {
      footballDataToken,
      supabase: createClient<any>(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })
    }
  };
};

const cronAuthorizationError = (request: NextRequest) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Missing CRON_SECRET." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Cron access required." }, { status: 401 });
  }

  return null;
};

export async function GET(request: NextRequest) {
  const authError = cronAuthorizationError(request);
  if (authError) return authError;

  const setup = createSyncContext();
  if ("status" in setup) return setup;

  return syncScores(setup.context);
}

export async function POST(request: NextRequest) {
  const setup = createSyncContext();
  if ("status" in setup) return setup;

  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!accessToken) {
    return NextResponse.json({ error: "Missing Supabase access token." }, { status: 401 });
  }

  const { supabase } = setup.context;
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || userData.user?.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  return syncScores(setup.context);
}
