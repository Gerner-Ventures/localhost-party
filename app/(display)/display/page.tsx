'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from '@/lib/context/WebSocketContext';
import { RoomLobby } from '@/components/display/RoomLobby';
import { GameBoard } from '@/components/display/GameBoard';
import { Leaderboard } from '@/components/display/Leaderboard';

export default function DisplayPage() {
  const { gameState, emit, isConnected } = useWebSocket();
  const [roomCode, setRoomCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Create room when display loads
    const createRoom = async () => {
      try {
        const response = await fetch('/api/rooms/create', { method: 'POST' });
        if (!response.ok) throw new Error('Failed to create room');

        const data = await response.json();
        setRoomCode(data.code);

        // Try to join via WebSocket if connected
        if (isConnected) {
          emit({ type: 'display:join', payload: { roomCode: data.code } });
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error creating room:', error);
        setError('Failed to create room. Please refresh the page.');
        setIsLoading(false);
      }
    };

    // Create room immediately, don't wait for WebSocket
    // WebSocket connection can happen in parallel
    createRoom();
  }, [emit, isConnected]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-white">
        <div className="text-6xl font-black mb-8 text-red-400">
          Error
        </div>
        <div className="text-3xl opacity-80 text-center px-8">
          {error}
        </div>
      </div>
    );
  }

  if (isLoading || !roomCode) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-white">
        <div className="text-6xl font-black mb-8 animate-pulse">
          localhost:party
        </div>
        <div className="text-3xl opacity-80">
          Creating room...
        </div>
        {!isConnected && (
          <div className="mt-4 text-xl opacity-60 max-w-2xl text-center">
            Note: WebSocket server not available. UI will work but players won't sync in real-time.
          </div>
        )}
      </div>
    );
  }

  // If no game state yet, show lobby by default
  if (!gameState) {
    return <RoomLobby roomCode={roomCode} players={[]} />;
  }

  return (
    <>
      {gameState.phase === 'lobby' && (
        <RoomLobby roomCode={roomCode} players={gameState.players} />
      )}

      {['prompt', 'submit', 'vote'].includes(gameState.phase) && (
        <GameBoard gameState={gameState} />
      )}

      {gameState.phase === 'results' && (
        <Leaderboard players={gameState.players} />
      )}
    </>
  );
}
