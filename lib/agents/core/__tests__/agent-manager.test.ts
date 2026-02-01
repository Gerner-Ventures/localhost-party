import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentManager } from "../agent-manager";
import type { GameState } from "../../../types/game";
import type { Player } from "../../../types/player";

// Mock Anthropic SDK — must be a class for `new Anthropic()` to work
vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Test response" }],
      }),
    };
  }
  return { default: MockAnthropic };
});

// Mock logger to silence output
vi.mock("../../../logger", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

function createPlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player${i + 1}`,
    name: `Player${i + 1}`,
    roomCode: "TEST",
    score: 0,
    isConnected: true,
  }));
}

function createState(overrides: Partial<GameState> = {}): GameState {
  return {
    roomCode: "TEST",
    gameType: "quiplash",
    currentRound: 1,
    phase: "lobby",
    players: createPlayers(3),
    submissions: [],
    votes: [],
    prompts: [],
    currentPromptIndex: 0,
    roundResults: {},
    timeRemaining: 60,
    ...overrides,
  };
}

describe("AgentManager", () => {
  let manager: AgentManager;

  beforeEach(() => {
    // Set API key so Anthropic client initializes
    vi.stubEnv("LH_PARTY_ANTHROPIC_API_KEY", "test-key");
    manager = new AgentManager({ enabled: true });
  });

  describe("persona registration", () => {
    it("registers Chip Sterling and Snarky Sam by default", () => {
      const personas = manager.getPersonas();
      const names = personas.map((p) => p.name);
      expect(names).toContain("Chip Sterling");
      expect(names).toContain("Snarky Sam");
    });

    it("registers exactly two personas", () => {
      expect(manager.getPersonas()).toHaveLength(2);
    });
  });

  describe("room enabled state", () => {
    it("defaults rooms to enabled", () => {
      expect(manager.isRoomEnabled("ABCD")).toBe(true);
    });

    it("can disable a specific room", () => {
      manager.setRoomEnabled("ABCD", false);
      expect(manager.isRoomEnabled("ABCD")).toBe(false);
    });

    it("can re-enable a disabled room", () => {
      manager.setRoomEnabled("ABCD", false);
      manager.setRoomEnabled("ABCD", true);
      expect(manager.isRoomEnabled("ABCD")).toBe(true);
    });

    it("returns empty responses when room is disabled", async () => {
      manager.setRoomEnabled("TEST", false);
      const state = createState({ phase: "submit" });
      const responses = await manager.handleGameStateChange("TEST", state);
      expect(responses).toEqual([]);
    });
  });

  describe("event deduplication", () => {
    // Access private method via any cast for unit testing
    const dedup = (events: { type: string }[]) => {
      const m = new AgentManager({ enabled: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (m as any).deduplicateEvents(events);
    };

    it("game:started supersedes phase:changed", () => {
      const result = dedup([
        { type: "game:started" },
        { type: "phase:changed" },
      ]);
      const types = result.map((e: { type: string }) => e.type);
      expect(types).toContain("game:started");
      expect(types).not.toContain("phase:changed");
    });

    it("matchup:started supersedes phase:changed and all:submitted", () => {
      const result = dedup([
        { type: "matchup:started" },
        { type: "phase:changed" },
        { type: "all:submitted" },
      ]);
      const types = result.map((e: { type: string }) => e.type);
      expect(types).toContain("matchup:started");
      expect(types).not.toContain("phase:changed");
      expect(types).not.toContain("all:submitted");
    });

    it("matchup:complete supersedes phase:changed and all:voted", () => {
      const result = dedup([
        { type: "matchup:complete" },
        { type: "phase:changed" },
        { type: "all:voted" },
      ]);
      const types = result.map((e: { type: string }) => e.type);
      expect(types).toContain("matchup:complete");
      expect(types).not.toContain("phase:changed");
      expect(types).not.toContain("all:voted");
    });

    it("game:complete supersedes phase:changed and round:complete", () => {
      const result = dedup([
        { type: "game:complete" },
        { type: "phase:changed" },
        { type: "round:complete" },
      ]);
      const types = result.map((e: { type: string }) => e.type);
      expect(types).toContain("game:complete");
      expect(types).not.toContain("phase:changed");
      expect(types).not.toContain("round:complete");
    });

    it("keeps unrelated events intact", () => {
      const result = dedup([
        { type: "player:joined" },
        { type: "submission:received" },
      ]);
      expect(result).toHaveLength(2);
    });
  });

  describe("event priority picking", () => {
    const pick = (types: string[]) => {
      const m = new AgentManager({ enabled: true });
      const events = types.map((type) => ({
        type,
        timestamp: Date.now(),
        context: {},
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (m as any).pickHighestPriorityEvent(events);
    };

    it("picks game:complete over everything", () => {
      const result = pick(["player:joined", "game:complete", "phase:changed"]);
      expect(result.type).toBe("game:complete");
    });

    it("picks game:started over round:complete", () => {
      const result = pick(["round:complete", "game:started"]);
      expect(result.type).toBe("game:started");
    });

    it("picks round:complete over matchup:started", () => {
      const result = pick(["matchup:started", "round:complete"]);
      expect(result.type).toBe("round:complete");
    });

    it("picks matchup:started over player:joined", () => {
      const result = pick(["player:joined", "matchup:started"]);
      expect(result.type).toBe("matchup:started");
    });

    it("returns null for empty list", () => {
      const result = pick([]);
      expect(result).toBeNull();
    });
  });

  describe("anti-repetition history", () => {
    it("records utterances per room", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = manager as any;
      m.recordUtterance("ROOM1", "Hello world");
      m.recordUtterance("ROOM1", "Goodbye world");
      m.recordUtterance("ROOM2", "Different room");

      const room1 = m.recentUtterances.get("ROOM1");
      expect(room1).toEqual(["Hello world", "Goodbye world"]);
      expect(m.recentUtterances.get("ROOM2")).toEqual(["Different room"]);
    });

    it("caps history at MAX_HISTORY (15)", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = manager as any;
      for (let i = 0; i < 20; i++) {
        m.recordUtterance("ROOM1", `Line ${i}`);
      }
      const history = m.recentUtterances.get("ROOM1");
      expect(history).toHaveLength(15);
      // Should have lines 5-19 (dropped 0-4)
      expect(history[0]).toBe("Line 5");
      expect(history[14]).toBe("Line 19");
    });

    it("resetGame preserves utterance history", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = manager as any;
      m.recordUtterance("ROOM1", "Should persist");
      manager.resetGame("ROOM1");
      expect(m.recentUtterances.get("ROOM1")).toEqual(["Should persist"]);
    });

    it("cleanupRoom clears utterance history", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = manager as any;
      m.recordUtterance("ROOM1", "Should be cleared");
      manager.cleanupRoom("ROOM1");
      expect(m.recentUtterances.get("ROOM1")).toBeUndefined();
    });
  });

  describe("resetGame", () => {
    it("clears previous state tracking", async () => {
      const state = createState({ phase: "lobby" });

      // Build up previous state
      await manager.handleGameStateChange("TEST", state);
      manager.resetGame("TEST");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((manager as any).previousStates.get("TEST")).toBeUndefined();
    });
  });

  describe("cleanupRoom", () => {
    it("clears all room-specific state", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = manager as any;

      // Set up state
      manager.setRoomEnabled("ROOM1", false);
      m.previousStates.set("ROOM1", {});
      m.recordUtterance("ROOM1", "test");

      // Cleanup
      manager.cleanupRoom("ROOM1");

      expect(m.previousStates.get("ROOM1")).toBeUndefined();
      expect(m.roomEnabledStates.get("ROOM1")).toBeUndefined();
      expect(m.recentUtterances.get("ROOM1")).toBeUndefined();
    });
  });

  describe("player name sanitization", () => {
    it("removes HTML brackets", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (manager as any).sanitizePlayerName(
        "<script>alert</script>"
      );
      expect(result).not.toContain("<");
      expect(result).not.toContain(">");
    });

    it("removes role keywords", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (manager as any).sanitizePlayerName("system admin");
      expect(result.toLowerCase()).not.toContain("system");
    });

    it("replaces newlines with spaces", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (manager as any).sanitizePlayerName("line1\nline2");
      expect(result).not.toContain("\n");
    });

    it("truncates to 20 characters", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (manager as any).sanitizePlayerName("a".repeat(50));
      expect(result.length).toBeLessThanOrEqual(20);
    });
  });

  describe("global enable/disable", () => {
    it("reports enabled when API key present", () => {
      expect(manager.isEnabled()).toBe(true);
    });

    it("can be disabled globally", () => {
      manager.setEnabled(false);
      expect(manager.isEnabled()).toBe(false);
    });
  });

  describe("first-match-wins persona selection", () => {
    it("returns at most one response per event", async () => {
      // Phase transition from lobby to submit triggers agents
      const prev = createState({ phase: "lobby" });
      const curr = createState({ phase: "submit" });

      await manager.handleGameStateChange("TEST", prev);
      const responses = await manager.handleGameStateChange("TEST", curr);

      // Should get exactly 0 or 1 response (never 2)
      expect(responses.length).toBeLessThanOrEqual(1);
    });
  });
});
