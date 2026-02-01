/**
 * Game Contract Interface
 *
 * This module defines the formal contract that all games must implement.
 * It enables a plugin-based architecture where new games can be added
 * without modifying server.ts or other core infrastructure.
 */

import type { Player } from "@/lib/types/player";
import type { GameType } from "@/lib/types/game";
import type { Socket, Server } from "socket.io";

/**
 * Base state interface that all game states must extend.
 * This ensures common properties are present across all games.
 */
export interface BaseGameState {
  roomCode: string;
  gameType: GameType;
  currentRound: number;
  phase: string; // Game-specific phases
  players: Player[];
  roundResults?: Record<string, number>;
  timeRemaining?: number;
}

/**
 * Context provided to game event handlers for server-side operations.
 */
export interface GameEventContext {
  socket: Socket;
  io: Server;
  playerId: string;
  playerName: string;
}

/**
 * Result returned from game event handlers.
 * Separates state computation from side effects.
 */
export interface GameEventResult<S extends BaseGameState> {
  /** Updated game state */
  state: S;
  /** Scores to apply to canonical player list (server handles mutation) */
  scoresToApply?: Record<string, number>;
  /** Side effects for server to execute */
  sideEffects?: GameSideEffect[];
}

/**
 * Side effects that games can request the server to perform.
 * This keeps game logic pure while allowing server-side operations.
 */
export type GameSideEffect =
  | ScheduleTimeoutEffect
  | EmitToRoomEffect
  | PersistToDatabaseEffect
  | GenerateContentEffect;

export interface ScheduleTimeoutEffect {
  type: "schedule_timeout";
  delayMs: number;
  /** Action identifier - server maps this to a handler */
  action: string;
  /** Optional data to pass to the timeout handler */
  data?: unknown;
}

export interface EmitToRoomEffect {
  type: "emit_to_room";
  event: string;
  data: unknown;
}

export interface PersistToDatabaseEffect {
  type: "persist_to_db";
  entity: "submission" | "vote" | "game" | "round";
  data: unknown;
}

export interface GenerateContentEffect {
  type: "generate_content";
  /** Configuration for content generation (e.g., trivia question params) */
  config: unknown;
  /** Action to trigger when generation completes */
  onCompleteAction: string;
}

/**
 * Custom event handler type for game-specific events.
 * Supports both sync and async handlers (e.g., AI judging).
 */
export type GameEventHandler<S extends BaseGameState> = (
  state: S,
  ctx: GameEventContext,
  data: unknown
) => GameEventResult<S> | Promise<GameEventResult<S>>;

/**
 * The Game Contract - every game implements this interface.
 *
 * @template S - The game-specific state type extending BaseGameState
 * @template TConfig - Optional configuration type for the game
 *
 * @example
 * ```typescript
 * const quiplashGame: GameContract<QuiplashState, QuiplashConfig> = {
 *   gameType: "quiplash",
 *   phases: ["lobby", "submit", "vote", "results"] as const,
 *   initialize: (roomCode, players) => createQuiplashState(roomCode, players),
 *   handleSubmit: (state, playerId, playerName, data) => processSubmission(state, playerId, data),
 *   // ...
 * };
 * ```
 */
export interface GameContract<S extends BaseGameState, TConfig = unknown> {
  /**
   * Unique game identifier matching GameType enum.
   */
  readonly gameType: GameType;

  /**
   * Valid phases for this game.
   * Used for validation and debugging.
   */
  readonly phases: readonly string[];

  /**
   * Default configuration for the game.
   */
  readonly defaultConfig?: TConfig;

  /**
   * Initialize game state when starting a new game.
   *
   * @param roomCode - The room code for this game session
   * @param players - Array of players in the game
   * @param config - Optional game configuration
   * @returns Initial game state
   */
  initialize(roomCode: string, players: Player[], config?: TConfig): S;

  /**
   * Handle player submission (answer, drawing, etc.).
   * Optional - not all games have submissions.
   *
   * @param state - Current game state
   * @param playerId - ID of submitting player
   * @param playerName - Name of submitting player
   * @param data - Submission data (game-specific)
   * @returns Updated state with optional side effects
   */
  handleSubmit?(
    state: S,
    playerId: string,
    playerName: string,
    data: unknown
  ): GameEventResult<S>;

  /**
   * Handle player vote.
   * Optional - not all games have voting.
   *
   * @param state - Current game state
   * @param playerId - ID of voting player
   * @param playerName - Name of voting player
   * @param data - Vote data (game-specific)
   * @returns Updated state with optional side effects
   */
  handleVote?(
    state: S,
    playerId: string,
    playerName: string,
    data: unknown
  ): GameEventResult<S>;

  /**
   * Advance to next round or phase.
   * Optional - some games may use custom events instead.
   *
   * @param state - Current game state
   * @returns Updated state with optional side effects
   */
  handleNextRound?(state: S): GameEventResult<S>;

  /**
   * Custom event handlers for game-specific events.
   * Keyed by event name (e.g., "trivia:answer", "game:buzz").
   *
   * @example
   * ```typescript
   * customEvents: {
   *   "trivia:answer": async (state, ctx, data) => {
   *     // Handle trivia answer with AI judging
   *     return { state: updatedState };
   *   }
   * }
   * ```
   */
  customEvents?: Record<string, GameEventHandler<S>>;

  /**
   * Get phases from which the game can be restarted.
   * Typically includes "results" and "game_results".
   */
  getRestartablePhases(): string[];

  /**
   * Reset game to lobby state.
   * Used when restarting a game.
   *
   * @param state - Current game state
   * @returns Reset state in lobby phase
   */
  resetToLobby(state: S): S;

  /**
   * Get display-friendly phase name.
   * Used for UI and debugging.
   *
   * @param phase - Internal phase name
   * @returns Human-readable phase name
   */
  getPhaseDisplayName?(phase: string): string;

  /**
   * Validate that a phase transition is allowed.
   * Used for debugging and preventing invalid state.
   *
   * @param fromPhase - Current phase
   * @param toPhase - Target phase
   * @returns Whether the transition is valid
   */
  isValidTransition?(fromPhase: string, toPhase: string): boolean;
}

/**
 * Type guard to check if an object implements GameContract.
 */
export function isGameContract(
  obj: unknown
): obj is GameContract<BaseGameState> {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "gameType" in obj &&
    "phases" in obj &&
    "initialize" in obj &&
    "getRestartablePhases" in obj &&
    "resetToLobby" in obj
  );
}
