import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import crypto from 'crypto';
import * as sharedRooms from './lib/shared-rooms';
import {
  initializeQuiplashGame,
  handleSubmission,
  handleVote,
  advanceToNextRound,
  getPlayerPrompt,
} from './lib/games/quiplash';
import { db } from './lib/db';
import type { GameState } from './lib/types/game';
import type { Player } from './lib/types/player';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Player socket tracking
const playerSockets = new Map(); // socketId -> player info

// Room cleanup settings
const ROOM_IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const ROOM_CLEANUP_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const ROOM_CLEANUP_BUFFER = 60 * 1000; // 1 minute buffer before deletion

// Sanitize player name on the server side
function sanitizePlayerName(name: unknown): string {
  if (typeof name !== 'string') return '';
  return name
    .trim()
    .replace(/[<>'"&]/g, '') // Remove potentially dangerous characters
    .replace(/\s+/g, ' ')     // Normalize whitespace
    .slice(0, 20);            // Enforce max length
}

// Validate room code format
function isValidRoomCode(code: unknown): code is string {
  if (typeof code !== 'string') return false;
  return /^[A-Z]{4}$/.test(code);
}

// Validate and sanitize submission/vote data
function validatePayloadData(data: unknown): { valid: boolean; sanitized: any } {
  if (data === null || data === undefined) {
    return { valid: false, sanitized: null };
  }

  // If it's a string, sanitize it
  if (typeof data === 'string') {
    const sanitized = data
      .slice(0, 1000) // Max 1000 chars for text submissions
      .replace(/[<>]/g, ''); // Remove HTML brackets
    return { valid: true, sanitized };
  }

  // If it's a simple object (vote choice, etc.), validate structure
  if (typeof data === 'object' && !Array.isArray(data)) {
    // Only allow specific known properties
    const allowed = ['choice', 'optionId', 'answerId', 'value', 'text'];
    const sanitized: Record<string, any> = {};
    for (const key of allowed) {
      if ((data as any)[key] !== undefined) {
        if (typeof (data as any)[key] === 'string') {
          sanitized[key] = (data as any)[key].slice(0, 500).replace(/[<>]/g, '');
        } else if (typeof (data as any)[key] === 'number') {
          sanitized[key] = (data as any)[key];
        } else if (typeof (data as any)[key] === 'boolean') {
          sanitized[key] = (data as any)[key];
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
      const parsedUrl = parse(req.url || '', true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  });

  // Helper function to get or create room (uses shared registry)
  function getRoom(roomCode: string): any {
    let room = sharedRooms.get(roomCode);
    if (!room) {
      room = {
        code: roomCode,
        players: [],
        gameState: {
          roomCode,
          gameType: null,
          currentRound: 0,
          phase: 'lobby' as const,
          players: [],
        },
        displaySocketId: null,
        lastActivity: Date.now(),
        createdAt: new Date(),
      };
      sharedRooms.set(roomCode, room);
    }
    // Update last activity timestamp
    room.lastActivity = Date.now();
    return room;
  }

  // Room cleanup: remove idle rooms to prevent memory leaks
  function cleanupIdleRooms() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [code, room] of sharedRooms.entries()) {
      // Check if room has been idle for too long
      const isIdle = (now - room.lastActivity) > ROOM_IDLE_TIMEOUT;
      // Check if room is empty (no connected players and no display)
      const isEmpty = room.players.every(p => !p.isConnected) && !room.displaySocketId;
      // Add buffer to prevent race condition with joining players
      const hasNoRecentActivity = (now - room.lastActivity) > ROOM_CLEANUP_BUFFER;

      if (isIdle && isEmpty && hasNoRecentActivity) {
        sharedRooms.remove(code);
        cleanedCount++;
        console.log(`🧹 Cleaned up idle room: ${code}`);
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} idle room(s). Active rooms: ${sharedRooms.size()}`);
    }
  }

  // Start room cleanup interval
  const cleanupInterval = setInterval(cleanupIdleRooms, ROOM_CLEANUP_INTERVAL);

  // Cleanup on server shutdown
  process.on('SIGTERM', () => {
    clearInterval(cleanupInterval);
    process.exit(0);
  });

  // Helper function to broadcast game state to all clients in a room
  function broadcastGameState(roomCode: string): void {
    const room = sharedRooms.get(roomCode);
    if (!room) return;

    // Update players in game state
    room.gameState.players = room.players;

    // Emit to all clients in the room
    io.to(roomCode).emit('game:state-update', room.gameState);
    console.log(`📤 Broadcast game state to room ${roomCode}:`, room.gameState);
  }

  io.on('connection', (socket) => {
    console.log(`✅ Client connected: ${socket.id}`);

    // Display joins a room
    socket.on('display:join', ({ roomCode }) => {
      console.log(`📺 Display joining room: ${roomCode}`);

      const room = getRoom(roomCode);
      room.displaySocketId = socket.id;

      socket.join(roomCode);
      socket.data.roomCode = roomCode;
      socket.data.isDisplay = true;

      // Send initial game state
      socket.emit('game:state-update', room.gameState);
      console.log(`📤 Sent initial state to display ${roomCode}`);
    });

    // Player joins a room
    socket.on('player:join', ({ roomCode, name }) => {
      // Validate and sanitize inputs
      const sanitizedName = sanitizePlayerName(name);
      const upperRoomCode = typeof roomCode === 'string' ? roomCode.toUpperCase() : '';

      if (!isValidRoomCode(upperRoomCode)) {
        console.warn(`⚠️ Invalid room code format: ${roomCode}`);
        socket.emit('player:error', { message: 'Invalid room code format' });
        return;
      }

      if (!sanitizedName || sanitizedName.length < 1) {
        console.warn(`⚠️ Invalid player name: ${name}`);
        socket.emit('player:error', { message: 'Invalid player name' });
        return;
      }

      console.log(`🎮 Player "${sanitizedName}" joining room: ${upperRoomCode}`);

      const room = getRoom(upperRoomCode);

      // Check if player already exists (reconnection)
      let player = room.players.find((p: any) => p.name === sanitizedName);

      if (player) {
        // Reconnection: update socket ID
        player.socketId = socket.id;
        player.isConnected = true;
      } else {
        // New player - use crypto.randomUUID() for secure unique IDs
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

      // Store player info with socket
      socket.join(upperRoomCode);
      socket.data.roomCode = upperRoomCode;
      socket.data.playerId = player.id;
      socket.data.playerName = sanitizedName;
      playerSockets.set(socket.id, player);

      // Broadcast updated game state
      broadcastGameState(upperRoomCode);

      // Send confirmation to the player
      socket.emit('player:joined', player);
      console.log(`✅ Player "${sanitizedName}" joined room ${upperRoomCode}`);
    });

    // Player or display leaves
    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);

      const roomCode = socket.data.roomCode;
      if (!roomCode) return;

      const room = sharedRooms.get(roomCode);
      if (!room) return;

      // If it's a player
      if (socket.data.playerId) {
        const player = room.players.find((p) => p.id === socket.data.playerId);
        if (player) {
          player.isConnected = false;
          console.log(`⚠️ Player "${player.name}" disconnected from room ${roomCode}`);

          // Broadcast updated state
          broadcastGameState(roomCode);
        }
        playerSockets.delete(socket.id);
      }

      // If it's the display
      if (socket.data.isDisplay) {
        room.displaySocketId = null;
        console.log(`⚠️ Display disconnected from room ${roomCode}`);
      }
    });

    // Start game
    socket.on('game:start', async ({ roomCode, gameType }) => {
      console.log(`🎮 Starting game "${gameType}" in room ${roomCode}`);

      const room = sharedRooms.get(roomCode);
      if (!room) {
        console.error(`❌ Room ${roomCode} not found`);
        socket.emit('player:error', { message: 'Room not found' });
        return;
      }

      // Initialize game based on type
      if (gameType === 'quiplash') {
        room.gameState = initializeQuiplashGame(roomCode, room.players);
      } else {
        // Fallback for other game types
        room.gameState.gameType = gameType;
        room.gameState.phase = 'prompt';
        room.gameState.currentRound = 1;
      }

      // Persist room and game to database
      try {
        const dbRoom = await db.room.upsert({
          where: { code: roomCode },
          create: {
            code: roomCode,
            status: 'active',
          },
          update: {
            status: 'active',
          },
        });

        // Create game record
        await db.game.create({
          data: {
            roomId: dbRoom.id,
            type: gameType,
            status: 'active',
            totalRounds: 3,
            state: room.gameState,
          },
        });

        console.log(`💾 Game persisted to database for room ${roomCode}`);
      } catch (error) {
        console.error('Failed to persist game to database:', error);
        // Continue anyway - game works in-memory
      }

      // Broadcast updated state
      broadcastGameState(roomCode);
    });

    // Generic player submission with validation
    socket.on('player:submit', async ({ roomCode, data }) => {
      // Validate room code
      if (!isValidRoomCode(roomCode)) {
        socket.emit('player:error', { message: 'Invalid room code' });
        return;
      }

      // Validate and sanitize submission data
      const { valid, sanitized } = validatePayloadData(data);
      if (!valid) {
        socket.emit('player:error', { message: 'Invalid submission data' });
        return;
      }

      console.log(`📝 Player submission in room ${roomCode}:`, sanitized);

      const room = sharedRooms.get(roomCode);
      if (!room) {
        socket.emit('player:error', { message: 'Room not found' });
        return;
      }

      // Handle submission based on game type
      if (room.gameState.gameType === 'quiplash') {
        room.gameState = handleSubmission(
          room.gameState as GameState,
          socket.data.playerId,
          socket.data.playerName,
          sanitized
        ) as any;

        // Persist submission to database (async, non-blocking)
        try {
          const game = await db.game.findFirst({
            where: {
              room: { code: roomCode },
              status: 'active'
            },
            include: { rounds: true }
          });

          if (game) {
            // Find or create round
            let round = game.rounds.find((r: any) => r.roundNum === room.gameState.currentRound);
            if (!round) {
              const prompt = getPlayerPrompt(room.gameState as GameState, socket.data.playerId);
              round = await db.round.create({
                data: {
                  gameId: game.id,
                  roundNum: room.gameState.currentRound,
                  prompt: prompt?.text || '',
                },
              });
            }

            // Find or create player in database
            const dbRoom = await db.room.findUnique({ where: { code: roomCode } });
            if (dbRoom) {
              const dbPlayer = await db.player.upsert({
                where: { roomId_name: { roomId: dbRoom.id, name: socket.data.playerName } },
                create: {
                  roomId: dbRoom.id,
                  name: socket.data.playerName,
                  socketId: socket.id,
                },
                update: {
                  socketId: socket.id,
                },
              });

              // Create submission
              await db.submission.create({
                data: {
                  roundId: round.id,
                  playerId: dbPlayer.id,
                  content: sanitized,
                },
              });
            }
          }
        } catch (error) {
          console.error('Failed to persist submission:', error);
          // Continue - game works in-memory
        }
      } else {
        // Generic handling for other games
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

      // Broadcast updated state
      broadcastGameState(roomCode);
    });

    // Generic player vote with validation
    socket.on('player:vote', async ({ roomCode, data }) => {
      // Validate room code
      if (!isValidRoomCode(roomCode)) {
        socket.emit('player:error', { message: 'Invalid room code' });
        return;
      }

      // Validate and sanitize vote data
      const { valid, sanitized } = validatePayloadData(data);
      if (!valid) {
        socket.emit('player:error', { message: 'Invalid vote data' });
        return;
      }

      console.log(`🗳️ Player vote in room ${roomCode}:`, sanitized);

      const room = sharedRooms.get(roomCode);
      if (!room) {
        socket.emit('player:error', { message: 'Room not found' });
        return;
      }

      // Handle vote based on game type
      if (room.gameState.gameType === 'quiplash') {
        room.gameState = handleVote(
          room.gameState as GameState,
          socket.data.playerId,
          socket.data.playerName,
          sanitized
        ) as any;

        // Persist vote to database (async, non-blocking)
        try {
          const game = await db.game.findFirst({
            where: {
              room: { code: roomCode },
              status: 'active'
            }
          });

          if (game) {
            // Find the submission being voted for
            const votedSubmission = await db.submission.findFirst({
              where: {
                round: {
                  gameId: game.id,
                  roundNum: room.gameState.currentRound,
                },
                player: {
                  room: { code: roomCode }
                }
              },
              include: { player: true }
            });

            if (votedSubmission) {
              const dbRoom = await db.room.findUnique({ where: { code: roomCode } });
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
          console.error('Failed to persist vote:', error);
          // Continue - game works in-memory
        }
      } else {
        // Generic handling for other games
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

      // Broadcast updated state
      broadcastGameState(roomCode);
    });

    // Advance to next round (for Quiplash and similar games)
    socket.on('game:next-round', async ({ roomCode }) => {
      if (!isValidRoomCode(roomCode)) {
        socket.emit('player:error', { message: 'Invalid room code' });
        return;
      }

      const room = sharedRooms.get(roomCode);
      if (!room) {
        socket.emit('player:error', { message: 'Room not found' });
        return;
      }

      if (room.gameState.gameType === 'quiplash') {
        room.gameState = advanceToNextRound(room.gameState as GameState) as any;

        // Update game state in database
        try {
          await db.game.updateMany({
            where: {
              room: { code: roomCode },
              status: 'active',
            },
            data: {
              currentRound: room.gameState.currentRound,
              state: room.gameState,
            },
          });
        } catch (error) {
          console.error('Failed to update game state:', error);
        }

        broadcastGameState(roomCode);
      }
    });

    // Heartbeat/ping for connection health
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
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
