"use client";

import { useEffect, useMemo, useState } from "react";
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

type SavedState = {
  activeGroup: GroupId | "all";
  activePlayerId: string;
  players: Player[];
  results: Record<string, ScorePick>;
};

const STORAGE_KEY = "world-cup-2026-family-predictor";

const emptyScore = (): ScorePick => ({ away: "", home: "" });

const emptyMatchScores = () =>
  worldCupMatches.reduce(
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

const completedCount = (scores: Record<string, ScorePick>) =>
  worldCupMatches.filter((match) => hasScore(scores[match.id])).length;

const completion = (scores: Record<string, ScorePick>) =>
  Math.round((completedCount(scores) / worldCupMatches.length) * 100);

const scorePlayer = (player: Player, results: Record<string, ScorePick>) =>
  worldCupMatches.reduce((total, match) => total + matchPoints(player.matchPredictions[match.id], results[match.id]), 0);

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

function TeamLine({ match }: { match: WorldCupMatch }) {
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
  label,
  match,
  onChange,
  score
}: {
  label: string;
  match: WorldCupMatch;
  onChange: (score: ScorePick) => void;
  score: ScorePick;
}) {
  const updateScore = (side: keyof ScorePick, value: string) => {
    const cleanValue = value === "" ? "" : String(Math.max(0, Math.floor(Number(value))));
    onChange({ ...score, [side]: cleanValue });
  };

  return (
    <div className="score-entry" aria-label={label}>
      <label>
        <span>{match.homeTeam.code}</span>
        <input
          aria-label={`${label} ${match.homeTeam.name}`}
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
  const [activePlayerId, setActivePlayerId] = useState("");
  const [activeGroup, setActiveGroup] = useState<GroupId | "all">("all");
  const [results, setResults] = useState<Record<string, ScorePick>>(emptyMatchScores);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
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
        } else {
          throw new Error("No saved players");
        }
      } catch {
        const starterPlayers = ["Alex", "Family"].map(createPlayer);
        setPlayers(starterPlayers);
        setActivePlayerId(starterPlayers[0].id);
      }
    } else {
      const starterPlayers = ["Alex", "Family"].map(createPlayer);
      setPlayers(starterPlayers);
      setActivePlayerId(starterPlayers[0].id);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeGroup, activePlayerId, players, results }));
  }, [activeGroup, activePlayerId, isLoaded, players, results]);

  const activePlayer = players.find((player) => player.id === activePlayerId) ?? players[0];
  const filteredMatches = activeGroup === "all" ? worldCupMatches : worldCupMatches.filter((match) => match.groupId === activeGroup);
  const resultCount = completedCount(results);

  const standings = useMemo(
    () =>
      players
        .map((player) => ({
          ...player,
          completion: completion(player.matchPredictions),
          exactScores: worldCupMatches.filter((match) => matchPoints(player.matchPredictions[match.id], results[match.id]) === 3)
            .length,
          score: scorePlayer(player, results)
        }))
        .sort((a, b) => b.score - a.score || b.exactScores - a.exactScores || b.completion - a.completion || a.name.localeCompare(b.name)),
    [players, results]
  );

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
  };

  const updateResultScore = (matchId: string, score: ScorePick) => {
    setResults((currentResults) => ({
      ...currentResults,
      [matchId]: score
    }));
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
    if (!window.confirm("Reset all players, match predictions, and actual scores?")) return;
    const starterPlayer = createPlayer("Alex");
    setPlayers([starterPlayer]);
    setActivePlayerId(starterPlayer.id);
    setActiveGroup("all");
    setResults(emptyMatchScores());
  };

  if (!isLoaded || !activePlayer) {
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
            draw, earns 1 point.
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
          <span>{worldCupMatches.length} group games</span>
          <strong>{resultCount} scored</strong>
        </div>
      </header>

      <section className="predictor-grid">
        <aside className="panel predictor-sidebar">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Players</p>
              <h2>Family leaderboard</h2>
            </div>
          </div>
          <div className="player-list">
            {standings.map((player, index) => (
              <button
                className={`player-row ${player.id === activePlayer.id ? "active" : ""}`}
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
          <div className="scoring-list">
            {scoringRules.map((rule) => (
              <div key={rule.label}>
                <span>{rule.label}</span>
                <strong>{rule.points}</strong>
              </div>
            ))}
          </div>
        </aside>

        <div className="predictor-main">
          <section className="panel match-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Prediction sheet</p>
                <h2>{activePlayer.name}'s match picks</h2>
              </div>
              <span className="badge ok">
                {completedCount(activePlayer.matchPredictions)} / {worldCupMatches.length} picked
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
                const predictedScore = normalizeScore(activePlayer.matchPredictions[match.id]);
                const actualScore = normalizeScore(results[match.id]);
                const points = matchPoints(predictedScore, actualScore);

                return (
                  <article className="match-row" key={match.id}>
                    <div>
                      <p className="eyebrow">{match.label}</p>
                      <TeamLine match={match} />
                    </div>
                    <ScoreInputs
                      label={`${activePlayer.name}'s prediction for ${match.label}`}
                      match={match}
                      onChange={(score) => updateActiveMatchScore(match.id, score)}
                      score={predictedScore}
                    />
                    <ScoreInputs
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
                  <span>Predictions complete: {completedCount(player.matchPredictions)} / {worldCupMatches.length}</span>
                  <small>Scores update as actual results are entered.</small>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
