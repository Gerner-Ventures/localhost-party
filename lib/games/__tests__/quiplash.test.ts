import { describe, it, expect } from "vitest";
import {
  initializeQuiplashGame,
  handleVote,
  advanceToNextRound,
  handleSubmission,
  calculateRoundScores,
  updatePlayerScores,
  applyScoresToPlayers,
  DEFAULT_QUIPLASH_CONFIG,
} from "../quiplash";
import { Player } from "../../types/player";

const POINTS_PER_VOTE = DEFAULT_QUIPLASH_CONFIG.pointsPerVote;

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
    it("should compute roundResults when all players have voted", () => {
      const players = createPlayers();
      let gameState = initializeQuiplashGame("TEST", players);

      // Submit answers
      gameState = handleSubmission(gameState, "player1", "Alice", "Answer 1");
      gameState = handleSubmission(gameState, "player2", "Bob", "Answer 2");
      gameState = handleSubmission(gameState, "player3", "Charlie", "Answer 3");

      expect(gameState.phase).toBe("vote");

      // All players vote: player1->player2, player2->player3, player3->player2
      gameState = handleVote(gameState, "player1", "Alice", "player2");
      expect(gameState.phase).toBe("vote"); // Not all voted yet

      gameState = handleVote(gameState, "player2", "Bob", "player3");
      expect(gameState.phase).toBe("vote"); // Not all voted yet

      gameState = handleVote(gameState, "player3", "Charlie", "player2");

      // Now all players have voted - phase transitions to results
      expect(gameState.phase).toBe("results");

      // roundResults should be populated with computed scores
      // player2 got 2 votes, player3 got 1 vote, player1 got 0 votes
      expect(gameState.roundResults).toEqual({
        player1: 0,
        player2: 2 * POINTS_PER_VOTE,
        player3: 1 * POINTS_PER_VOTE,
      });

      // NOTE: players array is NOT updated by handleVote() - that's the server's job
      // This separation keeps game logic pure (computing) vs side effects (applying)
      expect(gameState.players.every((p) => p.score === 0)).toBe(true);
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
      // roundResults should be empty (not yet computed)
      expect(gameState.roundResults).toEqual({});
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

    it("should reject votes for invalid player IDs", () => {
      const players = createPlayers();
      let gameState = initializeQuiplashGame("TEST", players);

      // Submit answers
      gameState = handleSubmission(gameState, "player1", "Alice", "Answer 1");
      gameState = handleSubmission(gameState, "player2", "Bob", "Answer 2");
      gameState = handleSubmission(gameState, "player3", "Charlie", "Answer 3");

      // Try to vote for a non-existent player
      const beforeVotes = gameState.votes?.length || 0;
      gameState = handleVote(
        gameState,
        "player1",
        "Alice",
        "invalid-player-id"
      );
      const afterVotes = gameState.votes?.length || 0;

      expect(afterVotes).toBe(beforeVotes); // Vote should not be recorded
    });
  });

  describe("updatePlayerScores", () => {
    it("should apply round scores to players correctly", () => {
      const players = createPlayers();
      const roundScores = {
        player1: 0,
        player2: 2 * POINTS_PER_VOTE,
        player3: 1 * POINTS_PER_VOTE,
      };

      const updatedPlayers = updatePlayerScores(players, roundScores);

      expect(updatedPlayers.find((p) => p.id === "player1")?.score).toBe(0);
      expect(updatedPlayers.find((p) => p.id === "player2")?.score).toBe(
        2 * POINTS_PER_VOTE
      );
      expect(updatedPlayers.find((p) => p.id === "player3")?.score).toBe(
        1 * POINTS_PER_VOTE
      );

      // Original players should not be mutated
      expect(players.every((p) => p.score === 0)).toBe(true);
    });

    it("should accumulate scores across multiple applications", () => {
      let players = createPlayers();
      const roundScores = {
        player1: 0,
        player2: 2 * POINTS_PER_VOTE,
        player3: 1 * POINTS_PER_VOTE,
      };

      // Apply scores multiple times (simulating multiple rounds)
      players = updatePlayerScores(players, roundScores);
      players = updatePlayerScores(players, roundScores);
      players = updatePlayerScores(players, roundScores);

      // After 3 rounds
      expect(players.find((p) => p.id === "player2")?.score).toBe(
        3 * 2 * POINTS_PER_VOTE
      );
      expect(players.find((p) => p.id === "player3")?.score).toBe(
        3 * 1 * POINTS_PER_VOTE
      );
    });
  });

  describe("applyScoresToPlayers", () => {
    it("should mutate players in-place", () => {
      const players = createPlayers();
      const roundScores = {
        player1: 0,
        player2: 2 * POINTS_PER_VOTE,
        player3: 1 * POINTS_PER_VOTE,
      };

      applyScoresToPlayers(players, roundScores);

      // Scores should be applied directly to the original array
      expect(players[0].score).toBe(0);
      expect(players[1].score).toBe(2 * POINTS_PER_VOTE);
      expect(players[2].score).toBe(1 * POINTS_PER_VOTE);
    });

    it("should accumulate scores across multiple calls", () => {
      const players = createPlayers();
      const roundScores = {
        player1: 0,
        player2: 2 * POINTS_PER_VOTE,
        player3: 1 * POINTS_PER_VOTE,
      };

      applyScoresToPlayers(players, roundScores);
      applyScoresToPlayers(players, roundScores);
      applyScoresToPlayers(players, roundScores);

      expect(players.find((p) => p.id === "player2")?.score).toBe(
        3 * 2 * POINTS_PER_VOTE
      );
      expect(players.find((p) => p.id === "player3")?.score).toBe(
        3 * 1 * POINTS_PER_VOTE
      );
    });

    it("should handle empty roundScores", () => {
      const players = createPlayers();

      applyScoresToPlayers(players, {});
      expect(players.every((p) => p.score === 0)).toBe(true);

      applyScoresToPlayers(players, undefined);
      expect(players.every((p) => p.score === 0)).toBe(true);
    });
  });

  describe("advanceToNextRound", () => {
    it("should clear roundResults and advance to next round", () => {
      const players = createPlayers();
      let gameState = initializeQuiplashGame("TEST", players);

      // Submit and vote
      gameState = handleSubmission(gameState, "player1", "Alice", "Answer 1");
      gameState = handleSubmission(gameState, "player2", "Bob", "Answer 2");
      gameState = handleSubmission(gameState, "player3", "Charlie", "Answer 3");

      gameState = handleVote(gameState, "player1", "Alice", "player2");
      gameState = handleVote(gameState, "player2", "Bob", "player3");
      gameState = handleVote(gameState, "player3", "Charlie", "player2");

      // Verify roundResults was computed
      expect(gameState.roundResults).toEqual({
        player1: 0,
        player2: 2 * POINTS_PER_VOTE,
        player3: 1 * POINTS_PER_VOTE,
      });

      // Advance to next round
      gameState = advanceToNextRound(gameState);

      // roundResults should be cleared
      expect(gameState.roundResults).toEqual({});
      expect(gameState.phase).toBe("submit");
      expect(gameState.currentRound).toBe(2);
    });

    it("should transition to final results when all rounds complete", () => {
      let players = createPlayers();
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

        // Simulate server applying scores (as the server would do)
        players = updatePlayerScores(players, gameState.roundResults || {});
        gameState = { ...gameState, players };

        if (round < 3) {
          gameState = advanceToNextRound(gameState);
        }
      }

      // After 3 rounds, should transition to final results
      gameState = advanceToNextRound(gameState);
      expect(gameState.phase).toBe("results");
      expect(gameState.currentRound).toBe(3);

      // Verify cumulative scores
      // Each round: player2 gets 2 votes, player3 gets 1 vote
      // After 3 rounds: player2 = 3*200 = 600, player3 = 3*100 = 300
      expect(gameState.players.find((p) => p.id === "player2")?.score).toBe(
        3 * 2 * POINTS_PER_VOTE
      );
      expect(gameState.players.find((p) => p.id === "player3")?.score).toBe(
        3 * 1 * POINTS_PER_VOTE
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
        player2: 2 * POINTS_PER_VOTE, // 2 votes
        player3: 1 * POINTS_PER_VOTE, // 1 vote
      });
    });
  });
});
