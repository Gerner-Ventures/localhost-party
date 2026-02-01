import { describe, it, expect } from "vitest";
import {
  initializePixelShowdownGame,
  handleAnswer,
  judgeMultipleChoiceAnswer,
  calculatePoints,
  applyJudgment,
  updateStreak,
  allPlayersAnswered,
  transitionToAnswerReveal,
  transitionToLeaderboard,
  advanceToNextQuestion,
  advanceToNextRound,
  transitionToRoundResults,
  transitionToGameResults,
  setQuestionQueue,
  startQuestions,
  getStandings,
  applyPointsToPlayer,
} from "../pixel-showdown";
import type { Player } from "../../types/player";
import type { TriviaQuestion } from "../../types/pixel-showdown";

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

const createMockQuestion = (
  overrides: Partial<TriviaQuestion> = {}
): TriviaQuestion => ({
  id: "q1",
  text: "What is 2+2?",
  type: "multiple_choice",
  correctAnswer: "4",
  options: ["3", "4", "5", "6"],
  timeLimit: 10,
  pointValue: 100,
  category: "Math",
  difficulty: "easy",
  ...overrides,
});

describe("Pixel Showdown Game Logic", () => {
  describe("initializePixelShowdownGame", () => {
    it("should create initial game state with correct values", () => {
      const players = createPlayers();
      const state = initializePixelShowdownGame("TEST", players);

      expect(state.roomCode).toBe("TEST");
      expect(state.gameType).toBe("pixel-showdown");
      expect(state.currentRound).toBe(1);
      expect(state.phase).toBe("category_announce");
      expect(state.players).toEqual(players);
      expect(state.questionNumber).toBe(0);
      expect(state.answers).toEqual([]);
      expect(state.questionQueue).toEqual([]);
    });

    it("should initialize player stats for all players", () => {
      const players = createPlayers();
      const state = initializePixelShowdownGame("TEST", players);

      for (const player of players) {
        expect(state.playerStats[player.id]).toBeDefined();
        expect(state.playerStats[player.id].currentStreak).toBe(0);
        expect(state.playerStats[player.id].longestStreak).toBe(0);
        expect(state.playerStats[player.id].totalCorrect).toBe(0);
        expect(state.playerStats[player.id].totalAnswered).toBe(0);
      }
    });

    it("should allow custom config overrides", () => {
      const players = createPlayers();
      const state = initializePixelShowdownGame("TEST", players, {
        questionsPerRound: 10,
        roundsPerGame: 5,
      });

      expect(state.questionsPerRound).toBe(10);
      expect(state.totalRounds).toBe(5);
    });
  });

  describe("setQuestionQueue and startQuestions", () => {
    it("should set questions and transition to question phase", () => {
      const players = createPlayers();
      let state = initializePixelShowdownGame("TEST", players);

      const questions = [
        createMockQuestion({ id: "q1" }),
        createMockQuestion({ id: "q2" }),
        createMockQuestion({ id: "q3" }),
      ];

      state = setQuestionQueue(state, questions);
      expect(state.questionQueue).toHaveLength(3);
      expect(state.phase).toBe("category_announce");

      state = startQuestions(state);
      expect(state.phase).toBe("question");
      expect(state.questionNumber).toBe(1);
      expect(state.currentQuestion).toEqual(questions[0]);
      expect(state.answers).toEqual([]);
    });

    it("should not start if no questions in queue", () => {
      const players = createPlayers();
      let state = initializePixelShowdownGame("TEST", players);

      // Don't add questions
      state = startQuestions(state);

      // Should remain in category_announce
      expect(state.phase).toBe("category_announce");
    });
  });

  describe("handleAnswer", () => {
    it("should record player answer", () => {
      const players = createPlayers();
      let state = initializePixelShowdownGame("TEST", players);
      state = setQuestionQueue(state, [createMockQuestion()]);
      state = startQuestions(state);

      const timestamp = Date.now();
      state = handleAnswer(state, "player1", "Alice", "4", timestamp);

      expect(state.answers).toHaveLength(1);
      expect(state.answers[0].playerId).toBe("player1");
      expect(state.answers[0].playerName).toBe("Alice");
      expect(state.answers[0].answer).toBe("4");
    });

    it("should not allow duplicate answers from same player", () => {
      const players = createPlayers();
      let state = initializePixelShowdownGame("TEST", players);
      state = setQuestionQueue(state, [createMockQuestion()]);
      state = startQuestions(state);

      const timestamp = Date.now();
      state = handleAnswer(state, "player1", "Alice", "4", timestamp);
      state = handleAnswer(state, "player1", "Alice", "5", timestamp + 1000);

      expect(state.answers).toHaveLength(1);
      expect(state.answers[0].answer).toBe("4");
    });

    it("should not accept answers outside question phase", () => {
      const players = createPlayers();
      let state = initializePixelShowdownGame("TEST", players);
      // Still in category_announce phase

      const timestamp = Date.now();
      state = handleAnswer(state, "player1", "Alice", "4", timestamp);

      expect(state.answers).toHaveLength(0);
    });
  });

  describe("judgeMultipleChoiceAnswer", () => {
    it("should return true for correct answer", () => {
      const question = createMockQuestion({ correctAnswer: "Paris" });
      expect(judgeMultipleChoiceAnswer(question, "Paris")).toBe(true);
      expect(judgeMultipleChoiceAnswer(question, "paris")).toBe(true);
      expect(judgeMultipleChoiceAnswer(question, "  PARIS  ")).toBe(true);
    });

    it("should return false for incorrect answer", () => {
      const question = createMockQuestion({ correctAnswer: "Paris" });
      expect(judgeMultipleChoiceAnswer(question, "London")).toBe(false);
      expect(judgeMultipleChoiceAnswer(question, "Berlin")).toBe(false);
    });
  });

  describe("calculatePoints", () => {
    it("should calculate base points for correct answer", () => {
      const players = createPlayers();
      let state = initializePixelShowdownGame("TEST", players);
      const question = createMockQuestion({ pointValue: 100, timeLimit: 10 });
      state = setQuestionQueue(state, [question]);
      state = startQuestions(state);

      // Answer at exactly the start time (max speed bonus)
      const startTime = state.questionStartTime!;
      const points = calculatePoints(state, "player1", startTime);

      // Base points (100) + max speed bonus (50) = 150
      expect(points).toBeGreaterThanOrEqual(100);
    });

    it("should give more points for faster answers", () => {
      const players = createPlayers();
      let state = initializePixelShowdownGame("TEST", players);
      const question = createMockQuestion({ pointValue: 100, timeLimit: 10 });
      state = setQuestionQueue(state, [question]);
      state = startQuestions(state);

      const startTime = state.questionStartTime!;
      const fastPoints = calculatePoints(state, "player1", startTime + 1000);
      const slowPoints = calculatePoints(state, "player1", startTime + 9000);

      expect(fastPoints).toBeGreaterThan(slowPoints);
    });

    it("should apply streak multiplier", () => {
      const players = createPlayers();
      let state = initializePixelShowdownGame("TEST", players);
      const question = createMockQuestion({ pointValue: 100, timeLimit: 10 });
      state = setQuestionQueue(state, [question]);
      state = startQuestions(state);

      const startTime = state.questionStartTime!;

      // No streak
      const noStreakPoints = calculatePoints(
        state,
        "player1",
        startTime + 5000
      );

      // Build a streak
      state = updateStreak(state, "player1", true);
      state = updateStreak(state, "player1", true);

      const streakPoints = calculatePoints(state, "player1", startTime + 5000);

      expect(streakPoints).toBeGreaterThan(noStreakPoints);
    });
  });

  describe("updateStreak", () => {
    it("should increment streak on correct answer", () => {
      const players = createPlayers();
      let state = initializePixelShowdownGame("TEST", players);

      expect(state.playerStats["player1"].currentStreak).toBe(0);

      state = updateStreak(state, "player1", true);
      expect(state.playerStats["player1"].currentStreak).toBe(1);

      state = updateStreak(state, "player1", true);
      expect(state.playerStats["player1"].currentStreak).toBe(2);
    });

    it("should reset streak on wrong answer", () => {
      const players = createPlayers();
      let state = initializePixelShowdownGame("TEST", players);

      state = updateStreak(state, "player1", true);
      state = updateStreak(state, "player1", true);
      expect(state.playerStats["player1"].currentStreak).toBe(2);

      state = updateStreak(state, "player1", false);
      expect(state.playerStats["player1"].currentStreak).toBe(0);
    });

    it("should track longest streak", () => {
      const players = createPlayers();
      let state = initializePixelShowdownGame("TEST", players);

      // Build streak of 3
      state = updateStreak(state, "player1", true);
      state = updateStreak(state, "player1", true);
      state = updateStreak(state, "player1", true);
      expect(state.playerStats["player1"].longestStreak).toBe(3);

      // Break streak
      state = updateStreak(state, "player1", false);
      expect(state.playerStats["player1"].currentStreak).toBe(0);
      expect(state.playerStats["player1"].longestStreak).toBe(3);

      // New streak of 2
      state = updateStreak(state, "player1", true);
      state = updateStreak(state, "player1", true);
      expect(state.playerStats["player1"].currentStreak).toBe(2);
      expect(state.playerStats["player1"].longestStreak).toBe(3);
    });

    it("should track totalCorrect and totalAnswered", () => {
      const players = createPlayers();
      let state = initializePixelShowdownGame("TEST", players);

      state = updateStreak(state, "player1", true);
      state = updateStreak(state, "player1", false);
      state = updateStreak(state, "player1", true);

      expect(state.playerStats["player1"].totalCorrect).toBe(2);
      expect(state.playerStats["player1"].totalAnswered).toBe(3);
    });
  });

  describe("allPlayersAnswered", () => {
    it("should return true when all connected players answered", () => {
      const players = createPlayers();
      let state = initializePixelShowdownGame("TEST", players);
      state = setQuestionQueue(state, [createMockQuestion()]);
      state = startQuestions(state);

      const timestamp = Date.now();
      state = handleAnswer(state, "player1", "Alice", "4", timestamp);
      expect(allPlayersAnswered(state)).toBe(false);

      state = handleAnswer(state, "player2", "Bob", "4", timestamp);
      expect(allPlayersAnswered(state)).toBe(false);

      state = handleAnswer(state, "player3", "Charlie", "4", timestamp);
      expect(allPlayersAnswered(state)).toBe(true);
    });

    it("should only count connected players", () => {
      const players = createPlayers();
      players[2].isConnected = false; // Charlie disconnected

      let state = initializePixelShowdownGame("TEST", players);
      state = setQuestionQueue(state, [createMockQuestion()]);
      state = startQuestions(state);

      const timestamp = Date.now();
      state = handleAnswer(state, "player1", "Alice", "4", timestamp);
      state = handleAnswer(state, "player2", "Bob", "4", timestamp);

      expect(allPlayersAnswered(state)).toBe(true);
    });
  });

  describe("Phase transitions", () => {
    it("should transition to answer_reveal correctly", () => {
      const players = createPlayers();
      let state = initializePixelShowdownGame("TEST", players);
      state = setQuestionQueue(state, [createMockQuestion()]);
      state = startQuestions(state);

      state = transitionToAnswerReveal(state);
      expect(state.phase).toBe("answer_reveal");
      expect(state.timeRemaining).toBe(4);
    });

    it("should transition to leaderboard correctly", () => {
      const players = createPlayers();
      let state = initializePixelShowdownGame("TEST", players);

      state = transitionToLeaderboard(state);
      expect(state.phase).toBe("leaderboard");
      expect(state.timeRemaining).toBe(4);
    });

    it("should transition to round_results correctly", () => {
      const players = createPlayers();
      let state = initializePixelShowdownGame("TEST", players);

      state = transitionToRoundResults(state);
      expect(state.phase).toBe("round_results");
      expect(state.timeRemaining).toBe(5);
      expect(state.roundResults).toBeDefined();
    });
  });

  describe("advanceToNextQuestion", () => {
    it("should advance to next question in queue", () => {
      const players = createPlayers();
      let state = initializePixelShowdownGame("TEST", players);
      const questions = [
        createMockQuestion({ id: "q1", text: "Question 1" }),
        createMockQuestion({ id: "q2", text: "Question 2" }),
        createMockQuestion({ id: "q3", text: "Question 3" }),
      ];
      state = setQuestionQueue(state, questions);
      state = startQuestions(state);

      expect(state.questionNumber).toBe(1);
      expect(state.currentQuestion?.id).toBe("q1");

      state = advanceToNextQuestion(state);
      expect(state.phase).toBe("question");
      expect(state.questionNumber).toBe(2);
      expect(state.currentQuestion?.id).toBe("q2");
      expect(state.answers).toEqual([]);
    });

    it("should transition to round_results after last question", () => {
      const players = createPlayers();
      let state = initializePixelShowdownGame("TEST", players, {
        questionsPerRound: 2,
      });
      const questions = [
        createMockQuestion({ id: "q1" }),
        createMockQuestion({ id: "q2" }),
      ];
      state = setQuestionQueue(state, questions);
      state = startQuestions(state);

      // Answer question 1, advance to question 2
      state = advanceToNextQuestion(state);
      expect(state.questionNumber).toBe(2);

      // After question 2, should go to round_results
      state = advanceToNextQuestion(state);
      expect(state.phase).toBe("round_results");
    });
  });

  describe("advanceToNextRound", () => {
    it("should advance to next round", () => {
      const players = createPlayers();
      let state = initializePixelShowdownGame("TEST", players, {
        roundsPerGame: 3,
      });
      state = { ...state, phase: "round_results" };

      expect(state.currentRound).toBe(1);

      state = advanceToNextRound(state);
      expect(state.currentRound).toBe(2);
      expect(state.phase).toBe("category_announce");
      expect(state.questionNumber).toBe(0);
      expect(state.questionQueue).toEqual([]);
      expect(state.currentCategory).toBe("Loading...");
    });

    it("should transition to game_results after final round", () => {
      const players = createPlayers();
      let state = initializePixelShowdownGame("TEST", players, {
        roundsPerGame: 3,
      });
      state = { ...state, currentRound: 3, phase: "round_results" };

      state = advanceToNextRound(state);
      expect(state.phase).toBe("game_results");
    });
  });

  describe("transitionToGameResults", () => {
    it("should set phase to game_results", () => {
      const players = createPlayers();
      let state = initializePixelShowdownGame("TEST", players);

      state = transitionToGameResults(state);
      expect(state.phase).toBe("game_results");
      expect(state.timeRemaining).toBeUndefined();
    });
  });

  describe("getStandings", () => {
    it("should return players sorted by score descending", () => {
      const players = createPlayers();
      players[0].score = 100;
      players[1].score = 300;
      players[2].score = 200;

      const state = initializePixelShowdownGame("TEST", players);
      const standings = getStandings(state);

      expect(standings[0].name).toBe("Bob");
      expect(standings[0].score).toBe(300);
      expect(standings[1].name).toBe("Charlie");
      expect(standings[1].score).toBe(200);
      expect(standings[2].name).toBe("Alice");
      expect(standings[2].score).toBe(100);
    });
  });

  describe("applyPointsToPlayer", () => {
    it("should add points to player score", () => {
      const players = createPlayers();
      expect(players[0].score).toBe(0);

      applyPointsToPlayer(players, "player1", 100);
      expect(players[0].score).toBe(100);

      applyPointsToPlayer(players, "player1", 50);
      expect(players[0].score).toBe(150);
    });

    it("should not throw for unknown player", () => {
      const players = createPlayers();

      expect(() => {
        applyPointsToPlayer(players, "unknown-player", 100);
      }).not.toThrow();
    });
  });

  describe("applyJudgment", () => {
    it("should set isCorrect and pointsAwarded on answer", () => {
      const players = createPlayers();
      let state = initializePixelShowdownGame("TEST", players);
      state = setQuestionQueue(state, [createMockQuestion()]);
      state = startQuestions(state);

      const timestamp = Date.now();
      state = handleAnswer(state, "player1", "Alice", "4", timestamp);

      state = applyJudgment(state, "player1", true);

      expect(state.answers[0].isCorrect).toBe(true);
      expect(state.answers[0].pointsAwarded).toBeGreaterThan(0);
    });

    it("should give zero points for incorrect answer", () => {
      const players = createPlayers();
      let state = initializePixelShowdownGame("TEST", players);
      state = setQuestionQueue(state, [createMockQuestion()]);
      state = startQuestions(state);

      const timestamp = Date.now();
      state = handleAnswer(state, "player1", "Alice", "wrong", timestamp);

      state = applyJudgment(state, "player1", false);

      expect(state.answers[0].isCorrect).toBe(false);
      expect(state.answers[0].pointsAwarded).toBe(0);
    });
  });
});
