const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// In-memory storage for rooms and players
const rooms = new Map();
const playerSockets = new Map(); // socketId -> player info

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
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

  // Helper function to get or create room
  function getRoom(roomCode) {
    if (!rooms.has(roomCode)) {
      rooms.set(roomCode, {
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
      });
    }
    return rooms.get(roomCode);
  }

  // Helper function to broadcast game state to all clients in a room
  function broadcastGameState(roomCode) {
    const room = rooms.get(roomCode);
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
      console.log(`🎮 Player "${name}" joining room: ${roomCode}`);

      const room = getRoom(roomCode);

      // Check if player already exists (reconnection)
      let player = room.players.find((p) => p.name === name);

      if (player) {
        // Reconnection: update socket ID
        player.socketId = socket.id;
        player.isConnected = true;
      } else {
        // New player
        player = {
          id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name,
          roomCode,
          score: 0,
          isConnected: true,
          socketId: socket.id,
        };
        room.players.push(player);
      }

      // Store player info with socket
      socket.join(roomCode);
      socket.data.roomCode = roomCode;
      socket.data.playerId = player.id;
      socket.data.playerName = name;
      playerSockets.set(socket.id, player);

      // Broadcast updated game state
      broadcastGameState(roomCode);

      // Send welcome message to the player
      socket.emit('player:joined', player);
      console.log(`✅ Player "${name}" joined room ${roomCode}`);
    });

    // Player or display leaves
    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);

      const roomCode = socket.data.roomCode;
      if (!roomCode) return;

      const room = rooms.get(roomCode);
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
    socket.on('game:start', ({ roomCode, gameType }) => {
      console.log(`🎮 Starting game "${gameType}" in room ${roomCode}`);

      const room = rooms.get(roomCode);
      if (!room) {
        console.error(`❌ Room ${roomCode} not found`);
        return;
      }

      // Update game state
      room.gameState.gameType = gameType;
      room.gameState.phase = 'prompt';
      room.gameState.currentRound = 1;

      // Broadcast updated state
      broadcastGameState(roomCode);
    });

    // Generic player submission
    socket.on('player:submit', ({ roomCode, data }) => {
      console.log(`📝 Player submission in room ${roomCode}:`, data);

      const room = rooms.get(roomCode);
      if (!room) return;

      // Store submission in game state (game-specific logic will go here)
      if (!room.gameState.submissions) {
        room.gameState.submissions = [];
      }

      room.gameState.submissions.push({
        playerId: socket.data.playerId,
        playerName: socket.data.playerName,
        data,
        timestamp: Date.now(),
      });

      // Broadcast updated state
      broadcastGameState(roomCode);
    });

    // Generic player vote
    socket.on('player:vote', ({ roomCode, data }) => {
      console.log(`🗳️ Player vote in room ${roomCode}:`, data);

      const room = rooms.get(roomCode);
      if (!room) return;

      // Store vote in game state (game-specific logic will go here)
      if (!room.gameState.votes) {
        room.gameState.votes = [];
      }

      room.gameState.votes.push({
        playerId: socket.data.playerId,
        playerName: socket.data.playerName,
        data,
        timestamp: Date.now(),
      });

      // Broadcast updated state
      broadcastGameState(roomCode);
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
