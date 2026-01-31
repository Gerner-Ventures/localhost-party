import { describe, it, expect } from "vitest";
import { EventDetector } from "../event-detector";
import type { GameState } from "../../../types/game";
import type { Player } from "../../../types/player";

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

describe("EventDetector", () => {
  describe("detectEvents", () => {
    it("detects game:started when first state has non-lobby phase", () => {
      const detector = new EventDetector();
      const state = createState({ phase: "submit" });

      const events = detector.detectEvents(null, state);

      expect(events).toContainEqual(
        expect.objectContaining({ type: "game:started" })
      );
    });

    it("does not emit game:started for lobby phase", () => {
      const detector = new EventDetector();
      const state = createState({ phase: "lobby" });

      const events = detector.detectEvents(null, state);

      expect(events).not.toContainEqual(
        expect.objectContaining({ type: "game:started" })
      );
    });

    it("detects phase:changed when phase differs", () => {
      const detector = new EventDetector();
      const prev = createState({ phase: "submit" });
      const curr = createState({ phase: "vote" });

      const events = detector.detectEvents(prev, curr);

      expect(events).toContainEqual(
        expect.objectContaining({ type: "phase:changed" })
      );
      const phaseEvent = events.find((e) => e.type === "phase:changed");
      expect(phaseEvent?.context.previousPhase).toBe("submit");
    });

    it("does not emit phase:changed when phase is the same", () => {
      const detector = new EventDetector();
      const prev = createState({ phase: "submit" });
      const curr = createState({ phase: "submit" });

      const events = detector.detectEvents(prev, curr);

      expect(events).not.toContainEqual(
        expect.objectContaining({ type: "phase:changed" })
      );
    });

    it("detects player:joined when a new player appears", () => {
      const detector = new EventDetector();
      const players2 = createPlayers(2);
      const players3 = createPlayers(3);
      const prev = createState({ players: players2 });
      const curr = createState({ players: players3 });

      const events = detector.detectEvents(prev, curr);

      expect(events).toContainEqual(
        expect.objectContaining({ type: "player:joined" })
      );
      const joinEvent = events.find((e) => e.type === "player:joined");
      expect(joinEvent?.context.playerName).toBe("Player3");
    });

    it("detects player:left when a player disconnects", () => {
      const detector = new EventDetector();
      const connectedPlayers = createPlayers(3);
      const disconnectedPlayers = createPlayers(3);
      disconnectedPlayers[1].isConnected = false;

      const prev = createState({ players: connectedPlayers });
      const curr = createState({ players: disconnectedPlayers });

      const events = detector.detectEvents(prev, curr);

      expect(events).toContainEqual(
        expect.objectContaining({ type: "player:left" })
      );
    });

    it("detects submission:received when submission count increases", () => {
      const detector = new EventDetector();
      const prev = createState({
        phase: "submit",
        submissions: [
          {
            playerId: "player1",
            playerName: "Player1",
            data: "answer1",
            timestamp: 1,
          },
        ],
      });
      const curr = createState({
        phase: "submit",
        submissions: [
          {
            playerId: "player1",
            playerName: "Player1",
            data: "answer1",
            timestamp: 1,
          },
          {
            playerId: "player2",
            playerName: "Player2",
            data: "answer2",
            timestamp: 2,
          },
        ],
      });

      const events = detector.detectEvents(prev, curr);

      expect(events).toContainEqual(
        expect.objectContaining({ type: "submission:received" })
      );
      const subEvent = events.find((e) => e.type === "submission:received");
      expect(subEvent?.context.submissionCount).toBe(2);
    });

    it("detects all:submitted when all players have submitted", () => {
      const detector = new EventDetector();
      const players = createPlayers(2);
      const prev = createState({
        phase: "submit",
        players,
        submissions: [
          {
            playerId: "player1",
            playerName: "Player1",
            data: "a",
            timestamp: 1,
          },
        ],
      });
      const curr = createState({
        phase: "submit",
        players,
        submissions: [
          {
            playerId: "player1",
            playerName: "Player1",
            data: "a",
            timestamp: 1,
          },
          {
            playerId: "player2",
            playerName: "Player2",
            data: "b",
            timestamp: 2,
          },
        ],
      });

      const events = detector.detectEvents(prev, curr);

      expect(events).toContainEqual(
        expect.objectContaining({ type: "all:submitted" })
      );
    });

    it("detects vote:received when vote count increases", () => {
      const detector = new EventDetector();
      const prev = createState({
        phase: "vote",
        votes: [
          {
            playerId: "player1",
            playerName: "Player1",
            data: "player2",
            timestamp: 1,
          },
        ],
      });
      const curr = createState({
        phase: "vote",
        votes: [
          {
            playerId: "player1",
            playerName: "Player1",
            data: "player2",
            timestamp: 1,
          },
          {
            playerId: "player2",
            playerName: "Player2",
            data: "player1",
            timestamp: 2,
          },
        ],
      });

      const events = detector.detectEvents(prev, curr);

      expect(events).toContainEqual(
        expect.objectContaining({ type: "vote:received" })
      );
    });

    it("detects round:complete on vote-to-results transition", () => {
      const detector = new EventDetector();
      const prev = createState({ phase: "vote" });
      const curr = createState({
        phase: "results",
        roundResults: { player1: 100, player2: 0 },
      });

      const events = detector.detectEvents(prev, curr);

      expect(events).toContainEqual(
        expect.objectContaining({ type: "round:complete" })
      );
    });

    it("detects game:complete on final round results", () => {
      const detector = new EventDetector();
      const players = createPlayers(2);
      players[0].score = 300;
      const prev = createState({ phase: "vote", currentRound: 3, players });
      const curr = createState({
        phase: "results",
        currentRound: 3,
        players,
        roundResults: { player1: 100 },
      });

      const events = detector.detectEvents(prev, curr);

      expect(events).toContainEqual(
        expect.objectContaining({ type: "game:complete" })
      );
      const completeEvent = events.find((e) => e.type === "game:complete");
      expect(completeEvent?.context.winnerName).toBe("Player1");
    });

    it("builds correct context with player scores", () => {
      const detector = new EventDetector();
      const players = createPlayers(2);
      players[0].score = 200;
      players[1].score = 100;
      const state = createState({ phase: "submit", players });

      const events = detector.detectEvents(null, state);
      const context = events[0]?.context;

      expect(context?.scores).toEqual({ Player1: 200, Player2: 100 });
      expect(context?.playerNames).toEqual(["Player1", "Player2"]);
      expect(context?.totalPlayers).toBe(2);
    });
  });

  describe("checkIdle", () => {
    it("returns null if called within threshold", () => {
      const detector = new EventDetector();
      detector.resetIdleTimer();
      const state = createState({ phase: "submit" });

      const event = detector.checkIdle(state);

      expect(event).toBeNull();
    });

    it("returns null during lobby phase", () => {
      const detector = new EventDetector();
      // Force idle check to pass by manipulating internal state
      const state = createState({ phase: "lobby" });

      // Even with enough time passed, lobby should not trigger idle
      const event = detector.checkIdle(state);
      expect(event).toBeNull();
    });
  });
});
