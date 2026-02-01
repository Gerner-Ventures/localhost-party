/**
 * Game Registry
 *
 * Central registry for all game contracts. Games register themselves here,
 * and the server uses the registry to route events to the appropriate handlers.
 *
 * @example
 * ```typescript
 * // In a game contract file:
 * import { gameRegistry } from "./registry";
 * import { quiplashGame } from "./quiplash-contract";
 *
 * gameRegistry.register(quiplashGame);
 *
 * // In server.ts:
 * const game = gameRegistry.get(room.gameState.gameType);
 * if (game?.handleSubmit) {
 *   const result = game.handleSubmit(state, playerId, playerName, data);
 * }
 * ```
 */

import type {
  GameContract,
  BaseGameState,
  GameEventResult,
  GameEventHandler,
} from "./types/game-contract";
import type { GameType } from "@/lib/types/game";
import type { Player } from "@/lib/types/player";

/**
 * Game Registry class for managing game contracts.
 */
class GameRegistry {
  private games = new Map<GameType, GameContract<BaseGameState>>();
  private initialized = false;

  /**
   * Register a game contract.
   * @param contract - The game contract to register
   * @throws If a game with the same type is already registered
   */
  register<S extends BaseGameState>(contract: GameContract<S>): void {
    if (this.games.has(contract.gameType)) {
      console.warn(
        `Game "${contract.gameType}" is already registered. Overwriting.`
      );
    }
    this.games.set(
      contract.gameType,
      contract as unknown as GameContract<BaseGameState>
    );
    console.log(`Game registered: ${contract.gameType}`);
  }

  /**
   * Unregister a game contract.
   * Useful for testing or dynamic game loading.
   */
  unregister(gameType: GameType): boolean {
    return this.games.delete(gameType);
  }

  /**
   * Get a game contract by type.
   * @param gameType - The game type to look up
   * @returns The game contract, or undefined if not found
   */
  get(gameType: GameType | null): GameContract<BaseGameState> | undefined {
    if (!gameType) return undefined;
    return this.games.get(gameType);
  }

  /**
   * Check if a game is registered.
   */
  has(gameType: GameType): boolean {
    return this.games.has(gameType);
  }

  /**
   * Get all registered game types.
   */
  getSupportedGames(): GameType[] {
    return Array.from(this.games.keys());
  }

  /**
   * Check if a phase is valid for a given game type.
   */
  isValidPhase(gameType: GameType | null, phase: string): boolean {
    if (!gameType) return phase === "lobby";
    const game = this.games.get(gameType);
    return game ? game.phases.includes(phase) : false;
  }

  /**
   * Get all valid phases for a game type.
   */
  getPhasesForGame(gameType: GameType): readonly string[] {
    const game = this.games.get(gameType);
    return game?.phases ?? [];
  }

  /**
   * Initialize a game.
   * Convenience method that delegates to the game contract.
   */
  initializeGame<S extends BaseGameState>(
    gameType: GameType,
    roomCode: string,
    players: Player[],
    config?: unknown
  ): S | null {
    const game = this.games.get(gameType);
    if (!game) {
      console.error(`Game "${gameType}" not registered`);
      return null;
    }
    return game.initialize(roomCode, players, config) as S;
  }

  /**
   * Handle a submission event.
   * Returns null if the game doesn't support submissions.
   */
  handleSubmit(
    gameType: GameType | null,
    state: BaseGameState,
    playerId: string,
    playerName: string,
    data: unknown
  ): GameEventResult<BaseGameState> | null {
    if (!gameType) return null;
    const game = this.games.get(gameType);
    if (!game?.handleSubmit) return null;
    return game.handleSubmit(state, playerId, playerName, data);
  }

  /**
   * Handle a vote event.
   * Returns null if the game doesn't support voting.
   */
  handleVote(
    gameType: GameType | null,
    state: BaseGameState,
    playerId: string,
    playerName: string,
    data: unknown
  ): GameEventResult<BaseGameState> | null {
    if (!gameType) return null;
    const game = this.games.get(gameType);
    if (!game?.handleVote) return null;
    return game.handleVote(state, playerId, playerName, data);
  }

  /**
   * Handle next round event.
   * Returns null if the game doesn't support next round.
   */
  handleNextRound(
    gameType: GameType | null,
    state: BaseGameState
  ): GameEventResult<BaseGameState> | null {
    if (!gameType) return null;
    const game = this.games.get(gameType);
    if (!game?.handleNextRound) return null;
    return game.handleNextRound(state);
  }

  /**
   * Get a custom event handler.
   * Returns null if the event is not registered for this game.
   */
  getCustomEventHandler(
    gameType: GameType | null,
    eventName: string
  ): GameEventHandler<BaseGameState> | null {
    if (!gameType) return null;
    const game = this.games.get(gameType);
    const handler = game?.customEvents?.[eventName];
    return handler ?? null;
  }

  /**
   * Check if a game can be restarted from the current phase.
   */
  canRestart(gameType: GameType | null, phase: string): boolean {
    if (!gameType) return false;
    const game = this.games.get(gameType);
    return game?.getRestartablePhases().includes(phase) ?? false;
  }

  /**
   * Reset a game to lobby state.
   */
  resetToLobby<S extends BaseGameState>(
    gameType: GameType | null,
    state: S
  ): S | null {
    if (!gameType) return null;
    const game = this.games.get(gameType);
    if (!game) return null;
    return game.resetToLobby(state) as S;
  }

  /**
   * Clear all registered games.
   * Useful for testing.
   */
  clear(): void {
    this.games.clear();
    this.initialized = false;
  }

  /**
   * Get registry stats for debugging.
   */
  getStats(): { gameCount: number; games: string[] } {
    return {
      gameCount: this.games.size,
      games: this.getSupportedGames(),
    };
  }

  /**
   * Mark registry as initialized.
   * Called after all games are registered.
   */
  markInitialized(): void {
    this.initialized = true;
    console.log(
      `Game registry initialized with ${this.games.size} games:`,
      this.getSupportedGames()
    );
  }

  /**
   * Check if registry is initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * Singleton game registry instance.
 * Import this in game contracts to register themselves.
 */
export const gameRegistry = new GameRegistry();

/**
 * Helper to create a type-safe game contract.
 * Provides better inference for the state and config types.
 */
export function defineGame<S extends BaseGameState, TConfig = unknown>(
  contract: GameContract<S, TConfig>
): GameContract<S, TConfig> {
  return contract;
}
