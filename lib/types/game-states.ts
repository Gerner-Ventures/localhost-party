/**
 * Discriminated Union Types for Game States
 *
 * This module provides strongly-typed game state types using discriminated unions.
 * TypeScript can narrow the type based on gameType, enabling compile-time
 * validation of game-specific properties.
 *
 * @example
 * ```typescript
 * function handleState(state: GameStateUnion) {
 *   if (isQuiplashState(state)) {
 *     // TypeScript knows state.submissions exists
 *     console.log(state.submissions.length);
 *   }
 * }
 * ```
 */

import type { Player } from "./player";
import type {
  TriviaQuestion,
  TriviaAnswer,
  BuzzerState,
  PlayerTriviaStats,
  PixelShowdownConfig,
} from "./pixel-showdown";

// Re-export for convenience
export type { Player };

/**
 * All supported game types.
 * This is the source of truth - game.ts GameType should reference this.
 */
export type GameType =
  | "quiplash"
  | "pixel-showdown"
  | "drawful"
  | "fibbage"
  | "murder-mystery"
  | "rap-battle";

// ============================================================================
// QUIPLASH TYPES
// ============================================================================

/**
 * Quiplash-specific phases.
 */
export type QuiplashPhase = "lobby" | "submit" | "vote" | "results";

/**
 * A prompt assigned to a player in Quiplash.
 */
export interface QuiplashPrompt {
  id: string;
  text: string;
  assignedPlayerIds: string[];
}

/**
 * A player's submission in Quiplash.
 */
export interface QuiplashSubmission {
  playerId: string;
  playerName: string;
  promptId: string;
  answer: string;
  timestamp: number;
}

/**
 * A vote cast in Quiplash.
 */
export interface QuiplashVote {
  playerId: string;
  playerName: string;
  votedForPlayerId: string;
  timestamp: number;
}

/**
 * A matchup between two answers in Quiplash voting.
 */
export interface QuiplashMatchup {
  promptId: string;
  promptText: string;
  submissions: QuiplashSubmission[];
}

/**
 * Quiplash game configuration.
 */
export interface QuiplashConfig {
  roundsPerGame: number;
  promptsPerRound: number;
  submissionTimeLimit: number;
  votingTimeLimit: number;
  pointsPerVote: number;
}

/**
 * Default Quiplash configuration.
 */
export const DEFAULT_QUIPLASH_CONFIG: QuiplashConfig = {
  roundsPerGame: 3,
  promptsPerRound: 1,
  submissionTimeLimit: 60,
  votingTimeLimit: 30,
  pointsPerVote: 100,
};

/**
 * Strongly-typed Quiplash game state.
 */
export interface QuiplashState {
  // Discriminant
  gameType: "quiplash";

  // Base properties
  roomCode: string;
  currentRound: number;
  phase: QuiplashPhase;
  players: Player[];
  roundResults?: Record<string, number>;
  timeRemaining?: number;

  // Quiplash-specific properties (required, not optional)
  prompts: QuiplashPrompt[];
  submissions: QuiplashSubmission[];
  votes: QuiplashVote[];
  currentPromptIndex: number;
  currentMatchup?: QuiplashMatchup;
  config: QuiplashConfig;
}

// ============================================================================
// PIXEL SHOWDOWN TYPES
// ============================================================================

/**
 * Pixel Showdown-specific phases.
 */
export type PixelShowdownPhase =
  | "lobby"
  | "category_announce"
  | "question"
  | "answer_reveal"
  | "leaderboard"
  | "round_results"
  | "game_results";

/**
 * Strongly-typed Pixel Showdown game state.
 * Re-exports the existing PixelShowdownState for compatibility.
 */
export interface PixelShowdownState {
  // Discriminant
  gameType: "pixel-showdown";

  // Base properties
  roomCode: string;
  currentRound: number;
  phase: PixelShowdownPhase;
  players: Player[];
  roundResults?: Record<string, number>;
  timeRemaining?: number;

  // Pixel Showdown-specific properties
  totalRounds: number;
  currentCategory?: string;
  currentQuestion?: TriviaQuestion;
  questionNumber: number;
  questionsPerRound: number;
  questionStartTime?: number;
  answers: TriviaAnswer[];
  buzzerState?: BuzzerState;
  playerStats: Record<string, PlayerTriviaStats>;
  questionQueue: TriviaQuestion[];
  config: PixelShowdownConfig;
}

// ============================================================================
// LOBBY STATE (before game selection)
// ============================================================================

/**
 * State when no game has been selected yet.
 */
export interface LobbyState {
  // Discriminant
  gameType: null;

  // Base properties
  roomCode: string;
  currentRound: number;
  phase: "lobby";
  players: Player[];
  roundResults?: Record<string, number>;
  timeRemaining?: number;
}

// ============================================================================
// UNION TYPE & TYPE GUARDS
// ============================================================================

/**
 * Discriminated union of all game states.
 * TypeScript can narrow based on gameType.
 */
export type GameStateUnion = LobbyState | QuiplashState | PixelShowdownState;

/**
 * Type guard for Quiplash state.
 */
export function isQuiplashState(state: GameStateUnion): state is QuiplashState {
  return state.gameType === "quiplash";
}

/**
 * Type guard for Pixel Showdown state.
 */
export function isPixelShowdownState(
  state: GameStateUnion
): state is PixelShowdownState {
  return state.gameType === "pixel-showdown";
}

/**
 * Type guard for Lobby state.
 */
export function isLobbyState(state: GameStateUnion): state is LobbyState {
  return state.gameType === null;
}

/**
 * Type guard to check if state has a specific game type.
 */
export function hasGameType<T extends GameType>(
  state: GameStateUnion,
  gameType: T
): state is Extract<GameStateUnion, { gameType: T }> {
  return state.gameType === gameType;
}

// ============================================================================
// PHASE UTILITIES
// ============================================================================

/**
 * All valid Quiplash phases.
 */
export const QUIPLASH_PHASES: readonly QuiplashPhase[] = [
  "lobby",
  "submit",
  "vote",
  "results",
] as const;

/**
 * All valid Pixel Showdown phases.
 */
export const PIXEL_SHOWDOWN_PHASES: readonly PixelShowdownPhase[] = [
  "lobby",
  "category_announce",
  "question",
  "answer_reveal",
  "leaderboard",
  "round_results",
  "game_results",
] as const;

/**
 * Check if a phase is valid for a given game type.
 */
export function isValidPhaseForGame(
  gameType: GameType | null,
  phase: string
): boolean {
  if (gameType === null) return phase === "lobby";
  if (gameType === "quiplash")
    return (QUIPLASH_PHASES as readonly string[]).includes(phase);
  if (gameType === "pixel-showdown")
    return (PIXEL_SHOWDOWN_PHASES as readonly string[]).includes(phase);
  return false;
}

/**
 * Get display name for a phase.
 */
export function getPhaseDisplayName(
  gameType: GameType | null,
  phase: string
): string {
  const phaseNames: Record<string, string> = {
    lobby: "Lobby",
    submit: "Submit Answers",
    vote: "Vote",
    results: "Results",
    category_announce: "Category Announcement",
    question: "Question",
    answer_reveal: "Answer Reveal",
    leaderboard: "Leaderboard",
    round_results: "Round Results",
    game_results: "Game Over",
  };
  return phaseNames[phase] || phase;
}

// ============================================================================
// BACKWARD COMPATIBILITY
// ============================================================================

/**
 * Legacy GameState type for backward compatibility.
 * Use GameStateUnion for new code.
 *
 * @deprecated Use GameStateUnion with type guards instead
 */
export interface LegacyGameState {
  roomCode: string;
  gameType: GameType | null;
  currentRound: number;
  phase: string;
  players: Player[];
  submissions?: Array<{
    playerId: string;
    playerName: string;
    data: unknown;
    timestamp: number;
  }>;
  votes?: Array<{
    playerId: string;
    playerName: string;
    data: unknown;
    timestamp: number;
  }>;
  prompts?: Array<{
    id: string;
    text: string;
    assignedPlayerIds?: string[];
  }>;
  currentPromptIndex?: number;
  roundResults?: Record<string, number>;
  timeRemaining?: number;
}

/**
 * Convert legacy GameState to GameStateUnion.
 * Useful during migration.
 */
export function toLegacyGameState(state: GameStateUnion): LegacyGameState {
  if (isQuiplashState(state)) {
    return {
      roomCode: state.roomCode,
      gameType: state.gameType,
      currentRound: state.currentRound,
      phase: state.phase,
      players: state.players,
      submissions: state.submissions.map((s) => ({
        playerId: s.playerId,
        playerName: s.playerName,
        data: s.answer,
        timestamp: s.timestamp,
      })),
      votes: state.votes.map((v) => ({
        playerId: v.playerId,
        playerName: v.playerName,
        data: v.votedForPlayerId,
        timestamp: v.timestamp,
      })),
      prompts: state.prompts.map((p) => ({
        id: p.id,
        text: p.text,
        assignedPlayerIds: p.assignedPlayerIds,
      })),
      currentPromptIndex: state.currentPromptIndex,
      roundResults: state.roundResults,
      timeRemaining: state.timeRemaining,
    };
  }

  if (isPixelShowdownState(state)) {
    return {
      roomCode: state.roomCode,
      gameType: state.gameType,
      currentRound: state.currentRound,
      phase: state.phase,
      players: state.players,
      roundResults: state.roundResults,
      timeRemaining: state.timeRemaining,
    };
  }

  // Lobby state
  return {
    roomCode: state.roomCode,
    gameType: state.gameType,
    currentRound: state.currentRound,
    phase: state.phase,
    players: state.players,
    roundResults: state.roundResults,
    timeRemaining: state.timeRemaining,
  };
}
