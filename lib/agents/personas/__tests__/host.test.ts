import { describe, it, expect } from "vitest";
import { chipSterling, getHostPromptContext } from "../host";

describe("Chip Sterling persona", () => {
  describe("identity", () => {
    it("has correct id", () => {
      expect(chipSterling.id).toBe("chip-sterling");
    });

    it("has host role", () => {
      expect(chipSterling.role).toBe("host");
    });

    it("has announcer voice", () => {
      expect(chipSterling.voice).toBe("announcer");
    });

    it("has maxTokens of 80", () => {
      expect(chipSterling.maxTokens).toBe(80);
    });
  });

  describe("personality traits", () => {
    it("has high enthusiasm", () => {
      expect(chipSterling.traits.enthusiasm).toBeGreaterThanOrEqual(0.8);
    });

    it("has low snarkiness", () => {
      expect(chipSterling.traits.snarkiness).toBeLessThanOrEqual(0.3);
    });
  });

  describe("trigger configuration", () => {
    const findTrigger = (event: string) =>
      chipSterling.triggers.find((t) => t.event === event);

    it("triggers on game:started with probability 1.0", () => {
      const trigger = findTrigger("game:started");
      expect(trigger).toBeDefined();
      expect(trigger!.probability).toBe(1.0);
      expect(trigger!.priority).toBe(100);
    });

    it("triggers on player:joined in lobby only", () => {
      const trigger = findTrigger("player:joined");
      expect(trigger).toBeDefined();
      expect(trigger!.probability).toBe(0.5);
      expect(trigger!.phaseFilter).toEqual(["lobby"]);
    });

    it("triggers on phase:changed in submit phase only", () => {
      const trigger = findTrigger("phase:changed");
      expect(trigger).toBeDefined();
      expect(trigger!.probability).toBe(1.0);
      expect(trigger!.phaseFilter).toEqual(["submit"]);
    });

    it("triggers on round:complete with coin-flip probability", () => {
      const trigger = findTrigger("round:complete");
      expect(trigger).toBeDefined();
      expect(trigger!.probability).toBe(0.5);
      expect(trigger!.priority).toBe(100);
    });

    it("triggers on game:complete with guaranteed probability", () => {
      const trigger = findTrigger("game:complete");
      expect(trigger).toBeDefined();
      expect(trigger!.probability).toBe(1.0);
      expect(trigger!.priority).toBe(100);
    });

    it("does NOT trigger on matchup:started (Sam owns voting)", () => {
      expect(findTrigger("matchup:started")).toBeUndefined();
    });

    it("does NOT trigger on matchup:complete (Sam owns matchup results)", () => {
      expect(findTrigger("matchup:complete")).toBeUndefined();
    });

    it("has exactly 5 triggers", () => {
      expect(chipSterling.triggers).toHaveLength(5);
    });
  });

  describe("personality prompt", () => {
    it("identifies as good cop", () => {
      expect(chipSterling.personality).toContain("GOOD COP");
    });

    it("references David Attenborough", () => {
      expect(chipSterling.personality).toContain("David Attenborough");
    });

    it("mentions colleague Sam", () => {
      expect(chipSterling.personality).toContain("Sam");
    });

    it("specifies submit phase domain", () => {
      expect(chipSterling.personality).toContain("SUBMIT phase");
    });
  });
});

describe("getHostPromptContext", () => {
  describe("game:started", () => {
    it("includes player names", () => {
      const result = getHostPromptContext("game:started", {
        playerNames: ["Alice", "Bob", "Charlie"],
      });
      expect(result).toContain("Alice");
      expect(result).toContain("Bob");
      expect(result).toContain("Charlie");
    });

    it("mentions welcome", () => {
      const result = getHostPromptContext("game:started", {
        playerNames: ["Alice"],
      });
      expect(result.toLowerCase()).toContain("welcome");
    });
  });

  describe("player:joined", () => {
    it("includes the joining player name", () => {
      const result = getHostPromptContext("player:joined", {
        playerName: "NewPlayer",
      });
      expect(result).toContain("NewPlayer");
    });

    it("expresses welcome warmth", () => {
      const result = getHostPromptContext("player:joined", {
        playerName: "Alice",
      });
      expect(result.toLowerCase()).toContain("welcome");
    });
  });

  describe("phase:changed (submit)", () => {
    it("includes round number", () => {
      const result = getHostPromptContext("phase:changed", {
        currentRound: 2,
        totalRounds: 3,
      });
      expect(result).toContain("2");
    });

    it("includes total rounds when available", () => {
      const result = getHostPromptContext("phase:changed", {
        currentRound: 1,
        totalRounds: 3,
      });
      expect(result).toContain("3");
    });

    it("mentions submissions or creativity", () => {
      const result = getHostPromptContext("phase:changed", {
        currentRound: 1,
      });
      expect(result.toLowerCase()).toMatch(/submit|creativ/);
    });
  });

  describe("round:complete", () => {
    it("includes round number", () => {
      const result = getHostPromptContext("round:complete", {
        currentRound: 2,
      });
      expect(result).toContain("2");
    });

    it("includes winner name when provided", () => {
      const result = getHostPromptContext("round:complete", {
        currentRound: 1,
        winnerName: "Alice",
      });
      expect(result).toContain("Alice");
    });

    it("requests brief response", () => {
      const result = getHostPromptContext("round:complete", {
        currentRound: 1,
      });
      expect(result.toLowerCase()).toMatch(/short|brief|one/i);
    });
  });

  describe("game:complete", () => {
    it("includes winner from scores", () => {
      const result = getHostPromptContext("game:complete", {
        scores: { Alice: 300, Bob: 200 },
      });
      expect(result).toContain("Alice");
    });

    it("handles missing scores gracefully", () => {
      const result = getHostPromptContext("game:complete", {});
      expect(result).toBeTruthy();
      expect(result.toLowerCase()).toContain("game over");
    });

    it("requests brief response", () => {
      const result = getHostPromptContext("game:complete", {
        scores: { Alice: 300 },
      });
      expect(result.toLowerCase()).toMatch(/short|brief|one/i);
    });
  });

  describe("unknown event", () => {
    it("returns empty string", () => {
      const result = getHostPromptContext("unknown:event", {});
      expect(result).toBe("");
    });
  });
});
