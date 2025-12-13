'use client';

import type { Player } from '@/lib/types';

interface LeaderboardProps {
  players: Player[];
}

export function Leaderboard({ players }: LeaderboardProps) {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  const getMedal = (position: number) => {
    switch (position) {
      case 0: return '🥇';
      case 1: return '🥈';
      case 2: return '🥉';
      default: return '🏅';
    }
  };

  const getPositionColor = (position: number) => {
    switch (position) {
      case 0: return 'from-yellow-400 to-yellow-600';
      case 1: return 'from-gray-300 to-gray-500';
      case 2: return 'from-orange-400 to-orange-600';
      default: return 'from-blue-400 to-blue-600';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen p-12 text-white">
      {/* Header */}
      <div className="mb-16 text-center">
        <h1 className="text-8xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500">
          Final Scores
        </h1>
        <p className="text-4xl opacity-80">Great game everyone! 🎉</p>
      </div>

      {/* Leaderboard */}
      <div className="w-full max-w-4xl space-y-6">
        {sortedPlayers.map((player, index) => (
          <div
            key={player.id}
            className={`flex items-center justify-between p-8 rounded-2xl bg-gradient-to-r ${getPositionColor(index)} shadow-2xl transform hover:scale-105 transition-all`}
            style={{
              animation: `slideIn 0.5s ease-out ${index * 0.15}s both`
            }}
          >
            <div className="flex items-center gap-6">
              <div className="text-6xl">{getMedal(index)}</div>
              <div className="text-5xl font-black text-white">{player.name}</div>
            </div>
            <div className="text-6xl font-black text-white drop-shadow-lg">
              {player.score}
            </div>
          </div>
        ))}
      </div>

      {/* Play Again Prompt */}
      <div className="mt-16 text-3xl opacity-80 text-center">
        Want to play again? Scan the QR code on the next screen
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-100px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
