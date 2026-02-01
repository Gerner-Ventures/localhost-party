// Load environment variables first
import "dotenv/config";

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import crypto from "crypto";
import * as sharedRooms from "./lib/shared-rooms";
import type { SharedRoom } from "./lib/shared-rooms";
import {
  handleSubmission,
  handleVote,
  advanceToNextRound,
  applyScoresToPlayers,
  getPlayerPrompt,
} from "./lib/games/quiplash";
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
} from "./lib/games/handlers";
import { handleAnswer as handleTriviaAnswerRaw } from "./lib/games/pixel-showdown";
import type { PixelShowdownState } from "./lib/types/pixel-showdown";
import { db } from "./lib/db";
import type { GameState } from "./lib/types/game";
import { DebugSetStateSchema } from "./lib/types/debug";
import { getAgentManager } from "./lib/agents";
import { logDebug, logInfo, logWarn, logError } from "./lib/logger";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Player socket tracking
const playerSockets = new Map(); // socketId -> player info

// Initialize AI agent manager
const agentManager = getAgentManager();

// Track auto-advance timeouts per room to prevent memory leaks
const roomTimeouts = new Map<string, NodeJS.Timeout[]>();

// Helper to schedule a room timeout with automatic tracking
function scheduleRoomTimeout(
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

// Clear all pending timeouts for a room
function clearRoomTimeouts(roomCode: string): void {
  const timeouts = roomTimeouts.get(roomCode);
  if (timeouts) {
    timeouts.forEach((id) => clearTimeout(id));
    roomTimeouts.delete(roomCode);
  }
}

// Room cleanup settings
const ROOM_IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const ROOM_CLEANUP_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const ROOM_CLEANUP_BUFFER = 60 * 1000; // 1 minute buffer before deletion

// Sanitize player name on the server side
function sanitizePlayerName(name: unknown): string {
  if (typeof name !== "string") return "";
  return name
    .trim()
    .replace(/[<>'"&]/g, "") // Remove potentially dangerous characters
    .replace(/\s+/g, " ") // Normalize whitespace
    .slice(0, 20); // Enforce max length
}

// Validate room code format
function isValidRoomCode(code: unknown): code is string {
  if (typeof code !== "string") return false;
  return /^[A-Z]{4}$/.test(code);
}

// Sanitized payload type
type SanitizedPayload =
  | string
  | Record<string, string | number | boolean>
  | null;

// Validate and sanitize submission/vote data
function validatePayloadData(data: unknown): {
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

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || "", true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      logError("HTTP", `Error handling ${req.url}`, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin:
        process.env.NEXT_PUBLIC_LH_PARTY_APP_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
    },
  });

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

  /** Get or create a room from the shared registry */
  function getRoom(roomCode: string): SharedRoom {
    let room = sharedRooms.get(roomCode);
    if (!room) {
      room = {
        code: roomCode,
        players: [],
        gameState: {
          roomCode,
          gameType: null,
          currentRound: 0,
          phase: "lobby" as const,
          players: [],
        },
        displaySocketId: null,
        lastActivity: Date.now(),
        createdAt: new Date(),
      };
      // Make gameState.players reference room.players (single source of truth)
      room.gameState.players = room.players;
      sharedRooms.set(roomCode, room);
      logInfo("Room", `Created room: ${roomCode}`);
    }
    room.lastActivity = Date.now();
    return room;
  }

  /** Remove idle rooms to prevent memory leaks */
  function cleanupIdleRooms() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [code, room] of sharedRooms.entries()) {
      const isIdle = now - room.lastActivity > ROOM_IDLE_TIMEOUT;
      const isEmpty =
        room.players.every((p) => !p.isConnected) && !room.displaySocketId;
      const hasNoRecentActivity = now - room.lastActivity > ROOM_CLEANUP_BUFFER;

      if (isIdle && isEmpty && hasNoRecentActivity) {
        clearRoomTimeouts(code);
        sharedRooms.remove(code);
        agentManager.cleanupRoom(code);
        cleanedCount++;
        logInfo("Cleanup", `Removed idle room: ${code}`);
      }
    }

    if (cleanedCount > 0) {
      logInfo(
        "Cleanup",
        `Removed ${cleanedCount} room(s). Active: ${sharedRooms.size()}`
      );
    }
  }

  // Start room cleanup interval
  const cleanupInterval = setInterval(cleanupIdleRooms, ROOM_CLEANUP_INTERVAL);

  process.on("SIGTERM", () => {
    logInfo("Server", "Received SIGTERM, shutting down...");
    clearInterval(cleanupInterval);
    process.exit(0);
  });

  /**
   * Broadcast game state to all clients in a room.
   * Ensures room.players is the single source of truth before emitting.
   */
  function broadcastGameState(roomCode: string): void {
    const room = sharedRooms.get(roomCode);
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

    io.to(roomCode).emit("game:state-update", room.gameState);
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

    // Trigger AI agent responses (async, non-blocking)
    if (agentManager.isEnabled()) {
      agentManager
        .handleGameStateChange(roomCode, room.gameState as GameState)
        .then((responses) => {
          for (const response of responses) {
            logDebug(
              "Agent",
              `${response.agentName}: "${response.text.substring(0, 50)}..."`
            );
            io.to(roomCode).emit("agent:speak", {
              agentId: response.agentId,
              agentName: response.agentName,
              text: response.text,
              voice: response.voice,
              emotion: response.emotion,
              priority: response.priority,
            });
          }
        })
        .catch((error) => {
          logError("Agent", "Error generating responses", error);
        });
    }
  }

  io.on("connection", (socket) => {
    logDebug("Socket", `Connected: ${socket.id}`);

    // Display joins a room
    socket.on("display:join", ({ roomCode, gameType }) => {
      logInfo(
        "Display",
        `Display joining room: ${roomCode} (gameType: ${gameType || "not specified"})`
      );

      const room = getRoom(roomCode);
      room.displaySocketId = socket.id;

      // Set gameType if provided and not already set
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

    // Player joins a room
    socket.on("player:join", ({ roomCode, name }) => {
      const sanitizedName = sanitizePlayerName(name);
      const upperRoomCode =
        typeof roomCode === "string" ? roomCode.toUpperCase() : "";

      if (!isValidRoomCode(upperRoomCode)) {
        logWarn("Validation", `Invalid room code format: ${roomCode}`);
        socket.emit("player:error", { message: "Invalid room code format" });
        return;
      }

      if (!sanitizedName || sanitizedName.length < 1) {
        logWarn("Validation", `Invalid player name: ${name}`);
        socket.emit("player:error", { message: "Invalid player name" });
        return;
      }

      logInfo("Player", `"${sanitizedName}" joining room: ${upperRoomCode}`);

      const room = getRoom(upperRoomCode);

      let player = room.players.find((p) => p.name === sanitizedName);

      if (player) {
        player.socketId = socket.id;
        player.isConnected = true;
      } else {
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

    // Player or display leaves
    socket.on("disconnect", () => {
      logDebug("Socket", `Disconnected: ${socket.id}`);

      const roomCode = socket.data.roomCode;
      if (!roomCode) return;

      const room = sharedRooms.get(roomCode);
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

      const room = sharedRooms.get(roomCode);
      if (!room) {
        logError("Game", `Room ${roomCode} not found`);
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

      // Reset agent state for new game
      agentManager.resetGame(roomCode);

      // Use shared game initialization
      const { gameState: newGameState } = initializeGame(
        gameType,
        roomCode,
        room.players
      );
      room.gameState = newGameState as SharedRoom["gameState"];

      // For pixel-showdown, generate questions asynchronously
      if (gameType === "pixel-showdown") {
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
            scheduleRoomTimeout(
              roomCode,
              () => {
                room.gameState = startTriviaQuestions(
                  room.gameState as PixelShowdownState
                );
                room.gameState.players = room.players;
                broadcastGameState(roomCode);
              },
              3000
            );
          },
          onError: (error) => {
            logError("Trivia", "Failed to generate questions", error);
          },
        });
      }
      // Maintain single source of truth
      room.gameState.players = room.players;

      // Broadcast immediately - don't block on database
      broadcastGameState(roomCode);

      // Persist to database in background (non-blocking)
      if (db) {
        (async () => {
          try {
            const dbRoom = await db.room.upsert({
              where: { code: roomCode },
              create: {
                code: roomCode,
                status: "active",
              },
              update: {
                status: "active",
              },
            });

            await db.game.create({
              data: {
                roomId: dbRoom.id,
                type: gameType,
                status: "active",
                totalRounds: 3,
                state: JSON.parse(JSON.stringify(room.gameState)),
              },
            });

            logInfo("Database", `Game persisted for room ${roomCode}`);
          } catch (error) {
            logError("Database", "Failed to persist game", error);
          }
        })();
      }
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

      logInfo(
        "Submission",
        `Player "${socket.data.playerName}" in room ${roomCode}`
      );

      const room = sharedRooms.get(roomCode);
      if (!room) {
        socket.emit("player:error", { message: "Room not found" });
        return;
      }

      if (room.gameState.gameType === "quiplash") {
        const updatedGameState = handleSubmission(
          room.gameState as GameState,
          socket.data.playerId,
          socket.data.playerName,
          sanitized as string
        );
        room.gameState = updatedGameState as SharedRoom["gameState"];
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

      // Broadcast immediately - don't block on database
      broadcastGameState(roomCode);

      // Persist submission to database in background (non-blocking)
      if (db && room.gameState.gameType === "quiplash") {
        (async () => {
          try {
            const game = await db.game.findFirst({
              where: {
                room: { code: roomCode },
                status: "active",
              },
              include: { rounds: true },
            });

            if (game) {
              let round = game.rounds.find(
                (r: { roundNum: number }) =>
                  r.roundNum === room.gameState.currentRound
              );
              if (!round) {
                const prompt = getPlayerPrompt(
                  room.gameState as GameState,
                  socket.data.playerId
                );
                round = await db.round.create({
                  data: {
                    gameId: game.id,
                    roundNum: room.gameState.currentRound,
                    prompt: prompt?.text || "",
                  },
                });
              }

              const dbRoom = await db.room.findUnique({
                where: { code: roomCode },
              });
              if (dbRoom) {
                const dbPlayer = await db.player.upsert({
                  where: {
                    roomId_name: {
                      roomId: dbRoom.id,
                      name: socket.data.playerName,
                    },
                  },
                  create: {
                    roomId: dbRoom.id,
                    name: socket.data.playerName,
                    socketId: socket.id,
                  },
                  update: {
                    socketId: socket.id,
                  },
                });

                await db.submission.create({
                  data: {
                    roundId: round.id,
                    playerId: dbPlayer.id,
                    content: String(sanitized),
                  },
                });
              }
            }
          } catch (error) {
            logError("Database", "Failed to persist submission", error);
          }
        })();
      }
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

      logInfo("Vote", `Player "${socket.data.playerName}" in room ${roomCode}`);

      const room = sharedRooms.get(roomCode);
      if (!room) {
        socket.emit("player:error", { message: "Room not found" });
        return;
      }

      if (room.gameState.gameType === "quiplash") {
        // Track phase before vote to detect vote->results transition
        const previousPhase = room.gameState.phase;
        const updatedGameState = handleVote(
          room.gameState as GameState,
          socket.data.playerId,
          socket.data.playerName,
          sanitized as string
        );
        room.gameState = updatedGameState as SharedRoom["gameState"];

        // Apply scores when transitioning from vote to results
        if (previousPhase === "vote" && room.gameState.phase === "results") {
          logInfo(
            "Scoring",
            "Vote phase complete - applying scores to players"
          );
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

      // Broadcast immediately - don't block on database
      broadcastGameState(roomCode);

      // Persist vote to database in background (non-blocking)
      if (db && room.gameState.gameType === "quiplash") {
        (async () => {
          try {
            const game = await db.game.findFirst({
              where: {
                room: { code: roomCode },
                status: "active",
              },
            });

            if (game) {
              const votedSubmission = await db.submission.findFirst({
                where: {
                  round: {
                    gameId: game.id,
                    roundNum: room.gameState.currentRound,
                  },
                  player: {
                    room: { code: roomCode },
                  },
                },
                include: { player: true },
              });

              if (votedSubmission) {
                const dbRoom = await db.room.findUnique({
                  where: { code: roomCode },
                });
                if (dbRoom) {
                  const dbVoter = await db.player.findFirst({
                    where: {
                      roomId: dbRoom.id,
                      name: socket.data.playerName,
                    },
                  });

                  if (dbVoter) {
                    await db.vote.create({
                      data: {
                        submissionId: votedSubmission.id,
                        voterId: dbVoter.id,
                      },
                    });
                  }
                }
              }
            }
          } catch (error) {
            logError("Database", "Failed to persist vote", error);
          }
        })();
      }
    });

    // Advance to next round
    socket.on("game:next-round", ({ roomCode }) => {
      if (!isValidRoomCode(roomCode)) {
        socket.emit("player:error", { message: "Invalid room code" });
        return;
      }

      const room = sharedRooms.get(roomCode);
      if (!room) {
        socket.emit("player:error", { message: "Room not found" });
        return;
      }

      // Handle both quiplash "results" and pixel-showdown "round_results"
      const validPhases = ["results", "round_results"];
      if (!validPhases.includes(room.gameState.phase)) {
        logWarn(
          "Game",
          `Cannot advance round in room ${roomCode} - phase is "${room.gameState.phase}", expected one of ${validPhases.join(", ")}`
        );
        socket.emit("player:error", { message: "Not in results phase" });
        return;
      }

      if (room.gameState.gameType === "quiplash") {
        logInfo("Game", `Advancing to next round in room ${roomCode}`);
        const updatedGameState = advanceToNextRound(
          room.gameState as GameState
        );
        room.gameState = updatedGameState as SharedRoom["gameState"];
        // Maintain single source of truth
        room.gameState.players = room.players;

        // Broadcast immediately - don't block on database
        broadcastGameState(roomCode);
      } else if (room.gameState.gameType === "pixel-showdown") {
        logInfo("Game", `Advancing trivia to next round in room ${roomCode}`);
        room.gameState = advanceTriviaRound(
          room.gameState as PixelShowdownState
        );
        room.gameState.players = room.players;
        broadcastGameState(roomCode);

        // If we're in category_announce, generate new questions
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
              scheduleRoomTimeout(
                roomCode,
                () => {
                  room.gameState = startTriviaQuestions(
                    room.gameState as PixelShowdownState
                  );
                  room.gameState.players = room.players;
                  broadcastGameState(roomCode);
                },
                3000
              );
            },
            onError: (error) => {
              logError(
                "Trivia",
                "Failed to generate questions for next round",
                error
              );
            },
          });
        }

        // Update game state in database in background (non-blocking)
        if (db) {
          (async () => {
            try {
              await db.game.updateMany({
                where: {
                  room: { code: roomCode },
                  status: "active",
                },
                data: {
                  currentRound: room.gameState.currentRound,
                  state: JSON.parse(JSON.stringify(room.gameState)),
                },
              });
            } catch (error) {
              logError("Database", "Failed to update game state", error);
            }
          })();
        }
      }
    });

    // Trivia answer submission (Pixel Showdown)
    socket.on("trivia:answer", async ({ roomCode, answer, timestamp }) => {
      if (!isValidRoomCode(roomCode)) {
        socket.emit("player:error", { message: "Invalid room code" });
        return;
      }

      const room = sharedRooms.get(roomCode);
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
      let result;

      // Use shared handlers for answer processing
      if (currentQuestion.type === "multiple_choice") {
        result = handleTriviaAnswerMC(
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
          result = await handleTriviaAnswerFreeText(
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
          // Record the answer without judgment on error
          room.gameState = handleTriviaAnswerRaw(
            state,
            socket.data.playerId,
            socket.data.playerName,
            answer,
            timestamp
          );
          result = { allAnswered: false };
        }
      }

      room.gameState.players = room.players;
      broadcastGameState(roomCode);

      // Check if all players have answered
      if (result?.allAnswered) {
        scheduleRoomTimeout(
          roomCode,
          () => {
            room.gameState = transitionAfterAllAnswered(
              room.gameState as PixelShowdownState
            );
            room.gameState.players = room.players;
            broadcastGameState(roomCode);

            // Auto-advance to leaderboard after reveal
            scheduleRoomTimeout(
              roomCode,
              () => {
                room.gameState = transitionToLeaderboardPhase(
                  room.gameState as PixelShowdownState
                );
                room.gameState.players = room.players;
                broadcastGameState(roomCode);

                // Auto-advance to next question after leaderboard
                scheduleRoomTimeout(
                  roomCode,
                  () => {
                    const currentState = room.gameState as PixelShowdownState;
                    if (currentState.phase !== "leaderboard") return;

                    room.gameState = advanceTrivia(currentState);
                    room.gameState.players = room.players;
                    broadcastGameState(roomCode);

                    // If we transitioned to round_results, auto-advance after showing results
                    const newState = room.gameState as PixelShowdownState;
                    if (newState.phase === "round_results") {
                      scheduleRoomTimeout(
                        roomCode,
                        () => {
                          const resultState =
                            room.gameState as PixelShowdownState;
                          if (resultState.phase !== "round_results") return;

                          // Advance to next round (or game_results if final round)
                          room.gameState = advanceTriviaRound(resultState);
                          room.gameState.players = room.players;
                          broadcastGameState(roomCode);

                          const afterAdvance =
                            room.gameState as PixelShowdownState;
                          // If we're now in category_announce, generate new questions
                          if (afterAdvance.phase === "category_announce") {
                            const apiBaseUrl = getApiBaseUrl();
                            generateTriviaQuestions({
                              apiBaseUrl,
                              state: afterAdvance,
                              onQuestionsReady: (questions, category) => {
                                room.gameState = setTriviaQuestions(
                                  room.gameState as PixelShowdownState,
                                  questions,
                                  category
                                );
                                room.gameState.players = room.players;
                                broadcastGameState(roomCode);

                                // Auto-advance to first question
                                scheduleRoomTimeout(
                                  roomCode,
                                  () => {
                                    room.gameState = startTriviaQuestions(
                                      room.gameState as PixelShowdownState
                                    );
                                    room.gameState.players = room.players;
                                    broadcastGameState(roomCode);
                                  },
                                  3000
                                );
                              },
                              onError: (error) => {
                                logError(
                                  "Trivia",
                                  "Failed to generate questions for next round",
                                  error
                                );
                              },
                            });
                          }
                          // If game_results, no further action needed
                        },
                        5000
                      ); // Show round results for 5 seconds
                    }
                  },
                  4000
                );
              },
              4000
            );
          },
          500
        );
      }
    });

    // Advance to next trivia question
    socket.on("trivia:next-question", ({ roomCode }) => {
      if (!isValidRoomCode(roomCode)) {
        socket.emit("player:error", { message: "Invalid room code" });
        return;
      }

      const room = sharedRooms.get(roomCode);
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

      // If we transitioned to category_announce, generate new questions
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
            scheduleRoomTimeout(
              roomCode,
              () => {
                room.gameState = startTriviaQuestions(
                  room.gameState as PixelShowdownState
                );
                room.gameState.players = room.players;
                broadcastGameState(roomCode);
              },
              3000
            );
          },
          onError: (error) => {
            logError(
              "Trivia",
              "Failed to generate questions for next round",
              error
            );
          },
        });
      }
    });

    // Restart game (return to lobby with same players)
    socket.on("game:restart", ({ roomCode }) => {
      if (!isValidRoomCode(roomCode)) {
        socket.emit("player:error", { message: "Invalid room code" });
        return;
      }

      const room = sharedRooms.get(roomCode);
      if (!room) {
        socket.emit("player:error", { message: "Room not found" });
        return;
      }

      // Allow restart from results phase or game_results phase
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

      // Clear any pending auto-advance timeouts
      clearRoomTimeouts(roomCode);

      // Reset all player scores
      room.players.forEach((player) => {
        player.score = 0;
      });

      // Reset game state to lobby
      room.gameState = {
        roomCode,
        gameType: null,
        currentRound: 0,
        phase: "lobby" as const,
        players: room.players,
      };

      broadcastGameState(roomCode);
    });

    // Agent toggle (enable/disable AI commentary)
    socket.on("agent:toggle", ({ enabled }) => {
      if (typeof enabled !== "boolean") {
        socket.emit("player:error", { message: "Invalid enabled value" });
        return;
      }

      // Use roomCode from socket session (set during player:join / display:join)
      const roomCode = socket.data.roomCode;
      if (!roomCode) {
        socket.emit("player:error", { message: "Not in a room" });
        return;
      }

      logInfo(
        "Agent",
        `Toggle for room ${roomCode}: ${enabled ? "enabled" : "disabled"}`
      );

      const room = sharedRooms.get(roomCode);
      if (!room) {
        socket.emit("player:error", { message: "Room not found" });
        return;
      }

      agentManager.setRoomEnabled(roomCode, enabled);
      io.to(roomCode).emit("agent:toggled", { enabled });
    });

    // ============================================
    // DEBUG PANEL HANDLERS
    // Only available in development and to display clients
    // ============================================

    // Helper to validate debug requests
    const validateDebugRequest = (roomCode: string): boolean => {
      // Only allow in development
      if (process.env.NODE_ENV === "production") {
        socket.emit("player:error", {
          message: "Debug commands not available in production",
        });
        return false;
      }

      // Only allow from display clients
      if (!socket.data.isDisplay) {
        socket.emit("player:error", {
          message: "Debug commands only available to display",
        });
        return false;
      }

      if (!isValidRoomCode(roomCode)) {
        socket.emit("player:error", { message: "Invalid room code" });
        return false;
      }

      return true;
    };

    // Debug: Set game phase directly
    socket.on("debug:set-phase", ({ roomCode, phase }) => {
      if (!validateDebugRequest(roomCode)) return;

      const room = sharedRooms.get(roomCode);
      if (!room) {
        socket.emit("player:error", { message: "Room not found" });
        return;
      }

      logInfo("Debug", `Setting phase to "${phase}" in room ${roomCode}`);
      room.gameState.phase = phase;
      room.gameState.players = room.players;
      broadcastGameState(roomCode);
    });

    // Debug: Add a fake player
    socket.on("debug:add-player", ({ roomCode, name }) => {
      if (!validateDebugRequest(roomCode)) return;

      const room = sharedRooms.get(roomCode);
      if (!room) {
        socket.emit("player:error", { message: "Room not found" });
        return;
      }

      const sanitizedName = sanitizePlayerName(name);
      if (!sanitizedName) {
        socket.emit("player:error", { message: "Invalid player name" });
        return;
      }

      // Check if player with same name already exists
      if (room.players.some((p) => p.name === sanitizedName)) {
        socket.emit("player:error", { message: "Player name already exists" });
        return;
      }

      logInfo(
        "Debug",
        `Adding fake player "${sanitizedName}" to room ${roomCode}`
      );

      const player = {
        id: crypto.randomUUID(),
        name: sanitizedName,
        roomCode,
        score: 0,
        isConnected: true,
        socketId: undefined, // Fake players have no socket
      };
      room.players.push(player);
      room.gameState.players = room.players;
      broadcastGameState(roomCode);
    });

    // Debug: Remove a player
    socket.on("debug:remove-player", ({ roomCode, playerId }) => {
      if (!validateDebugRequest(roomCode)) return;

      const room = sharedRooms.get(roomCode);
      if (!room) {
        socket.emit("player:error", { message: "Room not found" });
        return;
      }

      const playerIndex = room.players.findIndex((p) => p.id === playerId);
      if (playerIndex === -1) {
        socket.emit("player:error", { message: "Player not found" });
        return;
      }

      const removedPlayer = room.players[playerIndex];
      logInfo(
        "Debug",
        `Removing player "${removedPlayer.name}" from room ${roomCode}`
      );

      room.players.splice(playerIndex, 1);
      room.gameState.players = room.players;
      broadcastGameState(roomCode);
    });

    // Debug: Set player score
    socket.on("debug:set-score", ({ roomCode, playerId, score }) => {
      if (!validateDebugRequest(roomCode)) return;

      const room = sharedRooms.get(roomCode);
      if (!room) {
        socket.emit("player:error", { message: "Room not found" });
        return;
      }

      const player = room.players.find((p) => p.id === playerId);
      if (!player) {
        socket.emit("player:error", { message: "Player not found" });
        return;
      }

      const numericScore =
        typeof score === "number" ? score : parseInt(score, 10);
      if (isNaN(numericScore)) {
        socket.emit("player:error", { message: "Invalid score value" });
        return;
      }

      logInfo(
        "Debug",
        `Setting score for "${player.name}" to ${numericScore} in room ${roomCode}`
      );

      player.score = numericScore;
      room.gameState.players = room.players;
      broadcastGameState(roomCode);
    });

    // Debug: Set partial game state
    socket.on("debug:set-state", ({ roomCode, partialState }) => {
      if (!validateDebugRequest(roomCode)) return;

      const room = sharedRooms.get(roomCode);
      if (!room) {
        socket.emit("player:error", { message: "Room not found" });
        return;
      }

      // Validate partial state with Zod to prevent prototype pollution
      const validationResult = DebugSetStateSchema.safeParse(partialState);
      if (!validationResult.success) {
        socket.emit("player:error", {
          message: "Invalid state object",
          details: validationResult.error.issues.map((i) => i.message),
        });
        return;
      }

      const safePartialState = validationResult.data;
      logInfo(
        "Debug",
        `Updating game state in room ${roomCode}`,
        safePartialState
      );

      // Apply validated state changes
      Object.assign(room.gameState, safePartialState);

      // Always maintain single source of truth for players
      room.gameState.players = room.players;
      broadcastGameState(roomCode);
    });

    // Heartbeat/ping for connection health
    socket.on("ping", () => {
      socket.emit("pong");
    });
  });

  httpServer
    .once("error", (err) => {
      logError("Server", "Failed to start", err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`
╔═══════════════════════════════════════════╗
║                                           ║
║       🎉 localhost:party Server 🎉       ║
║                                           ║
║  ✅ Next.js: http://${hostname}:${port}    ║
║  ✅ Socket.io: Ready for connections      ║
║                                           ║
╚═══════════════════════════════════════════╝
      `);
    });
});
