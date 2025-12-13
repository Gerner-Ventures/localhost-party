import type { Room } from './types';

// Simple in-memory store for rooms (temporary until Prisma is set up)
// This will be replaced with database queries in production
const rooms = new Map<string, Room>();

export const roomStore = {
  create: (code: string): Room => {
    const room: Room = {
      id: crypto.randomUUID(),
      code,
      status: 'waiting',
      createdAt: new Date(),
    };
    rooms.set(code, room);
    return room;
  },

  get: (code: string): Room | undefined => {
    return rooms.get(code);
  },

  delete: (code: string): boolean => {
    return rooms.delete(code);
  },

  list: (): Room[] => {
    return Array.from(rooms.values());
  },

  update: (code: string, updates: Partial<Room>): Room | undefined => {
    const room = rooms.get(code);
    if (!room) return undefined;

    const updated = { ...room, ...updates };
    rooms.set(code, updated);
    return updated;
  },
};
