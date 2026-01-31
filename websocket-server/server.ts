/**
 * Standalone WebSocket Server for localhost:party
 * Deploy this to Railway for production WebSocket support
 *
 * IMPORTANT: Game logic is imported from ../lib/ (single source of truth).
 * Do NOT duplicate game logic here.
 */
import "dotenv/config";

import { createServer, IncomingMessage, ServerResponse } from "http";
import { Server } from "socket.io";
import crypto from "crypto";
import {
  initializeQuiplashGame,
  handleSubmission,
  handleVote,
  advanceToNextRound,
  applyScoresToPlayers,
} from "../lib/games/quiplash";
import { logDebug, logInfo, logWarn, logError } from "../lib/logger";
import type { GameState } from "../lib/types/game";
import type { Player } from "../lib/types/player";

const port = parseInt(process.env.PORT || "3001", 10);

// ============================================================================
// In-memory Room Storage
// ============================================================================
/**
 * CRITICAL ARCHITECTURE: Single Source of Truth for Player Data
 * ==============================================================
 *
 * `room.players` is the ONLY canonical source of player data (including scores).
 * `room.gameState.players` MUST always reference `room.players` (not a copy).
 *
 * This pattern ensures:
 * 1. Score updates to `room.players` are immediately visible in `gameState`
 * 2. No synchronization bugs between two separate player arrays
 * 3. `broadcastGameState()` always sends current player data
 *
 * IMPORTANT: When calling game logic functions that return new gameState objects
 * (like `handleVote()`, `advanceToNextRound()`), you MUST:
 * 1. Apply any score changes to `room.players` using `applyScoresToPlayers()`
 * 2. Reassign `room.gameState.players = room.players` to maintain the reference
 *
 * The `broadcastGameState()` function includes a defensive check to detect
 * if this reference is accidentally broken.
 */

interface Room {
  code: string;
  players: Player[];
  gameState: GameState;
  displaySocketId: string | null;
  lastActivity: number;
  createdAt: Date;
}

const rooms = new Map<string, Room>();
const playerSockets = new Map<string, Player>();

// Room cleanup settings
const ROOM_IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const ROOM_CLEANUP_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const ROOM_CLEANUP_BUFFER = 60 * 1000; // 1 minute buffer

// ============================================================================
// Validation Helpers
// ============================================================================
function sanitizePlayerName(name: unknown): string {
  if (typeof name !== "string") return "";
  return name
    .trim()
    .replace(/[<>'"&]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 20);
}

function isValidRoomCode(code: unknown): code is string {
  if (typeof code !== "string") return false;
  return /^[A-Z]{4}$/.test(code);
}

type SanitizedPayload =
  | string
  | Record<string, string | number | boolean>
  | null;

function validatePayloadData(data: unknown): {
  valid: boolean;
  sanitized: SanitizedPayload;
} {
  if (data === null || data === undefined) {
    return { valid: false, sanitized: null };
  }

  if (typeof data === "string") {
    const sanitized = data.slice(0, 1000).replace(/[<>]/g, "");
    return { valid: true, sanitized };
  }

  if (typeof data === "object" && !Array.isArray(data)) {
    const allowed = ["choice", "optionId", "answerId", "value", "text"];
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
// HTTP Server with Health Check
// ============================================================================
const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // Health check
  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "healthy",
        rooms: rooms.size,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // Room list (for debugging)
  if (req.url === "/api/rooms" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    const roomList = Array.from(rooms.entries()).map(([code, room]) => ({
      code,
      playerCount: room.players.length,
      phase: room.gameState?.phase,
      hasDisplay: !!room.displaySocketId,
    }));
    res.end(JSON.stringify({ rooms: roomList }));
    return;
  }

  // Check specific room
  if (req.url?.startsWith("/api/rooms/") && req.method === "GET") {
    const code = req.url.split("/")[3]?.toUpperCase();
    if (code && isValidRoomCode(code)) {
      const room = rooms.get(code);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          exists: !!room,
          code,
          playerCount: room?.players.length || 0,
        })
      );
      return;
    }
  }

  res.writeHead(404);
  res.end("Not found");
});

// ============================================================================
// Socket.io Server
// ============================================================================
const getAllowedOrigins = (): string[] => {
  const origins: string[] = [];

  if (process.env.NEXT_PUBLIC_LH_PARTY_APP_URL) {
    origins.push(process.env.NEXT_PUBLIC_LH_PARTY_APP_URL);
  }

  origins.push("http://localhost:3000");
  origins.push("http://localhost:3001");

  if (process.env.VERCEL_URL) {
    origins.push(`https://${process.env.VERCEL_URL}`);
  }

  return origins;
};

const io = new Server(httpServer, {
  cors: {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      const allowedOrigins = getAllowedOrigins();
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow localhost-party Vercel preview deployments only
      if (
        origin.match(/^https:\/\/localhost-party(-[a-z0-9-]+)*\.vercel\.app$/)
      ) {
        return callback(null, true);
      }

      callback(null, false);
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ============================================================================
// Room Management
// ============================================================================
function getRoom(roomCode: string): Room {
  let room = rooms.get(roomCode);
  if (!room) {
    room = {
      code: roomCode,
      players: [],
      gameState: {
        roomCode,
        gameType: null,
        currentRound: 0,
        phase: "lobby",
        players: [],
      },
      displaySocketId: null,
      lastActivity: Date.now(),
      createdAt: new Date(),
    };
    // Make gameState.players reference room.players (single source of truth)
    room.gameState.players = room.players;
    rooms.set(roomCode, room);
    logInfo("Room", `Created room: ${roomCode}`);
  }
  room.lastActivity = Date.now();
  return room;
}

function cleanupIdleRooms(): void {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [code, room] of rooms.entries()) {
    const isIdle = now - room.lastActivity > ROOM_IDLE_TIMEOUT;
    const isEmpty =
      room.players.every((p) => !p.isConnected) && !room.displaySocketId;
    const hasNoRecentActivity = now - room.lastActivity > ROOM_CLEANUP_BUFFER;

    if (isIdle && isEmpty && hasNoRecentActivity) {
      rooms.delete(code);
      cleanedCount++;
      logInfo("Cleanup", `Removed idle room: ${code}`);
    }
  }

  if (cleanedCount > 0) {
    logInfo(
      "Cleanup",
      `Removed ${cleanedCount} room(s). Active: ${rooms.size}`
    );
  }
}

const cleanupInterval = setInterval(cleanupIdleRooms, ROOM_CLEANUP_INTERVAL);

/**
 * Broadcast game state to all clients in a room.
 * IMPORTANT: room.players is the single source of truth.
 * gameState.players always references room.players.
 */
function broadcastGameState(roomCode: string): void {
  const room = rooms.get(roomCode);
  if (!room) return;

  // Defensive check: detect if reference was accidentally broken
  if (room.gameState.players !== room.players) {
    logWarn(
      "Broadcast",
      `Reference integrity broken for room ${roomCode} - restoring`
    );
  }

  // Ensure gameState.players references room.players (single source of truth)
  room.gameState.players = room.players;

  logDebug(
    "Broadcast",
    `Room ${roomCode} - Phase: ${room.gameState.phase}, Round: ${room.gameState.currentRound}`,
    {
      players: room.players.map((p) => ({
        name: p.name,
        score: p.score,
        connected: p.isConnected,
      })),
      roundResults: room.gameState.roundResults || null,
    }
  );

  io.to(roomCode).emit("game:state-update", room.gameState);
}

// ============================================================================
// Socket Event Handlers
// ============================================================================
io.on("connection", (socket) => {
  logDebug("Socket", `Connected: ${socket.id}`);

  // Display joins room
  socket.on("display:join", ({ roomCode }) => {
    logInfo("Display", `Display joining room: ${roomCode}`);

    const room = getRoom(roomCode);
    room.displaySocketId = socket.id;

    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.isDisplay = true;

    // Ensure players reference is correct before sending
    room.gameState.players = room.players;
    socket.emit("game:state-update", room.gameState);
  });

  // Player joins room
  socket.on("player:join", ({ roomCode, name }) => {
    const sanitizedName = sanitizePlayerName(name);
    const upperRoomCode =
      typeof roomCode === "string" ? roomCode.toUpperCase() : "";

    if (!isValidRoomCode(upperRoomCode)) {
      socket.emit("player:error", { message: "Invalid room code format" });
      return;
    }

    if (!sanitizedName || sanitizedName.length < 1) {
      socket.emit("player:error", { message: "Invalid player name" });
      return;
    }

    logInfo("Player", `"${sanitizedName}" joining room: ${upperRoomCode}`);

    const room = getRoom(upperRoomCode);
    let player = room.players.find((p) => p.name === sanitizedName);

    if (player) {
      // Reconnecting player
      player.socketId = socket.id;
      player.isConnected = true;
    } else {
      // New player
      player = {
        id: crypto.randomUUID(),
        name: sanitizedName,
        roomCode: upperRoomCode,
        score: 0,
        isConnected: true,
        socketId: socket.id,
      };
      room.players.push(player);
    }

    socket.join(upperRoomCode);
    socket.data.roomCode = upperRoomCode;
    socket.data.playerId = player.id;
    socket.data.playerName = sanitizedName;
    playerSockets.set(socket.id, player);

    broadcastGameState(upperRoomCode);
    socket.emit("player:joined", player);
    logInfo("Player", `"${sanitizedName}" joined room ${upperRoomCode}`, {
      playerId: player.id,
      score: player.score,
    });
  });

  // Disconnect
  socket.on("disconnect", () => {
    logDebug("Socket", `Disconnected: ${socket.id}`);

    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    const room = rooms.get(roomCode);
    if (!room) return;

    if (socket.data.playerId) {
      const player = room.players.find((p) => p.id === socket.data.playerId);
      if (player) {
        player.isConnected = false;
        logInfo("Player", `"${player.name}" disconnected from ${roomCode}`);
        broadcastGameState(roomCode);
      }
      playerSockets.delete(socket.id);
    }

    if (socket.data.isDisplay) {
      room.displaySocketId = null;
      logInfo("Display", `Display disconnected from ${roomCode}`);
    }
  });

  // Start game
  socket.on("game:start", ({ roomCode, gameType }) => {
    logInfo("Game", `Starting "${gameType}" in room ${roomCode}`);

    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit("player:error", { message: "Room not found" });
      return;
    }

    if (room.gameState.phase !== "lobby") {
      logWarn(
        "Game",
        `Cannot start game in room ${roomCode} - phase is "${room.gameState.phase}", expected "lobby"`
      );
      socket.emit("player:error", { message: "Game already in progress" });
      return;
    }

    if (gameType === "quiplash") {
      room.gameState = initializeQuiplashGame(roomCode, room.players);
    } else {
      room.gameState.gameType = gameType;
      room.gameState.phase = "prompt";
      room.gameState.currentRound = 1;
      room.gameState.players = room.players;
    }

    broadcastGameState(roomCode);
  });

  // Player submission
  socket.on("player:submit", ({ roomCode, data }) => {
    if (!isValidRoomCode(roomCode)) {
      socket.emit("player:error", { message: "Invalid room code" });
      return;
    }

    const { valid, sanitized } = validatePayloadData(data);
    if (!valid) {
      socket.emit("player:error", { message: "Invalid submission data" });
      return;
    }

    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit("player:error", { message: "Room not found" });
      return;
    }

    if (room.gameState.gameType === "quiplash") {
      room.gameState = handleSubmission(
        room.gameState,
        socket.data.playerId,
        socket.data.playerName,
        sanitized as string
      );
      // Maintain single source of truth
      room.gameState.players = room.players;
    } else {
      if (!room.gameState.submissions) {
        room.gameState.submissions = [];
      }
      room.gameState.submissions.push({
        playerId: socket.data.playerId,
        playerName: socket.data.playerName,
        data: sanitized,
        timestamp: Date.now(),
      });
    }

    broadcastGameState(roomCode);
  });

  // Player vote
  socket.on("player:vote", ({ roomCode, data }) => {
    if (!isValidRoomCode(roomCode)) {
      socket.emit("player:error", { message: "Invalid room code" });
      return;
    }

    const { valid, sanitized } = validatePayloadData(data);
    if (!valid) {
      socket.emit("player:error", { message: "Invalid vote data" });
      return;
    }

    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit("player:error", { message: "Room not found" });
      return;
    }

    if (room.gameState.gameType === "quiplash") {
      const previousPhase = room.gameState.phase;
      room.gameState = handleVote(
        room.gameState,
        socket.data.playerId,
        socket.data.playerName,
        sanitized as string
      );

      // If we just transitioned to results, apply scores to the canonical players array
      if (previousPhase === "vote" && room.gameState.phase === "results") {
        logInfo("Scoring", "Vote phase complete - applying scores to players");
        applyScoresToPlayers(room.players, room.gameState.roundResults);
      }

      // Maintain single source of truth
      room.gameState.players = room.players;
    } else {
      if (!room.gameState.votes) {
        room.gameState.votes = [];
      }
      room.gameState.votes.push({
        playerId: socket.data.playerId,
        playerName: socket.data.playerName,
        data: sanitized,
        timestamp: Date.now(),
      });
    }

    broadcastGameState(roomCode);
  });

  // Next round
  socket.on("game:next-round", ({ roomCode }) => {
    if (!isValidRoomCode(roomCode)) {
      socket.emit("player:error", { message: "Invalid room code" });
      return;
    }

    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit("player:error", { message: "Room not found" });
      return;
    }

    if (room.gameState.phase !== "results") {
      logWarn(
        "Game",
        `Cannot advance round in room ${roomCode} - phase is "${room.gameState.phase}", expected "results"`
      );
      socket.emit("player:error", { message: "Not in results phase" });
      return;
    }

    if (room.gameState.gameType === "quiplash") {
      room.gameState = advanceToNextRound(room.gameState);
      // Maintain single source of truth
      room.gameState.players = room.players;
      broadcastGameState(roomCode);
    }
  });

  // Restart game (return to lobby with same players)
  socket.on("game:restart", ({ roomCode }) => {
    if (!isValidRoomCode(roomCode)) {
      socket.emit("player:error", { message: "Invalid room code" });
      return;
    }

    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit("player:error", { message: "Room not found" });
      return;
    }

    if (room.gameState.phase !== "results") {
      logWarn(
        "Game",
        `Cannot restart game in room ${roomCode} - phase is "${room.gameState.phase}", expected "results"`
      );
      socket.emit("player:error", { message: "Game not finished" });
      return;
    }

    logInfo("Game", `Restarting game in room ${roomCode}`);

    // Reset all player scores
    room.players.forEach((player) => {
      player.score = 0;
    });

    // Reset game state to lobby
    room.gameState = {
      roomCode,
      gameType: null,
      currentRound: 0,
      phase: "lobby",
      players: room.players,
    };

    broadcastGameState(roomCode);
  });

  // Heartbeat
  socket.on("ping", () => {
    socket.emit("pong");
  });
});

// ============================================================================
// Graceful Shutdown
// ============================================================================
process.on("SIGTERM", () => {
  logInfo("Server", "Received SIGTERM, shutting down...");
  clearInterval(cleanupInterval);
  io.close(() => {
    logInfo("Server", "Socket.io closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logInfo("Server", "Received SIGINT, shutting down...");
  clearInterval(cleanupInterval);
  io.close(() => {
    logInfo("Server", "Socket.io closed");
    process.exit(0);
  });
});

// ============================================================================
// Start Server
// ============================================================================
httpServer.listen(port, () => {
  console.log(`
+----------------------------------------------------+
|                                                    |
|     localhost:party WebSocket Server               |
|                                                    |
|     Port: ${port}                                     |
|     Health: http://localhost:${port}/health            |
|     Status: Ready for connections                  |
|                                                    |
+----------------------------------------------------+
  `);
});
