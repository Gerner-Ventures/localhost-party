'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useWebSocket } from '@/lib/context/WebSocketContext';

function PlayerLobbyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { gameState, emit, isConnected } = useWebSocket();

  const roomCode = searchParams.get('code')?.toUpperCase();
  const [playerName, setPlayerName] = useState('');

  useEffect(() => {
    // Get player name from localStorage
    const savedName = localStorage.getItem('playerName');
    if (savedName) {
      setPlayerName(savedName);
    }

    // Redirect if no room code
    if (!roomCode) {
      router.push('/play');
    }
  }, [roomCode, router]);

  const currentPlayer = gameState?.players.find(
    (p) => p.name === playerName
  );

  const handleStartGame = () => {
    if (roomCode) {
      emit({
        type: 'game:start',
        payload: { roomCode, gameType: 'quiplash' }
      });
    }
  };

  if (!roomCode) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white text-2xl">
        No room code provided
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-white">
        <div className="text-4xl font-bold mb-4 animate-pulse">
          Joining room...
        </div>
        <div className="text-xl opacity-80">Room {roomCode}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen p-6 text-white">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-5xl font-black mb-2">Room {roomCode}</h1>
        <p className="text-xl opacity-80">
          {currentPlayer ? `Welcome, ${currentPlayer.name}!` : 'Waiting for players...'}
        </p>
      </div>

      {/* Connection Status */}
      {!isConnected && (
        <div className="mb-6 bg-yellow-500/20 border-2 border-yellow-500 text-white px-4 py-3 rounded-xl text-center">
          Reconnecting...
        </div>
      )}

      {/* Player Count */}
      <div className="text-center mb-6">
        <div className="inline-block bg-white/20 backdrop-blur-sm rounded-2xl px-8 py-4">
          <div className="text-3xl font-bold">
            {gameState.players.length} {gameState.players.length === 1 ? 'Player' : 'Players'}
          </div>
        </div>
      </div>

      {/* Player List */}
      <div className="flex-1 space-y-3 mb-6 overflow-y-auto">
        {gameState.players.length === 0 ? (
          <div className="text-center text-xl opacity-60 py-12">
            No players yet. Scan the QR code on the TV to join!
          </div>
        ) : (
          gameState.players.map((player, index) => (
            <div
              key={player.id}
              className={`p-5 rounded-xl transition-all ${
                player.name === playerName
                  ? 'bg-yellow-400 text-gray-900 scale-105'
                  : 'bg-white/10 backdrop-blur-sm'
              }`}
              style={{
                animation: `slideIn 0.3s ease-out ${index * 0.05}s both`
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-3xl">
                    {['🎮', '🎯', '🎲', '🎪', '🎨', '🎭', '🎸', '🎤'][index % 8]}
                  </div>
                  <div>
                    <div className="text-xl font-bold">{player.name}</div>
                    <div className={`text-sm ${player.name === playerName ? 'text-gray-700' : 'opacity-60'}`}>
                      {player.score} points
                    </div>
                  </div>
                </div>
                {player.name === playerName && (
                  <span className="text-sm font-bold bg-gray-900 text-yellow-400 px-3 py-1 rounded-full">
                    YOU
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Game Status */}
      {gameState.players.length < 2 && (
        <div className="mb-6 text-center">
          <div className="bg-blue-500/20 border-2 border-blue-500 text-white px-4 py-3 rounded-xl">
            <p className="font-bold mb-1">Waiting for more players</p>
            <p className="text-sm opacity-80">Need at least 2 players to start</p>
          </div>
        </div>
      )}

      {/* Start Game Button */}
      {gameState.players.length >= 2 && (
        <button
          onClick={handleStartGame}
          disabled={!isConnected}
          className="w-full py-6 text-2xl font-bold bg-green-500 text-white rounded-xl hover:bg-green-400 active:scale-95 transition-transform shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          🎮 Start Game
        </button>
      )}

      {/* Instructions */}
      <div className="mt-6 text-center text-white/60 text-sm">
        <p>More players can join by scanning the QR code on the TV</p>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default function PlayerLobbyPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen text-white text-2xl">
        Loading...
      </div>
    }>
      <PlayerLobbyContent />
    </Suspense>
  );
}
