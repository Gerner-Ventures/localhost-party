/**
 * Pixel Showdown (Trivia) Game Contract
 *
 * Implements the GameContract interface for Pixel Showdown.
 * Wraps the existing pure functions from pixel-showdown.ts.
 */

import type { GameEventResult, GameEventContext } from "./types/game-contract";
import type {
  PixelShowdownState,
  PixelShowdownConfig,
  TriviaQuestion,
  TriviaAnswer,
  PlayerTriviaStats,
  PixelShowdownPhase,
} from "@/lib/types/pixel-showdown";
import { DEFAULT_PIXEL_SHOWDOWN_CONFIG } from "@/lib/types/pixel-showdown";
import { gameRegistry, defineGame } from "./registry";
import {
  initializePixelShowdownGame,
  handleAnswer as handleTriviaAnswer,
  handleBuzz,
  judgeMultipleChoiceAnswer,
  calculatePoints,
  applyJudgment,
  updateStreak,
  allPlayersAnswered,
  transitionToAnswerReveal,
  transitionToLeaderboard,
  advanceToNextQuestion,
  transitionToRoundResults,
  advanceToNextRound as advanceTriviaRound,
  transitionToGameResults,
  resetToLobby as resetTriviaToLobby,
  setQuestionQueue,
  startQuestions,
  applyPointsToPlayer,
  getDifficultyForRound,
  getRandomCategory,
} from "./pixel-showdown";

/**
 * All valid Pixel Showdown phases.
 */
const PIXEL_SHOWDOWN_PHASES: readonly PixelShowdownPhase[] = [
  "lobby",
  "category_announce",
  "question",
  "answer_reveal",
  "leaderboard",
  "round_results",
  "game_results",
] as const;

/**
 * Phase transition map for validation.
 */
const VALID_TRANSITIONS: Record<PixelShowdownPhase, PixelShowdownPhase[]> = {
  lobby: ["category_announce"],
  category_announce: ["question"],
  question: ["answer_reveal"],
  answer_reveal: ["leaderboard"],
  leaderboard: ["question", "round_results"],
  round_results: ["category_announce", "game_results"],
  game_results: ["lobby"],
};

/**
 * Handle trivia answer submission.
 * Supports both multiple choice (sync) and free text (async with AI judging).
 */
async function handleTriviaAnswerEvent(
  state: PixelShowdownState,
  ctx: GameEventContext,
  data: unknown
): Promise<GameEventResult<PixelShowdownState>> {
  const { answer, timestamp } = data as { answer: string; timestamp: number };
  const { playerId, playerName } = ctx;

  // Record the answer
  let newState = handleTriviaAnswer(
    state,
    playerId,
    playerName,
    answer,
    timestamp
  );

  // If no current question or already answered, return unchanged
  if (newState === state) {
    return { state };
  }

  // For multiple choice, judge immediately
  if (state.currentQuestion?.type === "multiple_choice") {
    const isCorrect = judgeMultipleChoiceAnswer(state.currentQuestion, answer);
    newState = applyJudgment(newState, playerId, isCorrect, 1.0);
    newState = updateStreak(newState, playerId, isCorrect);

    if (isCorrect) {
      const points = calculatePoints(newState, playerId, timestamp);
      // Tell server to apply points
      const scoresToApply = { [playerId]: points };

      // Check if all players answered - if so, transition
      if (allPlayersAnswered(newState)) {
        return {
          state: newState,
          scoresToApply,
          sideEffects: [
            {
              type: "schedule_timeout",
              delayMs: 500,
              action: "trivia:transition-to-reveal",
            },
          ],
        };
      }

      return { state: newState, scoresToApply };
    }
  }

  // For free text, we need async AI judging
  // Return state with side effect to trigger AI judge
  if (state.currentQuestion?.type === "free_text") {
    return {
      state: newState,
      sideEffects: [
        {
          type: "generate_content",
          config: {
            questionText: state.currentQuestion.text,
            correctAnswer: state.currentQuestion.correctAnswer,
            playerAnswer: answer,
            acceptableAnswers: state.currentQuestion.acceptableAnswers,
            playerId,
            timestamp,
          },
          onCompleteAction: "trivia:apply-judgment",
        },
      ],
    };
  }

  // Check if all players answered
  if (allPlayersAnswered(newState)) {
    return {
      state: newState,
      sideEffects: [
        {
          type: "schedule_timeout",
          delayMs: 500,
          action: "trivia:transition-to-reveal",
        },
      ],
    };
  }

  return { state: newState };
}

/**
 * Handle buzzer press.
 */
function handleBuzzerEvent(
  state: PixelShowdownState,
  ctx: GameEventContext,
  data: unknown
): GameEventResult<PixelShowdownState> {
  const { timestamp } = data as { timestamp: number };
  const newState = handleBuzz(state, ctx.playerId, timestamp);
  return { state: newState };
}

/**
 * Apply AI judgment result for free text answers.
 */
function handleApplyJudgment(
  state: PixelShowdownState,
  _ctx: GameEventContext,
  data: unknown
): GameEventResult<PixelShowdownState> {
  const { playerId, isCorrect, confidence, timestamp } = data as {
    playerId: string;
    isCorrect: boolean;
    confidence: number;
    timestamp: number;
  };

  let newState = applyJudgment(state, playerId, isCorrect, confidence);
  newState = updateStreak(newState, playerId, isCorrect);

  const scoresToApply: Record<string, number> = {};
  if (isCorrect) {
    const points = calculatePoints(newState, playerId, timestamp);
    scoresToApply[playerId] = points;
  }

  // Check if all judgments are complete
  const allJudged = newState.answers.every((a) => a.isCorrect !== undefined);
  if (allJudged && allPlayersAnswered(newState)) {
    return {
      state: newState,
      scoresToApply:
        Object.keys(scoresToApply).length > 0 ? scoresToApply : undefined,
      sideEffects: [
        {
          type: "schedule_timeout",
          delayMs: 500,
          action: "trivia:transition-to-reveal",
        },
      ],
    };
  }

  return {
    state: newState,
    scoresToApply:
      Object.keys(scoresToApply).length > 0 ? scoresToApply : undefined,
  };
}

/**
 * Transition to answer reveal phase.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
function handleTransitionToReveal(
  state: PixelShowdownState,
  _ctx: GameEventContext,
  _data: unknown
): GameEventResult<PixelShowdownState> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const newState = transitionToAnswerReveal(state);
  return {
    state: newState,
    sideEffects: [
      {
        type: "schedule_timeout",
        delayMs: 4000,
        action: "trivia:transition-to-leaderboard",
      },
    ],
  };
}

/**
 * Transition to leaderboard phase.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
function handleTransitionToLeaderboard(
  state: PixelShowdownState,
  _ctx: GameEventContext,
  _data: unknown
): GameEventResult<PixelShowdownState> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const newState = transitionToLeaderboard(state);

  // Check if more questions in this round
  if (state.questionNumber < state.questionsPerRound) {
    return {
      state: newState,
      sideEffects: [
        {
          type: "schedule_timeout",
          delayMs: 4000,
          action: "trivia:next-question",
        },
      ],
    };
  }

  // End of round
  return {
    state: newState,
    sideEffects: [
      {
        type: "schedule_timeout",
        delayMs: 4000,
        action: "trivia:round-results",
      },
    ],
  };
}

/**
 * Advance to next question.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
function handleNextQuestion(
  state: PixelShowdownState,
  _ctx: GameEventContext,
  _data: unknown
): GameEventResult<PixelShowdownState> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const newState = advanceToNextQuestion(state);
  return { state: newState };
}

/**
 * Show round results.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
function handleRoundResults(
  state: PixelShowdownState,
  _ctx: GameEventContext,
  _data: unknown
): GameEventResult<PixelShowdownState> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const newState = transitionToRoundResults(state);
  return { state: newState };
}

/**
 * Advance to next round (called by server via handleNextRound).
 */
function handlePixelShowdownNextRound(
  state: PixelShowdownState
): GameEventResult<PixelShowdownState> {
  // Check if game is complete
  if (state.currentRound >= state.totalRounds) {
    return {
      state: transitionToGameResults(state),
    };
  }

  // Need to generate new questions
  const nextRound = state.currentRound + 1;
  const difficulty = getDifficultyForRound(nextRound, state.config);
  const category = getRandomCategory(state.config);

  return {
    state: advanceTriviaRound(state),
    sideEffects: [
      {
        type: "generate_content",
        config: {
          category,
          difficulty,
          count: state.config.questionsPerRound,
          round: nextRound,
        },
        onCompleteAction: "trivia:set-questions",
      },
    ],
  };
}

/**
 * Set questions for the round (after generation).
 */
function handleSetQuestions(
  state: PixelShowdownState,
  _ctx: GameEventContext,
  data: unknown
): GameEventResult<PixelShowdownState> {
  const { questions, category } = data as {
    questions: TriviaQuestion[];
    category: string;
  };

  let newState = setQuestionQueue(state, questions);
  newState = {
    ...newState,
    currentCategory: category,
  };

  return {
    state: newState,
    sideEffects: [
      {
        type: "schedule_timeout",
        delayMs: 3000,
        action: "trivia:start-questions",
      },
    ],
  };
}

/**
 * Start questions after category announcement.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
function handleStartQuestions(
  state: PixelShowdownState,
  _ctx: GameEventContext,
  _data: unknown
): GameEventResult<PixelShowdownState> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const newState = startQuestions(state);
  return { state: newState };
}

/**
 * Pixel Showdown game contract implementation.
 */
export const pixelShowdownGame = defineGame<
  PixelShowdownState,
  Partial<PixelShowdownConfig>
>({
  gameType: "pixel-showdown",

  phases: PIXEL_SHOWDOWN_PHASES,

  defaultConfig: DEFAULT_PIXEL_SHOWDOWN_CONFIG,

  initialize: initializePixelShowdownGame,

  // Pixel Showdown uses custom events instead of generic submit/vote
  handleSubmit: undefined,
  handleVote: undefined,

  handleNextRound: handlePixelShowdownNextRound,

  customEvents: {
    "trivia:answer": handleTriviaAnswerEvent,
    "trivia:buzz": handleBuzzerEvent,
    "trivia:apply-judgment": handleApplyJudgment,
    "trivia:transition-to-reveal": handleTransitionToReveal,
    "trivia:transition-to-leaderboard": handleTransitionToLeaderboard,
    "trivia:next-question": handleNextQuestion,
    "trivia:round-results": handleRoundResults,
    "trivia:set-questions": handleSetQuestions,
    "trivia:start-questions": handleStartQuestions,
  },

  getRestartablePhases: () => ["game_results", "round_results"],

  resetToLobby: resetTriviaToLobby,

  getPhaseDisplayName: (phase: string) => {
    const names: Record<string, string> = {
      lobby: "Lobby",
      category_announce: "Category Announcement",
      question: "Question",
      answer_reveal: "Answer Reveal",
      leaderboard: "Leaderboard",
      round_results: "Round Results",
      game_results: "Game Over",
    };
    return names[phase] || phase;
  },

  isValidTransition: (fromPhase: string, toPhase: string) => {
    const validTargets = VALID_TRANSITIONS[fromPhase as PixelShowdownPhase];
    return validTargets?.includes(toPhase as PixelShowdownPhase) ?? false;
  },
});

// Auto-register when this module is imported
gameRegistry.register(pixelShowdownGame);

// Re-export utilities that may be useful elsewhere
export {
  allPlayersAnswered,
  calculatePoints,
  getDifficultyForRound,
  getRandomCategory,
  applyPointsToPlayer,
};

/**
 * Check if a player has answered the current question.
 */
export function hasPlayerAnswered(
  state: PixelShowdownState,
  playerId: string
): boolean {
  return state.answers.some((a) => a.playerId === playerId);
}

/**
 * Get player's answer for the current question.
 */
export function getPlayerAnswer(
  state: PixelShowdownState,
  playerId: string
): TriviaAnswer | undefined {
  return state.answers.find((a) => a.playerId === playerId);
}

/**
 * Get answer count.
 */
export function getAnswerCount(state: PixelShowdownState): {
  answered: number;
  total: number;
} {
  const activePlayers = state.players.filter((p) => p.isConnected);
  return {
    answered: state.answers.length,
    total: activePlayers.length,
  };
}

/**
 * Get player stats.
 */
export function getPlayerStats(
  state: PixelShowdownState,
  playerId: string
): PlayerTriviaStats | undefined {
  return state.playerStats[playerId];
}
