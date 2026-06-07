"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { scoringRules, worldCupGroups, worldCupMatches, type GroupId, type WorldCupMatch } from "@/lib/worldCup2026";

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
  kickoffAt?: string;
};

type MatchRow = {
  away_code: string;
  away_flag: string;
  away_name: string;
  away_score: number | null;
  group_id: GroupId;
  home_code: string;
  home_flag: string;
  home_name: string;
  home_score: number | null;
  id: string;
  kickoff_at: string;
  label: string;
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

type SavedState = {
  activeGroup: GroupId | "all";
  activePlayerId: string;
  players: Player[];
  results: Record<string, ScorePick>;
};

const STORAGE_KEY = "world-cup-2026-family-predictor";

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

const isMatchLocked = (match: MatchWithState) => Boolean(match.kickoffAt && new Date(match.kickoffAt).getTime() <= Date.now());

const formatKickoff = (match: MatchWithState) =>
  match.kickoffAt ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(match.kickoffAt)) : "Kickoff TBC";

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
  groupId: row.group_id,
  homeScore: row.home_score,
  homeTeam: { code: row.home_code, flag: row.home_flag, name: row.home_name },
  id: row.id,
  kickoffAt: row.kickoff_at,
  label: row.label,
  round: "Group stage"
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
  score
}: {
  disabled?: boolean;
  label: string;
  match: MatchWithState;
  onChange: (score: ScorePick) => void;
  score: ScorePick;
}) {
  const updateScore = (side: keyof ScorePick, value: string) => {
    const cleanValue = value === "" ? "" : String(Math.max(0, Math.floor(Number(value))));
    onChange({ ...score, [side]: cleanValue });
  };

  return (
    <div className={`score-entry ${disabled ? "disabled" : ""}`} aria-label={label}>
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
  const [activeGroup, setActiveGroup] = useState<GroupId | "all">("all");
  const [results, setResults] = useState<Record<string, ScorePick>>(emptyMatchScores);
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
          setActiveGroup(parsed.activeGroup || "all");
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
      supabase.from("matches").select("*").order("id"),
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
    predictions.forEach((prediction) => {
      const player = sharedPlayers.find((item) => item.id === prediction.player_id);
      if (!player) return;
      player.matchPredictions[prediction.match_id] = {
        away: String(prediction.away_score),
        home: String(prediction.home_score)
      };
    });

    setMatches(sharedMatches);
    setResults(sharedResults);
    setPlayers(sharedPlayers);
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeGroup, activePlayerId, players, results }));
  }, [activeGroup, activePlayerId, isLoaded, players, results]);

  const activePlayer = players.find((player) => player.id === activePlayerId) ?? players[0];
  const filteredMatches = activeGroup === "all" ? matches : matches.filter((match) => match.groupId === activeGroup);
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
    const { error } = await supabase.from("predictions").upsert({
      away_score: Number(score.away),
      home_score: Number(score.home),
      match_id: matchId,
      player_id: session.user.id
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
    setActivePlayerId(starterPlayer.id);
    setActiveGroup("all");
    setResults(emptyMatchScores());
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
            draw, earns 1 point. In shared mode, everyone&apos;s predictions stay private until kickoff.
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
            <p className="muted-copy">We&apos;ll email you a magic link. Your predictions are tied to your email and hidden from everyone else until each match kicks off.</p>
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

              <div className="group-tabs" aria-label="Filter matches by group">
                <button className={activeGroup === "all" ? "active" : ""} onClick={() => setActiveGroup("all")} type="button">
                  All
                </button>
                {worldCupGroups.map((group) => (
                  <button
                    className={activeGroup === group.id ? "active" : ""}
                    key={group.id}
                    onClick={() => setActiveGroup(group.id)}
                    type="button"
                  >
                    {group.id}
                  </button>
                ))}
              </div>

              <div className="match-table">
                <div className="match-table-head">
                  <span>Match</span>
                  <span>Your score</span>
                  <span>Actual score</span>
                  <span>Pts</span>
                </div>
                {filteredMatches.map((match) => {
                  const predictedScore = normalizeScore(activePlayer?.matchPredictions[match.id]);
                  const actualScore = normalizeScore(results[match.id]);
                  const points = matchPoints(predictedScore, actualScore);
                  const locked = isMatchLocked(match);
                  const canEditPrediction = !isSupabaseConfigured || !locked;

                  return (
                    <article className="match-row" key={match.id}>
                      <div>
                        <p className="eyebrow">{match.label}</p>
                        <TeamLine match={match} />
                        <small className={locked ? "match-lock open" : "match-lock"}>
                          {locked ? "Picks visible" : `Private until ${formatKickoff(match)}`}
                        </small>
                      </div>
                      <ScoreInputs
                        disabled={!canEditPrediction}
                        label={`${activePlayer?.name ?? "Player"}'s prediction for ${match.label}`}
                        match={match}
                        onChange={(score) => updateActiveMatchScore(match.id, score)}
                        score={predictedScore}
                      />
                      <ScoreInputs
                        disabled={isSupabaseConfigured && !isAdmin}
                        label={`Actual score for ${match.label}`}
                        match={match}
                        onChange={(score) => updateResultScore(match.id, score)}
                        score={actualScore}
                      />
                      <strong className={`match-points ${points === 3 ? "exact" : points === 1 ? "outcome" : ""}`}>
                        {points}
                      </strong>
                    </article>
                  );
                })}
              </div>
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
