"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  arePredictionsRevealed,
  completedCount,
  completion,
  formatFractionalOdds,
  hasScore,
  isPredictionLocked,
  isPredictionLockWarning,
  matchPoints,
  nextKickoffMatches,
  nextPendingCount,
  outcome,
  PREDICTION_LOCK_MS,
  scoreKey,
  scorePlayer,
  sortMatchesByKickoff,
  type ScorePick
} from "@/lib/gameRules";
import {
  knockoutRounds,
  worldCupGroups,
  worldCupMatches,
  type GroupId,
  type TournamentRound,
  type WorldCupMatch
} from "@/lib/worldCup2026";

type ViewMode = "group" | "date";
type WorkspaceTab = "groups" | "knockouts" | "scorers" | "family" | "admin";
type DateFilter = "all" | "today" | string;
type GroupFilter = "all" | GroupId;
type TeamFilter = "all" | string;
type SaveStatus = "idle" | "saving" | "saved" | "error";
type AdminResultFilter = "needs-result" | "unscored" | "scored" | "all";

type Player = {
  groupPredictionCount?: number;
  id: string;
  knockoutPredictionCount?: number;
  matchPredictions: Record<string, ScorePick>;
  name: string;
  nextPendingCount?: number;
  predictionCount?: number;
};

type MatchWithState = WorldCupMatch & {
  awayScore?: number | null;
  homeScore?: number | null;
  lastSyncedAt?: string | null;
  odds?: {
    awayWin?: number | null;
    draw?: number | null;
    homeWin?: number | null;
  };
  scoreStatus?: string | null;
};

type MatchRow = {
  away_code: string;
  away_flag: string;
  away_name: string;
  away_score: number | null;
  city: string | null;
  group_id: GroupId | "KO";
  home_code: string;
  home_flag: string;
  home_name: string;
  home_score: number | null;
  id: string;
  kickoff_at: string;
  label: string;
  match_number: number | null;
  last_synced_at: string | null;
  odds_away_win: number | null;
  odds_draw: number | null;
  odds_home_win: number | null;
  round: TournamentRound | null;
  score_status: string | null;
  venue: string | null;
};

type PlayerRow = {
  daily_digest_opt_in?: boolean;
  display_name: string;
  id: string;
};

type PredictionRow = {
  away_score: number;
  home_score: number;
  match_id: string;
  player_id: string;
};

type PredictionStatusRow = {
  group_prediction_count?: number;
  knockout_prediction_count?: number;
  next_pending_count: number;
  player_id: string;
  prediction_count: number;
};

type ForecastRow = {
  away_result_picks: number;
  draw_result_picks: number;
  home_result_picks: number;
  match_id: string;
  top_score_away: number | null;
  top_score_home: number | null;
  top_score_picks: number | null;
  total_picks: number;
};

type FamilyForecast = {
  awayResultPicks: number;
  drawResultPicks: number;
  homeResultPicks: number;
  topScoreAway: number | null;
  topScoreHome: number | null;
  topScorePicks: number | null;
  totalPicks: number;
};

type ScorerRow = {
  assists: number | null;
  goals: number;
  last_synced_at: string | null;
  penalties: number | null;
  played_matches: number | null;
  player_name: string;
  team_code: string | null;
  team_name: string | null;
};

type SyncRunRow = {
  created_at: string;
  error: string | null;
  matched_count: number;
  object_count: number;
  provider: string;
  request_count: number;
  updated_count: number;
};

type PredictionSaveState = {
  scoreKey?: string;
  status: SaveStatus;
};

type SavedState = {
  activeDateFilter: DateFilter;
  activeGroupFilter: GroupFilter;
  activePlayerId: string;
  activeTeamFilter: TeamFilter;
  activeView: ViewMode;
  hideCompleted: boolean;
  filtersCollapsed: boolean;
  players: Player[];
  results: Record<string, ScorePick>;
  showMissingOnly: boolean;
  showUpcomingOnly: boolean;
};

const STORAGE_KEY = "world-cup-2026-family-predictor";
const NEXT_UPCOMING_MATCH_COUNT = 8;
const FAMILY_FORECAST_MINIMUM_PICKS = 4;
const CODEX_PLAYER_ID = "codex-var-dex";
const CODEX_PLAYER_NAME = "VAR-dex";

const emptyScore = (): ScorePick => ({ away: "", home: "" });

const emptyMatchScores = (matches: MatchWithState[] = worldCupMatches) =>
  matches.reduce(
    (scores, match) => ({
      ...scores,
      [match.id]: emptyScore()
    }),
    {} as Record<string, ScorePick>
  );

const createPlayer = (name: string): Player => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  matchPredictions: emptyMatchScores(),
  name,
  nextPendingCount: 0
});

const codexTeamRatings: Record<string, number> = {
  ARG: 94,
  BRA: 93,
  ENG: 91,
  ESP: 91,
  FRA: 94,
  GER: 90,
  NED: 89,
  POR: 90,
  BEL: 88,
  CRO: 86,
  URU: 86,
  COL: 85,
  MAR: 84,
  USA: 82,
  SUI: 82,
  JPN: 82,
  SEN: 82,
  MEX: 81,
  KOR: 80,
  SWE: 80,
  ECU: 79,
  AUT: 79,
  TUR: 79,
  CIV: 78,
  GHA: 77,
  PAR: 77,
  NOR: 77,
  CAN: 76,
  ALG: 76,
  AUS: 75,
  EGY: 75,
  IRN: 75,
  RSA: 73,
  TUN: 73,
  KSA: 72,
  SCO: 72,
  PAN: 71,
  UZB: 70,
  BIH: 70,
  CPV: 69,
  CZE: 69,
  JOR: 68,
  IRQ: 68,
  QAT: 67,
  NZL: 67,
  COD: 67,
  CUW: 66,
  HAI: 65
};

const fallbackCodexRating = (teamCode: string, matchNumber: number) =>
  68 + ((teamCode.split("").reduce((total, char) => total + char.charCodeAt(0), 0) + matchNumber) % 10);

const codexScoreForMatch = (match: MatchWithState): ScorePick => {
  const homeRating = codexTeamRatings[match.homeTeam.code] ?? fallbackCodexRating(match.homeTeam.code, match.matchNumber);
  const awayRating = codexTeamRatings[match.awayTeam.code] ?? fallbackCodexRating(match.awayTeam.code, match.matchNumber + 3);
  const homeEdge = homeRating + (match.round === "Group stage" ? 1 : 0) - awayRating;
  const bonusGoal = match.matchNumber % 5 === 0 ? 1 : 0;

  if (homeEdge >= 16) return { away: "0", home: String(3 + bonusGoal) };
  if (homeEdge >= 8) return { away: "1", home: "2" };
  if (homeEdge >= 3) return { away: match.matchNumber % 4 === 0 ? "0" : "1", home: "2" };
  if (homeEdge <= -16) return { away: String(3 + bonusGoal), home: "0" };
  if (homeEdge <= -8) return { away: "2", home: "1" };
  if (homeEdge <= -3) return { away: "2", home: match.matchNumber % 4 === 0 ? "0" : "1" };
  return match.matchNumber % 3 === 0 ? { away: "2", home: "2" } : { away: "1", home: "1" };
};

const createCodexPlayer = (matches: MatchWithState[]): Player => {
  const matchPredictions = matches.reduce(
    (predictions, match) => ({
      ...predictions,
      [match.id]: codexScoreForMatch(match)
    }),
    {} as Record<string, ScorePick>
  );

  return {
    groupPredictionCount: matches.filter((match) => match.round === "Group stage").length,
    id: CODEX_PLAYER_ID,
    knockoutPredictionCount: matches.filter((match) => match.round !== "Group stage").length,
    matchPredictions,
    name: CODEX_PLAYER_NAME,
    nextPendingCount: nextPendingCount(matchPredictions, matches),
    predictionCount: matches.length
  };
};

const withCodexPlayer = (currentPlayers: Player[], matches: MatchWithState[]) => [
  ...currentPlayers.filter((player) => player.id !== CODEX_PLAYER_ID),
  createCodexPlayer(matches)
];

const normalizeScore = (score: ScorePick | undefined): ScorePick => ({
  away: score?.away ?? "",
  home: score?.home ?? ""
});

const formatKickoff = (match: MatchWithState) =>
  match.kickoffAt ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(match.kickoffAt)) : "Kickoff TBC";

const formatLockDeadline = (match: MatchWithState) =>
  match.kickoffAt
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(new Date(match.kickoffAt).getTime() - PREDICTION_LOCK_MS))
    : "Lock TBC";

const formatTimeUntil = (targetTime: number) => {
  const remainingMs = targetTime - Date.now();
  if (remainingMs <= 0) return "now";
  const totalMinutes = Math.ceil(remainingMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const predictionStatusCopy = (match: MatchWithState) => {
  if (!match.kickoffAt) {
    return {
      detail: "Family picks stay hidden until kickoff.",
      summary: "Kickoff and lock time are still TBC."
    };
  }

  const kickoffTime = new Date(match.kickoffAt).getTime();
  const lockTime = kickoffTime - PREDICTION_LOCK_MS;

  if (kickoffTime <= Date.now()) {
    return {
      detail: "Everyone's saved picks are visible now.",
      summary: "Family picks revealed"
    };
  }

  if (lockTime <= Date.now()) {
    return {
      detail: `Family picks reveal at kickoff in ${formatTimeUntil(kickoffTime)}.`,
      summary: "Locked"
    };
  }

  return {
    detail: `You can edit for ${formatTimeUntil(lockTime)}. Family picks reveal at kickoff in ${formatTimeUntil(kickoffTime)}.`,
    summary: `Locks in ${formatTimeUntil(lockTime)}`
  };
};

const hasOdds = (match: MatchWithState) => Boolean(match.odds?.homeWin || match.odds?.draw || match.odds?.awayWin);

const oddsCopy = (match: MatchWithState) =>
  `Odds: ${match.homeTeam.code} ${formatFractionalOdds(match.odds?.homeWin)} · Draw ${formatFractionalOdds(
    match.odds?.draw
  )} · ${match.awayTeam.code} ${formatFractionalOdds(match.odds?.awayWin)}`;

const worldCupFunFacts = [
  "The 2026 World Cup is the first edition planned for 48 teams.",
  "Canada, Mexico, and the United States are co-hosting the 2026 tournament.",
  "Mexico City is set to become the first city to host matches in three different men's World Cups.",
  "The 2026 tournament format includes 12 groups of four teams.",
  "The final is scheduled for MetLife Stadium in the New York/New Jersey area.",
  "The group stage alone has 72 matches, which is enough for a serious family leaderboard swing.",
  "Penalty shoot-outs decide knockout ties after extra time, but official match scores can be recorded differently by providers.",
  "The Golden Boot is awarded to the tournament's top scorer, with assists used as a tie-breaker in recent tournaments."
];

const teamFunFacts: Record<string, string> = {
  ALG: "Algeria won the Africa Cup of Nations in 1990 and again in 2019.",
  ARG: "Argentina's national team is nicknamed La Albiceleste, after its sky-blue and white shirts.",
  AUS: "Australia moved from the Oceania confederation to the Asian confederation in 2006.",
  AUT: "Austria finished third at the 1954 World Cup.",
  BEL: "Belgium's national team is nicknamed the Red Devils.",
  BIH: "Bosnia and Herzegovina made its World Cup debut in 2014.",
  BRA: "Brazil is the only nation to have played at every men's World Cup.",
  CAN: "Canada is co-hosting the men's World Cup for the first time in 2026.",
  CIV: "Cote d'Ivoire's national team is nicknamed the Elephants.",
  COL: "Colombia's 2014 run to the quarter-finals is its best men's World Cup finish.",
  COD: "DR Congo played at the 1974 World Cup as Zaire.",
  CPV: "Cape Verde qualified for the men's World Cup for the first time for 2026.",
  CRO: "Croatia reached the World Cup final in 2018 and the semi-finals in 1998 and 2022.",
  CUW: "Curacao qualified for the men's World Cup for the first time for 2026.",
  CZE: "Czechia continues the football history of Czechoslovakia, which reached two World Cup finals.",
  ECU: "Ecuador's first men's World Cup appearance came in 2002.",
  EGY: "Egypt was the first African team to play at a men's World Cup, appearing in 1934.",
  ENG: "England won the 1966 World Cup at Wembley Stadium.",
  ESP: "Spain won the 2010 World Cup, with every knockout win coming by a one-goal margin.",
  FRA: "France has won the men's World Cup twice, in 1998 and 2018.",
  GER: "Germany has won the men's World Cup four times.",
  GHA: "Ghana reached the World Cup quarter-finals in 2010.",
  HAI: "Haiti played at the 1974 World Cup.",
  IRN: "Iran's national team is often called Team Melli.",
  IRQ: "Iraq's only previous men's World Cup appearance was in 1986.",
  JOR: "Jordan qualified for the men's World Cup for the first time for 2026.",
  JPN: "Japan has qualified for every men's World Cup since 1998.",
  KOR: "Korea Republic reached the World Cup semi-finals as a co-host in 2002.",
  KSA: "Saudi Arabia reached the last 16 on its World Cup debut in 1994.",
  MAR: "Morocco became the first African team to reach a men's World Cup semi-final in 2022.",
  MEX: "Mexico is the world's most populous Spanish-speaking country.",
  NED: "The Netherlands has reached three men's World Cup finals.",
  NOR: "Norway last played at a men's World Cup in 1998.",
  NZL: "New Zealand has played at two men's World Cups, in 1982 and 2010.",
  PAN: "Panama made its men's World Cup debut in 2018.",
  PAR: "Paraguay reached the World Cup quarter-finals in 2010.",
  POR: "Portugal's best men's World Cup finish was third place in 1966.",
  QAT: "Qatar hosted the 2022 World Cup.",
  RSA: "South Africa hosted the 2010 World Cup, the first men's World Cup held in Africa.",
  SCO: "Scotland's fans are famously known as the Tartan Army.",
  SEN: "Senegal reached the World Cup quarter-finals on its tournament debut in 2002.",
  SUI: "Switzerland hosted the 1954 World Cup.",
  SWE: "Sweden hosted the 1958 World Cup and reached the final that year.",
  TUN: "Tunisia earned Africa's first men's World Cup match win in 1978.",
  TUR: "Turkiye finished third at the 2002 World Cup.",
  URU: "Uruguay hosted and won the first men's World Cup in 1930.",
  USA: "The United States hosted the 1994 World Cup and is co-hosting again in 2026.",
  UZB: "Uzbekistan qualified for the men's World Cup for the first time for 2026."
};

const funFactForMatch = (match: MatchWithState) => {
  const teams = [match.homeTeam.code, match.awayTeam.code].filter((code) => teamFunFacts[code]);
  if (teams.length > 0) {
    const teamCode = teams[(match.matchNumber ?? match.id.length) % teams.length];
    return teamFunFacts[teamCode];
  }
  return worldCupFunFacts[(match.matchNumber ? match.matchNumber - 1 : match.id.length) % worldCupFunFacts.length];
};

const teamLatestResult = (teamCode: string, currentMatches: MatchWithState[], results: Record<string, ScorePick>) => {
  const latestMatch = sortMatchesByKickoff(currentMatches)
    .filter((match) => (match.homeTeam.code === teamCode || match.awayTeam.code === teamCode) && hasScore(results[match.id]))
    .pop();
  if (!latestMatch) return "-";

  const score = results[latestMatch.id];
  const teamWasHome = latestMatch.homeTeam.code === teamCode;
  const teamScore = Number(teamWasHome ? score.home : score.away);
  const opponentScore = Number(teamWasHome ? score.away : score.home);
  const opponentCode = teamWasHome ? latestMatch.awayTeam.code : latestMatch.homeTeam.code;
  const result = teamScore > opponentScore ? "W" : teamScore < opponentScore ? "L" : "D";
  return `${result} ${teamScore}-${opponentScore} ${opponentCode}`;
};

const formatMatchDate = (match: MatchWithState) =>
  match.kickoffAt ? new Intl.DateTimeFormat("en-GB", { dateStyle: "full" }).format(new Date(match.kickoffAt)) : "Kickoff TBC";

const toDateKey = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const matchDateKey = (match: MatchWithState) => (match.kickoffAt ? toDateKey(new Date(match.kickoffAt)) : "tbc");

const formatDateKey = (dateKey: string) => {
  if (dateKey === "tbc") return "Kickoff TBC";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(`${dateKey}T12:00:00`));
};

const isTodayMatch = (match: MatchWithState) => match.kickoffAt && matchDateKey(match) === toDateKey(new Date());

const hasCompletedResult = (match: MatchWithState, results: Record<string, ScorePick>) => hasScore(results[match.id]);

const isUpcomingMatch = (match: MatchWithState) => !match.kickoffAt || new Date(match.kickoffAt).getTime() > Date.now();

const hasKickedOff = (match: MatchWithState) => Boolean(match.kickoffAt && new Date(match.kickoffAt).getTime() <= Date.now());

const resultLabelForForecast = (match: MatchWithState, forecast: FamilyForecast) => {
  const resultCounts = [
    { label: match.homeTeam.name, picks: forecast.homeResultPicks },
    { label: "Draw", picks: forecast.drawResultPicks },
    { label: match.awayTeam.name, picks: forecast.awayResultPicks }
  ].sort((a, b) => b.picks - a.picks || a.label.localeCompare(b.label));

  const [leader, second] = resultCounts;
  if (!leader || leader.picks === 0) return "No clear lean yet";
  if (second && leader.picks === second.picks) return "Split decision";
  return `${leader.label} leads`;
};

const forecastFromRows = (rows: ForecastRow[] | null | undefined) =>
  (rows ?? []).reduce(
    (forecasts, row) => ({
      ...forecasts,
      [row.match_id]: {
        awayResultPicks: row.away_result_picks,
        drawResultPicks: row.draw_result_picks,
        homeResultPicks: row.home_result_picks,
        topScoreAway: row.top_score_away,
        topScoreHome: row.top_score_home,
        topScorePicks: row.top_score_picks,
        totalPicks: row.total_picks
      }
    }),
    {} as Record<string, FamilyForecast>
  );

const localForecastsFromPlayers = (currentPlayers: Player[], currentMatches: MatchWithState[], activePlayer: Player | undefined) => {
  if (!activePlayer) return {};
  return currentMatches.reduce(
    (forecasts, match) => {
      const activePlayerPicked = hasScore(activePlayer.matchPredictions[match.id]);
      if (!activePlayerPicked && !arePredictionsRevealed(match)) return forecasts;

      const picks = currentPlayers
        .map((player) => normalizeScore(player.matchPredictions[match.id]))
        .filter(hasScore);
      if (picks.length < FAMILY_FORECAST_MINIMUM_PICKS) return forecasts;

      const scoreCounts = new Map<string, { away: number; count: number; home: number }>();
      picks.forEach((pick) => {
        const home = Number(pick.home);
        const away = Number(pick.away);
        const key = `${home}-${away}`;
        scoreCounts.set(key, { away, count: (scoreCounts.get(key)?.count ?? 0) + 1, home });
      });
      const topScore = Array.from(scoreCounts.values()).sort((a, b) => b.count - a.count || a.home - b.home || a.away - b.away)[0];

      forecasts[match.id] = {
        awayResultPicks: picks.filter((pick) => Number(pick.home) < Number(pick.away)).length,
        drawResultPicks: picks.filter((pick) => Number(pick.home) === Number(pick.away)).length,
        homeResultPicks: picks.filter((pick) => Number(pick.home) > Number(pick.away)).length,
        topScoreAway: topScore?.away ?? null,
        topScoreHome: topScore?.home ?? null,
        topScorePicks: topScore?.count ?? null,
        totalPicks: picks.length
      };
      return forecasts;
    },
    {} as Record<string, FamilyForecast>
  );
};

const isPriorityPick = (match: MatchWithState, score: ScorePick | undefined) => {
  if (!match.kickoffAt || hasScore(score) || isPredictionLocked(match)) return false;
  return isPredictionLockWarning(match);
};

const buildGroupTable = (groupId: GroupId, matches: MatchWithState[], results: Record<string, ScorePick>) => {
  const group = worldCupGroups.find((item) => item.id === groupId);
  const rows = (group?.teams ?? []).map((team) => ({
    drawn: 0,
    for: 0,
    against: 0,
    goalDifference: 0,
    lost: 0,
    played: 0,
    points: 0,
    team,
    won: 0
  }));

  const byCode = new Map(rows.map((row) => [row.team.code, row]));

  matches
    .filter((match) => match.groupId === groupId && hasScore(results[match.id]))
    .forEach((match) => {
      const score = results[match.id];
      const home = byCode.get(match.homeTeam.code);
      const away = byCode.get(match.awayTeam.code);
      if (!home || !away) return;

      const homeScore = Number(score.home);
      const awayScore = Number(score.away);
      home.played += 1;
      away.played += 1;
      home.for += homeScore;
      home.against += awayScore;
      away.for += awayScore;
      away.against += homeScore;

      if (homeScore > awayScore) {
        home.won += 1;
        away.lost += 1;
        home.points += 3;
      } else if (awayScore > homeScore) {
        away.won += 1;
        home.lost += 1;
        away.points += 3;
      } else {
        home.drawn += 1;
        away.drawn += 1;
        home.points += 1;
        away.points += 1;
      }
    });

  return rows
    .map((row) => ({ ...row, goalDifference: row.for - row.against }))
    .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.for - a.for || a.team.name.localeCompare(b.team.name));
};

const migratePlayers = (players: unknown): Player[] | null => {
  if (!Array.isArray(players)) return null;

  const migratedPlayers: Array<Player | null> = players.map((player) => {
    if (!player || typeof player !== "object") return null;
    const currentPlayer = player as Partial<Player>;
    return {
      id: typeof currentPlayer.id === "string" ? currentPlayer.id : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      matchPredictions: {
        ...emptyMatchScores(),
        ...(currentPlayer.matchPredictions && typeof currentPlayer.matchPredictions === "object" ? currentPlayer.matchPredictions : {})
      },
      name: typeof currentPlayer.name === "string" ? currentPlayer.name : "Player",
      nextPendingCount: 0
    };
  });

  return migratedPlayers.filter((player): player is Player => player !== null);
};

const rowToMatch = (row: MatchRow): MatchWithState => ({
  awayScore: row.away_score,
  awayTeam: { code: row.away_code, flag: row.away_flag, name: row.away_name },
  city: row.city ?? "",
  groupId: row.group_id,
  homeScore: row.home_score,
  homeTeam: { code: row.home_code, flag: row.home_flag, name: row.home_name },
  id: row.id,
  kickoffAt: row.kickoff_at,
  label: row.label,
  lastSyncedAt: row.last_synced_at,
  matchNumber: row.match_number ?? Number(row.id.split("-")[1] ?? 0),
  odds: {
    awayWin: row.odds_away_win,
    draw: row.odds_draw,
    homeWin: row.odds_home_win
  },
  round: row.round ?? "Group stage",
  scoreStatus: row.score_status,
  venue: row.venue ?? ""
});

function TeamLine({ match }: { match: MatchWithState }) {
  return (
    <div className="match-teams">
      <strong>
        {match.homeTeam.flag} {match.homeTeam.name}
      </strong>
      <span>v</span>
      <strong>
        {match.awayTeam.flag} {match.awayTeam.name}
      </strong>
    </div>
  );
}

function ScoreInputs({
  disabled = false,
  label,
  match,
  onChange,
  saveStatus = "idle",
  score,
  urgencyStatus = "idle"
}: {
  disabled?: boolean;
  label: string;
  match: MatchWithState;
  onChange: (score: ScorePick) => void;
  saveStatus?: SaveStatus;
  score: ScorePick;
  urgencyStatus?: "idle" | "warning" | "locked";
}) {
  const updateScore = (side: keyof ScorePick, value: string) => {
    const cleanValue = value === "" ? "" : String(Math.max(0, Math.floor(Number(value))));
    onChange({ ...score, [side]: cleanValue });
  };

  return (
    <div className={`score-entry ${disabled ? "disabled" : ""} ${saveStatus !== "idle" ? saveStatus : ""} ${urgencyStatus !== "idle" ? urgencyStatus : ""}`} aria-label={label}>
      <label>
        <span>{match.homeTeam.code}</span>
        <input
          aria-label={`${label} ${match.homeTeam.name}`}
          disabled={disabled}
          inputMode="numeric"
          min="0"
          onChange={(event) => updateScore("home", event.target.value)}
          placeholder="-"
          type="number"
          value={score.home}
        />
      </label>
      <b>-</b>
      <label>
        <span>{match.awayTeam.code}</span>
        <input
          aria-label={`${label} ${match.awayTeam.name}`}
          disabled={disabled}
          inputMode="numeric"
          min="0"
          onChange={(event) => updateScore("away", event.target.value)}
          placeholder="-"
          type="number"
          value={score.away}
        />
      </label>
    </div>
  );
}

export function WorldCupPredictor() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<MatchWithState[]>(worldCupMatches);
  const [scorers, setScorers] = useState<ScorerRow[]>([]);
  const [syncRuns, setSyncRuns] = useState<SyncRunRow[]>([]);
  const [familyForecasts, setFamilyForecasts] = useState<Record<string, FamilyForecast>>({});
  const [activePlayerId, setActivePlayerId] = useState("");
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>("family");
  const [activeView, setActiveView] = useState<ViewMode>("group");
  const [activeDateFilter, setActiveDateFilter] = useState<DateFilter>("all");
  const [activeGroupFilter, setActiveGroupFilter] = useState<GroupFilter>("all");
  const [activeTeamFilter, setActiveTeamFilter] = useState<TeamFilter>("all");
  const [showUpcomingOnly, setShowUpcomingOnly] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [adminResultFilter, setAdminResultFilter] = useState<AdminResultFilter>("needs-result");
  const [results, setResults] = useState<Record<string, ScorePick>>(emptyMatchScores);
  const [predictionSaveStatus, setPredictionSaveStatus] = useState<Record<string, PredictionSaveState>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [profileName, setProfileName] = useState("");
  const [dailyDigestOptIn, setDailyDigestOptIn] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [scoreSyncMessage, setScoreSyncMessage] = useState("");
  const [isSyncingScores, setIsSyncingScores] = useState(false);
  const [profileReady, setProfileReady] = useState(!isSupabaseConfigured);

  const isAdmin = session?.user.app_metadata?.role === "admin";

  const loadLocalState = () => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<SavedState>;
          const migratedPlayers = migratePlayers(parsed.players);
          if (migratedPlayers && migratedPlayers.length > 0) {
            const restoredPlayers = withCodexPlayer(migratedPlayers, worldCupMatches);
            setPlayers(restoredPlayers);
            setActivePlayerId(parsed.activePlayerId || migratedPlayers[0].id);
            setActiveView(parsed.activeView === "date" ? "date" : "group");
            setActiveDateFilter(typeof parsed.activeDateFilter === "string" ? parsed.activeDateFilter : "all");
            setActiveGroupFilter(typeof parsed.activeGroupFilter === "string" ? parsed.activeGroupFilter : "all");
            setActiveTeamFilter(typeof parsed.activeTeamFilter === "string" ? parsed.activeTeamFilter : "all");
            setShowUpcomingOnly(Boolean(parsed.showUpcomingOnly));
            setHideCompleted(Boolean(parsed.hideCompleted));
            setShowMissingOnly(Boolean(parsed.showMissingOnly));
            setFiltersCollapsed(Boolean(parsed.filtersCollapsed));
            setResults({
            ...emptyMatchScores(),
            ...(parsed.results && typeof parsed.results === "object" ? parsed.results : {})
          });
          return;
        }
      } catch {
        // Fall through to starter players.
      }
    }
    const starterPlayers = withCodexPlayer(["Alex", "Family"].map(createPlayer), worldCupMatches);
    setPlayers(starterPlayers);
    setActivePlayerId(starterPlayers[0].id);
  };

  const loadSharedState = async (currentSession: Session) => {
    if (!supabase) return;
    setSyncMessage("Syncing shared game...");

    const [playerResponse, matchResponse, predictionResponse, statusResponse, scorerResponse, forecastResponse] = await Promise.all([
      supabase.from("players").select("id, display_name, daily_digest_opt_in").order("display_name"),
      supabase.from("matches").select("*").order("match_number", { nullsFirst: false }),
      supabase.from("predictions").select("player_id, match_id, home_score, away_score"),
      supabase.rpc("player_prediction_status"),
      supabase.from("tournament_scorers").select("*").order("goals", { ascending: false }).order("player_name"),
      supabase.rpc("family_match_forecasts", { minimum_picks: FAMILY_FORECAST_MINIMUM_PICKS })
    ]);

    if (playerResponse.error || matchResponse.error || predictionResponse.error || statusResponse.error || scorerResponse.error) {
      setSyncMessage(
        playerResponse.error?.message ||
          matchResponse.error?.message ||
          predictionResponse.error?.message ||
          statusResponse.error?.message ||
          scorerResponse.error?.message ||
          "Could not sync shared game."
      );
      return;
    }

    const matchRows = (matchResponse.data ?? []) as MatchRow[];
    const sharedMatches: MatchWithState[] = matchRows.length > 0 ? matchRows.map(rowToMatch) : worldCupMatches;
    const sharedResults = emptyMatchScores(sharedMatches);
    sharedMatches.forEach((match) => {
      sharedResults[match.id] =
        match.homeScore !== null && match.homeScore !== undefined && match.awayScore !== null && match.awayScore !== undefined
          ? { away: String(match.awayScore), home: String(match.homeScore) }
          : emptyScore();
    });

    const playerRows = (playerResponse.data ?? []) as PlayerRow[];
    const statusByPlayerId = new Map(
      ((statusResponse.data ?? []) as PredictionStatusRow[]).map((status) => [status.player_id, status])
    );
    const sharedPlayers = playerRows.map((player) => ({
      id: player.id,
      matchPredictions: emptyMatchScores(sharedMatches),
      name: player.display_name,
      groupPredictionCount: statusByPlayerId.get(player.id)?.group_prediction_count,
      knockoutPredictionCount: statusByPlayerId.get(player.id)?.knockout_prediction_count,
      nextPendingCount: statusByPlayerId.get(player.id)?.next_pending_count ?? 0,
      predictionCount: statusByPlayerId.get(player.id)?.prediction_count ?? 0
    }));

    const currentProfile = sharedPlayers.find((player) => player.id === currentSession.user.id);
    setProfileReady(Boolean(currentProfile));
    if (currentProfile) {
      setProfileName(currentProfile.name);
      setDailyDigestOptIn(Boolean(playerRows.find((player) => player.id === currentProfile.id)?.daily_digest_opt_in));
    } else {
      setProfileName(currentSession.user.email?.split("@")[0] ?? "");
      setDailyDigestOptIn(false);
    }

    const predictions = (predictionResponse.data ?? []) as PredictionRow[];
    const currentPlayerSaveStatus: Record<string, PredictionSaveState> = {};
    predictions.forEach((prediction) => {
      const player = sharedPlayers.find((item) => item.id === prediction.player_id);
      if (!player) return;
      const savedScore = {
        away: String(prediction.away_score),
        home: String(prediction.home_score)
      };
      player.matchPredictions[prediction.match_id] = savedScore;
      if (prediction.player_id === currentSession.user.id) {
        currentPlayerSaveStatus[prediction.match_id] = { scoreKey: scoreKey(savedScore), status: "saved" };
      }
    });

    setMatches(sharedMatches);
    setResults(sharedResults);
    setPlayers(withCodexPlayer(sharedPlayers, sharedMatches));
    setScorers((scorerResponse.data ?? []) as ScorerRow[]);
    if (currentSession.user.app_metadata?.role === "admin") {
      const { data: syncRunData } = await supabase
        .from("sync_runs")
        .select("created_at, error, matched_count, object_count, provider, request_count, updated_count")
        .eq("provider", "football-data.org")
        .order("created_at", { ascending: false });
      setSyncRuns((syncRunData ?? []) as SyncRunRow[]);
    } else {
      setSyncRuns([]);
    }
    setFamilyForecasts(forecastResponse.error ? {} : forecastFromRows(forecastResponse.data as ForecastRow[] | null));
    setPredictionSaveStatus(currentPlayerSaveStatus);
    setActivePlayerId(currentSession.user.id);
    setSyncMessage("Shared game synced.");
  };

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      loadLocalState();
      setIsLoaded(true);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) {
        loadSharedState(data.session).finally(() => setIsLoaded(true));
      } else {
        setIsLoaded(true);
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        loadSharedState(nextSession);
      } else {
        setPlayers([]);
        setScorers([]);
        setFamilyForecasts({});
        setActivePlayerId("");
        setProfileReady(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isLoaded || isSupabaseConfigured) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        activeDateFilter,
        activeGroupFilter,
        activePlayerId,
        activeTeamFilter,
        activeView,
        filtersCollapsed,
        hideCompleted,
        players,
        results,
        showMissingOnly,
        showUpcomingOnly
      })
    );
  }, [activeDateFilter, activeGroupFilter, activePlayerId, activeTeamFilter, activeView, filtersCollapsed, hideCompleted, isLoaded, players, results, showMissingOnly, showUpcomingOnly]);

  const activePlayer = players.find((player) => player.id === activePlayerId) ?? players[0];
  const visibleFamilyForecasts = useMemo(
    () => (isSupabaseConfigured ? familyForecasts : localForecastsFromPlayers(players, matches, activePlayer)),
    [activePlayer, familyForecasts, matches, players]
  );
  const todayKey = toDateKey(new Date());
  const teamOptions = useMemo(
    () =>
      Array.from(new Map(worldCupGroups.flatMap((group) => group.teams).map((team) => [team.code, team])).values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    []
  );
  const dateOptions = useMemo(
    () =>
      Array.from(
        new Set(
          sortMatchesByKickoff(matches)
            .filter((match) => match.round === "Group stage" && match.kickoffAt)
            .map(matchDateKey)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [matches]
  );
  const groupStageMatchList = useMemo(() => matches.filter((match) => match.round === "Group stage"), [matches]);
  const knockoutMatchList = useMemo(() => matches.filter((match) => match.round !== "Group stage"), [matches]);
  const filteredMatches = useMemo(() => {
    const nextMatches = sortMatchesByKickoff(groupStageMatchList).filter((match) => {
      const matchesTeam =
        activeTeamFilter === "all" || match.homeTeam.code === activeTeamFilter || match.awayTeam.code === activeTeamFilter;
      const matchesGroup = activeGroupFilter === "all" || match.groupId === activeGroupFilter;
      const matchesDate =
        activeDateFilter === "all" || (activeDateFilter === "today" ? isTodayMatch(match) : matchDateKey(match) === activeDateFilter);
      const matchesCompleted = !hideCompleted || !hasCompletedResult(match, results);
      const matchesMissing = !showMissingOnly || !hasScore(activePlayer?.matchPredictions[match.id]);
      return matchesTeam && matchesGroup && matchesDate && matchesCompleted && matchesMissing;
    });

    if (!showUpcomingOnly) return nextMatches;
    return nextMatches.filter(isUpcomingMatch).slice(0, NEXT_UPCOMING_MATCH_COUNT);
  }, [activeDateFilter, activeGroupFilter, activePlayer?.matchPredictions, activeTeamFilter, groupStageMatchList, hideCompleted, results, showMissingOnly, showUpcomingOnly]);
  const filteredKnockoutMatches = useMemo(() => {
    const nextMatches = sortMatchesByKickoff(knockoutMatchList).filter((match) => {
      const matchesCompleted = !hideCompleted || !hasCompletedResult(match, results);
      const matchesMissing = !showMissingOnly || !hasScore(activePlayer?.matchPredictions[match.id]);
      return matchesCompleted && matchesMissing;
    });

    if (!showUpcomingOnly) return nextMatches;
    return nextMatches.filter(isUpcomingMatch).slice(0, NEXT_UPCOMING_MATCH_COUNT);
  }, [activePlayer?.matchPredictions, hideCompleted, knockoutMatchList, results, showMissingOnly, showUpcomingOnly]);
  const knockoutMatchesByRound = useMemo(
    () =>
      knockoutRounds
        .map((round) => ({
          matches: filteredKnockoutMatches.filter((match) => match.round === round),
          round
        }))
        .filter((section) => section.matches.length > 0),
    [filteredKnockoutMatches]
  );
  const priorityCount = useMemo(
    () => filteredMatches.filter((match) => isPriorityPick(match, activePlayer?.matchPredictions[match.id])).length,
    [activePlayer?.matchPredictions, filteredMatches]
  );
  const nextMatches = useMemo(() => nextKickoffMatches(matches), [matches]);
  const visibleGroups = worldCupGroups.filter((group) => filteredMatches.some((match) => match.groupId === group.id));
  const resultCount = completedCount(results, matches);
  const activeGroupPickCount = activePlayer ? completedCount(activePlayer.matchPredictions, groupStageMatchList) : 0;
  const activeKnockoutPickCount = activePlayer ? completedCount(activePlayer.matchPredictions, knockoutMatchList) : 0;
  const scoredMatches = useMemo(() => matches.filter((match) => hasCompletedResult(match, results)), [matches, results]);
  const unscoredMatches = useMemo(() => matches.filter((match) => !hasCompletedResult(match, results)), [matches, results]);
  const adminNeedsResultCount = useMemo(
    () => unscoredMatches.filter((match) => hasKickedOff(match)).length,
    [unscoredMatches]
  );
  const adminResultMatches = useMemo(() => {
    const sortedMatches = sortMatchesByKickoff(matches);
    if (adminResultFilter === "needs-result") return sortedMatches.filter((match) => hasKickedOff(match) && !hasCompletedResult(match, results));
    if (adminResultFilter === "unscored") return sortedMatches.filter((match) => !hasCompletedResult(match, results));
    if (adminResultFilter === "scored") return sortedMatches.filter((match) => hasCompletedResult(match, results));
    return sortedMatches;
  }, [adminResultFilter, matches, results]);
  const adminScoreSyncUsage = useMemo(
    () => ({
      calls: syncRuns.reduce((total, run) => total + (run.request_count ?? 0), 0),
      fixtures: syncRuns.reduce((total, run) => total + (run.object_count ?? 0), 0),
      lastRun: syncRuns[0],
      matched: syncRuns.reduce((total, run) => total + (run.matched_count ?? 0), 0),
      updated: syncRuns.reduce((total, run) => total + (run.updated_count ?? 0), 0)
    }),
    [syncRuns]
  );
  const standings = useMemo(
    () =>
      players
        .map((player) => ({
          ...player,
          completion:
            typeof player.predictionCount === "number" ? Math.round((player.predictionCount / matches.length) * 100) : completion(player.matchPredictions, matches),
          exactScores: matches.filter((match) => matchPoints(player.matchPredictions[match.id], results[match.id]) === 3).length,
          gamesPlayed: scoredMatches.length,
          goalsCorrect: scoredMatches.reduce((total, match) => {
            const prediction = player.matchPredictions[match.id];
            const result = results[match.id];
            return total + Number(prediction?.home === result?.home) + Number(prediction?.away === result?.away);
          }, 0),
          groupPickCount:
            typeof player.groupPredictionCount === "number" ? player.groupPredictionCount : completedCount(player.matchPredictions, groupStageMatchList),
          hasNextPending: Boolean(player.nextPendingCount),
          knockoutPickCount:
            typeof player.knockoutPredictionCount === "number" ? player.knockoutPredictionCount : completedCount(player.matchPredictions, knockoutMatchList),
          pickCount: typeof player.predictionCount === "number" ? player.predictionCount : completedCount(player.matchPredictions, matches),
          resultCorrect: scoredMatches.filter((match) => outcome(player.matchPredictions[match.id]) === outcome(results[match.id])).length,
          score: scorePlayer(player, results, matches)
        }))
        .map((player) => ({
          ...player,
          goalsIncorrect: player.gamesPlayed * 2 - player.goalsCorrect
        }))
        .sort((a, b) => b.score - a.score || b.exactScores - a.exactScores || b.goalsCorrect - a.goalsCorrect || a.name.localeCompare(b.name)),
    [groupStageMatchList, knockoutMatchList, matches, players, results, scoredMatches]
  );

  const signIn = async () => {
    if (!supabase || !email.trim()) return;
    setAuthMessage("Sending sign-in link...");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin
      }
    });
    setAuthMessage(error ? error.message : "Check your email for the sign-in link.");
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    setAuthMessage("");
    setSyncMessage("");
  };

  const saveProfile = async () => {
    if (!supabase || !session || !profileName.trim()) return;
    setSyncMessage("Saving profile...");
    const { error } = await supabase.from("players").upsert({
      daily_digest_opt_in: dailyDigestOptIn,
      display_name: profileName.trim(),
      id: session.user.id
    });
    if (error) {
      setSyncMessage(error.message);
      return;
    }
    await loadSharedState(session);
  };

  const saveDailyDigestPreference = async (nextValue: boolean) => {
    setDailyDigestOptIn(nextValue);
    if (!supabase || !session || !profileReady) return;
    const { error } = await supabase.from("players").update({ daily_digest_opt_in: nextValue }).eq("id", session.user.id);
    setSyncMessage(error ? error.message : nextValue ? "Daily email digest enabled." : "Daily email digest disabled.");
  };

  const savePrediction = async (matchId: string, score: ScorePick) => {
    if (!supabase || !session || !hasScore(score)) return;
    const currentScoreKey = scoreKey(score);
    const match = matches.find((item) => item.id === matchId);
    if (match && isPredictionLocked(match)) {
      setSyncMessage("Predictions lock one hour before kickoff.");
      setPredictionSaveStatus((currentStatus) => ({ ...currentStatus, [matchId]: { scoreKey: currentScoreKey, status: "error" } }));
      return;
    }
    setPredictionSaveStatus((currentStatus) => ({ ...currentStatus, [matchId]: { scoreKey: currentScoreKey, status: "saving" } }));
    const { error } = await supabase.from("predictions").upsert({
      away_score: Number(score.away),
      home_score: Number(score.home),
      match_id: matchId,
      player_id: session.user.id
    });
    setPredictionSaveStatus((currentStatus) => {
      const latestStatus = currentStatus[matchId];
      if (latestStatus && latestStatus.scoreKey !== currentScoreKey) return currentStatus;
      return { ...currentStatus, [matchId]: { scoreKey: currentScoreKey, status: error ? "error" : "saved" } };
    });
    if (!error) {
      setPlayers((currentPlayers) =>
        currentPlayers.map((player) =>
          player.id === session.user.id
            ? {
                ...player,
                groupPredictionCount: completedCount(player.matchPredictions, groupStageMatchList),
                knockoutPredictionCount: completedCount(player.matchPredictions, knockoutMatchList),
                nextPendingCount: nextPendingCount(player.matchPredictions, matches),
                predictionCount: completedCount(player.matchPredictions, matches)
              }
            : player
        )
      );
    }
    setSyncMessage(error ? error.message : "Prediction saved.");
  };

  const saveResult = async (matchId: string, score: ScorePick) => {
    if (!supabase) return;
    const nextHomeScore = score.home === "" ? null : Number(score.home);
    const nextAwayScore = score.away === "" ? null : Number(score.away);
    const { error } = await supabase
      .from("matches")
      .update({ away_score: nextAwayScore, home_score: nextHomeScore })
      .eq("id", matchId);
    setSyncMessage(error ? error.message : hasScore(score) ? "Actual score saved." : "Actual score cleared.");
  };

  const syncScores = async () => {
    if (!supabase || !session) return;
    setIsSyncingScores(true);
    setScoreSyncMessage("Syncing scores...");
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      setScoreSyncMessage("Sign in again before syncing scores.");
      setIsSyncingScores(false);
      return;
    }

    const response = await fetch("/api/sync-scores", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    const payload = (await response.json()) as {
      error?: string;
      matched?: number;
      finishedWithoutScore?: number;
      rateLimit?: { remaining?: string; reset?: string; warning?: string };
      scorerError?: string;
      scorersUpdated?: number;
      unmatched?: unknown[];
      updated?: number;
    };
    if (!response.ok) {
      setScoreSyncMessage(payload.error ?? "Could not sync scores.");
      setIsSyncingScores(false);
      return;
    }

    await loadSharedState(session);
    const rateNote = payload.rateLimit?.warning
      ? ` ${payload.rateLimit.warning}`
      : payload.rateLimit?.remaining
        ? ` API requests remaining: ${payload.rateLimit.remaining}.`
        : "";
    const scorerNote = payload.scorerError ? ` Scorers unavailable: ${payload.scorerError}.` : ` Scorers updated: ${payload.scorersUpdated ?? 0}.`;
    const finishedWithoutScoreNote = payload.finishedWithoutScore
      ? ` Provider marked ${payload.finishedWithoutScore} finished fixture${payload.finishedWithoutScore === 1 ? "" : "s"} without a full-time score.`
      : "";
    setScoreSyncMessage(
      `Scores synced. Updated ${payload.updated ?? 0} of ${payload.matched ?? 0} matched fixtures.${scorerNote}${finishedWithoutScoreNote}${rateNote}`
    );
    setIsSyncingScores(false);
  };

  const updateActiveMatchScore = (matchId: string, score: ScorePick) => {
    if (!activePlayer) return;
    const match = matches.find((item) => item.id === matchId);
    if (match && isPredictionLocked(match)) {
      setSyncMessage("Predictions lock one hour before kickoff.");
      return;
    }
    setPlayers((currentPlayers) =>
      currentPlayers.map((player) =>
        player.id === activePlayer.id
          ? {
              ...player,
              matchPredictions: {
                ...player.matchPredictions,
                [matchId]: score
              }
            }
          : player
      )
    );
    if (!hasScore(score)) {
      setPredictionSaveStatus((currentStatus) => ({ ...currentStatus, [matchId]: { scoreKey: "", status: "idle" } }));
      return;
    }
    if (isSupabaseConfigured) {
      savePrediction(matchId, score);
    }
  };

  const updateResultScore = (matchId: string, score: ScorePick) => {
    setResults((currentResults) => ({
      ...currentResults,
      [matchId]: score
    }));
    if (isSupabaseConfigured && isAdmin) {
      saveResult(matchId, score);
    }
  };

  const resetGame = () => {
    if (isSupabaseConfigured) {
      setSyncMessage("Shared games are reset from Supabase, not from the browser.");
      return;
    }
    if (!window.confirm("Reset all players, match predictions, and actual scores?")) return;
    const starterPlayer = createPlayer("Alex");
    setPlayers(withCodexPlayer([starterPlayer], matches));
    setPredictionSaveStatus({});
    setActivePlayerId(starterPlayer.id);
    setActiveView("group");
    setActiveDateFilter("all");
    setActiveGroupFilter("all");
    setActiveTeamFilter("all");
    setShowUpcomingOnly(false);
    setHideCompleted(false);
    setShowMissingOnly(false);
    setFiltersCollapsed(false);
    setResults(emptyMatchScores());
  };

  const renderGroupTable = (groupId: GroupId) => {
    const table = buildGroupTable(groupId, matches, results);

    return (
      <div className="group-table-wrap">
        <div className="group-table-title">
          <strong>Group {groupId}</strong>
          <span>{matches.filter((match) => match.groupId === groupId && hasScore(results[match.id])).length} results</span>
        </div>
        <div className="group-table" aria-label={`Group ${groupId} table`}>
          <div className="group-table-head">
            <span>Team</span>
            <span>Last</span>
            <span>P</span>
            <span>W</span>
            <span>D</span>
            <span>L</span>
            <span>GD</span>
            <span>Pts</span>
          </div>
          {table.map((row) => (
            <div className="group-table-row" key={row.team.code}>
              <span>
                {row.team.flag} {row.team.name}
              </span>
              <span>{teamLatestResult(row.team.code, matches, results)}</span>
              <span>{row.played}</span>
              <span>{row.won}</span>
              <span>{row.drawn}</span>
              <span>{row.lost}</span>
              <span>{row.goalDifference}</span>
              <strong>{row.points}</strong>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMatchRow = (match: MatchWithState) => {
    const predictedScore = normalizeScore(activePlayer?.matchPredictions[match.id]);
    const actualScore = normalizeScore(results[match.id]);
    const currentSaveStatus = predictionSaveStatus[match.id];
    const predictionStatus = currentSaveStatus?.scoreKey === scoreKey(predictedScore) ? currentSaveStatus.status : "idle";
    const points = matchPoints(predictedScore, actualScore);
    const locked = isPredictionLocked(match);
    const lockWarning = isPredictionLockWarning(match);
    const revealed = arePredictionsRevealed(match);
    const canEditPrediction = !locked;
    const needsPick = !hasScore(predictedScore) && !locked;
    const priorityPick = isPriorityPick(match, predictedScore);
    const rowState = locked ? "locked" : lockWarning ? "lock-warning" : priorityPick ? "priority" : needsPick ? "needs-pick" : "";
    const statusCopy = predictionStatusCopy(match);
    const showDetailedPrivacy = isTodayMatch(match) || nextMatches.some((nextMatch) => nextMatch.id === match.id);
    const revealedPicks = players
      .map((player) => ({
        id: player.id,
        name: player.name,
        points: matchPoints(player.matchPredictions[match.id], actualScore),
        score: normalizeScore(player.matchPredictions[match.id])
      }))
      .filter((pick) => hasScore(pick.score))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

    return (
      <article className={`match-row ${rowState}`} key={match.id}>
        <div>
          <div className="match-meta">
            <p className="eyebrow">{match.label}</p>
            {locked ? (
              <span className="urgency-badge danger">Locked</span>
            ) : lockWarning ? (
              <span className="urgency-badge">Locks soon</span>
            ) : needsPick ? (
              <span className="urgency-badge soft">Needs pick</span>
            ) : null}
          </div>
          <TeamLine match={match} />
          <small className="match-kickoff">{formatKickoff(match)}</small>
          <small className="match-venue">{match.venue && match.city ? `${match.venue}, ${match.city}` : match.city || match.venue}</small>
          {hasOdds(match) ? <small className="match-odds">{oddsCopy(match)}</small> : null}
          <small className={revealed ? "match-lock open" : locked ? "match-lock locked" : "match-lock"}>
            {statusCopy.summary}
          </small>
          {showDetailedPrivacy ? <small className="privacy-note">{statusCopy.detail}</small> : null}
          {showDetailedPrivacy && !revealed && isSupabaseConfigured ? (
            <small className="privacy-note">Other players' exact scores stay private until kickoff.</small>
          ) : null}
        </div>
        <ScoreInputs
          disabled={!canEditPrediction}
          label={`${activePlayer?.name ?? "Player"}'s prediction for ${match.label}`}
          match={match}
          onChange={(score) => updateActiveMatchScore(match.id, score)}
          saveStatus={predictionStatus}
          score={predictedScore}
          urgencyStatus={locked ? "locked" : lockWarning ? "warning" : "idle"}
        />
        <ScoreInputs
          disabled={isSupabaseConfigured && !isAdmin}
          label={`Actual score for ${match.label}`}
          match={match}
          onChange={(score) => updateResultScore(match.id, score)}
          score={actualScore}
        />
        <strong className={`match-points ${points === 3 ? "exact" : points === 1 ? "outcome" : ""}`}>{points}</strong>
        {revealed ? (
          <div className="revealed-picks">
            <strong>Family picks</strong>
            {revealedPicks.length > 0 ? (
              <div>
                {revealedPicks.map((pick) => (
                  <span key={pick.id}>
                    {pick.name}: {pick.score.home}-{pick.score.away}
                    {hasScore(actualScore) ? ` (${pick.points} pts)` : ""}
                  </span>
                ))}
              </div>
            ) : (
              <span>No saved picks for this match.</span>
            )}
          </div>
        ) : null}
      </article>
    );
  };

  const renderAdminResultRow = (match: MatchWithState) => {
    const actualScore = normalizeScore(results[match.id]);
    const scored = hasScore(actualScore);
    const needsResult = hasKickedOff(match) && !scored;

    return (
      <article className={`admin-result-row ${needsResult ? "needs-result" : scored ? "scored" : ""}`} key={match.id}>
        <div>
          <div className="match-meta">
            <p className="eyebrow">{match.label}</p>
            {needsResult ? <span className="urgency-badge danger">Needs result</span> : scored ? <span className="urgency-badge soft">Scored</span> : null}
          </div>
          <TeamLine match={match} />
          <small className="match-kickoff">{formatKickoff(match)}</small>
          <small className="match-venue">{match.venue && match.city ? `${match.venue}, ${match.city}` : match.city || match.venue}</small>
          {match.scoreStatus ? <small className="match-odds">Provider status: {match.scoreStatus}</small> : null}
          {match.lastSyncedAt ? (
            <small className="match-venue">Last synced {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(match.lastSyncedAt))}</small>
          ) : null}
        </div>
        <ScoreInputs
          disabled={!isAdmin}
          label={`Admin actual score for ${match.label}`}
          match={match}
          onChange={(score) => updateResultScore(match.id, score)}
          score={actualScore}
        />
        <button className="text-button admin-clear-button" disabled={!scored} onClick={() => updateResultScore(match.id, emptyScore())} type="button">
          Clear
        </button>
      </article>
    );
  };

  if (!isLoaded) {
    return (
      <main className="shell predictor-shell">
        <p className="empty">Loading predictor...</p>
      </main>
    );
  }

  return (
    <main className="shell predictor-shell">
      <header className="predictor-hero">
        <div className="predictor-hero-copy">
          <p className="eyebrow">Family World Cup pool</p>
          <h1>World Cup 2026 predictor</h1>
          <p className="lede">
            Pick the score for every World Cup game. Earn 1 point for the home score, 1 for the away score, and 1 for
            the match result. Picks turn amber two hours before kickoff, lock one hour before kickoff, and stay private until the match starts.
          </p>
          {!isSupabaseConfigured ? (
            <div className="action-row predictor-actions">
              <button className="button secondary" onClick={resetGame} type="button">
                Reset game
              </button>
            </div>
          ) : null}
        </div>
        <div className="pitch-visual" aria-hidden="true">
          <div className="pitch-line center" />
          <div className="pitch-line box top" />
          <div className="pitch-line box bottom" />
          <div className="football">⚽</div>
          <span>{matches.length} matches</span>
          <strong>{resultCount} scored</strong>
        </div>
      </header>

      {isSupabaseConfigured && !session ? (
        <section className="panel auth-panel">
          <div>
            <p className="eyebrow">Shared family game</p>
            <h2>Sign in to save your picks</h2>
            <p className="muted-copy">We&apos;ll email you a magic link. Your predictions are tied to your email, turn amber two hours before kickoff, lock one hour before kickoff, and stay hidden from everyone else until each match starts.</p>
          </div>
          <div className="auth-form">
            <input
              aria-label="Email address"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
            <button className="button" onClick={signIn} type="button">
              Send link
            </button>
          </div>
          {authMessage ? <p className="sync-message">{authMessage}</p> : null}
        </section>
      ) : null}

      {isSupabaseConfigured && session && !profileReady ? (
        <section className="panel auth-panel">
          <div>
            <p className="eyebrow">Player profile</p>
            <h2>Choose your display name</h2>
            <p className="muted-copy">This is what your family will see on the leaderboard.</p>
          </div>
          <div className="auth-form">
            <input
              aria-label="Display name"
              onChange={(event) => setProfileName(event.target.value)}
              placeholder="Display name"
              value={profileName}
            />
            <label className="inline-check">
              <input checked={dailyDigestOptIn} onChange={(event) => setDailyDigestOptIn(event.target.checked)} type="checkbox" />
              <span>Send me the 7am family digest</span>
            </label>
            <button className="button" onClick={saveProfile} type="button">
              Save
            </button>
          </div>
          {syncMessage ? <p className="sync-message">{syncMessage}</p> : null}
        </section>
      ) : null}

      {(!isSupabaseConfigured || (session && profileReady && activePlayer)) && (
        <>
          <div className="view-tabs workspace-tabs" aria-label="Choose app section">
            <button className={activeWorkspaceTab === "family" ? "active" : ""} onClick={() => setActiveWorkspaceTab("family")} type="button">
              Family table
            </button>
            <button className={activeWorkspaceTab === "groups" ? "active" : ""} onClick={() => setActiveWorkspaceTab("groups")} type="button">
              Group games
            </button>
            <button className={activeWorkspaceTab === "knockouts" ? "active" : ""} onClick={() => setActiveWorkspaceTab("knockouts")} type="button">
              Knockouts
            </button>
            <button className={activeWorkspaceTab === "scorers" ? "active" : ""} onClick={() => setActiveWorkspaceTab("scorers")} type="button">
              Scorers
            </button>
            {isAdmin ? (
              <button className={activeWorkspaceTab === "admin" ? "active" : ""} onClick={() => setActiveWorkspaceTab("admin")} type="button">
                Admin
              </button>
            ) : null}
          </div>

          {nextMatches.length > 0 && activeWorkspaceTab !== "family" ? (
            <section className="panel next-matches-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Up next</p>
                  <h2>{nextMatches.length === 1 ? "Next match" : "Next matches"}</h2>
                </div>
                <span className="badge warning">{predictionStatusCopy(nextMatches[0]).summary}</span>
              </div>
              <div className="next-match-list">
                {nextMatches.map((match) => (
                  <article className="next-match-card" key={match.id}>
                    <div>
                      <strong>
                        {match.homeTeam.flag} {match.homeTeam.name} vs {match.awayTeam.flag} {match.awayTeam.name}
                      </strong>
                      <span>
                        Group {match.groupId} · Match {match.matchNumber}
                      </span>
                    </div>
                    <div>
                      <b>{formatKickoff(match)}</b>
                      <span>
                        {match.venue}, {match.city}
                      </span>
                      <small className="privacy-note">{predictionStatusCopy(match).detail}</small>
                      {hasOdds(match) ? <small className="match-odds">{oddsCopy(match)}</small> : null}
                    </div>
                    <div className="family-forecast">
                      <strong>Family forecast</strong>
                      {visibleFamilyForecasts[match.id] ? (
                        <>
                          <span>
                            {resultLabelForForecast(match, visibleFamilyForecasts[match.id])} from {visibleFamilyForecasts[match.id].totalPicks} picks
                          </span>
                          {visibleFamilyForecasts[match.id].topScoreHome !== null && visibleFamilyForecasts[match.id].topScoreAway !== null ? (
                            <small>
                              Top score: {visibleFamilyForecasts[match.id].topScoreHome}-{visibleFamilyForecasts[match.id].topScoreAway}
                              {visibleFamilyForecasts[match.id].topScorePicks ? ` (${visibleFamilyForecasts[match.id].topScorePicks} picks)` : ""}
                            </small>
                          ) : null}
                        </>
                      ) : (
                        <span>
                          {hasScore(activePlayer?.matchPredictions[match.id])
                            ? `${FAMILY_FORECAST_MINIMUM_PICKS}+ family picks needed for a forecast`
                            : "Make your pick to unlock the family lean"}
                        </span>
                      )}
                    </div>
                    <div className="fun-fact">
                      <strong>Fun fact</strong>
                      <span>{funFactForMatch(match)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className={`predictor-grid ${activeWorkspaceTab === "family" ? "family-layout" : "picks-layout"}`}>
          <div className="predictor-main">
            {activeWorkspaceTab === "groups" ? (
              <section className="panel match-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Group-stage picks</p>
                  <h2>{activePlayer?.name}&apos;s group game picks</h2>
                </div>
                <span className="badge ok">
                  {activeGroupPickCount} / {groupStageMatchList.length} picked
                </span>
              </div>

              <div className="view-tabs" aria-label="Choose match view">
                <button className={activeView === "group" ? "active" : ""} onClick={() => setActiveView("group")} type="button">
                  Group view
                </button>
                <button className={activeView === "date" ? "active" : ""} onClick={() => setActiveView("date")} type="button">
                  Date order
                </button>
              </div>

              <div className="match-filters">
                <div className="filter-header">
                  <strong>Filters</strong>
                  <button className="text-button" onClick={() => setFiltersCollapsed((current) => !current)} type="button">
                    {filtersCollapsed ? "Show filters" : "Hide filters"}
                  </button>
                </div>
                {!filtersCollapsed ? (
                  <div className="filter-select-grid">
                    <label>
                      <span>Group</span>
                      <select
                        aria-label="Filter matches by group"
                        onChange={(event) => setActiveGroupFilter(event.target.value as GroupFilter)}
                        value={activeGroupFilter}
                      >
                        <option value="all">All groups</option>
                        {worldCupGroups.map((group) => (
                          <option key={group.id} value={group.id}>
                            Group {group.id}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Team</span>
                      <select aria-label="Filter matches by team" onChange={(event) => setActiveTeamFilter(event.target.value)} value={activeTeamFilter}>
                        <option value="all">All teams</option>
                        {teamOptions.map((team) => (
                          <option key={team.code} value={team.code}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Date</span>
                      <select aria-label="Filter matches by date" onChange={(event) => setActiveDateFilter(event.target.value)} value={activeDateFilter}>
                        <option value="all">All dates</option>
                        <option value="today">Today</option>
                        {dateOptions.filter((dateKey) => dateKey !== todayKey).map((dateKey) => (
                          <option key={dateKey} value={dateKey}>
                            {formatDateKey(dateKey)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}
                <div className="quick-filters" aria-label="Quick match filters">
                  <label>
                    <input checked={showMissingOnly} onChange={(event) => setShowMissingOnly(event.target.checked)} type="checkbox" />
                    <span>Missing my scores</span>
                  </label>
                  <label>
                    <input checked={showUpcomingOnly} onChange={(event) => setShowUpcomingOnly(event.target.checked)} type="checkbox" />
                    <span>Next {NEXT_UPCOMING_MATCH_COUNT} upcoming games</span>
                  </label>
                  <label>
                    <input checked={hideCompleted} onChange={(event) => setHideCompleted(event.target.checked)} type="checkbox" />
                    <span>Hide completed games</span>
                  </label>
                </div>
                <p className="filter-summary">
                  {priorityCount > 0
                    ? `${priorityCount} priority ${priorityCount === 1 ? "pick" : "picks"} in this view`
                    : `${filteredMatches.length} of ${groupStageMatchList.length} group ${filteredMatches.length === 1 ? "match" : "matches"} shown`}
                </p>
              </div>

              {activeView === "group" ? (
                <div className="group-view">
                  {filteredMatches.length === 0 ? <p className="empty">No matches for these filters.</p> : null}

                  {visibleGroups.map((group) => {
                    const groupMatches = filteredMatches.filter((match) => match.groupId === group.id);
                    return (
                      <section className="group-section" key={group.id}>
                        {renderGroupTable(group.id)}
                        <div className="match-table">
                          <div className="match-table-head">
                            <span>Match</span>
                            <span>Your score</span>
                            <span>Actual score</span>
                            <span>Pts</span>
                          </div>
                          {groupMatches.map(renderMatchRow)}
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : (
                <div className="date-view">
                  {filteredMatches.length === 0 ? (
                    <p className="empty">No matches for these filters.</p>
                  ) : null}

                  {filteredMatches.map((match, index) => {
                    const previousMatch = filteredMatches[index - 1];
                    const showDateHeading = index === 0 || formatMatchDate(previousMatch) !== formatMatchDate(match);
                    return (
                      <div className="date-match-block" key={match.id}>
                        {showDateHeading ? <h3>{formatMatchDate(match)}</h3> : null}
                        {renderMatchRow(match)}
                      </div>
                    );
                  })}
                </div>
              )}
              </section>
            ) : null}

            {activeWorkspaceTab === "knockouts" ? (
              <section className="panel match-panel">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Bracket picks</p>
                    <h2>{activePlayer?.name}&apos;s knockout picks</h2>
                  </div>
                  <span className="badge ok">
                    {activeKnockoutPickCount} / {knockoutMatchList.length} picked
                  </span>
                </div>
                <p className="muted-copy">
                  Knockout teams are shown as bracket slots until the tournament fills them in. You can still pick scores now and revise them until one hour before kickoff.
                </p>
                <div className="match-filters compact">
                  <div className="quick-filters" aria-label="Quick knockout filters">
                    <label>
                      <input checked={showMissingOnly} onChange={(event) => setShowMissingOnly(event.target.checked)} type="checkbox" />
                      <span>Missing my scores</span>
                    </label>
                    <label>
                      <input checked={showUpcomingOnly} onChange={(event) => setShowUpcomingOnly(event.target.checked)} type="checkbox" />
                      <span>Next {NEXT_UPCOMING_MATCH_COUNT} upcoming games</span>
                    </label>
                    <label>
                      <input checked={hideCompleted} onChange={(event) => setHideCompleted(event.target.checked)} type="checkbox" />
                      <span>Hide completed games</span>
                    </label>
                  </div>
                  <p className="filter-summary">
                    {filteredKnockoutMatches.length} of {knockoutMatchList.length} knockout {filteredKnockoutMatches.length === 1 ? "match" : "matches"} shown
                  </p>
                </div>
                <div className="group-view">
                  {filteredKnockoutMatches.length === 0 ? <p className="empty">No knockout matches for these filters.</p> : null}
                  {knockoutMatchesByRound.map((section) => (
                    <section className="group-section" key={section.round}>
                      <div className="group-table-title">
                        <strong>{section.round}</strong>
                        <span>{section.matches.length} matches</span>
                      </div>
                      <div className="match-table">
                        <div className="match-table-head">
                          <span>Match</span>
                          <span>Your score</span>
                          <span>Actual score</span>
                          <span>Pts</span>
                        </div>
                        {section.matches.map(renderMatchRow)}
                      </div>
                    </section>
                  ))}
                </div>
              </section>
            ) : null}

            {activeWorkspaceTab === "scorers" ? (
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Golden boot watch</p>
                    <h2>Tournament scorers</h2>
                  </div>
                  <span className="badge ok">{scorers.length} players</span>
                </div>
                {scorers.length > 0 ? (
                  <div className="scorers-table" aria-label="Tournament scorers">
                    <div className="scorers-table-head">
                      <span>Player</span>
                      <span>Team</span>
                      <span>Goals</span>
                      <span>Assists</span>
                    </div>
                    {scorers.map((scorer) => (
                      <div className="scorers-table-row" key={`${scorer.team_code ?? scorer.team_name}-${scorer.player_name}`}>
                        <strong>{scorer.player_name}</strong>
                        <span>{scorer.team_name ?? scorer.team_code ?? "-"}</span>
                        <b>{scorer.goals}</b>
                        <span>{scorer.assists ?? "-"}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty">
                    Scorers will appear here once football-data.org returns World Cup scorer data through the sync route.
                  </p>
                )}
              </section>
            ) : null}

            {activeWorkspaceTab === "family" ? (
              <section className="panel family-table-panel">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Family table</p>
                    <h2>League standings</h2>
                  </div>
                  <span className="badge ok">{scoredMatches.length} played</span>
                </div>

                {nextMatches.length > 0 ? (
                  <div className="family-next-game">
                    <span>Next game</span>
                    <strong>
                      {nextMatches[0].homeTeam.flag} {nextMatches[0].homeTeam.name} vs {nextMatches[0].awayTeam.flag}{" "}
                      {nextMatches[0].awayTeam.name}
                    </strong>
                    <small>
                      {formatKickoff(nextMatches[0])} · {predictionStatusCopy(nextMatches[0]).summary}
                    </small>
                  </div>
                ) : null}

                {isSupabaseConfigured ? (
                  <div className="sync-card family-account-card">
                    <strong>{session?.user.email}</strong>
                    <span>Shared Supabase game</span>
                    <label className="inline-check compact-check">
                      <input checked={dailyDigestOptIn} onChange={(event) => saveDailyDigestPreference(event.target.checked)} type="checkbox" />
                      <span>7am digest</span>
                    </label>
                    {isAdmin ? (
                      <button className="text-button" disabled={isSyncingScores} onClick={syncScores} type="button">
                        {isSyncingScores ? "Syncing..." : "Sync scores"}
                      </button>
                    ) : null}
                    <button className="text-button" onClick={signOut} type="button">
                      Sign out
                    </button>
                  </div>
                ) : null}

                <div className="family-standings-scroll">
                  <table className="family-standings-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Player</th>
                        <th>GP</th>
                        <th>GC</th>
                        <th>GI</th>
                        <th>RC</th>
                        <th>EX</th>
                        <th>Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((player, index) => (
                        <tr className={player.hasNextPending ? "needs-pick" : ""} key={player.id}>
                          <td>{index + 1}</td>
                          <td>
                            <strong>{player.name}</strong>
                            {player.hasNextPending ? (
                              <small>Missing next {player.nextPendingCount === 1 ? "match" : `${player.nextPendingCount} matches`}</small>
                            ) : null}
                          </td>
                          <td>{player.gamesPlayed}</td>
                          <td>{player.goalsCorrect}</td>
                          <td>{player.goalsIncorrect}</td>
                          <td>{player.resultCorrect}</td>
                          <td>{player.exactScores}</td>
                          <td>
                            <b>{player.score}</b>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="table-key">
                  <span>GP: games played</span>
                  <span>GC: team scores correct</span>
                  <span>GI: team scores missed</span>
                  <span>RC: results correct</span>
                  <span>EX: exact scores</span>
                </div>

                <div className="prediction-summary bragging-rights">
                  {standings.slice(0, 4).map((player) => (
                    <article key={player.id}>
                      <strong>{player.name}</strong>
                      <span>{player.score} points</span>
                      <span>{player.pickCount} / {matches.length} picks complete</span>
                      <small>
                        {player.exactScores} exact · {player.goalsCorrect} scores correct · {player.resultCorrect} results correct
                      </small>
                    </article>
                  ))}
                </div>
                {syncMessage ? <p className="sync-message">{syncMessage}</p> : null}
                {scoreSyncMessage ? <p className="sync-message">{scoreSyncMessage}</p> : null}
              </section>
            ) : null}

            {activeWorkspaceTab === "admin" && isAdmin ? (
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Admin console</p>
                    <h2>Result entry</h2>
                  </div>
                  <button className="button" disabled={isSyncingScores} onClick={syncScores} type="button">
                    {isSyncingScores ? "Syncing..." : "Sync scores"}
                  </button>
                </div>

                <div className="admin-stat-grid">
                  <div>
                    <span>Needs result</span>
                    <strong>{adminNeedsResultCount}</strong>
                  </div>
                  <div>
                    <span>Scored</span>
                    <strong>{scoredMatches.length}</strong>
                  </div>
                  <div>
                    <span>Unscored</span>
                    <strong>{unscoredMatches.length}</strong>
                  </div>
                  <div>
                    <span>Score API calls</span>
                    <strong>{adminScoreSyncUsage.calls}</strong>
                  </div>
                  <div>
                    <span>Provider fixtures</span>
                    <strong>{adminScoreSyncUsage.fixtures}</strong>
                  </div>
                  <div>
                    <span>Sync matched</span>
                    <strong>{adminScoreSyncUsage.matched}</strong>
                  </div>
                  <div>
                    <span>Sync updated</span>
                    <strong>{adminScoreSyncUsage.updated}</strong>
                  </div>
                  <div>
                    <span>Last score sync</span>
                    <strong>
                      {adminScoreSyncUsage.lastRun
                        ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(
                            new Date(adminScoreSyncUsage.lastRun.created_at)
                          )
                        : "-"}
                    </strong>
                  </div>
                  <div>
                    <span>Last sync status</span>
                    <strong>{adminScoreSyncUsage.lastRun?.error ? "Warning" : adminScoreSyncUsage.lastRun ? "OK" : "-"}</strong>
                  </div>
                </div>
                {adminScoreSyncUsage.lastRun?.error ? <p className="sync-message">Last score sync note: {adminScoreSyncUsage.lastRun.error}</p> : null}

                <div className="match-filters compact">
                  <div className="filter-select-grid admin-filter-grid">
                    <label>
                      <span>Result view</span>
                      <select
                        aria-label="Filter admin result rows"
                        onChange={(event) => setAdminResultFilter(event.target.value as AdminResultFilter)}
                        value={adminResultFilter}
                      >
                        <option value="needs-result">Needs result</option>
                        <option value="unscored">All unscored</option>
                        <option value="scored">Scored</option>
                        <option value="all">All matches</option>
                      </select>
                    </label>
                  </div>
                  <p className="filter-summary">
                    {adminResultMatches.length} {adminResultMatches.length === 1 ? "match" : "matches"} shown
                  </p>
                </div>

                <div className="admin-result-list">
                  {adminResultMatches.length === 0 ? <p className="empty">No matches in this admin view.</p> : null}
                  {adminResultMatches.map(renderAdminResultRow)}
                </div>
                {syncMessage ? <p className="sync-message">{syncMessage}</p> : null}
                {scoreSyncMessage ? <p className="sync-message">{scoreSyncMessage}</p> : null}
              </section>
            ) : null}
          </div>
          </section>
        </>
      )}
    </main>
  );
}
