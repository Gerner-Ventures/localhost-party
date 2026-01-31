"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useWebSocket } from "@/lib/context/WebSocketContext";
import { useAudio } from "@/lib/context/AudioContext";
import { useAgents } from "@/lib/context/AgentContext";
import { RoomLobby } from "@/components/display/RoomLobby";
import { GameBoard } from "@/components/display/GameBoard";
import { Leaderboard } from "@/components/display/Leaderboard";
import { AUDIO_VOLUMES, AUDIO_DURATIONS } from "@/lib/audio/constants";
import type { GameType } from "@/lib/types/game";

function DisplayContent() {
  const searchParams = useSearchParams();
  const gameType = searchParams.get("game");
  const { gameState, emit, isConnected } = useWebSocket();
  const { playSound, playMusic, stopMusic } = useAudio();
  const { agentsEnabled, setAgentsEnabled, speakingAgent } = useAgents();
  const [roomCode, setRoomCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string>("");

  // Refs to prevent duplicate operations (persists across re-renders and strict mode)
  const hasCreatedRoom = useRef(false);
  const hasJoinedRoom = useRef(false);
  const previousPhase = useRef(gameState?.phase);
  const isMusicPlaying = useRef(false);

  // Create room once on mount - uses both ref and state for robust race condition prevention
  useEffect(() => {
    // Skip if already created or currently creating
    if (hasCreatedRoom.current || isCreating) return;
    hasCreatedRoom.current = true;
    setIsCreating(true);

    const createRoom = async () => {
      try {
        const response = await fetch("/api/rooms/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameType }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to create room");
        }

        const data = await response.json();
        setRoomCode(data.code);
        setIsLoading(false);
      } catch (err) {
        console.error("Error creating room:", err);
        const message =
          err instanceof Error ? err.message : "Failed to create room";
        setError(`${message}. Please refresh the page.`);
        setIsLoading(false);
      } finally {
        setIsCreating(false);
      }
    };

    createRoom();
  }, [gameType, isCreating]);

  // Join room via WebSocket when connected and room is ready
  useEffect(() => {
    if (isConnected && roomCode && !hasJoinedRoom.current) {
      hasJoinedRoom.current = true;
      // Pass gameType so Railway WebSocket server knows what game this room is for
      emit({
        type: "display:join",
        payload: { roomCode, gameType: gameType as GameType | null },
      });
    }
  }, [isConnected, roomCode, gameType, emit]);

  // Play lobby music and handle phase transitions
  useEffect(() => {
    const currentPhase = gameState?.phase;

    // Start music when in lobby phase
    if (currentPhase === "lobby" && !isMusicPlaying.current) {
      isMusicPlaying.current = true;
      playMusic("lobby-theme", {
        loop: true,
        fadeIn: AUDIO_DURATIONS.FADE_IN_SLOW,
        volume: AUDIO_VOLUMES.LOBBY_MUSIC,
      });
    }

    // Stop music when game starts (leaving lobby)
    if (currentPhase && currentPhase !== "lobby" && isMusicPlaying.current) {
      isMusicPlaying.current = false;
      stopMusic("lobby-theme", { fadeOut: AUDIO_DURATIONS.FADE_OUT_MEDIUM });
    }

    // Play phase transition sound
    if (currentPhase && currentPhase !== previousPhase.current) {
      // Skip sound on initial load
      if (previousPhase.current !== undefined) {
        playSound("phase-transition");
      }
      previousPhase.current = currentPhase;
    }
  }, [gameState?.phase, playSound, playMusic, stopMusic]);

  // Cleanup music on unmount
  useEffect(() => {
    return () => {
      if (isMusicPlaying.current) {
        stopMusic("lobby-theme", { fadeOut: 500 });
      }
    };
  }, [stopMusic]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-white">
        <div className="text-6xl font-black mb-8 text-red-400">Error</div>
        <div className="text-3xl opacity-80 text-center px-8">{error}</div>
      </div>
    );
  }

  if (isLoading || !roomCode) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-white">
        <div className="text-6xl font-black mb-8 animate-pulse">
          localhost:party
        </div>
        <div className="text-3xl opacity-80">Creating room...</div>
        {!isConnected && (
          <div className="mt-4 text-xl opacity-60 max-w-2xl text-center">
            Note: WebSocket server not available. UI will work but players
            won&apos;t sync in real-time.
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
      {gameState.phase === "lobby" && (
        <RoomLobby roomCode={roomCode} players={gameState.players} />
      )}

      {/* Quiplash phases */}
      {["prompt", "submit", "vote"].includes(gameState.phase) && (
        <GameBoard gameState={gameState} />
      )}

      {gameState.phase === "results" && (
        <Leaderboard players={gameState.players} />
      )}

      {/* Pixel Showdown phases */}
      {[
        "category_announce",
        "question",
        "answer_reveal",
        "leaderboard",
        "round_results",
        "game_results",
      ].includes(gameState.phase) && <GameBoard gameState={gameState} />}

      {/* AI Agent Toggle */}
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
        {speakingAgent && (
          <div className="px-3 py-1 rounded-full bg-neon-cyan/20 text-neon-cyan text-sm animate-pulse">
            AI Speaking...
          </div>
        )}
        <button
          onClick={() => setAgentsEnabled(!agentsEnabled)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            agentsEnabled
              ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30"
              : "bg-gray-800/80 text-gray-400 border border-gray-600 hover:bg-gray-700"
          }`}
          title={
            agentsEnabled ? "Disable AI Commentary" : "Enable AI Commentary"
          }
        >
          {agentsEnabled ? "AI: ON" : "AI: OFF"}
        </button>
      </div>
    </>
  );
}

export default function DisplayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center h-screen text-white">
          <div className="text-6xl font-black mb-8 animate-pulse">
            localhost:party
          </div>
          <div className="text-3xl opacity-80">Loading...</div>
        </div>
      }
    >
      <DisplayContent />
    </Suspense>
  );
}
