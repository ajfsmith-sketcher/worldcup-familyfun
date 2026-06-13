import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { matchDateKeyInTimeZone } from "@/lib/gameRules";

export const dynamic = "force-dynamic";

type MatchRow = {
  away_flag: string;
  away_name: string;
  id: string;
  home_flag: string;
  home_name: string;
  kickoff_at: string;
};

type PlayerRow = {
  display_name: string;
  id: string;
};

type PredictionRow = {
  match_id: string;
  player_id: string;
};

const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
};

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Missing Supabase admin configuration." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!accessToken) {
    return NextResponse.json({ error: "Missing Supabase access token." }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || userData.user?.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const [matchesResponse, playersResponse, predictionsResponse] = await Promise.all([
    supabase.from("matches").select("id, home_name, home_flag, away_name, away_flag, kickoff_at").order("kickoff_at"),
    supabase.from("players").select("id, display_name").order("display_name"),
    supabase.from("predictions").select("player_id, match_id")
  ]);

  if (matchesResponse.error || playersResponse.error || predictionsResponse.error) {
    return NextResponse.json(
      {
        error:
          matchesResponse.error?.message ||
          playersResponse.error?.message ||
          predictionsResponse.error?.message ||
          "Could not load missing picks."
      },
      { status: 500 }
    );
  }

  const todayUsKey = matchDateKeyInTimeZone(new Date().toISOString());
  const matches = ((matchesResponse.data ?? []) as MatchRow[]).filter(
    (match) => match.kickoff_at && matchDateKeyInTimeZone(match.kickoff_at) === todayUsKey
  );
  const players = (playersResponse.data ?? []) as PlayerRow[];
  const predictionKeys = new Set(
    ((predictionsResponse.data ?? []) as PredictionRow[]).map((prediction) => `${prediction.player_id}:${prediction.match_id}`)
  );

  const rows = matches.map((match) => ({
    awayFlag: match.away_flag,
    awayName: match.away_name,
    homeFlag: match.home_flag,
    homeName: match.home_name,
    id: match.id,
    kickoffAt: match.kickoff_at,
    missingPlayers: players
      .filter((player) => !predictionKeys.has(`${player.id}:${match.id}`))
      .map((player) => player.display_name)
  }));

  return NextResponse.json({
    missingCount: rows.reduce((total, row) => total + row.missingPlayers.length, 0),
    rows
  });
}
