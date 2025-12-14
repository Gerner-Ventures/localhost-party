"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useWebSocket } from "@/lib/context/WebSocketContext";
import { RoomLobby } from "@/components/display/RoomLobby";
import { GameBoard } from "@/components/display/GameBoard";
import { Leaderboard } from "@/components/display/Leaderboard";

function DisplayContent() {
  const searchParams = useSearchParams();
  const gameType = searchParams.get("game");
  const { gameState, emit, isConnected } = useWebSocket();
  const [roomCode, setRoomCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string>("");

  // Refs to prevent duplicate operations (persists across re-renders and strict mode)
  const hasCreatedRoom = useRef(false);
  const hasJoinedRoom = useRef(false);

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
      emit({ type: "display:join", payload: { roomCode } });
    }
  }, [isConnected, roomCode, emit]);

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

      {["prompt", "submit", "vote"].includes(gameState.phase) && (
        <GameBoard gameState={gameState} />
      )}

      {gameState.phase === "results" && (
        <Leaderboard players={gameState.players} />
      )}
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
