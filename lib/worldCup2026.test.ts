import { describe, expect, it } from "vitest";
import { knockoutMatches, worldCupMatches } from "./worldCup2026";

describe("worldCupMatches", () => {
  it("includes the full 104-match tournament schedule with 32 knockout fixtures", () => {
    expect(worldCupMatches).toHaveLength(104);
    expect(knockoutMatches).toHaveLength(32);
    expect(worldCupMatches[0].matchNumber).toBe(1);
    expect(worldCupMatches.at(-1)?.matchNumber).toBe(104);
  });

  it("keeps knockout matches as bracket placeholders until teams are known", () => {
    const final = knockoutMatches.find((match) => match.matchNumber === 104);

    expect(final?.round).toBe("Final");
    expect(final?.homeTeam.name).toBe("Winner Match 101");
    expect(final?.awayTeam.name).toBe("Winner Match 102");
  });
});
