'use client';

import type { GameState } from '@/lib/types/game';

interface QuiplashDisplayProps {
  gameState: GameState;
}

export function QuiplashDisplay({ gameState }: QuiplashDisplayProps) {
  const { phase, prompts, submissions, players, currentRound } = gameState;

  if (phase === 'prompt') {
    return (
      <div className="text-center animate-slide-up">
        <h2 className="text-7xl font-black mb-12">Round {currentRound}</h2>
        <p className="text-5xl opacity-80">Check your phones for your prompt!</p>
        <div className="mt-16 text-3xl opacity-60">
          Answer creatively... the funniest answer wins!
        </div>
      </div>
    );
  }

  if (phase === 'submit') {
    const submittedCount = submissions?.length || 0;
    const totalPlayers = players.length;

    return (
      <div className="text-center animate-slide-up">
        <h2 className="text-7xl font-black mb-12">Submit Your Answers</h2>
        <p className="text-5xl opacity-80 mb-16">
          Waiting for players...
        </p>

        {/* Progress Bar */}
        <div className="max-w-3xl mx-auto mb-12">
          <div className="h-8 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
              style={{ width: `${(submittedCount / totalPlayers) * 100}%` }}
            />
          </div>
          <p className="text-2xl mt-4 opacity-60">
            {submittedCount} / {totalPlayers} submitted
          </p>
        </div>

        {/* Player Indicators */}
        <div className="flex gap-6 justify-center flex-wrap max-w-4xl mx-auto">
          {players.map((player) => {
            const hasSubmitted = submissions?.some(
              (s) => s.playerId === player.id
            );

            return (
              <div
                key={player.id}
                className={`px-8 py-4 rounded-2xl text-2xl font-bold transition-all duration-300 ${
                  hasSubmitted
                    ? 'bg-green-500/30 border-2 border-green-400'
                    : 'bg-white/10 border-2 border-white/20'
                }`}
              >
                {player.name} {hasSubmitted ? '✓' : '⏳'}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (phase === 'vote') {
    // Show all submissions for voting
    return (
      <div className="text-center animate-slide-up">
        <h2 className="text-7xl font-black mb-8">Time to Vote!</h2>

        {/* Show the prompt */}
        {prompts && prompts[0] && (
          <div className="text-4xl opacity-80 mb-12 max-w-4xl mx-auto">
            "{prompts[0].text}"
          </div>
        )}

        {/* Show all submissions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto mt-16">
          {submissions?.map((submission, index) => (
            <div
              key={submission.playerId}
              className="bg-gradient-to-br from-purple-600/30 to-blue-600/30 backdrop-blur-sm rounded-3xl p-10 border-2 border-white/20 animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="text-4xl font-bold mb-4">
                {String.fromCharCode(65 + index)}
              </div>
              <div className="text-3xl min-h-[100px] flex items-center justify-center">
                "{String(submission.data)}"
              </div>
            </div>
          ))}
        </div>

        <p className="text-3xl opacity-60 mt-12">
          Vote on your phone for your favorite answer!
        </p>
      </div>
    );
  }

  return null;
}
