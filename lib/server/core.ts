/**
 * Server Core Module
 *
 * Provides shared functionality for both the combined Next.js server
 * and the standalone WebSocket server.
 *
 * This module extracts common patterns to eliminate code duplication
 * between server.ts and websocket-server/server.ts.
 */

import type { Server, Socket } from "socket.io";
import type { Player } from "@/lib/types/player";
import type { GameType } from "@/lib/types/game";
import type { SharedRoom } from "@/lib/shared-rooms";
import * as sharedRooms from "@/lib/shared-rooms";
import crypto from "crypto";

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Server configuration options.
 */
export interface ServerConfig {
  /** Enable AI agent system */
  enableAgents: boolean;
  /** Enable database persistence */
  enableDatabase: boolean;
  /** Enable debug panel handlers */
  enableDebugHandlers: boolean;
  /** Enable verbose logging */
  debug?: boolean;
}

/**
 * Room cleanup settings.
 */
export const ROOM_SETTINGS = {
  /** Time before a room is considered idle (30 minutes) */
  IDLE_TIMEOUT: 30 * 60 * 1000,
  /** How often to check for idle rooms (5 minutes) */
  CLEANUP_INTERVAL: 5 * 60 * 1000,
  /** Buffer time before actual deletion (1 minute) */
  CLEANUP_BUFFER: 60 * 1000,
};

// ============================================================================
// ROOM TIMEOUT MANAGEMENT
// ============================================================================

/** Track auto-advance timeouts per room to prevent memory leaks */
const roomTimeouts = new Map<string, NodeJS.Timeout[]>();

/**
 * Schedule a timeout for a room with automatic tracking.
 * When the room is cleaned up, all pending timeouts are cleared.
 */
export function scheduleRoomTimeout(
  roomCode: string,
  callback: () => void,
  delay: number
): NodeJS.Timeout {
  const timeoutId = setTimeout(() => {
    // Remove this timeout from tracking when it fires
    const timeouts = roomTimeouts.get(roomCode);
    if (timeouts) {
      const index = timeouts.indexOf(timeoutId);
      if (index > -1) timeouts.splice(index, 1);
    }
    callback();
  }, delay);

  // Track the timeout
  const existing = roomTimeouts.get(roomCode) || [];
  existing.push(timeoutId);
  roomTimeouts.set(roomCode, existing);

  return timeoutId;
}

/**
 * Clear all pending timeouts for a room.
 */
export function clearRoomTimeouts(roomCode: string): void {
  const timeouts = roomTimeouts.get(roomCode);
  if (timeouts) {
    timeouts.forEach((id) => clearTimeout(id));
    roomTimeouts.delete(roomCode);
  }
}

/**
 * Get count of active timeouts for a room (for debugging).
 */
export function getRoomTimeoutCount(roomCode: string): number {
  return roomTimeouts.get(roomCode)?.length ?? 0;
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Sanitize player name for safe display and storage.
 */
export function sanitizePlayerName(name: unknown): string {
  if (typeof name !== "string") return "";
  return name
    .trim()
    .replace(/[<>'"&]/g, "") // Remove potentially dangerous characters
    .replace(/\s+/g, " ") // Normalize whitespace
    .slice(0, 20); // Enforce max length
}

/**
 * Validate room code format (4 uppercase letters).
 */
export function isValidRoomCode(code: unknown): code is string {
  if (typeof code !== "string") return false;
  return /^[A-Z]{4}$/.test(code);
}

/**
 * Generate a random room code.
 */
export function generateRoomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Sanitized payload type for submissions and votes.
 */
export type SanitizedPayload =
  | string
  | Record<string, string | number | boolean>
  | null;

/**
 * Validate and sanitize submission/vote data.
 */
export function validatePayloadData(data: unknown): {
  valid: boolean;
  sanitized: SanitizedPayload;
} {
  if (data === null || data === undefined) {
    return { valid: false, sanitized: null };
  }

  // If it's a string, sanitize it
  if (typeof data === "string") {
    const sanitized = data
      .slice(0, 1000) // Max 1000 chars for text submissions
      .replace(/[<>]/g, ""); // Remove HTML brackets
    return { valid: true, sanitized };
  }

  // If it's a simple object (vote choice, etc.), validate structure
  if (typeof data === "object" && !Array.isArray(data)) {
    // Only allow specific known properties
    const allowed = [
      "choice",
      "optionId",
      "answerId",
      "value",
      "text",
      "promptId",
      "answer",
      "timestamp",
    ];
    const sanitized: Record<string, string | number | boolean> = {};
    const dataObj = data as Record<string, unknown>;
    for (const key of allowed) {
      if (dataObj[key] !== undefined) {
        if (typeof dataObj[key] === "string") {
          sanitized[key] = (dataObj[key] as string)
            .slice(0, 500)
            .replace(/[<>]/g, "");
        } else if (typeof dataObj[key] === "number") {
          sanitized[key] = dataObj[key] as number;
        } else if (typeof dataObj[key] === "boolean") {
          sanitized[key] = dataObj[key] as boolean;
        }
      }
    }
    return { valid: true, sanitized };
  }

  return { valid: false, sanitized: null };
}

// ============================================================================
// PLAYER MANAGEMENT
// ============================================================================

/**
 * Create a new player.
 */
export function createPlayer(
  id: string,
  name: string,
  roomCode: string,
  socketId: string
): Player {
  return {
    id,
    name,
    roomCode,
    score: 0,
    isConnected: true,
    socketId,
  };
}

/**
 * Generate a unique player ID.
 */
export function generatePlayerId(): string {
  return crypto.randomUUID();
}

/**
 * Find a player in a room by socket ID.
 */
export function findPlayerBySocketId(
  room: SharedRoom,
  socketId: string
): Player | undefined {
  return room.players.find((p) => p.socketId === socketId);
}

/**
 * Find a player in a room by player ID.
 */
export function findPlayerById(
  room: SharedRoom,
  playerId: string
): Player | undefined {
  return room.players.find((p) => p.id === playerId);
}

/**
 * Apply scores to players (mutates player objects).
 */
export function applyScoresToPlayers(
  players: Player[],
  scores: Record<string, number> | undefined
): void {
  if (!scores || Object.keys(scores).length === 0) return;

  players.forEach((player) => {
    player.score += scores[player.id] || 0;
  });
}

/**
 * Reset all player scores to zero.
 */
export function resetPlayerScores(players: Player[]): void {
  players.forEach((player) => {
    player.score = 0;
  });
}

// ============================================================================
// ROOM MANAGEMENT
// ============================================================================

/**
 * Create a new room.
 */
export function createRoom(
  code: string,
  gameType: GameType | null = null
): SharedRoom {
  return {
    code,
    players: [],
    gameState: {
      roomCode: code,
      gameType,
      currentRound: 1,
      phase: "lobby",
      players: [], // Will be set to room.players
    },
    displaySocketId: null,
    lastActivity: Date.now(),
    createdAt: new Date(),
  };
}

/**
 * Get or create a room.
 */
export function getOrCreateRoom(
  code: string,
  gameType: GameType | null = null
): SharedRoom {
  let room = sharedRooms.get(code);
  if (!room) {
    room = createRoom(code, gameType);
    sharedRooms.set(code, room);
  }
  // Maintain single source of truth
  room.gameState.players = room.players;
  return room;
}

/**
 * Update room last activity timestamp.
 */
export function touchRoom(room: SharedRoom): void {
  room.lastActivity = Date.now();
}

/**
 * Check if a room is idle (no activity for IDLE_TIMEOUT).
 */
export function isRoomIdle(room: SharedRoom): boolean {
  const now = Date.now();
  return now - room.lastActivity > ROOM_SETTINGS.IDLE_TIMEOUT;
}

/**
 * Check if a room has any connected players or display.
 */
export function hasConnectedClients(room: SharedRoom): boolean {
  const hasConnectedPlayers = room.players.some((p) => p.isConnected);
  return hasConnectedPlayers || room.displaySocketId !== null;
}

// ============================================================================
// BROADCAST UTILITIES
// ============================================================================

/**
 * Create a broadcast function for game state updates.
 */
export function createBroadcastGameState(
  io: Server,
  onBroadcast?: (roomCode: string, room: SharedRoom) => void
) {
  return function broadcastGameState(roomCode: string): void {
    const room = sharedRooms.get(roomCode);
    if (!room) {
      console.warn(`[Broadcast] Room ${roomCode} not found`);
      return;
    }

    // Ensure single source of truth
    room.gameState.players = room.players;

    // Emit to all clients in the room
    io.to(roomCode).emit("game:state-update", room.gameState);

    // Optional callback for additional processing (e.g., agent updates)
    if (onBroadcast) {
      onBroadcast(roomCode, room);
    }
  };
}

// ============================================================================
// ROOM CLEANUP
// ============================================================================

/**
 * Cleanup function for a single room.
 */
export function cleanupRoom(
  code: string,
  additionalCleanup?: (code: string) => void
): void {
  clearRoomTimeouts(code);
  if (additionalCleanup) {
    additionalCleanup(code);
  }
  sharedRooms.remove(code);
  console.log(`[Cleanup] Removed room ${code}`);
}

/**
 * Start the room cleanup interval.
 * Returns a function to stop the interval.
 */
export function startRoomCleanupInterval(
  additionalCleanup?: (code: string) => void
): () => void {
  const intervalId = setInterval(() => {
    const now = Date.now();

    for (const [code, room] of sharedRooms.entries()) {
      const idleTime = now - room.lastActivity;
      const isIdle = idleTime > ROOM_SETTINGS.IDLE_TIMEOUT;
      const hasClients = hasConnectedClients(room);

      if (isIdle && !hasClients) {
        // Add buffer before actual deletion
        if (
          idleTime >
          ROOM_SETTINGS.IDLE_TIMEOUT + ROOM_SETTINGS.CLEANUP_BUFFER
        ) {
          cleanupRoom(code, additionalCleanup);
        }
      }
    }
  }, ROOM_SETTINGS.CLEANUP_INTERVAL);

  return () => clearInterval(intervalId);
}

// ============================================================================
// SOCKET UTILITIES
// ============================================================================

/**
 * Join a socket to a room.
 */
export function joinSocketToRoom(socket: Socket, roomCode: string): void {
  socket.join(roomCode);
}

/**
 * Leave a socket from a room.
 */
export function leaveSocketFromRoom(socket: Socket, roomCode: string): void {
  socket.leave(roomCode);
}

/**
 * Set socket data for player tracking.
 */
export function setSocketPlayerData(
  socket: Socket,
  playerId: string,
  playerName: string,
  roomCode: string
): void {
  socket.data.playerId = playerId;
  socket.data.playerName = playerName;
  socket.data.roomCode = roomCode;
}

// ============================================================================
// LOGGING
// ============================================================================

/**
 * Log a WebSocket event (for debugging).
 */
export function logSocketEvent(
  event: string,
  socketId: string,
  data?: unknown
): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [WS] ${event} from ${socketId}`, data || "");
}

/**
 * Log an error with context.
 */
export function logError(
  context: string,
  message: string,
  error?: unknown
): void {
  console.error(`[${context}] ${message}`, error || "");
}

/**
 * Log a warning.
 */
export function logWarn(context: string, message: string): void {
  console.warn(`[${context}] ${message}`);
}

/**
 * Log info.
 */
export function logInfo(context: string, message: string): void {
  console.log(`[${context}] ${message}`);
}
