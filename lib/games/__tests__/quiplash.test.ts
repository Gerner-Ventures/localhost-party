import { describe, it, expect } from "vitest";
import {
  initializeQuiplashGame,
  handleVote,
  advanceToNextRound,
  handleSubmission,
  calculateRoundScores,
} from "../quiplash";
import { Player } from "../../types/player";

describe("Quiplash Scoring", () => {
  const createPlayers = (): Player[] => [
    {
      id: "player1",
      name: "Alice",
      roomCode: "TEST",
      score: 0,
      isConnected: true,
    },
    {
      id: "player2",
      name: "Bob",
      roomCode: "TEST",
      score: 0,
      isConnected: true,
    },
    {
      id: "player3",
      name: "Charlie",
      roomCode: "TEST",
      score: 0,
      isConnected: true,
    },
  ];

  describe("handleVote", () => {
    it("should calculate and apply scores when all players have voted", () => {
      const players = createPlayers();
      let gameState = initializeQuiplashGame("TEST", players);

      // Submit answers
      gameState = handleSubmission(gameState, "player1", "Alice", "Answer 1");
      gameState = handleSubmission(gameState, "player2", "Bob", "Answer 2");
      gameState = handleSubmission(gameState, "player3", "Charlie", "Answer 3");

      expect(gameState.phase).toBe("vote");

      // All players vote for player2
      gameState = handleVote(gameState, "player1", "Alice", "player2");
      expect(gameState.phase).toBe("vote"); // Not all voted yet

      gameState = handleVote(gameState, "player2", "Bob", "player3");
      expect(gameState.phase).toBe("vote"); // Not all voted yet

      gameState = handleVote(gameState, "player3", "Charlie", "player2");

      // Now all players have voted
      expect(gameState.phase).toBe("results");

      // Scores should be calculated immediately
      const player2 = gameState.players.find((p) => p.id === "player2");
      const player3 = gameState.players.find((p) => p.id === "player3");

      // player2 got 2 votes (from player1 and player3) = 200 points
      expect(player2?.score).toBe(200);
      // player3 got 1 vote (from player2) = 100 points
      expect(player3?.score).toBe(100);

      // roundResults should also be populated
      expect(gameState.roundResults).toEqual({
        player1: 0,
        player2: 200,
        player3: 100,
      });
    });

    it("should not calculate scores if not all players have voted", () => {
      const players = createPlayers();
      let gameState = initializeQuiplashGame("TEST", players);

      // Submit answers
      gameState = handleSubmission(gameState, "player1", "Alice", "Answer 1");
      gameState = handleSubmission(gameState, "player2", "Bob", "Answer 2");
      gameState = handleSubmission(gameState, "player3", "Charlie", "Answer 3");

      // Only 2 players vote
      gameState = handleVote(gameState, "player1", "Alice", "player2");
      gameState = handleVote(gameState, "player2", "Bob", "player3");

      expect(gameState.phase).toBe("vote");
      // Scores should still be 0
      expect(gameState.players.every((p) => p.score === 0)).toBe(true);
    });

    it("should prevent voting for yourself", () => {
      const players = createPlayers();
      let gameState = initializeQuiplashGame("TEST", players);

      // Submit answers
      gameState = handleSubmission(gameState, "player1", "Alice", "Answer 1");
      gameState = handleSubmission(gameState, "player2", "Bob", "Answer 2");
      gameState = handleSubmission(gameState, "player3", "Charlie", "Answer 3");

      // Try to vote for yourself
      const beforeVotes = gameState.votes?.length || 0;
      gameState = handleVote(gameState, "player1", "Alice", "player1");
      const afterVotes = gameState.votes?.length || 0;

      expect(afterVotes).toBe(beforeVotes); // Vote should not be recorded
    });
  });

  describe("advanceToNextRound", () => {
    it("should not recalculate scores (already done in handleVote)", () => {
      const players = createPlayers();
      let gameState = initializeQuiplashGame("TEST", players);

      // Submit and vote
      gameState = handleSubmission(gameState, "player1", "Alice", "Answer 1");
      gameState = handleSubmission(gameState, "player2", "Bob", "Answer 2");
      gameState = handleSubmission(gameState, "player3", "Charlie", "Answer 3");

      // player2 gets 2 votes, player3 gets 1 vote
      gameState = handleVote(gameState, "player1", "Alice", "player2");
      gameState = handleVote(gameState, "player2", "Bob", "player3"); // Can't vote for self, vote for player3
      gameState = handleVote(gameState, "player3", "Charlie", "player2");

      // player2 has 2 votes = 200 points
      const scoreAfterVoting = gameState.players.find(
        (p) => p.id === "player2"
      )?.score;
      expect(scoreAfterVoting).toBe(200);

      // Advance to next round
      gameState = advanceToNextRound(gameState);

      // Score should remain the same (not doubled)
      const scoreAfterAdvance = gameState.players.find(
        (p) => p.id === "player2"
      )?.score;
      expect(scoreAfterAdvance).toBe(200);
      expect(gameState.phase).toBe("submit");
      expect(gameState.currentRound).toBe(2);
    });

    it("should transition to final results when all rounds complete", () => {
      const players = createPlayers();
      let gameState = initializeQuiplashGame("TEST", players);

      // Play through all 3 rounds
      for (let round = 1; round <= 3; round++) {
        // Submit
        gameState = handleSubmission(
          gameState,
          "player1",
          "Alice",
          `R${round} A1`
        );
        gameState = handleSubmission(
          gameState,
          "player2",
          "Bob",
          `R${round} A2`
        );
        gameState = handleSubmission(
          gameState,
          "player3",
          "Charlie",
          `R${round} A3`
        );

        // Vote
        gameState = handleVote(gameState, "player1", "Alice", "player2");
        gameState = handleVote(gameState, "player2", "Bob", "player3");
        gameState = handleVote(gameState, "player3", "Charlie", "player2");

        if (round < 3) {
          gameState = advanceToNextRound(gameState);
        }
      }

      // After 3 rounds, should transition to final results
      gameState = advanceToNextRound(gameState);
      expect(gameState.phase).toBe("results");
      expect(gameState.currentRound).toBe(3);

      // Verify cumulative scores
      // Each round: player2 gets 2 votes (200), player3 gets 1 vote (100)
      // After 3 rounds: player2 = 600, player3 = 300
      expect(gameState.players.find((p) => p.id === "player2")?.score).toBe(
        600
      );
      expect(gameState.players.find((p) => p.id === "player3")?.score).toBe(
        300
      );
    });
  });

  describe("calculateRoundScores", () => {
    it("should correctly count votes and calculate points", () => {
      const players = createPlayers();
      const gameState = {
        roomCode: "TEST",
        gameType: "quiplash" as const,
        currentRound: 1,
        phase: "results" as const,
        players,
        prompts: [],
        submissions: [],
        votes: [
          {
            playerId: "player1",
            playerName: "Alice",
            data: "player2",
            timestamp: Date.now(),
          },
          {
            playerId: "player2",
            playerName: "Bob",
            data: "player3",
            timestamp: Date.now(),
          },
          {
            playerId: "player3",
            playerName: "Charlie",
            data: "player2",
            timestamp: Date.now(),
          },
        ],
        currentPromptIndex: 0,
        roundResults: {},
        timeRemaining: 0,
      };

      const scores = calculateRoundScores(gameState);

      expect(scores).toEqual({
        player1: 0,
        player2: 200, // 2 votes
        player3: 100, // 1 vote
      });
    });
  });
});
