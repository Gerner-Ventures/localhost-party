/**
 * Standalone WebSocket Server for localhost:party
 * Deploy this to Railway for production WebSocket support
 *
 * IMPORTANT: Game logic is imported from ../lib/ (single source of truth).
 * Do NOT duplicate game logic here.
 *
 * SUPPORTED GAMES:
 * - Quiplash (AI Quip Clash)
 * - Pixel Showdown (Speed Trivia)
 *
 * NOTE: AI agent commentary (agent:speak, agent:toggle) is NOT yet supported
 * in this standalone server. Agents currently only work in the combined
 * Next.js server (server.ts). This is a known limitation for the initial
 * release — agent support will be added here in a future iteration.
 */
import "dotenv/config";

import { createServer, IncomingMessage, ServerResponse } from "http";
import { Server } from "socket.io";
import crypto from "crypto";

// Game registry - auto-registers all games on import
import { gameRegistry } from "../lib/games";
import { createEventRouter } from "../lib/server/event-router";
import type { GameEventRouter } from "../lib/server/event-router";

// Shared server utilities (single source of truth)
import {
  sanitizePlayerName,
  isValidRoomCode,
  validatePayloadData,
  ROOM_SETTINGS,
} from "../lib/server/core";

// Quiplash-specific imports (not yet in shared handlers)
import {
  handleSubmission,
  handleVote,
  advanceToNextRound,
  applyScoresToPlayers,
} from "../lib/games/quiplash";
// Shared game handlers - single source of truth for game logic
import {
  initializeGame,
  generateTriviaQuestions,
  handleTriviaAnswerMC,
  handleTriviaAnswerFreeText,
  transitionAfterAllAnswered,
  transitionToLeaderboardPhase,
  advanceTrivia,
  advanceTriviaRound,
  setTriviaQuestions,
  startTriviaQuestions,
  getApiBaseUrl,
} from "../lib/games/handlers";
import { allPlayersAnswered } from "../lib/games/pixel-showdown";
import { logDebug, logInfo, logWarn, logError } from "../lib/logger";
import type { GameState } from "../lib/types/game";
import type { Player } from "../lib/types/player";
import type { PixelShowdownState } from "../lib/types/pixel-showdown";

// Feature flag for new event router
const USE_NEW_EVENT_ROUTER = process.env.USE_NEW_EVENT_ROUTER === "true";

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

// Note: Room cleanup settings, validation helpers, and sanitization functions
// are now imported from lib/server/core.ts (single source of truth)

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

  // Primary app URL from environment
  if (process.env.NEXT_PUBLIC_LH_PARTY_APP_URL) {
    origins.push(process.env.NEXT_PUBLIC_LH_PARTY_APP_URL);
  }

  // Always allow production
  origins.push("https://localhost-party.vercel.app");

  // Local development
  origins.push("http://localhost:3000");
  origins.push("http://localhost:3001");

  // Dynamic Vercel URL (from Vercel environment)
  if (process.env.VERCEL_URL) {
    origins.push(`https://${process.env.VERCEL_URL}`);
  }

  // Additional allowed origins (comma-separated env var)
  if (process.env.ALLOWED_ORIGINS) {
    const additional = process.env.ALLOWED_ORIGINS.split(",").map((o) =>
      o.trim()
    );
    origins.push(...additional);
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
    const isIdle = now - room.lastActivity > ROOM_SETTINGS.IDLE_TIMEOUT;
    const isEmpty =
      room.players.every((p) => !p.isConnected) && !room.displaySocketId;
    const hasNoRecentActivity =
      now - room.lastActivity > ROOM_SETTINGS.CLEANUP_BUFFER;

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

const cleanupInterval = setInterval(
  cleanupIdleRooms,
  ROOM_SETTINGS.CLEANUP_INTERVAL
);

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
// Game Registry and Event Router
// ============================================================================

// Initialize game event router (for new registry-based event handling)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let eventRouter: GameEventRouter | null = null;
if (USE_NEW_EVENT_ROUTER) {
  logInfo("Server", "Using new event router with game registry");
  logInfo(
    "Server",
    `Registered games: ${gameRegistry.getSupportedGames().join(", ")}`
  );
  // Note: eventRouter would need room adapter to work with local rooms Map
  // For now, keeping legacy handlers but game registry is available
} else {
  logInfo("Server", "Using legacy event handlers");
  logInfo(
    "Server",
    `Game registry available with: ${gameRegistry.getSupportedGames().join(", ")}`
  );
}

// ============================================================================
// Socket Event Handlers
// ============================================================================
io.on("connection", (socket) => {
  logDebug("Socket", `Connected: ${socket.id}`);

  // Display joins room
  socket.on("display:join", ({ roomCode, gameType }) => {
    logInfo(
      "Display",
      `Display joining room: ${roomCode} (gameType: ${gameType || "not specified"})`
    );

    const room = getRoom(roomCode);
    room.displaySocketId = socket.id;

    // Set gameType if provided (needed for Railway which doesn't share memory with Vercel API)
    if (gameType && !room.gameState.gameType) {
      room.gameState.gameType = gameType;
      logInfo("Display", `Set gameType for room ${roomCode}: ${gameType}`);
    }

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

    // Use shared game initialization
    const { gameState: newGameState } = initializeGame(
      gameType,
      roomCode,
      room.players
    );
    room.gameState = newGameState as Room["gameState"];

    if (gameType === "pixel-showdown") {
      // Generate questions for first round asynchronously
      const apiBaseUrl = getApiBaseUrl();
      generateTriviaQuestions({
        apiBaseUrl,
        state: room.gameState as PixelShowdownState,
        onQuestionsReady: (questions, category) => {
          room.gameState = setTriviaQuestions(
            room.gameState as PixelShowdownState,
            questions,
            category
          );
          room.gameState.players = room.players;
          broadcastGameState(roomCode);

          // Auto-advance to first question after category announcement
          setTimeout(() => {
            room.gameState = startTriviaQuestions(
              room.gameState as PixelShowdownState
            );
            room.gameState.players = room.players;
            broadcastGameState(roomCode);
          }, 3000);
        },
        onError: (error) => {
          logError("Trivia", "Failed to generate questions", error);
          // Notify clients of the error
          io.to(roomCode).emit("game:error", {
            message: "Failed to generate trivia questions",
            details: error.message,
          });
        },
      });
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

    // Handle both quiplash "results" and pixel-showdown "round_results"
    if (
      room.gameState.phase !== "results" &&
      room.gameState.phase !== "round_results"
    ) {
      logWarn(
        "Game",
        `Cannot advance round in room ${roomCode} - phase is "${room.gameState.phase}", expected "results" or "round_results"`
      );
      socket.emit("player:error", { message: "Not in results phase" });
      return;
    }

    if (room.gameState.gameType === "quiplash") {
      room.gameState = advanceToNextRound(room.gameState);
      // Maintain single source of truth
      room.gameState.players = room.players;
      broadcastGameState(roomCode);
    } else if (room.gameState.gameType === "pixel-showdown") {
      const triviaState = room.gameState as PixelShowdownState;
      room.gameState = advanceTriviaRound(triviaState);
      room.gameState.players = room.players;
      broadcastGameState(roomCode);

      // If we're in category_announce, generate questions for next round
      const newState = room.gameState as PixelShowdownState;
      if (newState.phase === "category_announce") {
        const apiBaseUrl = getApiBaseUrl();
        generateTriviaQuestions({
          apiBaseUrl,
          state: newState,
          onQuestionsReady: (questions, category) => {
            room.gameState = setTriviaQuestions(
              room.gameState as PixelShowdownState,
              questions,
              category
            );
            room.gameState.players = room.players;
            broadcastGameState(roomCode);

            // Auto-advance to first question
            setTimeout(() => {
              room.gameState = startTriviaQuestions(
                room.gameState as PixelShowdownState
              );
              room.gameState.players = room.players;
              broadcastGameState(roomCode);
            }, 3000);
          },
          onError: (error) => {
            logError(
              "Trivia",
              "Failed to generate questions for next round",
              error
            );
            io.to(roomCode).emit("game:error", {
              message: "Failed to generate trivia questions",
              details: error.message,
            });
          },
        });
      }
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

    // Allow restart from both quiplash "results" and pixel-showdown "game_results"
    if (
      room.gameState.phase !== "results" &&
      room.gameState.phase !== "game_results"
    ) {
      logWarn(
        "Game",
        `Cannot restart game in room ${roomCode} - phase is "${room.gameState.phase}", expected "results" or "game_results"`
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

  // Trivia answer submission (Pixel Showdown)
  socket.on("trivia:answer", async ({ roomCode, answer, timestamp }) => {
    if (!isValidRoomCode(roomCode)) {
      socket.emit("player:error", { message: "Invalid room code" });
      return;
    }

    const room = rooms.get(roomCode);
    if (!room || room.gameState.gameType !== "pixel-showdown") {
      socket.emit("player:error", {
        message: "Room not found or wrong game type",
      });
      return;
    }

    const state = room.gameState as PixelShowdownState;
    if (state.phase !== "question" || !state.currentQuestion) {
      return; // Ignore answers outside question phase
    }

    logInfo(
      "Trivia",
      `Answer from "${socket.data.playerName}" in room ${roomCode}`
    );

    const currentQuestion = state.currentQuestion;

    // Use shared handlers for answer processing
    if (currentQuestion.type === "multiple_choice") {
      const result = handleTriviaAnswerMC(
        state,
        socket.data.playerId,
        socket.data.playerName,
        answer,
        timestamp,
        room.players
      );
      room.gameState = result.updatedState;
    } else if (currentQuestion.type === "free_text") {
      try {
        const apiBaseUrl = getApiBaseUrl();
        const result = await handleTriviaAnswerFreeText(
          state,
          socket.data.playerId,
          socket.data.playerName,
          answer,
          timestamp,
          room.players,
          apiBaseUrl
        );
        room.gameState = result.updatedState;
      } catch (error) {
        logError("Trivia", "Failed to judge answer", error);
      }
    }

    room.gameState.players = room.players;
    broadcastGameState(roomCode);

    // Check if all players have answered
    if (allPlayersAnswered(room.gameState as PixelShowdownState)) {
      setTimeout(() => {
        room.gameState = transitionAfterAllAnswered(
          room.gameState as PixelShowdownState
        );
        room.gameState.players = room.players;
        broadcastGameState(roomCode);

        // Auto-advance to leaderboard after reveal
        setTimeout(() => {
          room.gameState = transitionToLeaderboardPhase(
            room.gameState as PixelShowdownState
          );
          room.gameState.players = room.players;
          broadcastGameState(roomCode);

          // Auto-advance from leaderboard to next question or round_results
          setTimeout(() => {
            const leaderboardState = room.gameState as PixelShowdownState;
            // Only advance if still in leaderboard phase
            if (leaderboardState.phase !== "leaderboard") return;

            room.gameState = advanceTrivia(leaderboardState);
            room.gameState.players = room.players;
            broadcastGameState(roomCode);

            // If we transitioned to round_results, auto-advance to next round
            const afterAdvance = room.gameState as PixelShowdownState;
            if (afterAdvance.phase === "round_results") {
              setTimeout(() => {
                const resultState = room.gameState as PixelShowdownState;
                if (resultState.phase !== "round_results") return;

                room.gameState = advanceTriviaRound(resultState);
                room.gameState.players = room.players;
                broadcastGameState(roomCode);

                // If category_announce, generate new questions
                const newState = room.gameState as PixelShowdownState;
                if (newState.phase === "category_announce") {
                  const apiBaseUrl = getApiBaseUrl();
                  generateTriviaQuestions({
                    apiBaseUrl,
                    state: newState,
                    onQuestionsReady: (questions, category) => {
                      room.gameState = setTriviaQuestions(
                        room.gameState as PixelShowdownState,
                        questions,
                        category
                      );
                      room.gameState.players = room.players;
                      broadcastGameState(roomCode);

                      setTimeout(() => {
                        room.gameState = startTriviaQuestions(
                          room.gameState as PixelShowdownState
                        );
                        room.gameState.players = room.players;
                        broadcastGameState(roomCode);
                      }, 3000);
                    },
                    onError: (error) => {
                      logError(
                        "Trivia",
                        "Failed to generate questions for next round",
                        error
                      );
                      io.to(roomCode).emit("game:error", {
                        message: "Failed to generate trivia questions",
                        details: error.message,
                      });
                    },
                  });
                }
              }, 5000);
            }
          }, 4000);
        }, 4000);
      }, 500);
    }
  });

  // Advance to next trivia question
  socket.on("trivia:next-question", ({ roomCode }) => {
    if (!isValidRoomCode(roomCode)) {
      socket.emit("player:error", { message: "Invalid room code" });
      return;
    }

    const room = rooms.get(roomCode);
    if (!room || room.gameState.gameType !== "pixel-showdown") {
      socket.emit("player:error", {
        message: "Room not found or wrong game type",
      });
      return;
    }

    const state = room.gameState as PixelShowdownState;
    if (state.phase !== "leaderboard") {
      return;
    }

    logInfo("Trivia", `Advancing to next question in room ${roomCode}`);

    room.gameState = advanceTrivia(state);
    room.gameState.players = room.players;
    broadcastGameState(roomCode);

    // If we transitioned to category_announce, generate questions for next round
    const newState = room.gameState as PixelShowdownState;
    if (newState.phase === "category_announce") {
      const apiBaseUrl = getApiBaseUrl();
      generateTriviaQuestions({
        apiBaseUrl,
        state: newState,
        onQuestionsReady: (questions, category) => {
          room.gameState = setTriviaQuestions(
            room.gameState as PixelShowdownState,
            questions,
            category
          );
          room.gameState.players = room.players;
          broadcastGameState(roomCode);

          // Auto-advance to first question
          setTimeout(() => {
            room.gameState = startTriviaQuestions(
              room.gameState as PixelShowdownState
            );
            room.gameState.players = room.players;
            broadcastGameState(roomCode);
          }, 3000);
        },
        onError: (error) => {
          logError(
            "Trivia",
            "Failed to generate questions for next round",
            error
          );
          io.to(roomCode).emit("game:error", {
            message: "Failed to generate trivia questions",
            details: error.message,
          });
        },
      });
    }
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
  const apiUrl = getApiBaseUrl();
  console.log(`
+----------------------------------------------------+
|                                                    |
|     localhost:party WebSocket Server               |
|                                                    |
|     Port: ${port}                                     |
|     Health: http://localhost:${port}/health            |
|     API URL: ${apiUrl.padEnd(35)}|
|     Status: Ready for connections                  |
|                                                    |
+----------------------------------------------------+
  `);

  // Warn if using localhost in production (likely misconfigured)
  if (apiUrl.includes("localhost") && process.env.NODE_ENV === "production") {
    console.warn(
      "⚠️  WARNING: API URL is set to localhost in production mode.",
      "This will cause trivia question generation to fail.",
      "Set NEXT_PUBLIC_LH_PARTY_APP_URL to the Vercel deployment URL."
    );
  }
});
