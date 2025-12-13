// Type definitions for shared-rooms.js

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
    gameType: string | null;
    currentRound: number;
    phase: string;
    players: Array<any>;
    submissions?: Array<any>;
    votes?: Array<any>;
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
