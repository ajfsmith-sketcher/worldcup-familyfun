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

type LeaderboardRow = {
  exactScores: number;
  gamesPlayed: number;
  goalsCorrect: number;
  goalsIncorrect: number;
  movement: number;
  name: string;
  playerId: string;
  points: number;
  resultCorrect: number;
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

const DIGEST_HOUR_UTC = 6;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const latestDigestEnd = (now = new Date()) => {
  const end = new Date(now);
  end.setUTCHours(DIGEST_HOUR_UTC, 0, 0, 0);
  if (end.getTime() > now.getTime()) {
    end.setUTCDate(end.getUTCDate() - 1);
  }
  return end;
};

const digestWindow = (now = new Date()) => {
  const end = latestDigestEnd(now);
  const start = new Date(end.getTime() - ONE_DAY_MS);
  const nextEnd = new Date(end.getTime() + ONE_DAY_MS);
  return { end, nextEnd, start };
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
  windowMatches
}: {
  leaderboard: LeaderboardRow[];
  windowMatches: MatchRow[];
}) => {
  const leader = leaderboard[0];
  const scoredInWindow = windowMatches.filter((match) => scoreFromMatch(match)).length;
  const finishedWithoutScores = windowMatches.filter((match) => match.score_status === "FINISHED" && !scoreFromMatch(match)).length;
  const leaderCopy = leader ? `${leader.name} is setting the pace on ${leader.points} points` : "The leaderboard is still limbering up";
  const resultCopy =
    scoredInWindow > 0
      ? `${scoredInWindow} result${scoredInWindow === 1 ? "" : "s"} landed since the last digest.`
      : "The latest official scores are still making their way through the feed.";
  const providerCopy =
    finishedWithoutScores > 0
      ? ` ${finishedWithoutScores} finished match${finishedWithoutScores === 1 ? " is" : "es are"} still waiting on a full-time score from the provider.`
      : "";

  return `${leaderCopy}. ${resultCopy}${providerCopy} Plenty of time for a heroic comeback, or at least a very confident group chat message.`;
};

const buildLeaderboard = ({
  matches,
  players,
  predictions,
  previousRanks = new Map<string, number>()
}: {
  matches: MatchRow[];
  players: PlayerRow[];
  predictions: Map<string, Score>;
  previousRanks?: Map<string, number>;
}) => {
  const gamesPlayed = matches.length;
  return players
    .map((player) => {
      const exactScores = matches.filter((match) => matchPoints(predictions.get(`${player.id}:${match.id}`), scoreFromMatch(match)) === 3).length;
      const goalsCorrect = matches.reduce((total, match) => {
        const prediction = predictions.get(`${player.id}:${match.id}`);
        const result = scoreFromMatch(match);
        return total + Number(prediction?.home === result?.home) + Number(prediction?.away === result?.away);
      }, 0);
      const points = matches.reduce((total, match) => total + matchPoints(predictions.get(`${player.id}:${match.id}`), scoreFromMatch(match)), 0);
      const resultCorrect = matches.filter((match) => outcome(predictions.get(`${player.id}:${match.id}`)) === outcome(scoreFromMatch(match))).length;
      return {
        exactScores,
        gamesPlayed,
        goalsCorrect,
        goalsIncorrect: gamesPlayed * 2 - goalsCorrect,
        movement: 0,
        name: player.display_name,
        playerId: player.id,
        points,
        resultCorrect
      };
    })
    .sort((left, right) => right.points - left.points || right.exactScores - left.exactScores || right.goalsCorrect - left.goalsCorrect || left.name.localeCompare(right.name))
    .map((player, index) => ({
      ...player,
      movement: previousRanks.has(player.playerId) ? (previousRanks.get(player.playerId) ?? index + 1) - (index + 1) : 0
    }));
};

const rankMap = (leaderboard: LeaderboardRow[]) => new Map(leaderboard.map((player, index) => [player.playerId, index + 1]));

const movementLabel = (movement: number) => {
  if (movement > 0) return `<span class="move-up">&#9650; ${movement}</span>`;
  if (movement < 0) return `<span class="move-down">&#9660; ${Math.abs(movement)}</span>`;
  return `<span class="move-flat">-</span>`;
};

const buildDigestHtml = ({
  appUrl,
  digestEnd,
  digestStart,
  leaderboard,
  players,
  predictions,
  todayMatches,
  windowMatches
}: {
  appUrl: string;
  digestEnd: Date;
  digestStart: Date;
  leaderboard: LeaderboardRow[];
  players: PlayerRow[];
  predictions: Map<string, Score>;
  todayMatches: MatchRow[];
  windowMatches: MatchRow[];
}) => {
  const summary = buildSummary({ leaderboard, windowMatches });
  const leaderboardRows = leaderboard
    .map(
      (player, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${movementLabel(player.movement)}</td>
          <td>${htmlEscape(player.name)}</td>
          <td>${player.gamesPlayed}</td>
          <td>${player.goalsCorrect}</td>
          <td>${player.goalsIncorrect}</td>
          <td>${player.resultCorrect}</td>
          <td>${player.exactScores}</td>
          <td>${player.points}</td>
        </tr>`
    )
    .join("");

  const resultSections =
    windowMatches.length > 0
      ? windowMatches
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
              <section class="inner-card">
                <h3>Match ${match.match_number ?? ""}: ${htmlEscape(match.home_name)} ${scoreLabel(result)} ${htmlEscape(match.away_name)}</h3>
                ${result ? "" : `<p class="muted">Provider status: ${htmlEscape(match.score_status ?? "pending")}. Full-time score not available yet.</p>`}
                <table>
                  <thead><tr><th>Player</th><th>Pick</th><th>Points</th></tr></thead>
                  <tbody>${pickRows}</tbody>
                </table>
              </section>`;
          })
          .join("")
      : `<p class="muted">No World Cup matches in this digest window.</p>`;

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
          table { border-collapse: collapse; margin: 12px 0; width: 100%; }
          th, td { border-bottom: 1px solid #e4ece8; padding: 8px; text-align: left; }
          th { color: #52635d; font-size: 12px; text-transform: uppercase; }
          .button { background: #0f766e; border-radius: 8px; color: #ffffff; display: inline-block; font-weight: bold; padding: 10px 14px; text-decoration: none; }
          .card { border: 1px solid #dbe5df; border-radius: 12px; margin-top: 18px; padding: 18px; }
          .inner-card { background: #f8fbfa; border: 1px solid #e2ece7; border-radius: 10px; margin-top: 12px; padding: 14px; }
          .key { font-size: 12px; margin-top: 10px; }
          .move-down { color: #b42318; font-weight: bold; }
          .move-flat { color: #65736e; font-weight: bold; }
          .move-up { color: #027a48; font-weight: bold; }
          .muted { color: #65736e; }
        </style>
      </head>
      <body>
        <main>
          <p class="muted">Family World Cup Pool</p>
          <h1>7am digest - ${htmlEscape(displayDate(digestEnd))}</h1>
          <p>${htmlEscape(summary)}</p>
          <p><a class="button" href="${htmlEscape(appUrl)}">Open the predictor</a></p>

          <section class="card">
            <h2>Leaderboard</h2>
            <table>
              <thead><tr><th>#</th><th>Move</th><th>Player</th><th>GP</th><th>GC</th><th>GI</th><th>RC</th><th>EX</th><th>Pts</th></tr></thead>
              <tbody>${leaderboardRows}</tbody>
            </table>
            <p class="muted key">Key: GP = games played, GC = goals correct, GI = goals incorrect, RC = results correct, EX = exact scores, Pts = total points.</p>
          </section>

          <section class="card">
            <h2>Results since last digest</h2>
            <p class="muted">${htmlEscape(displayDate(digestStart))} ${displayTime(digestStart)} to ${htmlEscape(displayDate(digestEnd))} ${displayTime(digestEnd)}</p>
            ${resultSections}
          </section>

          <section class="card">
            <h2>Fixtures before the next digest</h2>
            <ul>${todayRows}</ul>
          </section>
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

const buildAndSendDigest = async (
  { baseUrl, brevoApiKey, senderEmail, senderName, supabase }: DigestContext,
  options: { testRecipientId?: string } = {}
) => {
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
  const { end: digestEnd, nextEnd: nextDigestEnd, start: digestStart } = digestWindow(today);
  const windowMatches = matches.filter((match) => {
    const kickoffTime = new Date(match.kickoff_at).getTime();
    return kickoffTime >= digestStart.getTime() && kickoffTime < digestEnd.getTime();
  });
  const todayMatches = matches.filter((match) => {
    const kickoffTime = new Date(match.kickoff_at).getTime();
    return kickoffTime >= digestEnd.getTime() && kickoffTime < nextDigestEnd.getTime();
  });
  const scoredMatches = matches.filter(scoreFromMatch);
  const previousScoredMatches = scoredMatches.filter((match) => new Date(match.kickoff_at).getTime() < digestStart.getTime());
  const previousLeaderboard = buildLeaderboard({ matches: previousScoredMatches, players, predictions });
  const leaderboard = buildLeaderboard({ matches: scoredMatches, players, predictions, previousRanks: rankMap(previousLeaderboard) });

  const htmlContent = buildDigestHtml({
    appUrl: `${baseUrl}/world-cup-2026`,
    digestEnd,
    digestStart,
    leaderboard,
    players,
    predictions,
    todayMatches,
    windowMatches
  });
  const subject = `World Cup family digest - ${displayDate(today)}`;
  const recipients = players
    .filter((player) => (options.testRecipientId ? player.id === options.testRecipientId : player.daily_digest_opt_in))
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

  return {
    mode: options.testRecipientId ? "test" : "scheduled",
    recipients: recipients.length,
    todayMatches: todayMatches.length,
    yesterdayMatches: windowMatches.length
  };
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

export async function POST(request: NextRequest) {
  const setup = createContext();
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

  try {
    const result = await buildAndSendDigest(setup.context, { testRecipientId: userData.user.id });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not send test daily digest." }, { status: 500 });
  }
}
