import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const WORLD_CUP_26_GAMES_URL = "https://worldcup26.ir/get/games";
const ROUND_OF_32_START = 73;
const ROUND_OF_32_END = 88;

type SupabaseMatchRow = {
  away_name: string;
  home_name: string;
  match_number: number;
};

type WorldCup26Game = {
  away_team_name_en?: string;
  home_team_name_en?: string;
  id?: number | string;
  type?: string;
};

const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
};

const normaliseTeamName = (name: string) => {
  const cleanName = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const aliases: Record<string, string> = {
    "cote d ivoire": "ivory coast",
    "democratic republic of the congo": "dr congo",
    "korea republic": "south korea",
    "united states of america": "united states"
  };

  return aliases[cleanName] ?? cleanName;
};

const sameTeam = (left: string, right: string) => normaliseTeamName(left) === normaliseTeamName(right);

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

  const matchesResponse = await supabase
    .from("matches")
    .select("match_number, home_name, away_name")
    .gte("match_number", ROUND_OF_32_START)
    .lte("match_number", ROUND_OF_32_END)
    .order("match_number");

  if (matchesResponse.error) {
    return NextResponse.json({ error: matchesResponse.error.message }, { status: 500 });
  }

  const sourceResponse = await fetch(WORLD_CUP_26_GAMES_URL, {
    cache: "no-store"
  });

  if (!sourceResponse.ok) {
    return NextResponse.json({ error: `worldcup26.ir returned ${sourceResponse.status}` }, { status: 502 });
  }

  const sourcePayload = (await sourceResponse.json()) as { games?: WorldCup26Game[] };
  const sourceGamesByMatchNumber = new Map(
    (sourcePayload.games ?? [])
      .filter((game) => game.type === "r32")
      .map((game) => [Number(game.id), game])
  );

  const rows = ((matchesResponse.data ?? []) as SupabaseMatchRow[]).map((match) => {
    const sourceGame = sourceGamesByMatchNumber.get(match.match_number);
    const sourceHomeName = sourceGame?.home_team_name_en ?? "";
    const sourceAwayName = sourceGame?.away_team_name_en ?? "";
    const homeMatches = Boolean(sourceHomeName && sameTeam(match.home_name, sourceHomeName));
    const awayMatches = Boolean(sourceAwayName && sameTeam(match.away_name, sourceAwayName));

    return {
      awayMatches,
      matchNumber: match.match_number,
      sourceAwayName,
      sourceHomeName,
      status: sourceGame && homeMatches && awayMatches ? "ok" : "mismatch",
      supabaseAwayName: match.away_name,
      supabaseHomeName: match.home_name,
      homeMatches
    };
  });

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    mismatchCount: rows.filter((row) => row.status !== "ok").length,
    rows,
    source: WORLD_CUP_26_GAMES_URL
  });
}
