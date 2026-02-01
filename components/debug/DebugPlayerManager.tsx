"use client";

import { useState, useCallback } from "react";
import { useWebSocket } from "@/lib/context/WebSocketContext";
import { useDebug } from "@/lib/context/DebugContext";

const FAKE_PLAYER_NAMES = [
  "TestBot",
  "DebugDan",
  "FakeFrank",
  "MockMary",
  "SampleSam",
  "DummyDave",
  "PlaceholderPete",
  "StubSteve",
];

export function DebugPlayerManager() {
  const { gameState } = useWebSocket();
  const { addFakePlayer, removePlayer, setPlayerScore } = useDebug();
  const [customName, setCustomName] = useState("");
  const [editingScore, setEditingScore] = useState<string | null>(null);
  const [scoreValue, setScoreValue] = useState("");

  const handleAddPlayer = useCallback(
    (name?: string) => {
      const playerName =
        name ||
        customName ||
        FAKE_PLAYER_NAMES[
          Math.floor(Math.random() * FAKE_PLAYER_NAMES.length)
        ] + Math.floor(Math.random() * 100);
      addFakePlayer(playerName);
      setCustomName("");
    },
    [addFakePlayer, customName]
  );

  const handleEditScore = useCallback(
    (playerId: string, currentScore: number) => {
      setEditingScore(playerId);
      setScoreValue(currentScore.toString());
    },
    []
  );

  const handleSaveScore = useCallback(
    (playerId: string) => {
      const score = parseInt(scoreValue, 10);
      if (!isNaN(score)) {
        setPlayerScore(playerId, score);
      }
      setEditingScore(null);
      setScoreValue("");
    },
    [scoreValue, setPlayerScore]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingScore(null);
    setScoreValue("");
  }, []);

  if (!gameState) {
    return (
      <div className="p-4 text-gray-500 text-center">
        No game state available. Join a room first.
      </div>
    );
  }

  const players = gameState.players || [];

  return (
    <div className="flex flex-col h-full">
      {/* Add Player Section */}
      <div className="p-4 border-b border-cyan-500/20">
        <h3 className="text-gray-400 text-xs mb-2 uppercase tracking-wider">
          Add Player
        </h3>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            placeholder="Player name..."
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddPlayer()}
            className="flex-1 px-2 py-1.5 text-xs bg-black/50 border border-cyan-500/30
                       rounded text-white placeholder-gray-500
                       focus:outline-none focus:border-cyan-400"
          />
          <button
            onClick={() => handleAddPlayer()}
            className="px-3 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-500
                       text-white rounded transition-colors"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {FAKE_PLAYER_NAMES.slice(0, 4).map((name) => (
            <button
              key={name}
              onClick={() => handleAddPlayer(name)}
              className="px-2 py-1 text-[10px] bg-cyan-500/20 text-cyan-400
                         hover:bg-cyan-500/40 rounded transition-colors"
            >
              + {name}
            </button>
          ))}
        </div>
      </div>

      {/* Player List */}
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <h3 className="text-gray-400 text-xs mb-2 uppercase tracking-wider">
            Players ({players.length})
          </h3>
          {players.length === 0 ? (
            <div className="text-gray-500 text-xs text-center py-4">
              No players in room
            </div>
          ) : (
            <div className="space-y-2">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-2 p-2 bg-white/5 rounded
                             border border-cyan-500/10"
                >
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center
                               text-xs font-bold text-black bg-cyan-500"
                  >
                    {player.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-xs font-medium truncate">
                      {player.name}
                    </div>
                    <div className="text-gray-500 text-[10px] truncate">
                      {player.id}
                    </div>
                  </div>

                  {/* Score */}
                  <div className="flex items-center gap-1">
                    {editingScore === player.id ? (
                      <>
                        <input
                          type="number"
                          value={scoreValue}
                          onChange={(e) => setScoreValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveScore(player.id);
                            if (e.key === "Escape") handleCancelEdit();
                          }}
                          className="w-16 px-1 py-0.5 text-xs bg-black border border-cyan-400
                                     rounded text-white text-center focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveScore(player.id)}
                          className="text-green-400 hover:text-green-300 text-xs"
                        >
                          ✓
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="text-gray-400 hover:text-gray-300 text-xs"
                        >
                          ✗
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() =>
                          handleEditScore(player.id, player.score || 0)
                        }
                        className="text-cyan-400 hover:text-cyan-300 text-xs
                                   px-2 py-0.5 bg-cyan-500/10 rounded"
                      >
                        {player.score || 0} pts
                      </button>
                    )}
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removePlayer(player.id)}
                    className="text-red-400 hover:text-red-300 text-xs px-1"
                    title="Remove player"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
