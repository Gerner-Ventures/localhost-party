"use client";

import type { PixelShowdownState } from "@/lib/types/pixel-showdown";

interface PixelShowdownDisplayProps {
  gameState: PixelShowdownState;
}

export function PixelShowdownDisplay({ gameState }: PixelShowdownDisplayProps) {
  const {
    phase,
    currentQuestion,
    answers,
    players,
    questionNumber,
    questionsPerRound,
    timeRemaining,
    currentRound,
    totalRounds,
    playerStats,
    questionQueue,
    currentCategory,
  } = gameState;

  // Category Announcement Phase
  if (phase === "category_announce") {
    // Use currentCategory if set, otherwise fall back to question data
    const category =
      currentCategory ||
      currentQuestion?.category ||
      questionQueue[0]?.category ||
      "Loading...";

    return (
      <div className="text-center animate-slide-up">
        <h2 className="text-5xl font-black mb-8 opacity-60">
          ROUND {currentRound}
        </h2>
        <p className="text-3xl opacity-40 mb-12">Next Category</p>
        <div className="text-8xl font-black text-[var(--neon-cyan)] animate-pulse">
          {category}
        </div>
        <p className="text-3xl opacity-60 mt-12">Get ready...</p>
      </div>
    );
  }

  // Question Phase
  if (phase === "question" && currentQuestion) {
    return (
      <div className="text-center">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 px-8">
          <div className="text-2xl opacity-60">
            Question {questionNumber} / {questionsPerRound}
          </div>
          <div className="text-4xl font-bold text-[var(--neon-yellow)] animate-pulse">
            {timeRemaining}s
          </div>
          <div className="text-2xl opacity-60 px-4 py-2 rounded-full bg-white/10">
            {currentQuestion.category}
          </div>
        </div>

        {/* Question */}
        <h2 className="text-5xl font-black mb-12 leading-tight max-w-5xl mx-auto">
          {currentQuestion.text}
        </h2>

        {/* Multiple Choice Options */}
        {currentQuestion.type === "multiple_choice" &&
          currentQuestion.options && (
            <div className="grid grid-cols-2 gap-6 max-w-5xl mx-auto">
              {currentQuestion.options.map((option, i) => (
                <div
                  key={i}
                  className="bg-gradient-to-br from-purple-600/30 to-blue-600/30 backdrop-blur-sm rounded-2xl p-8 border-2 border-white/20 text-left"
                >
                  <span className="text-4xl font-bold text-[var(--neon-cyan)] mr-4">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="text-2xl">{option}</span>
                </div>
              ))}
            </div>
          )}

        {/* Free Text Indicator */}
        {currentQuestion.type === "free_text" && (
          <div className="text-3xl opacity-60 mb-8">
            Type your answer on your phone!
          </div>
        )}

        {/* Answer Progress */}
        <div className="mt-12 flex gap-4 justify-center flex-wrap max-w-4xl mx-auto">
          {players.map((player) => {
            const hasAnswered = answers.some((a) => a.playerId === player.id);
            return (
              <div
                key={player.id}
                className={`px-6 py-3 rounded-xl text-xl font-bold transition-all ${
                  hasAnswered
                    ? "bg-green-500/30 border-2 border-green-400"
                    : "bg-white/10 border-2 border-white/20"
                }`}
              >
                {player.name} {hasAnswered ? "✓" : "..."}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Answer Reveal Phase
  if (phase === "answer_reveal" && currentQuestion) {
    return (
      <div className="text-center animate-slide-up">
        <h2 className="text-4xl font-black mb-8 text-[var(--neon-green)]">
          CORRECT ANSWER
        </h2>
        <div className="text-6xl font-black mb-12 text-white">
          {currentQuestion.correctAnswer}
        </div>

        {/* Player Results */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {answers.map((answer) => {
            const stats = playerStats[answer.playerId];
            return (
              <div
                key={answer.playerId}
                className={`p-6 rounded-xl transition-all ${
                  answer.isCorrect
                    ? "bg-green-500/30 border-2 border-green-400"
                    : "bg-red-500/30 border-2 border-red-400"
                }`}
              >
                <div className="text-xl font-bold mb-1">
                  {answer.playerName}
                </div>
                <div className="text-lg opacity-80 truncate">
                  &ldquo;{answer.answer}&rdquo;
                </div>
                {answer.isCorrect && (
                  <div className="text-[var(--neon-yellow)] font-bold mt-2 text-2xl">
                    +{answer.pointsAwarded} pts
                  </div>
                )}
                {stats && stats.currentStreak >= 2 && (
                  <div className="text-orange-400 text-sm mt-1">
                    {stats.currentStreak} streak
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Leaderboard Phase
  if (phase === "leaderboard") {
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

    return (
      <div className="text-center animate-slide-up">
        <h2 className="text-5xl font-black mb-12">STANDINGS</h2>
        <div className="space-y-4 max-w-3xl mx-auto">
          {sortedPlayers.map((player, i) => {
            const stats = playerStats[player.id];
            return (
              <div
                key={player.id}
                className="flex items-center justify-between p-6 bg-gradient-to-r from-purple-600/30 to-blue-600/30 rounded-xl border-2 border-white/10"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="flex items-center gap-6">
                  <span
                    className={`text-4xl font-black ${
                      i === 0
                        ? "text-[var(--neon-yellow)]"
                        : i === 1
                          ? "text-gray-300"
                          : i === 2
                            ? "text-orange-400"
                            : "text-white/60"
                    }`}
                  >
                    #{i + 1}
                  </span>
                  <span className="text-2xl font-bold">{player.name}</span>
                  {stats && stats.currentStreak >= 3 && (
                    <span className="text-xl text-orange-400 animate-pulse">
                      {stats.currentStreak} streak
                    </span>
                  )}
                </div>
                <span className="text-3xl font-black text-[var(--neon-green)]">
                  {player.score}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-2xl opacity-60 mt-8">
          Question {questionNumber} / {questionsPerRound} complete
        </p>
      </div>
    );
  }

  // Round Results Phase
  if (phase === "round_results") {
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

    return (
      <div className="text-center animate-slide-up">
        <h2 className="text-6xl font-black mb-4 text-[var(--neon-magenta)]">
          ROUND {currentRound} COMPLETE!
        </h2>
        <p className="text-2xl opacity-60 mb-12">
          {currentRound < totalRounds
            ? `${totalRounds - currentRound} round${totalRounds - currentRound > 1 ? "s" : ""} remaining`
            : "Final round complete!"}
        </p>

        <div className="space-y-4 max-w-3xl mx-auto">
          {sortedPlayers.map((player, i) => {
            const stats = playerStats[player.id];
            return (
              <div
                key={player.id}
                className="flex items-center justify-between p-6 bg-gradient-to-r from-purple-600/30 to-blue-600/30 rounded-xl"
              >
                <div className="flex items-center gap-6">
                  <span className="text-4xl font-black text-[var(--neon-yellow)]">
                    #{i + 1}
                  </span>
                  <div className="text-left">
                    <div className="text-2xl font-bold">{player.name}</div>
                    {stats && (
                      <div className="text-sm opacity-60">
                        {stats.totalCorrect} correct | Best streak:{" "}
                        {stats.longestStreak}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-3xl font-black text-[var(--neon-green)]">
                  {player.score}
                </span>
              </div>
            );
          })}
        </div>

        <p className="text-2xl opacity-60 mt-12">
          {currentRound < totalRounds
            ? "Waiting for host to start next round..."
            : "Waiting to see final results..."}
        </p>
      </div>
    );
  }

  // Game Results Phase (Final)
  if (phase === "game_results") {
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];

    return (
      <div className="text-center animate-slide-up">
        <h2 className="text-7xl font-black mb-4 text-[var(--neon-yellow)]">
          GAME OVER!
        </h2>
        <div className="text-4xl mb-8">
          <span className="text-[var(--neon-cyan)]">{winner?.name}</span> wins
          with <span className="text-[var(--neon-green)]">{winner?.score}</span>{" "}
          points!
        </div>

        <div className="space-y-4 max-w-3xl mx-auto mt-12">
          {sortedPlayers.map((player, i) => {
            const stats = playerStats[player.id];
            return (
              <div
                key={player.id}
                className={`flex items-center justify-between p-6 rounded-xl ${
                  i === 0
                    ? "bg-gradient-to-r from-yellow-600/40 to-orange-600/40 border-2 border-yellow-400"
                    : "bg-gradient-to-r from-purple-600/20 to-blue-600/20"
                }`}
              >
                <div className="flex items-center gap-6">
                  <span
                    className={`text-4xl font-black ${
                      i === 0 ? "text-[var(--neon-yellow)]" : "text-white/60"
                    }`}
                  >
                    #{i + 1}
                  </span>
                  <div className="text-left">
                    <div className="text-2xl font-bold">{player.name}</div>
                    {stats && (
                      <div className="text-sm opacity-60">
                        {stats.totalCorrect} correct | Best streak:{" "}
                        {stats.longestStreak}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-3xl font-black text-[var(--neon-green)]">
                  {player.score}
                </span>
              </div>
            );
          })}
        </div>

        <p className="text-2xl opacity-60 mt-12">
          Press Play Again on your phone to start a new game!
        </p>
      </div>
    );
  }

  return null;
}
