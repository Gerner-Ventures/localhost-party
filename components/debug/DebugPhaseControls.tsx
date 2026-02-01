"use client";

import { useWebSocket } from "@/lib/context/WebSocketContext";
import { useDebug } from "@/lib/context/DebugContext";
import type { GamePhase } from "@/lib/types/game";

// Phases organized by game type
const QUIPLASH_PHASES: { phase: GamePhase; label: string }[] = [
  { phase: "lobby", label: "Lobby" },
  { phase: "prompt", label: "Prompt" },
  { phase: "submit", label: "Submit" },
  { phase: "vote", label: "Vote" },
  { phase: "results", label: "Results" },
];

const PIXEL_SHOWDOWN_PHASES: { phase: GamePhase; label: string }[] = [
  { phase: "lobby", label: "Lobby" },
  { phase: "category_announce", label: "Category" },
  { phase: "question", label: "Question" },
  { phase: "answer_reveal", label: "Reveal" },
  { phase: "leaderboard", label: "Leaderboard" },
  { phase: "round_results", label: "Round Results" },
  { phase: "game_results", label: "Game Results" },
];

export function DebugPhaseControls() {
  const { gameState } = useWebSocket();
  const { setPhase, resetGame } = useDebug();

  if (!gameState) {
    return (
      <div className="p-4 text-gray-500 text-center">
        No game state available. Join a room first.
      </div>
    );
  }

  const isQuiplash = gameState.gameType === "quiplash" || !gameState.gameType;
  const isPixelShowdown = gameState.gameType === "pixel-showdown";

  return (
    <div className="p-4 space-y-6">
      {/* Current Phase */}
      <div className="text-center">
        <span className="text-gray-400 text-xs">Current Phase:</span>
        <div className="text-cyan-400 text-lg font-bold mt-1">
          {gameState.phase}
        </div>
      </div>

      {/* Quiplash Phases */}
      {(isQuiplash || !gameState.gameType) && (
        <div>
          <h3 className="text-gray-400 text-xs mb-2 uppercase tracking-wider">
            Quiplash Phases
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {QUIPLASH_PHASES.map(({ phase, label }) => (
              <button
                key={phase}
                onClick={() => setPhase(phase)}
                disabled={gameState.phase === phase}
                className={`px-3 py-2 text-xs rounded transition-colors
                           ${
                             gameState.phase === phase
                               ? "bg-cyan-500 text-black font-bold"
                               : "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/40"
                           }
                           disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pixel Showdown Phases */}
      {(isPixelShowdown || !gameState.gameType) && (
        <div>
          <h3 className="text-gray-400 text-xs mb-2 uppercase tracking-wider">
            Pixel Showdown Phases
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {PIXEL_SHOWDOWN_PHASES.map(({ phase, label }) => (
              <button
                key={phase}
                onClick={() => setPhase(phase)}
                disabled={gameState.phase === phase}
                className={`px-3 py-2 text-xs rounded transition-colors
                           ${
                             gameState.phase === phase
                               ? "bg-purple-500 text-black font-bold"
                               : "bg-purple-500/20 text-purple-400 hover:bg-purple-500/40"
                           }
                           disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="border-t border-cyan-500/20 pt-4">
        <h3 className="text-gray-400 text-xs mb-2 uppercase tracking-wider">
          Actions
        </h3>
        <div className="flex gap-2">
          <button
            onClick={resetGame}
            className="flex-1 px-3 py-2 text-xs bg-red-600 hover:bg-red-500
                       text-white rounded transition-colors"
          >
            Reset Game
          </button>
        </div>
      </div>
    </div>
  );
}
