// Type definitions for shared-rooms.js
import type { Player } from "./types/player";
import type {
  GameSubmission,
  GameVote,
  GameType,
  GamePhase,
} from "./types/game";

export interface SharedRoom {
  code: string;
  players: Array<{
    id: string;
    name: string;
    roomCode: string;
    score: number;
    isConnected: boolean;
    socketId: string;
  }>;
  gameState: {
    roomCode: string;
    gameType: GameType | null;
    currentRound: number;
    phase: GamePhase;
    players: Player[];
    submissions?: GameSubmission[];
    votes?: GameVote[];
    roundResults?: Record<string, number>;
    prompts?: Array<{ id: string; text: string; assignedPlayerIds?: string[] }>;
    currentPromptIndex?: number;
    timeRemaining?: number;
  };
  displaySocketId: string | null;
  lastActivity: number;
  createdAt?: Date;
}

export function get(code: string): SharedRoom | undefined;
export function set(code: string, room: SharedRoom): void;
export function has(code: string): boolean;
export function remove(code: string): boolean;
export function list(): SharedRoom[];
export function entries(): IterableIterator<[string, SharedRoom]>;
export function size(): number;
