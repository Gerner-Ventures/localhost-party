'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWebSocket } from '@/lib/context/WebSocketContext';

function JoinRoomContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { emit, isConnected } = useWebSocket();

  const [roomCode, setRoomCode] = useState(searchParams.get('code')?.toUpperCase() || '');
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Load saved player name from localStorage if it exists
  useEffect(() => {
    const savedName = localStorage.getItem('playerName');
    if (savedName) {
      setPlayerName(savedName);
    }
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsJoining(true);

    if (!roomCode || !playerName) {
      setError('Please fill in all fields');
      setIsJoining(false);
      return;
    }

    if (roomCode.length !== 4) {
      setError('Room code must be 4 characters');
      setIsJoining(false);
      return;
    }

    try {
      // Validate room exists
      const res = await fetch(`/api/rooms/${roomCode.toUpperCase()}`);
      if (!res.ok) {
        throw new Error('Room not found');
      }

      // Store player info in localStorage
      localStorage.setItem('playerName', playerName);
      localStorage.setItem('roomCode', roomCode.toUpperCase());

      // Join via WebSocket
      emit({
        type: 'player:join',
        payload: { roomCode: roomCode.toUpperCase(), name: playerName }
      });

      // Navigate to lobby
      router.push(`/play/lobby?code=${roomCode.toUpperCase()}`);
    } catch (err) {
      console.error('Error joining room:', err);
      setError('Could not join room. Please check the code and try again.');
      setIsJoining(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <div className="w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black text-white mb-3">
            localhost:party
          </h1>
          <p className="text-xl text-white/80">Party games powered by AI</p>
        </div>

        {/* Join Form */}
        <form onSubmit={handleJoin} className="space-y-6">
          {/* Room Code Input */}
          <div>
            <label htmlFor="roomCode" className="block text-white text-sm font-bold mb-2">
              Room Code
            </label>
            <input
              id="roomCode"
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 4))}
              maxLength={4}
              className="w-full px-6 py-4 text-3xl font-bold text-center uppercase tracking-widest rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-yellow-400"
              placeholder="ABCD"
              autoComplete="off"
              required
            />
          </div>

          {/* Player Name Input */}
          <div>
            <label htmlFor="playerName" className="block text-white text-sm font-bold mb-2">
              Your Name
            </label>
            <input
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value.slice(0, 20))}
              maxLength={20}
              className="w-full px-6 py-4 text-xl rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-yellow-400"
              placeholder="Enter your name"
              autoComplete="off"
              required
            />
            <p className="text-sm text-white/60 mt-2">
              {playerName.length}/20 characters
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/20 border-2 border-red-500 text-white px-4 py-3 rounded-xl text-center">
              {error}
            </div>
          )}

          {/* Connection Status */}
          {!isConnected && (
            <div className="bg-yellow-500/20 border-2 border-yellow-500 text-white px-4 py-3 rounded-xl text-center">
              Connecting to server...
            </div>
          )}

          {/* Join Button */}
          <button
            type="submit"
            disabled={!isConnected || isJoining || !roomCode || !playerName}
            className="w-full py-5 text-2xl font-bold bg-yellow-400 text-gray-900 rounded-xl hover:bg-yellow-300 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isJoining ? 'Joining...' : isConnected ? 'Join Game' : 'Connecting...'}
          </button>
        </form>

        {/* Instructions */}
        <div className="mt-8 text-center text-white/60 text-sm">
          <p>Enter the 4-letter code shown on the TV screen</p>
        </div>
      </div>
    </div>
  );
}

export default function JoinRoomPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen text-white text-2xl">
        Loading...
      </div>
    }>
      <JoinRoomContent />
    </Suspense>
  );
}
