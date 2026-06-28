import { describe, expect, it } from "vitest";
import { knockoutMatches, worldCupMatches } from "./worldCup2026";

describe("worldCupMatches", () => {
  it("includes the full 104-match tournament schedule with 32 knockout fixtures", () => {
    expect(worldCupMatches).toHaveLength(104);
    expect(knockoutMatches).toHaveLength(32);
    expect(worldCupMatches[0].matchNumber).toBe(1);
    expect(worldCupMatches.at(-1)?.matchNumber).toBe(104);
  });

  it("includes the confirmed Round of 32 teams and keeps later rounds as placeholders", () => {
    const opener = knockoutMatches.find((match) => match.matchNumber === 73);
    const final = knockoutMatches.find((match) => match.matchNumber === 104);

    expect(opener?.round).toBe("Round of 32");
    expect(opener?.homeTeam.name).toBe("South Africa");
    expect(opener?.awayTeam.name).toBe("Canada");
    expect(final?.round).toBe("Final");
    expect(final?.homeTeam.name).toBe("Winner Match 101");
    expect(final?.awayTeam.name).toBe("Winner Match 102");
  });
});
