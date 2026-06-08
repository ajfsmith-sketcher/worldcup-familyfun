"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { scoringRules, worldCupGroups, worldCupMatches, type GroupId, type WorldCupMatch } from "@/lib/worldCup2026";

type ViewMode = "group" | "date";
type DateFilter = "all" | "today" | string;
type GroupFilter = "all" | GroupId;
type TeamFilter = "all" | string;
type SaveStatus = "idle" | "saving" | "saved" | "error";

type ScorePick = {
  away: string;
  home: string;
};

type Player = {
  id: string;
  matchPredictions: Record<string, ScorePick>;
  name: string;
};

type MatchWithState = WorldCupMatch & {
  awayScore?: number | null;
  homeScore?: number | null;
};

type MatchRow = {
  away_code: string;
  away_flag: string;
  away_name: string;
  away_score: number | null;
  city: string | null;
  group_id: GroupId;
  home_code: string;
  home_flag: string;
  home_name: string;
  home_score: number | null;
  id: string;
  kickoff_at: string;
  label: string;
  match_number: number | null;
  venue: string | null;
};

type PlayerRow = {
  display_name: string;
  id: string;
};

type PredictionRow = {
  away_score: number;
  home_score: number;
  match_id: string;
  player_id: string;
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
  players: Player[];
  results: Record<string, ScorePick>;
  showUpcomingOnly: boolean;
};

const STORAGE_KEY = "world-cup-2026-family-predictor";
const PREDICTION_LOCK_MS = 2 * 60 * 60 * 1000;
const NEXT_UPCOMING_MATCH_COUNT = 8;

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
  name
});

const normalizeScore = (score: ScorePick | undefined): ScorePick => ({
  away: score?.away ?? "",
  home: score?.home ?? ""
});

const hasScore = (score: ScorePick | undefined) => score?.home !== "" && score?.away !== "";

const scoreKey = (score: ScorePick | undefined) => (hasScore(score) ? `${score?.home}-${score?.away}` : "");

const outcome = (score: ScorePick | undefined) => {
  if (!hasScore(score)) return "pending";
  const home = Number(score?.home);
  const away = Number(score?.away);
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
};

const matchPoints = (prediction: ScorePick | undefined, result: ScorePick | undefined) => {
  if (!hasScore(prediction) || !hasScore(result)) return 0;
  if (prediction?.home === result?.home && prediction?.away === result?.away) return 3;
  return outcome(prediction) === outcome(result) ? 1 : 0;
};

const completedCount = (scores: Record<string, ScorePick>, matches: MatchWithState[] = worldCupMatches) =>
  matches.filter((match) => hasScore(scores[match.id])).length;

const completion = (scores: Record<string, ScorePick>, matches: MatchWithState[] = worldCupMatches) =>
  Math.round((completedCount(scores, matches) / matches.length) * 100);

const scorePlayer = (player: Player, results: Record<string, ScorePick>, matches: MatchWithState[]) =>
  matches.reduce((total, match) => total + matchPoints(player.matchPredictions[match.id], results[match.id]), 0);

const isPredictionLocked = (match: MatchWithState) =>
  Boolean(match.kickoffAt && new Date(match.kickoffAt).getTime() - PREDICTION_LOCK_MS <= Date.now());

const arePredictionsRevealed = (match: MatchWithState) => Boolean(match.kickoffAt && new Date(match.kickoffAt).getTime() <= Date.now());

const formatKickoff = (match: MatchWithState) =>
  match.kickoffAt ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(match.kickoffAt)) : "Kickoff TBC";

const formatLockDeadline = (match: MatchWithState) =>
  match.kickoffAt
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(new Date(match.kickoffAt).getTime() - PREDICTION_LOCK_MS))
    : "Lock TBC";

const matchTime = (match: MatchWithState) => (match.kickoffAt ? new Date(match.kickoffAt).getTime() : Number.MAX_SAFE_INTEGER);

const sortMatchesByKickoff = (currentMatches: MatchWithState[]) =>
  [...currentMatches].sort((a, b) => matchTime(a) - matchTime(b) || a.groupId.localeCompare(b.groupId) || a.id.localeCompare(b.id));

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

const isPriorityPick = (match: MatchWithState, score: ScorePick | undefined) => {
  if (!match.kickoffAt || hasScore(score) || isPredictionLocked(match)) return false;
  const lockTime = new Date(match.kickoffAt).getTime() - PREDICTION_LOCK_MS;
  return lockTime - Date.now() <= 24 * 60 * 60 * 1000;
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

  return players
    .map((player) => {
      if (!player || typeof player !== "object") return null;
      const currentPlayer = player as Partial<Player>;
      return {
        id: typeof currentPlayer.id === "string" ? currentPlayer.id : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        matchPredictions: {
          ...emptyMatchScores(),
          ...(currentPlayer.matchPredictions && typeof currentPlayer.matchPredictions === "object"
            ? currentPlayer.matchPredictions
            : {})
        },
        name: typeof currentPlayer.name === "string" ? currentPlayer.name : "Player"
      };
    })
    .filter((player): player is Player => Boolean(player));
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
  matchNumber: row.match_number ?? Number(row.id.split("-")[1] ?? 0),
  round: "Group stage",
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
  score
}: {
  disabled?: boolean;
  label: string;
  match: MatchWithState;
  onChange: (score: ScorePick) => void;
  saveStatus?: SaveStatus;
  score: ScorePick;
}) {
  const updateScore = (side: keyof ScorePick, value: string) => {
    const cleanValue = value === "" ? "" : String(Math.max(0, Math.floor(Number(value))));
    onChange({ ...score, [side]: cleanValue });
  };

  return (
    <div className={`score-entry ${disabled ? "disabled" : ""} ${saveStatus !== "idle" ? saveStatus : ""}`} aria-label={label}>
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
  const [activePlayerId, setActivePlayerId] = useState("");
  const [activeView, setActiveView] = useState<ViewMode>("group");
  const [activeDateFilter, setActiveDateFilter] = useState<DateFilter>("all");
  const [activeGroupFilter, setActiveGroupFilter] = useState<GroupFilter>("all");
  const [activeTeamFilter, setActiveTeamFilter] = useState<TeamFilter>("all");
  const [showUpcomingOnly, setShowUpcomingOnly] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [results, setResults] = useState<Record<string, ScorePick>>(emptyMatchScores);
  const [predictionSaveStatus, setPredictionSaveStatus] = useState<Record<string, PredictionSaveState>>({});
  const [newPlayerName, setNewPlayerName] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [profileName, setProfileName] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [profileReady, setProfileReady] = useState(!isSupabaseConfigured);

  const isAdmin = session?.user.app_metadata?.role === "admin";

  const loadLocalState = () => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<SavedState>;
          const migratedPlayers = migratePlayers(parsed.players);
          if (migratedPlayers && migratedPlayers.length > 0) {
            setPlayers(migratedPlayers);
            setActivePlayerId(parsed.activePlayerId || migratedPlayers[0].id);
            setActiveView(parsed.activeView === "date" ? "date" : "group");
            setActiveDateFilter(typeof parsed.activeDateFilter === "string" ? parsed.activeDateFilter : "all");
            setActiveGroupFilter(typeof parsed.activeGroupFilter === "string" ? parsed.activeGroupFilter : "all");
            setActiveTeamFilter(typeof parsed.activeTeamFilter === "string" ? parsed.activeTeamFilter : "all");
            setShowUpcomingOnly(Boolean(parsed.showUpcomingOnly));
            setHideCompleted(Boolean(parsed.hideCompleted));
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
    const starterPlayers = ["Alex", "Family"].map(createPlayer);
    setPlayers(starterPlayers);
    setActivePlayerId(starterPlayers[0].id);
  };

  const loadSharedState = async (currentSession: Session) => {
    if (!supabase) return;
    setSyncMessage("Syncing shared game...");

    const [playerResponse, matchResponse, predictionResponse] = await Promise.all([
      supabase.from("players").select("id, display_name").order("display_name"),
      supabase.from("matches").select("*").order("match_number", { nullsFirst: false }),
      supabase.from("predictions").select("player_id, match_id, home_score, away_score")
    ]);

    if (playerResponse.error || matchResponse.error || predictionResponse.error) {
      setSyncMessage(playerResponse.error?.message || matchResponse.error?.message || predictionResponse.error?.message || "Could not sync shared game.");
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
    const sharedPlayers = playerRows.map((player) => ({
      id: player.id,
      matchPredictions: emptyMatchScores(sharedMatches),
      name: player.display_name
    }));

    const currentProfile = sharedPlayers.find((player) => player.id === currentSession.user.id);
    setProfileReady(Boolean(currentProfile));
    if (currentProfile) {
      setProfileName(currentProfile.name);
    } else {
      setProfileName(currentSession.user.email?.split("@")[0] ?? "");
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
    setPlayers(sharedPlayers);
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
        hideCompleted,
        players,
        results,
        showUpcomingOnly
      })
    );
  }, [activeDateFilter, activeGroupFilter, activePlayerId, activeTeamFilter, activeView, hideCompleted, isLoaded, players, results, showUpcomingOnly]);

  const activePlayer = players.find((player) => player.id === activePlayerId) ?? players[0];
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
      Array.from(new Set(sortMatchesByKickoff(matches).filter((match) => match.kickoffAt).map(matchDateKey))).sort((a, b) => a.localeCompare(b)),
    [matches]
  );
  const filteredMatches = useMemo(() => {
    const nextMatches = sortMatchesByKickoff(matches).filter((match) => {
      const matchesTeam =
        activeTeamFilter === "all" || match.homeTeam.code === activeTeamFilter || match.awayTeam.code === activeTeamFilter;
      const matchesGroup = activeGroupFilter === "all" || match.groupId === activeGroupFilter;
      const matchesDate =
        activeDateFilter === "all" || (activeDateFilter === "today" ? isTodayMatch(match) : matchDateKey(match) === activeDateFilter);
      const matchesCompleted = !hideCompleted || !hasCompletedResult(match, results);
      return matchesTeam && matchesGroup && matchesDate && matchesCompleted;
    });

    if (!showUpcomingOnly) return nextMatches;
    return nextMatches.filter(isUpcomingMatch).slice(0, NEXT_UPCOMING_MATCH_COUNT);
  }, [activeDateFilter, activeGroupFilter, activeTeamFilter, hideCompleted, matches, results, showUpcomingOnly]);
  const priorityCount = useMemo(
    () => filteredMatches.filter((match) => isPriorityPick(match, activePlayer?.matchPredictions[match.id])).length,
    [activePlayer?.matchPredictions, filteredMatches]
  );
  const visibleGroups = worldCupGroups.filter((group) => filteredMatches.some((match) => match.groupId === group.id));
  const resultCount = completedCount(results, matches);

  const standings = useMemo(
    () =>
      players
        .map((player) => ({
          ...player,
          completion: completion(player.matchPredictions, matches),
          exactScores: matches.filter((match) => matchPoints(player.matchPredictions[match.id], results[match.id]) === 3).length,
          score: scorePlayer(player, results, matches)
        }))
        .sort((a, b) => b.score - a.score || b.exactScores - a.exactScores || b.completion - a.completion || a.name.localeCompare(b.name)),
    [matches, players, results]
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
      display_name: profileName.trim(),
      id: session.user.id
    });
    if (error) {
      setSyncMessage(error.message);
      return;
    }
    await loadSharedState(session);
  };

  const savePrediction = async (matchId: string, score: ScorePick) => {
    if (!supabase || !session || !hasScore(score)) return;
    const currentScoreKey = scoreKey(score);
    const match = matches.find((item) => item.id === matchId);
    if (match && isPredictionLocked(match)) {
      setSyncMessage("Predictions lock two hours before kickoff.");
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
    setSyncMessage(error ? error.message : "Prediction saved.");
  };

  const saveResult = async (matchId: string, score: ScorePick) => {
    if (!supabase || !hasScore(score)) return;
    const { error } = await supabase
      .from("matches")
      .update({ away_score: Number(score.away), home_score: Number(score.home) })
      .eq("id", matchId);
    setSyncMessage(error ? error.message : "Actual score saved.");
  };

  const updateActiveMatchScore = (matchId: string, score: ScorePick) => {
    if (!activePlayer) return;
    const match = matches.find((item) => item.id === matchId);
    if (match && isPredictionLocked(match)) {
      setSyncMessage("Predictions lock two hours before kickoff.");
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

  const addPlayer = () => {
    const trimmedName = newPlayerName.trim();
    if (!trimmedName) return;
    const player = createPlayer(trimmedName);
    setPlayers((currentPlayers) => [...currentPlayers, player]);
    setActivePlayerId(player.id);
    setNewPlayerName("");
  };

  const resetGame = () => {
    if (isSupabaseConfigured) {
      setSyncMessage("Shared games are reset from Supabase, not from the browser.");
      return;
    }
    if (!window.confirm("Reset all players, match predictions, and actual scores?")) return;
    const starterPlayer = createPlayer("Alex");
    setPlayers([starterPlayer]);
    setPredictionSaveStatus({});
    setActivePlayerId(starterPlayer.id);
    setActiveView("group");
    setActiveDateFilter("all");
    setActiveGroupFilter("all");
    setActiveTeamFilter("all");
    setShowUpcomingOnly(false);
    setHideCompleted(false);
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
    const revealed = arePredictionsRevealed(match);
    const canEditPrediction = !isSupabaseConfigured || !locked;
    const needsPick = !hasScore(predictedScore) && !locked;
    const priorityPick = isPriorityPick(match, predictedScore);

    return (
      <article className={`match-row ${priorityPick ? "priority" : needsPick ? "needs-pick" : ""}`} key={match.id}>
        <div>
          <div className="match-meta">
            <p className="eyebrow">{match.label}</p>
            {priorityPick ? <span className="urgency-badge">Priority</span> : needsPick ? <span className="urgency-badge soft">Needs pick</span> : null}
          </div>
          <TeamLine match={match} />
          <small className="match-kickoff">{formatKickoff(match)}</small>
          <small className="match-venue">{match.venue && match.city ? `${match.venue}, ${match.city}` : match.city || match.venue}</small>
          <small className={revealed ? "match-lock open" : locked ? "match-lock locked" : "match-lock"}>
            {revealed ? "Picks visible" : locked ? "Picks locked, visible at kickoff" : match.kickoffAt ? `Picks lock ${formatLockDeadline(match)}` : "Lock time TBC"}
          </small>
        </div>
        <ScoreInputs
          disabled={!canEditPrediction}
          label={`${activePlayer?.name ?? "Player"}'s prediction for ${match.label}`}
          match={match}
          onChange={(score) => updateActiveMatchScore(match.id, score)}
          saveStatus={predictionStatus}
          score={predictedScore}
        />
        <ScoreInputs
          disabled={isSupabaseConfigured && !isAdmin}
          label={`Actual score for ${match.label}`}
          match={match}
          onChange={(score) => updateResultScore(match.id, score)}
          score={actualScore}
        />
        <strong className={`match-points ${points === 3 ? "exact" : points === 1 ? "outcome" : ""}`}>{points}</strong>
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
            Pick the score for every group-stage game. Exact scorelines earn 3 points; the right winner, including a
            draw, earns 1 point. Picks lock two hours before kickoff and stay private until the match starts.
          </p>
          <div className="action-row predictor-actions">
            <button className="button secondary" onClick={resetGame} type="button">
              Reset game
            </button>
          </div>
        </div>
        <div className="pitch-visual" aria-hidden="true">
          <div className="pitch-line center" />
          <div className="pitch-line box top" />
          <div className="pitch-line box bottom" />
          <div className="football">⚽</div>
          <span>{matches.length} group games</span>
          <strong>{resultCount} scored</strong>
        </div>
      </header>

      {isSupabaseConfigured && !session ? (
        <section className="panel auth-panel">
          <div>
            <p className="eyebrow">Shared family game</p>
            <h2>Sign in to save your picks</h2>
            <p className="muted-copy">We&apos;ll email you a magic link. Your predictions are tied to your email, lock two hours before kickoff, and stay hidden from everyone else until each match starts.</p>
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
            <button className="button" onClick={saveProfile} type="button">
              Save
            </button>
          </div>
          {syncMessage ? <p className="sync-message">{syncMessage}</p> : null}
        </section>
      ) : null}

      {(!isSupabaseConfigured || (session && profileReady && activePlayer)) && (
        <section className="predictor-grid">
          <aside className="panel predictor-sidebar">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Players</p>
                <h2>Family leaderboard</h2>
              </div>
            </div>
            {isSupabaseConfigured ? (
              <div className="sync-card">
                <strong>{session?.user.email}</strong>
                <span>Shared Supabase game</span>
                <button className="text-button" onClick={signOut} type="button">
                  Sign out
                </button>
              </div>
            ) : null}
            <div className="player-list">
              {standings.map((player, index) => (
                <button
                  className={`player-row ${player.id === activePlayer?.id ? "active" : ""}`}
                  disabled={isSupabaseConfigured && player.id !== session?.user.id}
                  key={player.id}
                  onClick={() => setActivePlayerId(player.id)}
                  type="button"
                >
                  <span className="rank">#{index + 1}</span>
                  <span>
                    <strong>{player.name}</strong>
                    <small>
                      {player.completion}% complete · {player.exactScores} exact
                    </small>
                  </span>
                  <b>{player.score}</b>
                </button>
              ))}
            </div>
            {!isSupabaseConfigured ? (
              <div className="add-player">
                <input
                  aria-label="New player name"
                  onChange={(event) => setNewPlayerName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addPlayer();
                  }}
                  placeholder="Add player"
                  value={newPlayerName}
                />
                <button className="button" onClick={addPlayer} type="button">
                  Add
                </button>
              </div>
            ) : null}
            <div className="scoring-list">
              {scoringRules.map((rule) => (
                <div key={rule.label}>
                  <span>{rule.label}</span>
                  <strong>{rule.points}</strong>
                </div>
              ))}
            </div>
            {syncMessage ? <p className="sync-message">{syncMessage}</p> : null}
          </aside>

          <div className="predictor-main">
            <section className="panel match-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Prediction sheet</p>
                  <h2>{activePlayer?.name}&apos;s match picks</h2>
                </div>
                <span className="badge ok">
                  {activePlayer ? completedCount(activePlayer.matchPredictions, matches) : 0} / {matches.length} picked
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

                <div className="quick-filters" aria-label="Quick match filters">
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
                    : `${filteredMatches.length} ${filteredMatches.length === 1 ? "match" : "matches"} shown`}
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

            <section className="panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Bragging rights</p>
                  <h2>Score breakdown</h2>
                </div>
              </div>
              <div className="prediction-summary">
                {standings.map((player) => (
                  <article key={player.id}>
                    <strong>{player.name}</strong>
                    <span>Total: {player.score} points</span>
                    <span>Exact scores: {player.exactScores}</span>
                    <span>Predictions visible: {completedCount(player.matchPredictions, matches)} / {matches.length}</span>
                    <small>
                      {isSupabaseConfigured
                        ? "Other players' predictions appear here after kickoff."
                        : "Scores update as actual results are entered."}
                    </small>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>
      )}
    </main>
  );
}
