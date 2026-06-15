import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { PREDICTION_LOCK_MS } from "@/lib/gameRules";

export const dynamic = "force-dynamic";

type MatchRow = {
  kickoff_at: string;
};

const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
};

export async function POST(request: NextRequest) {
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
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Sign in again before clearing a prediction." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { matchId?: string };
  if (!body.matchId) {
    return NextResponse.json({ error: "Missing match id." }, { status: 400 });
  }

  const { data: match, error: matchError } = await supabase.from("matches").select("kickoff_at").eq("id", body.matchId).single();
  if (matchError || !match) {
    return NextResponse.json({ error: matchError?.message ?? "Match not found." }, { status: 404 });
  }

  const kickoffTime = new Date((match as MatchRow).kickoff_at).getTime();
  if (kickoffTime - PREDICTION_LOCK_MS <= Date.now()) {
    return NextResponse.json({ error: "Predictions lock one hour before kickoff." }, { status: 409 });
  }

  const { error: deleteError } = await supabase
    .from("predictions")
    .delete()
    .eq("player_id", userData.user.id)
    .eq("match_id", body.matchId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ cleared: true });
}
