'use client';

import { QRCodeSVG } from 'qrcode.react';
import type { Player } from '@/lib/types';

interface RoomLobbyProps {
  roomCode: string;
  players: Player[];
}

export function RoomLobby({ roomCode, players }: RoomLobbyProps) {
  const joinUrl = `${process.env.NEXT_PUBLIC_APP_URL}/play?code=${roomCode}`;

  return (
    <div className="flex flex-col items-center justify-center h-screen p-12 text-white">
      {/* Logo/Title */}
      <div className="mb-12">
        <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500">
          localhost:party
        </h1>
      </div>

      {/* Room Code Display */}
      <div className="text-center mb-16">
        <p className="text-2xl mb-4 opacity-80">Room Code</p>
        <h2 className="text-9xl font-black mb-6 tracking-[0.5em] text-yellow-400 drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]">
          {roomCode}
        </h2>
        <p className="text-3xl opacity-80">
          Join at <span className="font-bold text-yellow-400">{process.env.NEXT_PUBLIC_APP_URL}/play</span>
        </p>
      </div>

      {/* QR Code */}
      <div className="bg-white p-8 rounded-3xl mb-16 shadow-2xl">
        <QRCodeSVG value={joinUrl} size={220} />
      </div>

      {/* Connected Players */}
      <div className="w-full max-w-6xl">
        <h3 className="text-5xl font-bold mb-10 text-center">
          Players <span className="text-yellow-400">({players.length})</span>
        </h3>
        {players.length === 0 ? (
          <div className="text-3xl text-center opacity-60">
            Waiting for players to join...
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-6">
            {players.map((player, index) => (
              <div
                key={player.id}
                className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center transform hover:scale-105 transition-transform border-2 border-white/20"
                style={{
                  animation: `fadeIn 0.5s ease-out ${index * 0.1}s both`
                }}
              >
                <div className="text-4xl mb-3">
                  {['🎮', '🎯', '🎲', '🎪', '🎨', '🎭', '🎸', '🎤'][index % 8]}
                </div>
                <div className="text-2xl font-bold truncate">{player.name}</div>
                <div className="text-lg opacity-60 mt-2">{player.score} pts</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Start Button Instruction */}
      {players.length >= 2 && (
        <div className="mt-16 text-3xl opacity-80 animate-pulse">
          ✨ Ready to start? Have a player tap "Start Game" on their phone
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
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
