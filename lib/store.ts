import type { Room } from './types';
// Use shared rooms registry for consistency with WebSocket server
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharedRooms = require('./shared-rooms');

// Room store that delegates to the shared registry
// This ensures API routes and WebSocket server share the same room state
export const roomStore = {
  create: (code: string): Room => {
    // Check if room already exists
    const existing = sharedRooms.get(code);
    if (existing) {
      return {
        id: existing.id || crypto.randomUUID(),
        code: existing.code,
        status: existing.gameState?.phase === 'lobby' ? 'waiting' : 'playing',
        createdAt: existing.createdAt || new Date(),
      };
    }

    // Create new room in shared registry
    const room = {
      code,
      players: [],
      gameState: {
        roomCode: code,
        gameType: null,
        currentRound: 0,
        phase: 'lobby',
        players: [],
      },
      displaySocketId: null,
      lastActivity: Date.now(),
      createdAt: new Date(),
      id: crypto.randomUUID(),
    };
    sharedRooms.set(code, room);

    return {
      id: room.id,
      code: room.code,
      status: 'waiting',
      createdAt: room.createdAt,
    };
  },

  get: (code: string): Room | undefined => {
    const room = sharedRooms.get(code);
    if (!room) return undefined;

    return {
      id: room.id || crypto.randomUUID(),
      code: room.code,
      status: room.gameState?.phase === 'lobby' ? 'waiting' : 'playing',
      createdAt: room.createdAt || new Date(),
    };
  },

  delete: (code: string): boolean => {
    return sharedRooms.remove(code);
  },

  list: (): Room[] => {
    return sharedRooms.list().map((room: { id?: string; code: string; gameState?: { phase: string }; createdAt?: Date }) => ({
      id: room.id || crypto.randomUUID(),
      code: room.code,
      status: room.gameState?.phase === 'lobby' ? 'waiting' : 'playing',
      createdAt: room.createdAt || new Date(),
    }));
  },

  update: (code: string, updates: Partial<Room>): Room | undefined => {
    const room = sharedRooms.get(code);
    if (!room) return undefined;

    // Update room properties
    if (updates.status) {
      room.gameState.phase = updates.status === 'waiting' ? 'lobby' : 'prompt';
    }

    return {
      id: room.id || crypto.randomUUID(),
      code: room.code,
      status: room.gameState?.phase === 'lobby' ? 'waiting' : 'playing',
      createdAt: room.createdAt || new Date(),
    };
  },
};
