import { afterEach, describe, expect, it, vi } from "vitest";
import {
  arePredictionsRevealed,
  completedCount,
  completion,
  formatFractionalOdds,
  isPredictionLocked,
  isPredictionLockWarning,
  matchPoints,
  nextKickoffMatches,
  nextPendingCount,
  outcome,
  scorePlayer,
  type GameMatch,
  type ScorePick
} from "./gameRules";

const score = (home: string, away: string): ScorePick => ({ away, home });

const matches: GameMatch[] = [
  { id: "A-1", kickoffAt: "2026-06-11T19:00:00Z" },
  { id: "A-2", kickoffAt: "2026-06-12T01:00:00Z" },
  { id: "A-3", kickoffAt: "2026-06-12T01:00:00Z" }
];

afterEach(() => {
  vi.useRealTimers();
});

describe("matchPoints", () => {
  it("awards one point for each correct team score and one point for the correct result", () => {
    expect(matchPoints(score("2", "1"), score("2", "1"))).toBe(3);
    expect(matchPoints(score("2", "0"), score("2", "1"))).toBe(2);
    expect(matchPoints(score("3", "1"), score("2", "1"))).toBe(2);
    expect(matchPoints(score("4", "2"), score("2", "1"))).toBe(1);
    expect(matchPoints(score("0", "1"), score("2", "1"))).toBe(1);
  });

  it("handles draws and missing scores", () => {
    expect(outcome(score("1", "1"))).toBe("draw");
    expect(matchPoints(score("2", "2"), score("1", "1"))).toBe(1);
    expect(matchPoints(score("", "2"), score("1", "2"))).toBe(0);
    expect(matchPoints(undefined, score("1", "2"))).toBe(0);
  });
});

describe("player scoring and completion", () => {
  it("totals points across matches and counts completed picks", () => {
    const player = {
      matchPredictions: {
        "A-1": score("2", "1"),
        "A-2": score("0", "0"),
        "A-3": score("", "")
      }
    };
    const results = {
      "A-1": score("2", "1"),
      "A-2": score("1", "1"),
      "A-3": score("3", "0")
    };

    expect(scorePlayer(player, results, matches)).toBe(4);
    expect(completedCount(player.matchPredictions, matches)).toBe(2);
    expect(completion(player.matchPredictions, matches)).toBe(67);
  });
});

describe("formatFractionalOdds", () => {
  it("formats decimal odds as simplified UK fractional odds", () => {
    expect(formatFractionalOdds(1.47)).toBe("47/100");
    expect(formatFractionalOdds(4.11)).toBe("311/100");
    expect(formatFractionalOdds(6.79)).toBe("579/100");
    expect(formatFractionalOdds(2.5)).toBe("3/2");
    expect(formatFractionalOdds(3)).toBe("2/1");
  });

  it("uses a dash when odds are missing or invalid", () => {
    expect(formatFractionalOdds(null)).toBe("-");
    expect(formatFractionalOdds(undefined)).toBe("-");
    expect(formatFractionalOdds(1)).toBe("-");
  });
});

describe("prediction timing", () => {
  it("warns two hours before kickoff and locks one hour before kickoff", () => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date("2026-06-11T16:59:00Z"));
    expect(isPredictionLockWarning(matches[0])).toBe(false);
    expect(isPredictionLocked(matches[0])).toBe(false);

    vi.setSystemTime(new Date("2026-06-11T17:00:00Z"));
    expect(isPredictionLockWarning(matches[0])).toBe(true);
    expect(isPredictionLocked(matches[0])).toBe(false);

    vi.setSystemTime(new Date("2026-06-11T18:00:00Z"));
    expect(isPredictionLockWarning(matches[0])).toBe(false);
    expect(isPredictionLocked(matches[0])).toBe(true);
  });

  it("reveals family predictions at kickoff", () => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date("2026-06-11T18:59:59Z"));
    expect(arePredictionsRevealed(matches[0])).toBe(false);

    vi.setSystemTime(new Date("2026-06-11T19:00:00Z"));
    expect(arePredictionsRevealed(matches[0])).toBe(true);
  });
});

describe("next matches", () => {
  it("returns all matches on the next US matchday and counts missing picks", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T20:00:00Z"));

    const matchdayMatches: GameMatch[] = [
      { id: "done", kickoffAt: "2026-06-11T19:00:00Z" },
      { id: "late-uk-1", kickoffAt: "2026-06-12T01:00:00Z" },
      { id: "late-uk-2", kickoffAt: "2026-06-12T03:00:00Z" },
      { id: "next-us-day", kickoffAt: "2026-06-12T19:00:00Z" }
    ];

    expect(nextKickoffMatches(matchdayMatches).map((match) => match.id)).toEqual(["late-uk-1", "late-uk-2"]);
    expect(
      nextPendingCount(
        {
          "late-uk-1": score("1", "0"),
          "late-uk-2": score("", "")
        },
        matchdayMatches
      )
    ).toBe(1);
  });
});
