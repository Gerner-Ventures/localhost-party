/**
 * Standalone WebSocket Server for localhost:party
 * Deploy this to Railway for production WebSocket support
 */
require('dotenv').config();

const { createServer } = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');

const port = parseInt(process.env.PORT || '3001', 10);

// ============================================================================
// In-memory Room Storage
// ============================================================================
const rooms = new Map();
const playerSockets = new Map();

// Room cleanup settings
const ROOM_IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const ROOM_CLEANUP_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const ROOM_CLEANUP_BUFFER = 60 * 1000; // 1 minute buffer

// ============================================================================
// Quiplash Game Logic (embedded for standalone deployment)
// ============================================================================
const QUIPLASH_PROMPTS = [
  "A terrible name for a pet rock",
  "The worst thing to say on a first date",
  "A bad slogan for a funeral home",
  "The last thing you want to hear from your dentist",
  "A terrible superhero name",
  "The worst birthday present ever",
  "A horrible tattoo idea",
  "The last thing you want to find in your soup",
  "A terrible name for a gym",
  "The worst excuse for being late",
  "A bad place to take a nap",
  "The worst thing to yell in a library",
  "A terrible name for a band",
  "The last thing you want your pilot to say",
  "A horrible baby name",
  "The worst thing to bring to a picnic",
  "A terrible wedding vow",
  "The last thing you want to hear at the doctor's office",
  "A bad name for a restaurant",
  "The worst pickup line ever",
];

const DEFAULT_CONFIG = {
  roundsPerGame: 3,
  promptsPerRound: 1,
  submissionTimeLimit: 60,
  votingTimeLimit: 30,
  pointsPerVote: 100,
};

function generatePromptsForRound(players, roundNumber) {
  const prompts = [];
  const usedIndices = new Set();

  for (let i = 0; i < players.length; i++) {
    let promptIndex;
    do {
      promptIndex = Math.floor(Math.random() * QUIPLASH_PROMPTS.length);
    } while (usedIndices.has(promptIndex));

    usedIndices.add(promptIndex);

    prompts.push({
      id: `round-${roundNumber}-prompt-${i}`,
      text: QUIPLASH_PROMPTS[promptIndex],
      assignedPlayerIds: [players[i].id],
    });
  }

  return prompts;
}

function initializeQuiplashGame(roomCode, players) {
  const prompts = generatePromptsForRound(players, 1);

  return {
    roomCode,
    gameType: 'quiplash',
    currentRound: 1,
    phase: 'submit',
    players,
    prompts,
    submissions: [],
    votes: [],
    currentPromptIndex: 0,
    roundResults: {},
    timeRemaining: DEFAULT_CONFIG.submissionTimeLimit,
  };
}

function handleSubmission(gameState, playerId, playerName, submissionText) {
  const existingSubmission = gameState.submissions?.find(
    (s) => s.playerId === playerId
  );

  if (existingSubmission) {
    return gameState;
  }

  const newSubmission = {
    playerId,
    playerName,
    data: submissionText,
    timestamp: Date.now(),
  };

  const updatedSubmissions = [...(gameState.submissions || []), newSubmission];
  const allPlayersSubmitted = updatedSubmissions.length === gameState.players.length;

  return {
    ...gameState,
    submissions: updatedSubmissions,
    phase: allPlayersSubmitted ? 'vote' : gameState.phase,
    timeRemaining: allPlayersSubmitted ? DEFAULT_CONFIG.votingTimeLimit : gameState.timeRemaining,
  };
}

function handleVote(gameState, voterId, voterName, votedForPlayerId) {
  if (voterId === votedForPlayerId) {
    return gameState;
  }

  const existingVote = gameState.votes?.find((v) => v.playerId === voterId);
  if (existingVote) {
    return gameState;
  }

  const newVote = {
    playerId: voterId,
    playerName: voterName,
    data: votedForPlayerId,
    timestamp: Date.now(),
  };

  const updatedVotes = [...(gameState.votes || []), newVote];
  const allPlayersVoted = updatedVotes.length === gameState.players.length;

  return {
    ...gameState,
    votes: updatedVotes,
    phase: allPlayersVoted ? 'results' : gameState.phase,
  };
}

function calculateRoundScores(gameState) {
  const scores = {};

  gameState.players.forEach((player) => {
    scores[player.id] = 0;
  });

  gameState.votes?.forEach((vote) => {
    const votedForPlayerId = vote.data;
    if (scores[votedForPlayerId] !== undefined) {
      scores[votedForPlayerId] += DEFAULT_CONFIG.pointsPerVote;
    }
  });

  return scores;
}

function updatePlayerScores(players, roundScores) {
  return players.map((player) => ({
    ...player,
    score: player.score + (roundScores[player.id] || 0),
  }));
}

function advanceToNextRound(gameState) {
  const roundScores = calculateRoundScores(gameState);
  const updatedPlayers = updatePlayerScores(gameState.players, roundScores);

  if (gameState.currentRound >= DEFAULT_CONFIG.roundsPerGame) {
    return {
      ...gameState,
      players: updatedPlayers,
      roundResults: roundScores,
      phase: 'results',
    };
  }

  // Start next round - go directly to submit phase (no separate prompt display phase)
  const nextRound = gameState.currentRound + 1;
  const newPrompts = generatePromptsForRound(updatedPlayers, nextRound);

  return {
    ...gameState,
    currentRound: nextRound,
    phase: 'submit', // Go directly to submit - players see prompts on their controllers
    players: updatedPlayers,
    prompts: newPrompts,
    submissions: [],
    votes: [],
    roundResults: roundScores,
    timeRemaining: DEFAULT_CONFIG.submissionTimeLimit,
  };
}

// ============================================================================
// Validation Helpers
// ============================================================================
function sanitizePlayerName(name) {
  if (typeof name !== 'string') return '';
  return name
    .trim()
    .replace(/[<>'"&]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 20);
}

function isValidRoomCode(code) {
  if (typeof code !== 'string') return false;
  return /^[A-Z]{4}$/.test(code);
}

function validatePayloadData(data) {
  if (data === null || data === undefined) {
    return { valid: false, sanitized: null };
  }

  if (typeof data === 'string') {
    const sanitized = data.slice(0, 1000).replace(/[<>]/g, '');
    return { valid: true, sanitized };
  }

  if (typeof data === 'object' && !Array.isArray(data)) {
    const allowed = ['choice', 'optionId', 'answerId', 'value', 'text'];
    const sanitized = {};
    for (const key of allowed) {
      if (data[key] !== undefined) {
        if (typeof data[key] === 'string') {
          sanitized[key] = data[key].slice(0, 500).replace(/[<>]/g, '');
        } else if (typeof data[key] === 'number' || typeof data[key] === 'boolean') {
          sanitized[key] = data[key];
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
const httpServer = createServer((req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      rooms: rooms.size,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  // Room list (for debugging)
  if (req.url === '/api/rooms' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const roomList = Array.from(rooms.entries()).map(([code, room]) => ({
      code,
      playerCount: room.players.length,
      phase: room.gameState.phase,
      hasDisplay: !!room.displaySocketId,
    }));
    res.end(JSON.stringify({ rooms: roomList }));
    return;
  }

  // Check specific room
  if (req.url?.startsWith('/api/rooms/') && req.method === 'GET') {
    const code = req.url.split('/')[3]?.toUpperCase();
    if (code && isValidRoomCode(code)) {
      const room = rooms.get(code);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        exists: !!room,
        code,
        playerCount: room?.players.length || 0,
      }));
      return;
    }
  }

  res.writeHead(404);
  res.end('Not found');
});

// ============================================================================
// Socket.io Server
// ============================================================================
const getAllowedOrigins = () => {
  const origins = [];

  if (process.env.NEXT_PUBLIC_LH_PARTY_APP_URL) {
    origins.push(process.env.NEXT_PUBLIC_LH_PARTY_APP_URL);
  }

  origins.push('http://localhost:3000');
  origins.push('http://localhost:3001');

  if (process.env.VERCEL_URL) {
    origins.push(`https://${process.env.VERCEL_URL}`);
  }

  return origins;
};

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = getAllowedOrigins();
      if (!origin) return callback(null, true);

      // Allow configured origins (exact match only for security)
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow localhost-party Vercel preview deployments only
      // Pattern matches: localhost-party-{git-branch}-{team}.vercel.app or localhost-party-{hash}-{team}.vercel.app
      // Anchored to prevent matching subdomains like "localhost-party-fake.malicious.vercel.app"
      if (origin.match(/^https:\/\/localhost-party(-[a-z0-9-]+)*\.vercel\.app$/)) {
        return callback(null, true);
      }

      callback(null, false);
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ============================================================================
// Room Management
// ============================================================================
function getRoom(roomCode) {
  let room = rooms.get(roomCode);
  if (!room) {
    room = {
      code: roomCode,
      players: [],
      gameState: {
        roomCode,
        gameType: null,
        currentRound: 0,
        phase: 'lobby',
        players: [],
      },
      displaySocketId: null,
      lastActivity: Date.now(),
      createdAt: new Date(),
    };
    rooms.set(roomCode, room);
    console.log(`[Room] Created room: ${roomCode}`);
  }
  room.lastActivity = Date.now();
  return room;
}

function cleanupIdleRooms() {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [code, room] of rooms.entries()) {
    const isIdle = now - room.lastActivity > ROOM_IDLE_TIMEOUT;
    const isEmpty = room.players.every((p) => !p.isConnected) && !room.displaySocketId;
    const hasNoRecentActivity = now - room.lastActivity > ROOM_CLEANUP_BUFFER;

    if (isIdle && isEmpty && hasNoRecentActivity) {
      rooms.delete(code);
      cleanedCount++;
      console.log(`[Cleanup] Removed idle room: ${code}`);
    }
  }

  if (cleanedCount > 0) {
    console.log(`[Cleanup] Removed ${cleanedCount} room(s). Active: ${rooms.size}`);
  }
}

const cleanupInterval = setInterval(cleanupIdleRooms, ROOM_CLEANUP_INTERVAL);

function broadcastGameState(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  room.gameState.players = room.players;
  io.to(roomCode).emit('game:state-update', room.gameState);
  console.log(`[Broadcast] Room ${roomCode}:`, {
    phase: room.gameState.phase,
    players: room.players.length,
  });
}

// ============================================================================
// Socket Event Handlers
// ============================================================================
io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // Display joins room
  socket.on('display:join', ({ roomCode }) => {
    console.log(`[Display] Joining room: ${roomCode}`);

    const room = getRoom(roomCode);
    room.displaySocketId = socket.id;

    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.isDisplay = true;

    socket.emit('game:state-update', room.gameState);
  });

  // Player joins room
  socket.on('player:join', ({ roomCode, name }) => {
    const sanitizedName = sanitizePlayerName(name);
    const upperRoomCode = typeof roomCode === 'string' ? roomCode.toUpperCase() : '';

    if (!isValidRoomCode(upperRoomCode)) {
      socket.emit('player:error', { message: 'Invalid room code format' });
      return;
    }

    if (!sanitizedName || sanitizedName.length < 1) {
      socket.emit('player:error', { message: 'Invalid player name' });
      return;
    }

    console.log(`[Player] "${sanitizedName}" joining room: ${upperRoomCode}`);

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
    socket.emit('player:joined', player);
    console.log(`[Player] "${sanitizedName}" joined room ${upperRoomCode}`);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);

    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    const room = rooms.get(roomCode);
    if (!room) return;

    if (socket.data.playerId) {
      const player = room.players.find((p) => p.id === socket.data.playerId);
      if (player) {
        player.isConnected = false;
        console.log(`[Player] "${player.name}" disconnected from ${roomCode}`);
        broadcastGameState(roomCode);
      }
      playerSockets.delete(socket.id);
    }

    if (socket.data.isDisplay) {
      room.displaySocketId = null;
      console.log(`[Display] Disconnected from ${roomCode}`);
    }
  });

  // Start game
  socket.on('game:start', ({ roomCode, gameType }) => {
    console.log(`[Game] Starting "${gameType}" in room ${roomCode}`);

    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit('player:error', { message: 'Room not found' });
      return;
    }

    if (gameType === 'quiplash') {
      room.gameState = initializeQuiplashGame(roomCode, room.players);
    } else {
      room.gameState.gameType = gameType;
      room.gameState.phase = 'prompt';
      room.gameState.currentRound = 1;
    }

    broadcastGameState(roomCode);
  });

  // Player submission
  socket.on('player:submit', ({ roomCode, data }) => {
    if (!isValidRoomCode(roomCode)) {
      socket.emit('player:error', { message: 'Invalid room code' });
      return;
    }

    const { valid, sanitized } = validatePayloadData(data);
    if (!valid) {
      socket.emit('player:error', { message: 'Invalid submission data' });
      return;
    }

    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit('player:error', { message: 'Room not found' });
      return;
    }

    if (room.gameState.gameType === 'quiplash') {
      room.gameState = handleSubmission(
        room.gameState,
        socket.data.playerId,
        socket.data.playerName,
        sanitized
      );
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
  socket.on('player:vote', ({ roomCode, data }) => {
    if (!isValidRoomCode(roomCode)) {
      socket.emit('player:error', { message: 'Invalid room code' });
      return;
    }

    const { valid, sanitized } = validatePayloadData(data);
    if (!valid) {
      socket.emit('player:error', { message: 'Invalid vote data' });
      return;
    }

    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit('player:error', { message: 'Room not found' });
      return;
    }

    if (room.gameState.gameType === 'quiplash') {
      room.gameState = handleVote(
        room.gameState,
        socket.data.playerId,
        socket.data.playerName,
        sanitized
      );
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
  socket.on('game:next-round', ({ roomCode }) => {
    if (!isValidRoomCode(roomCode)) {
      socket.emit('player:error', { message: 'Invalid room code' });
      return;
    }

    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit('player:error', { message: 'Room not found' });
      return;
    }

    if (room.gameState.gameType === 'quiplash') {
      room.gameState = advanceToNextRound(room.gameState);
      broadcastGameState(roomCode);
    }
  });

  // Heartbeat
  socket.on('ping', () => {
    socket.emit('pong');
  });
});

// ============================================================================
// Graceful Shutdown
// ============================================================================
process.on('SIGTERM', () => {
  console.log('[Server] Received SIGTERM, shutting down...');
  clearInterval(cleanupInterval);
  io.close(() => {
    console.log('[Server] Socket.io closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[Server] Received SIGINT, shutting down...');
  clearInterval(cleanupInterval);
  io.close(() => {
    console.log('[Server] Socket.io closed');
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
