import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

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

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const footballDataToken = process.env.FOOTBALL_DATA_API_TOKEN;

  if (!supabaseUrl || !serviceRoleKey || !footballDataToken) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or FOOTBALL_DATA_API_TOKEN." },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!accessToken) {
    return NextResponse.json({ error: "Missing Supabase access token." }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || userData.user?.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const [localResponse, apiResponse] = await Promise.all([
    supabase.from("matches").select("id, kickoff_at, home_code, home_name, away_code, away_name, external_match_id"),
    fetch("https://api.football-data.org/v4/competitions/WC/matches?season=2026", {
      headers: { "X-Auth-Token": footballDataToken },
      next: { revalidate: 0 }
    })
  ]);

  if (localResponse.error) {
    return NextResponse.json({ error: localResponse.error.message }, { status: 500 });
  }

  if (!apiResponse.ok) {
    const body = await apiResponse.text();
    return NextResponse.json({ error: `football-data.org returned ${apiResponse.status}`, body }, { status: 502 });
  }

  const apiPayload = (await apiResponse.json()) as { matches?: FootballDataMatch[] };
  const localMatches = (localResponse.data ?? []) as LocalMatch[];
  const updates = [];
  const unmatched = [];

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

  return NextResponse.json({
    failed,
    matched: updates.length,
    unmatched,
    updated: updates.length - failed.length
  });
}
