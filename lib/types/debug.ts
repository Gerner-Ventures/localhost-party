import { z } from "zod";
import type { GamePhase, GameState } from "./game";

/**
 * Debug Panel Types
 *
 * Types for the developer debug panel that allows inspecting and
 * manipulating game state in real-time.
 */

/**
 * Valid debug panel tabs
 */
export const DEBUG_TABS = [
  "state",
  "events",
  "phases",
  "players",
  "settings",
] as const;

/**
 * Valid game phases that can be set via debug
 */
export const VALID_GAME_PHASES = [
  "lobby",
  "prompt",
  "submit",
  "vote",
  "results",
  "category_announce",
  "question",
  "answer_reveal",
  "leaderboard",
  "round_results",
  "game_results",
] as const;

/**
 * Zod schema for validating debug:set-state payload
 * Only allows safe, known properties to prevent prototype pollution
 */
export const DebugSetStateSchema = z
  .object({
    phase: z.enum(VALID_GAME_PHASES).optional(),
    currentRound: z.number().int().min(0).max(100).optional(),
    timeRemaining: z.number().int().min(0).max(300).optional(),
    currentPromptIndex: z.number().int().min(0).optional(),
    questionNumber: z.number().int().min(0).optional(),
  })
  .strict(); // Reject unknown properties to prevent prototype pollution

export type DebugSetStateInput = z.infer<typeof DebugSetStateSchema>;

/**
 * Validate a debug tab value from localStorage
 */
export function isValidDebugTab(tab: unknown): tab is DebugTab {
  return typeof tab === "string" && DEBUG_TABS.includes(tab as DebugTab);
}

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
export type DebugTab = "state" | "events" | "phases" | "players" | "settings";

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
