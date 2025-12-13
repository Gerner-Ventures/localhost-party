'use client';

import type { GameState } from '@/lib/types';
import { QuiplashDisplay } from '@/components/games/QuiplashDisplay';

interface GameBoardProps {
  gameState: GameState;
}

export function GameBoard({ gameState }: GameBoardProps) {
  return (
    <div className="flex flex-col items-center justify-center h-screen p-12 text-white">
      {/* Header */}
      <div className="w-full max-w-6xl mb-8">
        <div className="flex justify-between items-center">
          <div className="text-3xl font-bold">
            Round {gameState.currentRound}
          </div>
          <div className="text-3xl font-bold text-yellow-400">
            {gameState.gameType?.toUpperCase()}
          </div>
          <div className="text-3xl font-bold">
            {gameState.phase.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Game Content Area */}
      <div className="flex-1 w-full max-w-6xl bg-white/10 backdrop-blur-sm rounded-3xl p-12 border-2 border-white/20">
        <div className="flex flex-col items-center justify-center h-full">
          {/* Game-specific components */}
          {gameState.gameType === 'quiplash' ? (
            <QuiplashDisplay gameState={gameState} />
          ) : (
            /* Fallback for other game types */
            <>
              {gameState.phase === 'prompt' && (
                <div className="text-center">
                  <h2 className="text-6xl font-black mb-8">Get Ready!</h2>
                  <p className="text-4xl opacity-80">Check your phones for the prompt</p>
                </div>
              )}

              {gameState.phase === 'submit' && (
                <div className="text-center">
                  <h2 className="text-6xl font-black mb-8">Submit Your Answers</h2>
                  <p className="text-4xl opacity-80">Waiting for players...</p>
                  <div className="mt-12 flex gap-4 justify-center">
                    {gameState.players.map((player) => (
                      <div
                        key={player.id}
                        className="px-6 py-3 bg-white/20 rounded-xl text-2xl"
                      >
                        {player.name} {player.isConnected ? '✓' : '⏳'}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {gameState.phase === 'vote' && (
                <div className="text-center">
                  <h2 className="text-6xl font-black mb-8">Time to Vote!</h2>
                  <p className="text-4xl opacity-80">Cast your votes on your phones</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Player Score Bar */}
      <div className="w-full max-w-6xl mt-8">
        <div className="flex gap-4 justify-center">
          {gameState.players.map((player) => (
            <div
              key={player.id}
              className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl px-6 py-3 min-w-[150px] text-center"
            >
              <div className="text-xl font-bold">{player.name}</div>
              <div className="text-2xl font-black text-yellow-400">{player.score}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
