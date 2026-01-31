import type { Player } from "./player";

/**
 * Types of trivia questions supported
 */
export type QuestionType = "multiple_choice" | "free_text" | "buzzer";

/**
 * Game phases for Pixel Showdown
 */
export type PixelShowdownPhase =
  | "lobby"
  | "category_announce" // AI announces upcoming category (2-3s)
  | "question" // Question displayed, players answer (15s)
  | "answer_reveal" // Show correct answer + results (3-5s)
  | "leaderboard" // Show current standings (3-5s)
  | "round_results" // End of round summary
  | "game_results"; // Final results

/**
 * A single trivia question
 */
export interface TriviaQuestion {
  id: string;
  text: string;
  type: QuestionType;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  options?: string[]; // For multiple choice (4 options)
  correctAnswer: string;
  acceptableAnswers?: string[]; // Alternative acceptable answers for free text
  timeLimit: number; // Seconds to answer
  pointValue: number; // Base points: 100/200/300 for easy/medium/hard
}

/**
 * Player's answer to a question
 */
export interface TriviaAnswer {
  playerId: string;
  playerName: string;
  questionId: string;
  answer: string;
  timestamp: number; // When answer was submitted (for speed scoring)
  isCorrect?: boolean; // Set after judging
  pointsAwarded?: number; // Points earned (includes speed bonus + streak)
  judgeConfidence?: number; // For AI-judged free text (0-1)
}

/**
 * Buzzer state for buzzer-type questions
 */
export interface BuzzerState {
  isActive: boolean;
  firstBuzzPlayerId?: string;
  firstBuzzTimestamp?: number;
  buzzOrder: string[]; // Player IDs in order of buzz
}

/**
 * Per-player tracking for streaks and stats
 */
export interface PlayerTriviaStats {
  playerId: string;
  currentStreak: number;
  longestStreak: number;
  totalCorrect: number;
  totalAnswered: number;
  averageResponseTimeMs: number;
}

/**
 * Configuration for Pixel Showdown
 */
export interface PixelShowdownConfig {
  questionsPerRound: number; // Default: 5
  roundsPerGame: number; // Default: 3
  baseTimeLimit: number; // Default seconds per question: 15
  buzzerTimeLimit: number; // Shorter time for buzzer questions: 5
  maxSpeedBonus: number; // Max bonus points for fastest answer: 500
  streakMultiplierCap: number; // Max streak multiplier: 3x
  categories: string[]; // Available categories
  difficultyProgression: boolean; // Questions get harder each round
}

/**
 * Default configuration
 */
export const DEFAULT_PIXEL_SHOWDOWN_CONFIG: PixelShowdownConfig = {
  questionsPerRound: 5,
  roundsPerGame: 3,
  baseTimeLimit: 15,
  buzzerTimeLimit: 5,
  maxSpeedBonus: 500,
  streakMultiplierCap: 3,
  categories: [
    "Science",
    "History",
    "Pop Culture",
    "Geography",
    "Sports",
    "Entertainment",
    "Technology",
    "Music",
    "Movies",
    "Video Games",
  ],
  difficultyProgression: true,
};

/**
 * Extended game state for Pixel Showdown
 */
export interface PixelShowdownState {
  roomCode: string;
  gameType: "pixel-showdown";
  currentRound: number;
  totalRounds: number;
  phase: PixelShowdownPhase;
  players: Player[];

  // Question state
  currentQuestion?: TriviaQuestion;
  questionNumber: number; // Current question in round (1-indexed)
  questionsPerRound: number;
  questionStartTime?: number; // Timestamp when question was displayed

  // Answer tracking
  answers: TriviaAnswer[];
  buzzerState?: BuzzerState;

  // Player stats (keyed by playerId)
  playerStats: Record<string, PlayerTriviaStats>;

  // Round/game results
  roundResults?: Record<string, number>;
  timeRemaining?: number;

  // Question queue (pre-generated for the round)
  questionQueue: TriviaQuestion[];

  // Configuration
  config: PixelShowdownConfig;
}

/**
 * Request to generate trivia questions
 */
export interface GenerateQuestionsRequest {
  category?: string; // If not provided, AI selects
  difficulty: "easy" | "medium" | "hard";
  count: number;
  excludeIds?: string[]; // Questions to avoid repeating
}

/**
 * Response from question generation
 */
export interface GenerateQuestionsResponse {
  questions: TriviaQuestion[];
}

/**
 * Request to judge a free-text answer
 */
export interface JudgeAnswerRequest {
  questionText: string;
  correctAnswer: string;
  playerAnswer: string;
  acceptableAnswers?: string[];
}

/**
 * Response from answer judging
 */
export interface JudgeAnswerResponse {
  isCorrect: boolean;
  confidence: number; // 0-1
  explanation?: string;
}
