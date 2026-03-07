/**
 * Game Event Router
 *
 * Routes WebSocket events to the appropriate game handlers via the game registry.
 * Replaces hardcoded game type checks in server.ts with a unified routing system.
 */

import type { Server, Socket } from "socket.io";
import type { SharedRoom } from "@/lib/shared-rooms";
import type { Player } from "@/lib/types/player";
import type { GameType } from "@/lib/types/game";
import type {
  BaseGameState,
  GameEventResult,
  GameSideEffect,
  GameEventContext,
} from "@/lib/games/types/game-contract";
import { gameRegistry } from "@/lib/games/registry";

/**
 * Configuration for the event router.
 */
export interface EventRouterConfig {
  /** Callback to broadcast game state after changes */
  broadcastGameState: (roomCode: string) => void;
  /** Callback to schedule timeouts with room cleanup */
  scheduleRoomTimeout: (
    roomCode: string,
    callback: () => void,
    delayMs: number
  ) => NodeJS.Timeout;
  /** Callback to persist to database (optional) */
  persistToDatabase?: (entity: string, data: unknown) => Promise<void>;
  /** Callback to generate content (e.g., trivia questions) */
  generateContent?: (
    config: unknown,
    onComplete: (result: unknown) => void
  ) => void;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Game Event Router class.
 * Handles routing of WebSocket events to game contracts.
 */
export class GameEventRouter {
  private io: Server;
  private config: EventRouterConfig;

  constructor(io: Server, config: EventRouterConfig) {
    this.io = io;
    this.config = config;
  }

  /**
   * Apply scores to the canonical player list.
   */
  private applyScoresToPlayers(
    players: Player[],
    scores: Record<string, number>
  ): void {
    if (!scores || Object.keys(scores).length === 0) return;

    players.forEach((player) => {
      player.score += scores[player.id] || 0;
    });
  }

  /**
   * Execute side effects from game event results.
   */
  private executeSideEffects(
    room: SharedRoom,
    socket: Socket,
    effects: GameSideEffect[]
  ): void {
    for (const effect of effects) {
      switch (effect.type) {
        case "schedule_timeout":
          this.config.scheduleRoomTimeout(
            room.code,
            () => {
              // Dispatch the scheduled action as a custom event
              this.handleCustomEvent(effect.action, socket, room, effect.data);
            },
            effect.delayMs
          );
          break;

        case "emit_to_room":
          this.io.to(room.code).emit(effect.event, effect.data);
          break;

        case "persist_to_db":
          if (this.config.persistToDatabase) {
            this.config
              .persistToDatabase(effect.entity, effect.data)
              .catch((err) => {
                console.error(`Failed to persist ${effect.entity}:`, err);
              });
          }
          break;

        case "generate_content":
          if (this.config.generateContent) {
            this.config.generateContent(effect.config, (result) => {
              // Dispatch the completion action
              this.handleCustomEvent(
                effect.onCompleteAction,
                socket,
                room,
                result
              );
            });
          }
          break;
      }
    }
  }

  /**
   * Apply event result to room state.
   */
  private applyResult(
    room: SharedRoom,
    socket: Socket,
    result: GameEventResult<BaseGameState>
  ): void {
    // Update game state
    room.gameState = result.state as SharedRoom["gameState"];

    // Maintain single source of truth for players
    room.gameState.players = room.players;

    // Apply scores if any
    if (result.scoresToApply) {
      this.applyScoresToPlayers(room.players, result.scoresToApply);
    }

    // Execute side effects
    if (result.sideEffects) {
      this.executeSideEffects(room, socket, result.sideEffects);
    }

    // Broadcast updated state
    this.config.broadcastGameState(room.code);
  }

  /**
   * Handle player submission event.
   * Routes to the appropriate game's handleSubmit method.
   *
   * @returns true if handled by registry, false if fallback needed
   */
  handleSubmit(socket: Socket, room: SharedRoom, data: unknown): boolean {
    const { gameType } = room.gameState;
    if (!gameType) return false;

    const result = gameRegistry.handleSubmit(
      gameType,
      room.gameState as BaseGameState,
      socket.data.playerId,
      socket.data.playerName,
      data
    );

    if (!result) return false;

    this.applyResult(room, socket, result);
    return true;
  }

  /**
   * Handle player vote event.
   * Routes to the appropriate game's handleVote method.
   *
   * @returns true if handled by registry, false if fallback needed
   */
  handleVote(socket: Socket, room: SharedRoom, data: unknown): boolean {
    const { gameType } = room.gameState;
    if (!gameType) return false;

    const result = gameRegistry.handleVote(
      gameType,
      room.gameState as BaseGameState,
      socket.data.playerId,
      socket.data.playerName,
      data
    );

    if (!result) return false;

    this.applyResult(room, socket, result);
    return true;
  }

  /**
   * Handle next round event.
   * Routes to the appropriate game's handleNextRound method.
   *
   * @returns true if handled by registry, false if fallback needed
   */
  handleNextRound(socket: Socket, room: SharedRoom): boolean {
    const { gameType } = room.gameState;
    if (!gameType) return false;

    const result = gameRegistry.handleNextRound(
      gameType,
      room.gameState as BaseGameState
    );

    if (!result) return false;

    this.applyResult(room, socket, result);
    return true;
  }

  /**
   * Handle custom game event.
   * Routes to the appropriate game's custom event handler.
   *
   * @returns true if handled, false if no handler found
   */
  async handleCustomEvent(
    eventName: string,
    socket: Socket,
    room: SharedRoom,
    data: unknown
  ): Promise<boolean> {
    const { gameType } = room.gameState;
    if (!gameType) return false;

    const handler = gameRegistry.getCustomEventHandler(gameType, eventName);
    if (!handler) return false;

    const ctx: GameEventContext = {
      socket,
      io: this.io,
      playerId: socket.data.playerId || "",
      playerName: socket.data.playerName || "",
    };

    try {
      const result = await handler(room.gameState as BaseGameState, ctx, data);
      this.applyResult(room, socket, result);
      return true;
    } catch (error) {
      console.error(`Error handling custom event ${eventName}:`, error);
      return false;
    }
  }

  /**
   * Initialize a new game.
   *
   * @returns The initialized game state, or null if game type not found
   */
  initializeGame<S extends BaseGameState>(
    gameType: GameType,
    roomCode: string,
    players: Player[],
    config?: unknown
  ): S | null {
    return gameRegistry.initializeGame<S>(gameType, roomCode, players, config);
  }

  /**
   * Check if a game type is registered.
   */
  hasGame(gameType: GameType): boolean {
    return gameRegistry.has(gameType);
  }

  /**
   * Check if a game can be restarted from current phase.
   */
  canRestart(gameType: GameType | null, phase: string): boolean {
    return gameRegistry.canRestart(gameType, phase);
  }

  /**
   * Get all supported game types.
   */
  getSupportedGames(): GameType[] {
    return gameRegistry.getSupportedGames();
  }

  /**
   * Log router state for debugging.
   */
  logState(): void {
    if (!this.config.debug) return;
    console.log("GameEventRouter state:", {
      supportedGames: this.getSupportedGames(),
      registryStats: gameRegistry.getStats(),
    });
  }
}

/**
 * Create a new event router instance.
 */
export function createEventRouter(
  io: Server,
  config: EventRouterConfig
): GameEventRouter {
  return new GameEventRouter(io, config);
}
