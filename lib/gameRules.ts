export type ScorePick = {
  away: string;
  home: string;
};

export type GameMatch = {
  id: string;
  kickoffAt?: string;
};

export type GamePlayer = {
  matchPredictions: Record<string, ScorePick>;
};

export const PREDICTION_WARNING_MS = 2 * 60 * 60 * 1000;
export const PREDICTION_LOCK_MS = 60 * 60 * 1000;

export const hasScore = (score: ScorePick | undefined) => Boolean(score && score.home !== "" && score.away !== "");

export const scoreKey = (score: ScorePick | undefined) => (hasScore(score) ? `${score?.home}-${score?.away}` : "");

export const outcome = (score: ScorePick | undefined) => {
  if (!hasScore(score)) return "pending";
  const home = Number(score?.home);
  const away = Number(score?.away);
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
};

export const matchPoints = (prediction: ScorePick | undefined, result: ScorePick | undefined) => {
  if (!hasScore(prediction) || !hasScore(result)) return 0;
  return (
    Number(prediction?.home === result?.home) +
    Number(prediction?.away === result?.away) +
    Number(outcome(prediction) === outcome(result))
  );
};

export const completedCount = <Match extends GameMatch>(scores: Record<string, ScorePick>, matches: Match[]) =>
  matches.filter((match) => hasScore(scores[match.id])).length;

export const completion = <Match extends GameMatch>(scores: Record<string, ScorePick>, matches: Match[]) =>
  Math.round((completedCount(scores, matches) / matches.length) * 100);

export const scorePlayer = <Match extends GameMatch>(player: GamePlayer, results: Record<string, ScorePick>, matches: Match[]) =>
  matches.reduce((total, match) => total + matchPoints(player.matchPredictions[match.id], results[match.id]), 0);

const greatestCommonDivisor = (left: number, right: number): number => {
  const remainder = left % right;
  return remainder === 0 ? right : greatestCommonDivisor(right, remainder);
};

export const formatFractionalOdds = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 1) return "-";

  const numerator = Math.round((value - 1) * 100);
  const denominator = 100;
  const divisor = greatestCommonDivisor(numerator, denominator);

  return `${numerator / divisor}/${denominator / divisor}`;
};

export const isPredictionLocked = (match: GameMatch) =>
  Boolean(match.kickoffAt && new Date(match.kickoffAt).getTime() - PREDICTION_LOCK_MS <= Date.now());

export const isPredictionLockWarning = (match: GameMatch) =>
  Boolean(match.kickoffAt && !isPredictionLocked(match) && new Date(match.kickoffAt).getTime() - PREDICTION_WARNING_MS <= Date.now());

export const arePredictionsRevealed = (match: GameMatch) =>
  Boolean(match.kickoffAt && new Date(match.kickoffAt).getTime() <= Date.now());

const matchTime = (match: GameMatch) => (match.kickoffAt ? new Date(match.kickoffAt).getTime() : Number.MAX_SAFE_INTEGER);

export const matchDateKeyInTimeZone = (kickoffAt: string, timeZone = "America/Los_Angeles") => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric"
  }).formatToParts(new Date(kickoffAt));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};

export const sortMatchesByKickoff = <Match extends GameMatch>(currentMatches: Match[]) =>
  [...currentMatches].sort((a, b) => matchTime(a) - matchTime(b) || a.id.localeCompare(b.id));

export const nextKickoffMatches = <Match extends GameMatch>(currentMatches: Match[]) => {
  const futureMatches = sortMatchesByKickoff(currentMatches).filter(
    (match) => match.kickoffAt && new Date(match.kickoffAt).getTime() > Date.now()
  );
  const nextKickoffAt = futureMatches[0]?.kickoffAt;
  const nextMatchDateKey = nextKickoffAt ? matchDateKeyInTimeZone(nextKickoffAt) : "";
  return nextMatchDateKey ? futureMatches.filter((match) => match.kickoffAt && matchDateKeyInTimeZone(match.kickoffAt) === nextMatchDateKey) : [];
};

export const nextPendingCount = <Match extends GameMatch>(scores: Record<string, ScorePick>, currentMatches: Match[]) =>
  nextKickoffMatches(currentMatches).filter((match) => !hasScore(scores[match.id])).length;
