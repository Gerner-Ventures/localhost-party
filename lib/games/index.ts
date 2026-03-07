/**
 * Game System Entry Point
 *
 * Import this module to initialize the game registry with all registered games.
 * This ensures all game contracts are registered before the server starts.
 */

// Import registry first
export { gameRegistry, defineGame } from "./registry";

// Import contracts to auto-register them
// These imports have side effects that register the games
import "./quiplash-contract";
import "./pixel-showdown-contract";

// Re-export types
export type {
  GameContract,
  BaseGameState,
  GameEventResult,
  GameEventContext,
  GameSideEffect,
  GameEventHandler,
} from "./types/game-contract";

// Mark registry as initialized
import { gameRegistry } from "./registry";
gameRegistry.markInitialized();

// Log initialization
console.log("[Games] Game registry initialized");
