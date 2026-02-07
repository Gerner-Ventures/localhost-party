/**
 * Shared Game Handlers
 *
 * Centralized game logic used by both the main server (server.ts)
 * and the standalone WebSocket server (websocket-server/server.ts).
 *
 * This ensures consistent behavior across deployment environments.
 */

import type { GameState, GameType } from "../types/game";
import type { Player } from "../types/player";
import type {
  PixelShowdownState,
  TriviaQuestion,
} from "../types/pixel-showdown";
import { initializeQuiplashGame } from "./quiplash";
import {
  initializePixelShowdownGame,
  handleAnswer as handleTriviaAnswerInternal,
  judgeMultipleChoiceAnswer,
  applyJudgment,
  updateStreak,
  applyPointsToPlayer,
  allPlayersAnswered,
  transitionToAnswerReveal,
  transitionToLeaderboard,
  advanceToNextQuestion,
  advanceToNextRound as advanceToNextTriviaRound,
  setQuestionQueue,
  startQuestions,
  getRandomCategory,
  getDifficultyForRound,
} from "./pixel-showdown";

/** Minimum and maximum player counts per game type */
const PLAYER_LIMITS: Record<GameType, { min: number; max: number }> = {
  quiplash: { min: 3, max: 8 },
  "pixel-showdown": { min: 2, max: 10 },
};

/**
 * Validate player count for a game type.
 * Returns an error message if invalid, or null if valid.
 */
export function validatePlayerCount(
  gameType: GameType,
  playerCount: number
): string | null {
  const limits = PLAYER_LIMITS[gameType];
  if (!limits) return null; // Unknown games have no limits
  if (playerCount < limits.min) {
    return `${gameType} requires at least ${limits.min} players (got ${playerCount})`;
  }
  if (playerCount > limits.max) {
    return `${gameType} supports at most ${limits.max} players (got ${playerCount})`;
  }
  return null;
}

/**
 * Result of initializing a game
 */
export interface GameInitResult {
  gameState: GameState | PixelShowdownState;
  /** For pixel-showdown: async function to generate and set questions */
  generateQuestions?: () => Promise<void>;
}

/**
 * Initialize a game based on type.
 * Throws if the player count is outside the allowed range for the game.
 */
export function initializeGame(
  gameType: GameType,
  roomCode: string,
  players: Player[]
): GameInitResult {
  const validationError = validatePlayerCount(gameType, players.length);
  if (validationError) {
    throw new Error(validationError);
  }

  switch (gameType) {
    case "quiplash":
      return {
        gameState: initializeQuiplashGame(roomCode, players),
      };

    case "pixel-showdown":
      return {
        gameState: initializePixelShowdownGame(roomCode, players),
      };

    default:
      // For unimplemented games, return a basic game state
      return {
        gameState: {
          roomCode,
          gameType,
          currentRound: 1,
          phase: "prompt",
          players,
        },
      };
  }
}

/**
 * Configuration for question generation
 */
export interface QuestionGenerationConfig {
  apiBaseUrl: string;
  state: PixelShowdownState;
  onQuestionsReady: (questions: TriviaQuestion[], category: string) => void;
  onError: (error: Error) => void;
}

/**
 * Generate questions for a trivia round
 */
export async function generateTriviaQuestions(
  config: QuestionGenerationConfig
): Promise<void> {
  const { apiBaseUrl, state, onQuestionsReady, onError } = config;
  const category = getRandomCategory(state.config);
  const difficulty = getDifficultyForRound(state.currentRound, state.config);

  try {
    const response = await fetch(`${apiBaseUrl}/api/trivia/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        difficulty,
        count: state.config.questionsPerRound,
      }),
    });

    const data = await response.json();

    if (data.questions && data.questions.length > 0) {
      onQuestionsReady(data.questions, data.category || category);
    } else {
      onError(new Error("No questions returned from API"));
    }
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Result of handling a trivia answer
 */
export interface TriviaAnswerResult {
  updatedState: PixelShowdownState;
  isCorrect: boolean;
  pointsAwarded: number;
  allAnswered: boolean;
}

/**
 * Handle a trivia answer (for multiple choice - synchronous)
 */
export function handleTriviaAnswerMC(
  state: PixelShowdownState,
  playerId: string,
  playerName: string,
  answer: string,
  timestamp: number,
  players: Player[]
): TriviaAnswerResult {
  // Record the answer
  let updatedState = handleTriviaAnswerInternal(
    state,
    playerId,
    playerName,
    answer,
    timestamp
  );

  const currentQuestion = updatedState.currentQuestion!;
  const isCorrect = judgeMultipleChoiceAnswer(currentQuestion, answer);

  // Apply judgment and streak
  updatedState = applyJudgment(updatedState, playerId, isCorrect);
  updatedState = updateStreak(updatedState, playerId, isCorrect);

  // Apply points if correct
  let pointsAwarded = 0;
  if (isCorrect) {
    const playerAnswer = updatedState.answers.find(
      (a) => a.playerId === playerId
    );
    if (playerAnswer?.pointsAwarded) {
      pointsAwarded = playerAnswer.pointsAwarded;
      applyPointsToPlayer(players, playerId, pointsAwarded);
    }
  }

  return {
    updatedState,
    isCorrect,
    pointsAwarded,
    allAnswered: allPlayersAnswered(updatedState),
  };
}

/**
 * Configuration for AI answer judging
 */
export interface AIJudgeConfig {
  apiBaseUrl: string;
  questionText: string;
  correctAnswer: string;
  playerAnswer: string;
  acceptableAnswers?: string[];
}

/**
 * Judge a free-text answer using AI
 */
export async function judgeTriviaAnswerAI(
  config: AIJudgeConfig
): Promise<{ isCorrect: boolean; confidence: number }> {
  const {
    apiBaseUrl,
    questionText,
    correctAnswer,
    playerAnswer,
    acceptableAnswers,
  } = config;

  const response = await fetch(`${apiBaseUrl}/api/trivia/judge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      questionText,
      correctAnswer,
      playerAnswer,
      acceptableAnswers,
    }),
  });

  const judgment = await response.json();
  return {
    isCorrect: Boolean(judgment.isCorrect),
    confidence: judgment.confidence || 0.5,
  };
}

/**
 * Handle a trivia answer (for free text - requires async AI judging)
 */
export async function handleTriviaAnswerFreeText(
  state: PixelShowdownState,
  playerId: string,
  playerName: string,
  answer: string,
  timestamp: number,
  players: Player[],
  apiBaseUrl: string
): Promise<TriviaAnswerResult> {
  // Record the answer
  let updatedState = handleTriviaAnswerInternal(
    state,
    playerId,
    playerName,
    answer,
    timestamp
  );

  const currentQuestion = updatedState.currentQuestion!;

  // Use AI to judge
  const judgment = await judgeTriviaAnswerAI({
    apiBaseUrl,
    questionText: currentQuestion.text,
    correctAnswer: currentQuestion.correctAnswer,
    playerAnswer: answer,
    acceptableAnswers: currentQuestion.acceptableAnswers,
  });

  const isCorrect = judgment.isCorrect;

  // Apply judgment and streak
  updatedState = applyJudgment(
    updatedState,
    playerId,
    isCorrect,
    judgment.confidence
  );
  updatedState = updateStreak(updatedState, playerId, isCorrect);

  // Apply points if correct
  let pointsAwarded = 0;
  if (isCorrect) {
    const playerAnswer = updatedState.answers.find(
      (a) => a.playerId === playerId
    );
    if (playerAnswer?.pointsAwarded) {
      pointsAwarded = playerAnswer.pointsAwarded;
      applyPointsToPlayer(players, playerId, pointsAwarded);
    }
  }

  return {
    updatedState,
    isCorrect,
    pointsAwarded,
    allAnswered: allPlayersAnswered(updatedState),
  };
}

/**
 * Transition trivia state after all players answered
 */
export function transitionAfterAllAnswered(
  state: PixelShowdownState
): PixelShowdownState {
  return transitionToAnswerReveal(state);
}

/**
 * Transition to leaderboard
 */
export function transitionToLeaderboardPhase(
  state: PixelShowdownState
): PixelShowdownState {
  return transitionToLeaderboard(state);
}

/**
 * Advance to next question or round results
 */
export function advanceTrivia(state: PixelShowdownState): PixelShowdownState {
  return advanceToNextQuestion(state);
}

/**
 * Advance to next round
 */
export function advanceTriviaRound(
  state: PixelShowdownState
): PixelShowdownState {
  return advanceToNextTriviaRound(state);
}

/**
 * Set questions for a trivia round
 */
export function setTriviaQuestions(
  state: PixelShowdownState,
  questions: TriviaQuestion[],
  category?: string
): PixelShowdownState {
  const updatedState = setQuestionQueue(state, questions);
  // Store the category if provided, or derive from first question
  const resolvedCategory = category || questions[0]?.category;
  return resolvedCategory
    ? { ...updatedState, currentCategory: resolvedCategory }
    : updatedState;
}

/**
 * Start showing questions (transition from category_announce to question)
 */
export function startTriviaQuestions(
  state: PixelShowdownState
): PixelShowdownState {
  return startQuestions(state);
}

/**
 * Check if game type is supported
 */
export function isGameTypeSupported(gameType: GameType): boolean {
  return ["quiplash", "pixel-showdown"].includes(gameType);
}

/**
 * Get the API base URL for the current environment
 */
export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_LH_PARTY_APP_URL || "http://localhost:3000";
}
