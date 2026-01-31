import type { Player } from "../types/player";
import type {
  PixelShowdownState,
  PixelShowdownConfig,
  TriviaQuestion,
  TriviaAnswer,
  PlayerTriviaStats,
  PixelShowdownPhase,
} from "../types/pixel-showdown";
import { DEFAULT_PIXEL_SHOWDOWN_CONFIG } from "../types/pixel-showdown";

/**
 * Initialize a new Pixel Showdown game
 */
export function initializePixelShowdownGame(
  roomCode: string,
  players: Player[],
  config: Partial<PixelShowdownConfig> = {}
): PixelShowdownState {
  const fullConfig = { ...DEFAULT_PIXEL_SHOWDOWN_CONFIG, ...config };

  // Initialize player stats
  const playerStats: Record<string, PlayerTriviaStats> = {};
  for (const player of players) {
    playerStats[player.id] = {
      playerId: player.id,
      currentStreak: 0,
      longestStreak: 0,
      totalCorrect: 0,
      totalAnswered: 0,
      averageResponseTimeMs: 0,
    };
  }

  return {
    roomCode,
    gameType: "pixel-showdown",
    currentRound: 1,
    totalRounds: fullConfig.roundsPerGame,
    phase: "category_announce",
    players,
    questionNumber: 0,
    questionsPerRound: fullConfig.questionsPerRound,
    answers: [],
    playerStats,
    questionQueue: [],
    config: fullConfig,
    timeRemaining: 3, // Time to show category announcement
  };
}

/**
 * Set the question queue for the current round
 */
export function setQuestionQueue(
  state: PixelShowdownState,
  questions: TriviaQuestion[]
): PixelShowdownState {
  return {
    ...state,
    questionQueue: questions,
  };
}

/**
 * Advance from category_announce to first question
 */
export function startQuestions(state: PixelShowdownState): PixelShowdownState {
  if (state.phase !== "category_announce" || state.questionQueue.length === 0) {
    return state;
  }

  const currentQuestion = state.questionQueue[0];

  return {
    ...state,
    phase: "question",
    questionNumber: 1,
    currentQuestion,
    questionStartTime: Date.now(),
    answers: [],
    timeRemaining: currentQuestion.timeLimit,
  };
}

/**
 * Handle a player's answer submission
 */
export function handleAnswer(
  state: PixelShowdownState,
  playerId: string,
  playerName: string,
  answer: string,
  timestamp: number
): PixelShowdownState {
  // Only accept answers during question phase
  if (state.phase !== "question" || !state.currentQuestion) {
    return state;
  }

  // Check if player already answered
  const existingAnswer = state.answers.find((a) => a.playerId === playerId);
  if (existingAnswer) {
    return state;
  }

  const newAnswer: TriviaAnswer = {
    playerId,
    playerName,
    questionId: state.currentQuestion.id,
    answer,
    timestamp,
  };

  return {
    ...state,
    answers: [...state.answers, newAnswer],
  };
}

/**
 * Handle buzzer press for buzzer-type questions
 */
export function handleBuzz(
  state: PixelShowdownState,
  playerId: string,
  timestamp: number
): PixelShowdownState {
  if (
    state.phase !== "question" ||
    state.currentQuestion?.type !== "buzzer" ||
    !state.buzzerState
  ) {
    return state;
  }

  // If buzzer already pressed by someone, add to order
  if (state.buzzerState.buzzOrder.includes(playerId)) {
    return state;
  }

  const newBuzzOrder = [...state.buzzerState.buzzOrder, playerId];
  const isFirstBuzz = newBuzzOrder.length === 1;

  return {
    ...state,
    buzzerState: {
      ...state.buzzerState,
      buzzOrder: newBuzzOrder,
      firstBuzzPlayerId: isFirstBuzz
        ? playerId
        : state.buzzerState.firstBuzzPlayerId,
      firstBuzzTimestamp: isFirstBuzz
        ? timestamp
        : state.buzzerState.firstBuzzTimestamp,
    },
  };
}

/**
 * Judge an answer for a multiple choice question
 */
export function judgeMultipleChoiceAnswer(
  question: TriviaQuestion,
  playerAnswer: string
): boolean {
  return (
    playerAnswer.toLowerCase().trim() ===
    question.correctAnswer.toLowerCase().trim()
  );
}

/**
 * Calculate points for a correct answer
 * Formula: (basePoints + speedBonus) * streakMultiplier
 */
export function calculatePoints(
  state: PixelShowdownState,
  playerId: string,
  answerTimestamp: number
): number {
  if (!state.currentQuestion || !state.questionStartTime) {
    return 0;
  }

  const question = state.currentQuestion;
  const basePoints = question.pointValue;

  // Speed bonus: faster = more points
  const responseTimeMs = answerTimestamp - state.questionStartTime;
  const maxTimeMs = question.timeLimit * 1000;
  const speedRatio = Math.max(0, 1 - responseTimeMs / maxTimeMs);
  const speedBonus = Math.floor(speedRatio * state.config.maxSpeedBonus);

  // Streak multiplier
  const stats = state.playerStats[playerId];
  const streakMultiplier = Math.min(
    1 + stats.currentStreak * 0.5,
    state.config.streakMultiplierCap
  );

  return Math.floor((basePoints + speedBonus) * streakMultiplier);
}

/**
 * Apply judgment to an answer (sets isCorrect and pointsAwarded)
 */
export function applyJudgment(
  state: PixelShowdownState,
  playerId: string,
  isCorrect: boolean,
  confidence?: number
): PixelShowdownState {
  const answerIndex = state.answers.findIndex((a) => a.playerId === playerId);
  if (answerIndex === -1) {
    return state;
  }

  const answer = state.answers[answerIndex];
  const points = isCorrect
    ? calculatePoints(state, playerId, answer.timestamp)
    : 0;

  const updatedAnswers = [...state.answers];
  updatedAnswers[answerIndex] = {
    ...answer,
    isCorrect,
    pointsAwarded: points,
    judgeConfidence: confidence,
  };

  return {
    ...state,
    answers: updatedAnswers,
  };
}

/**
 * Update streak for a player after their answer is judged
 */
export function updateStreak(
  state: PixelShowdownState,
  playerId: string,
  wasCorrect: boolean
): PixelShowdownState {
  const stats = state.playerStats[playerId];
  if (!stats) return state;

  const newStreak = wasCorrect ? stats.currentStreak + 1 : 0;
  const newLongestStreak = Math.max(stats.longestStreak, newStreak);

  return {
    ...state,
    playerStats: {
      ...state.playerStats,
      [playerId]: {
        ...stats,
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        totalCorrect: wasCorrect ? stats.totalCorrect + 1 : stats.totalCorrect,
        totalAnswered: stats.totalAnswered + 1,
      },
    },
  };
}

/**
 * Check if all players have answered the current question
 */
export function allPlayersAnswered(state: PixelShowdownState): boolean {
  const activePlayers = state.players.filter((p) => p.isConnected);
  return state.answers.length >= activePlayers.length;
}

/**
 * Transition to answer reveal phase
 */
export function transitionToAnswerReveal(
  state: PixelShowdownState
): PixelShowdownState {
  return {
    ...state,
    phase: "answer_reveal",
    timeRemaining: 4, // Show answer reveal for 4 seconds
  };
}

/**
 * Transition to leaderboard phase
 */
export function transitionToLeaderboard(
  state: PixelShowdownState
): PixelShowdownState {
  return {
    ...state,
    phase: "leaderboard",
    timeRemaining: 4, // Show leaderboard for 4 seconds
  };
}

/**
 * Advance to the next question in the current round
 */
export function advanceToNextQuestion(
  state: PixelShowdownState
): PixelShowdownState {
  const nextQuestionNumber = state.questionNumber + 1;

  // Check if round is complete
  if (nextQuestionNumber > state.questionsPerRound) {
    return transitionToRoundResults(state);
  }

  // Get next question from queue
  const nextQuestion = state.questionQueue[nextQuestionNumber - 1];
  if (!nextQuestion) {
    return transitionToRoundResults(state);
  }

  return {
    ...state,
    phase: "question",
    questionNumber: nextQuestionNumber,
    currentQuestion: nextQuestion,
    questionStartTime: Date.now(),
    answers: [],
    buzzerState:
      nextQuestion.type === "buzzer"
        ? { isActive: true, buzzOrder: [] }
        : undefined,
    timeRemaining: nextQuestion.timeLimit,
  };
}

/**
 * Transition to round results phase
 */
export function transitionToRoundResults(
  state: PixelShowdownState
): PixelShowdownState {
  // Calculate round results (points earned this round per player)
  const roundResults: Record<string, number> = {};
  for (const player of state.players) {
    const stats = state.playerStats[player.id];
    roundResults[player.id] = stats?.totalCorrect || 0;
  }

  return {
    ...state,
    phase: "round_results",
    roundResults,
    timeRemaining: 5,
  };
}

/**
 * Advance to the next round
 */
export function advanceToNextRound(
  state: PixelShowdownState
): PixelShowdownState {
  const nextRound = state.currentRound + 1;

  // Check if game is complete
  if (nextRound > state.totalRounds) {
    return transitionToGameResults(state);
  }

  return {
    ...state,
    currentRound: nextRound,
    phase: "category_announce",
    questionNumber: 0,
    currentQuestion: undefined,
    questionStartTime: undefined,
    answers: [],
    questionQueue: [], // Will be populated by server
    roundResults: undefined,
    timeRemaining: 3,
  };
}

/**
 * Transition to final game results
 */
export function transitionToGameResults(
  state: PixelShowdownState
): PixelShowdownState {
  return {
    ...state,
    phase: "game_results",
    timeRemaining: undefined,
  };
}

/**
 * Get sorted standings (players sorted by score descending)
 */
export function getStandings(state: PixelShowdownState): Player[] {
  return [...state.players].sort((a, b) => b.score - a.score);
}

/**
 * Get the winner(s) of the game
 */
export function getWinners(state: PixelShowdownState): Player[] {
  const sorted = getStandings(state);
  if (sorted.length === 0) return [];

  const topScore = sorted[0].score;
  return sorted.filter((p) => p.score === topScore);
}

/**
 * Apply points to a player's score (mutates player object)
 */
export function applyPointsToPlayer(
  players: Player[],
  playerId: string,
  points: number
): void {
  const player = players.find((p) => p.id === playerId);
  if (player) {
    player.score += points;
  }
}

/**
 * Reset game to lobby state
 */
export function resetToLobby(state: PixelShowdownState): PixelShowdownState {
  // Reset player stats
  const playerStats: Record<string, PlayerTriviaStats> = {};
  for (const player of state.players) {
    playerStats[player.id] = {
      playerId: player.id,
      currentStreak: 0,
      longestStreak: 0,
      totalCorrect: 0,
      totalAnswered: 0,
      averageResponseTimeMs: 0,
    };
  }

  return {
    ...state,
    currentRound: 1,
    phase: "lobby",
    questionNumber: 0,
    currentQuestion: undefined,
    questionStartTime: undefined,
    answers: [],
    buzzerState: undefined,
    playerStats,
    roundResults: undefined,
    questionQueue: [],
    timeRemaining: undefined,
  };
}

/**
 * Get difficulty for a round (increases each round if difficultyProgression is on)
 */
export function getDifficultyForRound(
  round: number,
  config: PixelShowdownConfig
): "easy" | "medium" | "hard" {
  if (!config.difficultyProgression) {
    return "medium";
  }

  if (round === 1) return "easy";
  if (round === 2) return "medium";
  return "hard";
}

/**
 * Get a random category from config
 */
export function getRandomCategory(config: PixelShowdownConfig): string {
  const index = Math.floor(Math.random() * config.categories.length);
  return config.categories[index];
}

/**
 * Check if phase is a waiting phase (no player action needed)
 */
export function isWaitingPhase(phase: PixelShowdownPhase): boolean {
  return ["category_announce", "answer_reveal", "leaderboard"].includes(phase);
}
