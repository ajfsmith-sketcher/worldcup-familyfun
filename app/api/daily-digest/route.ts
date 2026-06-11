import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type SupabaseAdminClient = ReturnType<typeof createClient<any>>;

type PlayerRow = {
  daily_digest_opt_in: boolean;
  display_name: string;
  id: string;
};

type MatchRow = {
  away_code: string;
  away_name: string;
  away_score: number | null;
  home_code: string;
  home_name: string;
  home_score: number | null;
  id: string;
  kickoff_at: string;
  match_number: number | null;
  score_status: string | null;
};

type PredictionRow = {
  away_score: number;
  home_score: number;
  match_id: string;
  player_id: string;
};

type Score = {
  away: number;
  home: number;
};

type DigestContext = {
  baseUrl: string;
  brevoApiKey: string;
  senderEmail: string;
  senderName: string;
  supabase: SupabaseAdminClient;
};

const htmlEscape = (value: string | number | null | undefined) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const localDateKey = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/London",
    year: "numeric"
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};

const displayDate = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeZone: "Europe/London"
  }).format(date);

const displayTime = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London"
  }).format(date);

const hasScore = (score: Score | undefined) => typeof score?.home === "number" && typeof score?.away === "number";

const outcome = (score: Score | undefined) => {
  if (!hasScore(score)) return "pending";
  if ((score?.home ?? 0) > (score?.away ?? 0)) return "home";
  if ((score?.away ?? 0) > (score?.home ?? 0)) return "away";
  return "draw";
};

const matchPoints = (prediction: Score | undefined, result: Score | undefined) => {
  if (!hasScore(prediction) || !hasScore(result)) return 0;
  return (
    Number(prediction?.home === result?.home) +
    Number(prediction?.away === result?.away) +
    Number(outcome(prediction) === outcome(result))
  );
};

const scoreFromMatch = (match: MatchRow): Score | undefined =>
  typeof match.home_score === "number" && typeof match.away_score === "number"
    ? { away: match.away_score, home: match.home_score }
    : undefined;

const scoreLabel = (score: Score | undefined) => (score ? `${score.home}-${score.away}` : "-");

const buildSummary = ({
  leaderboard,
  yesterdayMatches
}: {
  leaderboard: Array<{ name: string; points: number }>;
  yesterdayMatches: MatchRow[];
}) => {
  const leader = leaderboard[0];
  const scoredYesterday = yesterdayMatches.filter((match) => scoreFromMatch(match)).length;
  const finishedWithoutScores = yesterdayMatches.filter((match) => match.score_status === "FINISHED" && !scoreFromMatch(match)).length;
  const leaderCopy = leader ? `${leader.name} is setting the pace on ${leader.points} points` : "The leaderboard is still limbering up";
  const resultCopy =
    scoredYesterday > 0
      ? `${scoredYesterday} result${scoredYesterday === 1 ? "" : "s"} landed yesterday.`
      : "Yesterday's official scores are still making their way through the feed.";
  const providerCopy =
    finishedWithoutScores > 0
      ? ` ${finishedWithoutScores} finished match${finishedWithoutScores === 1 ? " is" : "es are"} still waiting on a full-time score from the provider.`
      : "";

  return `${leaderCopy}. ${resultCopy}${providerCopy} Plenty of time for a heroic comeback, or at least a very confident group chat message.`;
};

const buildDigestHtml = ({
  appUrl,
  leaderboard,
  players,
  predictions,
  todayMatches,
  yesterdayDate,
  yesterdayMatches
}: {
  appUrl: string;
  leaderboard: Array<{ exactScores: number; name: string; points: number }>;
  players: PlayerRow[];
  predictions: Map<string, Score>;
  todayMatches: MatchRow[];
  yesterdayDate: Date;
  yesterdayMatches: MatchRow[];
}) => {
  const summary = buildSummary({ leaderboard, yesterdayMatches });
  const leaderboardRows = leaderboard
    .map(
      (player, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${htmlEscape(player.name)}</td>
          <td>${player.points}</td>
          <td>${player.exactScores}</td>
        </tr>`
    )
    .join("");

  const resultSections =
    yesterdayMatches.length > 0
      ? yesterdayMatches
          .map((match) => {
            const result = scoreFromMatch(match);
            const pickRows = players
              .map((player) => {
                const prediction = predictions.get(`${player.id}:${match.id}`);
                return `
                  <tr>
                    <td>${htmlEscape(player.display_name)}</td>
                    <td>${scoreLabel(prediction)}</td>
                    <td>${matchPoints(prediction, result)}</td>
                  </tr>`;
              })
              .join("");

            return `
              <section>
                <h3>Match ${match.match_number ?? ""}: ${htmlEscape(match.home_name)} ${scoreLabel(result)} ${htmlEscape(match.away_name)}</h3>
                ${result ? "" : `<p class="muted">Provider status: ${htmlEscape(match.score_status ?? "pending")}. Full-time score not available yet.</p>`}
                <table>
                  <thead><tr><th>Player</th><th>Pick</th><th>Points</th></tr></thead>
                  <tbody>${pickRows}</tbody>
                </table>
              </section>`;
          })
          .join("")
      : `<p class="muted">No World Cup matches yesterday.</p>`;

  const todayRows =
    todayMatches.length > 0
      ? todayMatches
          .map(
            (match) => `
              <li>${displayTime(new Date(match.kickoff_at))} - ${htmlEscape(match.home_name)} v ${htmlEscape(match.away_name)}</li>`
          )
          .join("")
      : "<li>No matches today.</li>";

  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { background: #f3f7f5; color: #17211f; font-family: Arial, sans-serif; margin: 0; padding: 24px; }
          main { background: #ffffff; border: 1px solid #dbe5df; border-radius: 10px; margin: 0 auto; max-width: 760px; padding: 24px; }
          h1, h2, h3 { margin-bottom: 8px; }
          p { line-height: 1.5; }
          table { border-collapse: collapse; margin: 12px 0 24px; width: 100%; }
          th, td { border-bottom: 1px solid #e4ece8; padding: 8px; text-align: left; }
          th { color: #52635d; font-size: 12px; text-transform: uppercase; }
          .button { background: #0f766e; border-radius: 8px; color: #ffffff; display: inline-block; font-weight: bold; padding: 10px 14px; text-decoration: none; }
          .muted { color: #65736e; }
        </style>
      </head>
      <body>
        <main>
          <p class="muted">Family World Cup Pool</p>
          <h1>7am digest - ${htmlEscape(displayDate(yesterdayDate))}</h1>
          <p>${htmlEscape(summary)}</p>
          <p><a class="button" href="${htmlEscape(appUrl)}">Open the predictor</a></p>

          <h2>Leaderboard</h2>
          <table>
            <thead><tr><th>#</th><th>Player</th><th>Points</th><th>Exact scores</th></tr></thead>
            <tbody>${leaderboardRows}</tbody>
          </table>

          <h2>Yesterday's games</h2>
          ${resultSections}

          <h2>Today's fixtures</h2>
          <ul>${todayRows}</ul>
        </main>
      </body>
    </html>`;
};

const sendDigestEmail = async ({
  brevoApiKey,
  htmlContent,
  recipientEmail,
  recipientName,
  senderEmail,
  senderName,
  subject
}: {
  brevoApiKey: string;
  htmlContent: string;
  recipientEmail: string;
  recipientName: string;
  senderEmail: string;
  senderName: string;
  subject: string;
}) => {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    body: JSON.stringify({
      htmlContent,
      sender: { email: senderEmail, name: senderName },
      subject,
      to: [{ email: recipientEmail, name: recipientName }]
    }),
    headers: {
      "api-key": brevoApiKey,
      "content-type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Brevo returned ${response.status}${body ? `: ${body.slice(0, 400)}` : ""}`);
  }
};

const createContext = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const brevoApiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.DIGEST_SENDER_EMAIL;
  const senderName = process.env.DIGEST_SENDER_NAME ?? "Family World Cup";
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://worldcup-familyfun.vercel.app";

  if (!supabaseUrl || !serviceRoleKey || !brevoApiKey || !senderEmail) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BREVO_API_KEY, or DIGEST_SENDER_EMAIL." },
      { status: 500 }
    );
  }

  return {
    context: {
      baseUrl,
      brevoApiKey,
      senderEmail,
      senderName,
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

const buildAndSendDigest = async ({ baseUrl, brevoApiKey, senderEmail, senderName, supabase }: DigestContext) => {
  const [playersResponse, matchesResponse, predictionsResponse, usersResponse] = await Promise.all([
    supabase.from("players").select("id, display_name, daily_digest_opt_in").order("display_name"),
    supabase.from("matches").select("id, match_number, home_name, home_code, away_name, away_code, kickoff_at, home_score, away_score, score_status").order("kickoff_at"),
    supabase.from("predictions").select("player_id, match_id, home_score, away_score"),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  ]);

  if (playersResponse.error || matchesResponse.error || predictionsResponse.error || usersResponse.error) {
    throw new Error(playersResponse.error?.message || matchesResponse.error?.message || predictionsResponse.error?.message || usersResponse.error?.message);
  }

  const players = (playersResponse.data ?? []) as PlayerRow[];
  const matches = (matchesResponse.data ?? []) as MatchRow[];
  const predictions = new Map(
    ((predictionsResponse.data ?? []) as PredictionRow[]).map((prediction) => [
      `${prediction.player_id}:${prediction.match_id}`,
      { away: prediction.away_score, home: prediction.home_score }
    ])
  );
  const usersById = new Map((usersResponse.data.users ?? []).map((user) => [user.id, user]));
  const today = new Date();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const todayKey = localDateKey(today);
  const yesterdayKey = localDateKey(yesterday);
  const yesterdayMatches = matches.filter((match) => localDateKey(new Date(match.kickoff_at)) === yesterdayKey);
  const todayMatches = matches.filter((match) => localDateKey(new Date(match.kickoff_at)) === todayKey);
  const scoredMatches = matches.filter(scoreFromMatch);
  const leaderboard = players
    .map((player) => {
      const points = scoredMatches.reduce(
        (total, match) => total + matchPoints(predictions.get(`${player.id}:${match.id}`), scoreFromMatch(match)),
        0
      );
      const exactScores = scoredMatches.filter((match) => matchPoints(predictions.get(`${player.id}:${match.id}`), scoreFromMatch(match)) === 3).length;
      return { exactScores, name: player.display_name, points };
    })
    .sort((left, right) => right.points - left.points || right.exactScores - left.exactScores || left.name.localeCompare(right.name));

  const htmlContent = buildDigestHtml({
    appUrl: `${baseUrl}/world-cup-2026`,
    leaderboard,
    players,
    predictions,
    todayMatches,
    yesterdayDate: yesterday,
    yesterdayMatches
  });
  const subject = `World Cup family digest - ${displayDate(today)}`;
  const recipients = players
    .filter((player) => player.daily_digest_opt_in)
    .map((player) => ({ email: usersById.get(player.id)?.email, name: player.display_name }))
    .filter((recipient): recipient is { email: string; name: string } => Boolean(recipient.email));

  await Promise.all(
    recipients.map((recipient) =>
      sendDigestEmail({
        brevoApiKey,
        htmlContent,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        senderEmail,
        senderName,
        subject
      })
    )
  );

  return { recipients: recipients.length, todayMatches: todayMatches.length, yesterdayMatches: yesterdayMatches.length };
};

export async function GET(request: NextRequest) {
  const authError = cronAuthorizationError(request);
  if (authError) return authError;

  const setup = createContext();
  if ("status" in setup) return setup;

  try {
    const result = await buildAndSendDigest(setup.context);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not send daily digest." }, { status: 500 });
  }
}
