import { describe, it, expect } from "vitest";
import { snarkySam, getCommentatorPromptContext } from "../commentator";

describe("Snarky Sam persona", () => {
  describe("identity", () => {
    it("has correct id", () => {
      expect(snarkySam.id).toBe("snarky-sam");
    });

    it("has commentator role", () => {
      expect(snarkySam.role).toBe("commentator");
    });

    it("has surfer voice", () => {
      expect(snarkySam.voice).toBe("surfer");
    });

    it("has maxTokens of 80", () => {
      expect(snarkySam.maxTokens).toBe(80);
    });
  });

  describe("personality traits", () => {
    it("has high snarkiness", () => {
      expect(snarkySam.traits.snarkiness).toBeGreaterThanOrEqual(0.9);
    });

    it("has low formality", () => {
      expect(snarkySam.traits.formality).toBeLessThanOrEqual(0.2);
    });
  });

  describe("trigger configuration", () => {
    const findTrigger = (event: string) =>
      snarkySam.triggers.find((t) => t.event === event);

    it("triggers on player:joined in lobby only", () => {
      const trigger = findTrigger("player:joined");
      expect(trigger).toBeDefined();
      expect(trigger!.probability).toBe(0.5);
      expect(trigger!.priority).toBe(85);
      expect(trigger!.phaseFilter).toEqual(["lobby"]);
    });

    it("does NOT trigger on matchup:started (removed)", () => {
      expect(findTrigger("matchup:started")).toBeUndefined();
    });

    it("does NOT trigger on matchup:complete (removed)", () => {
      expect(findTrigger("matchup:complete")).toBeUndefined();
    });

    it("triggers on round:complete with high probability", () => {
      const trigger = findTrigger("round:complete");
      expect(trigger).toBeDefined();
      expect(trigger!.probability).toBe(0.7);
      expect(trigger!.priority).toBe(90);
    });

    it("triggers on game:complete as guaranteed fallback", () => {
      const trigger = findTrigger("game:complete");
      expect(trigger).toBeDefined();
      expect(trigger!.probability).toBe(1.0);
      expect(trigger!.priority).toBe(90);
    });

    it("does NOT trigger on submission:received (Chip owns submit)", () => {
      expect(findTrigger("submission:received")).toBeUndefined();
    });

    it("does NOT trigger on all:submitted", () => {
      expect(findTrigger("all:submitted")).toBeUndefined();
    });

    it("does NOT trigger on idle:detected", () => {
      expect(findTrigger("idle:detected")).toBeUndefined();
    });

    it("has exactly 6 triggers", () => {
      expect(snarkySam.triggers).toHaveLength(6);
    });
  });

  describe("phase ownership", () => {
    it("Sam has higher priority than Chip for player:joined in lobby", () => {
      // Sam at 85, Chip at 80 — Sam gets first chance
      const samTrigger = snarkySam.triggers.find(
        (t) => t.event === "player:joined"
      );
      expect(samTrigger!.priority).toBe(85);
      // Chip should be 80 (validated in host.test.ts)
    });

    it("Sam has lower priority than Chip for round:complete", () => {
      // Sam at 90 with prob 1.0, Chip at 100 with prob 0.5
      // Chip gets first chance (coin flip), Sam is guaranteed fallback
      const samTrigger = snarkySam.triggers.find(
        (t) => t.event === "round:complete"
      );
      expect(samTrigger!.priority).toBe(90);
      // Chip at 100 means Chip checked first
    });

    it("Sam has lower priority than Chip for game:complete", () => {
      const samTrigger = snarkySam.triggers.find(
        (t) => t.event === "game:complete"
      );
      expect(samTrigger!.priority).toBe(90);
    });
  });

  describe("personality prompt", () => {
    it("identifies as bad cop", () => {
      expect(snarkySam.personality).toContain("BAD COP");
    });

    it("references dark humor", () => {
      expect(snarkySam.personality.toLowerCase()).toContain("dark");
    });

    it("mentions vote phase domain", () => {
      expect(snarkySam.personality).toContain("VOTE phase");
    });

    it("emphasizes referencing specific content", () => {
      expect(snarkySam.personality).toContain("ACTUAL content");
    });

    it("sets comedy boundary — not bullying", () => {
      expect(snarkySam.personality.toLowerCase()).toContain("not bullying");
    });
  });
});

describe("getCommentatorPromptContext", () => {
  describe("player:joined", () => {
    it("includes the joining player name", () => {
      const result = getCommentatorPromptContext("player:joined", {
        playerName: "NewPlayer",
      });
      expect(result).toContain("NewPlayer");
    });

    it("uses dark humor framing", () => {
      const result = getCommentatorPromptContext("player:joined", {
        playerName: "Alice",
      });
      expect(result.toLowerCase()).toMatch(/dark|suffer|compete|size/);
    });
  });

  describe("matchup:started", () => {
    it("includes round number", () => {
      const result = getCommentatorPromptContext("matchup:started", {
        currentRound: 2,
        matchupIndex: 0,
        matchupTotal: 3,
        promptText: "What is love?",
      });
      expect(result).toContain("2");
    });

    it("includes matchup number (1-indexed display)", () => {
      const result = getCommentatorPromptContext("matchup:started", {
        currentRound: 1,
        matchupIndex: 2,
        matchupTotal: 4,
        promptText: "Test prompt",
      });
      expect(result).toContain("3 of 4");
    });

    it("includes the prompt text", () => {
      const result = getCommentatorPromptContext("matchup:started", {
        currentRound: 1,
        matchupIndex: 0,
        matchupTotal: 2,
        promptText: "Why did the chicken cross the road?",
      });
      expect(result).toContain("Why did the chicken cross the road?");
    });

    it("handles zero matchupIndex", () => {
      const result = getCommentatorPromptContext("matchup:started", {
        currentRound: 1,
        matchupIndex: 0,
        matchupTotal: 2,
        promptText: "Test",
      });
      // matchupIndex 0 should display as matchup 1
      expect(result).toContain("1 of 2");
    });
  });

  describe("matchup:complete with winner", () => {
    it("includes winner name", () => {
      const result = getCommentatorPromptContext("matchup:complete", {
        matchupIndex: 0,
        matchupTotal: 3,
        matchupWinnerName: "Alice",
        matchupAnswers: ["Answer A", "Answer B"],
      });
      expect(result).toContain("Alice");
    });

    it("includes both answers", () => {
      const result = getCommentatorPromptContext("matchup:complete", {
        matchupIndex: 0,
        matchupTotal: 3,
        matchupWinnerName: "Alice",
        matchupAnswers: ["First answer text", "Second answer text"],
      });
      expect(result).toContain("First answer text");
      expect(result).toContain("Second answer text");
    });

    it("references roasting and specific content", () => {
      const result = getCommentatorPromptContext("matchup:complete", {
        matchupIndex: 0,
        matchupTotal: 2,
        matchupWinnerName: "Alice",
        matchupAnswers: ["Good answer", "Bad answer"],
      });
      expect(result.toLowerCase()).toMatch(/roast|react|reference/);
    });
  });

  describe("matchup:complete as tie", () => {
    it("handles tie (no winner)", () => {
      const result = getCommentatorPromptContext("matchup:complete", {
        matchupIndex: 1,
        matchupTotal: 3,
        matchupAnswers: ["Answer A", "Answer B"],
      });
      expect(result.toLowerCase()).toContain("tie");
    });

    it("includes both answers in tie", () => {
      const result = getCommentatorPromptContext("matchup:complete", {
        matchupIndex: 0,
        matchupTotal: 2,
        matchupAnswers: ["Tied answer 1", "Tied answer 2"],
      });
      expect(result).toContain("Tied answer 1");
      expect(result).toContain("Tied answer 2");
    });
  });

  describe("round:complete", () => {
    it("includes round number", () => {
      const result = getCommentatorPromptContext("round:complete", {
        currentRound: 2,
      });
      expect(result).toContain("2");
    });

    it("requests brief response", () => {
      const result = getCommentatorPromptContext("round:complete", {
        currentRound: 1,
      });
      expect(result.toLowerCase()).toMatch(/short|brief|one/i);
    });
  });

  describe("game:complete", () => {
    it("includes winner from scores", () => {
      const result = getCommentatorPromptContext("game:complete", {
        scores: { Alice: 500, Bob: 300 },
      });
      expect(result).toContain("Alice");
    });

    it("handles missing scores gracefully", () => {
      const result = getCommentatorPromptContext("game:complete", {});
      expect(result).toBeTruthy();
      expect(result.toLowerCase()).toContain("game over");
    });

    it("requests brief response", () => {
      const result = getCommentatorPromptContext("game:complete", {
        scores: { Alice: 100 },
      });
      expect(result.toLowerCase()).toMatch(/short|brief|one/i);
    });
  });

  describe("unknown event", () => {
    it("returns empty string", () => {
      const result = getCommentatorPromptContext("unknown:event", {});
      expect(result).toBe("");
    });
  });
});
