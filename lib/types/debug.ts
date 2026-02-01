import type { GamePhase, GameState } from "./game";

/**
 * Debug Panel Types
 *
 * Types for the developer debug panel that allows inspecting and
 * manipulating game state in real-time.
 */

/**
 * A logged WebSocket event (sent or received)
 */
export interface DebugEvent {
  id: string;
  timestamp: number;
  direction: "sent" | "received";
  type: string;
  payload: unknown;
}

/**
 * Debug panel tab options
 */
export type DebugTab = "state" | "events" | "phases" | "players";

/**
 * Debug panel UI state
 */
export interface DebugState {
  isOpen: boolean;
  activeTab: DebugTab;
  eventLog: DebugEvent[];
  maxEvents: number;
  isPaused: boolean;
  eventFilter: string;
}

/**
 * Debug context value exposed to components
 */
export interface DebugContextValue {
  state: DebugState;
  isHydrated: boolean;
  togglePanel: () => void;
  setActiveTab: (tab: DebugTab) => void;
  logEvent: (event: Omit<DebugEvent, "id" | "timestamp">) => void;
  clearEventLog: () => void;
  togglePause: () => void;
  setEventFilter: (filter: string) => void;

  // Debug actions (emit WebSocket events)
  setPhase: (phase: GamePhase) => void;
  addFakePlayer: (name: string) => void;
  removePlayer: (playerId: string) => void;
  setPlayerScore: (playerId: string, score: number) => void;
  setGameState: (partialState: Partial<GameState>) => void;
  resetGame: () => void;
}

/**
 * WebSocket payload types for debug events
 */
export interface DebugSetPhasePayload {
  roomCode: string;
  phase: GamePhase;
}

export interface DebugAddPlayerPayload {
  roomCode: string;
  name: string;
}

export interface DebugRemovePlayerPayload {
  roomCode: string;
  playerId: string;
}

export interface DebugSetScorePayload {
  roomCode: string;
  playerId: string;
  score: number;
}

export interface DebugSetStatePayload {
  roomCode: string;
  partialState: Partial<GameState>;
}
