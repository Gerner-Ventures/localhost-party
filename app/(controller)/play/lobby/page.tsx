"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useWebSocket } from "@/lib/context/WebSocketContext";
import { useAudio } from "@/lib/context/AudioContext";

function PlayerLobbyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { gameState, emit, isConnected } = useWebSocket();
  const { playSound, unlockAudio, isUnlocked } = useAudio();

  const roomCode = searchParams.get("code")?.toUpperCase();
  // Initialize playerName from localStorage using lazy initializer
  const [playerName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("playerName") || "";
    }
    return "";
  });

  // Player avatars - arcade/gaming themed
  const avatars = ["⚡", "🎮", "👾", "🕹️", "🎯", "🔥", "💎", "🚀"];

  const hasRejoined = useRef(false);
  const isRedirecting = useRef(false);

  useEffect(() => {
    if (!roomCode) {
      router.push("/play");
    }
  }, [roomCode, router]);

  // Reset re-join flag on disconnect so we re-join on reconnect
  useEffect(() => {
    if (!isConnected) {
      hasRejoined.current = false;
    }
  }, [isConnected]);

  // Re-join room on page load or reconnect
  useEffect(() => {
    if (isConnected && roomCode && playerName && !hasRejoined.current) {
      hasRejoined.current = true;
      emit({
        type: "player:join",
        payload: { roomCode, name: playerName },
      });
    }
  }, [isConnected, roomCode, playerName, emit]);

  // Prefetch game page so navigation is instant when game starts
  useEffect(() => {
    if (roomCode) {
      router.prefetch(`/play/game?code=${roomCode}`);
    }
  }, [roomCode, router]);

  // Redirect to game controller when game starts (guard prevents redirect loops)
  useEffect(() => {
    if (
      gameState &&
      gameState.phase !== "lobby" &&
      roomCode &&
      !isRedirecting.current
    ) {
      isRedirecting.current = true;
      router.replace(`/play/game?code=${roomCode}`);
    } else if (gameState?.phase === "lobby") {
      isRedirecting.current = false;
    }
  }, [gameState, roomCode, router]);

  const currentPlayer = gameState?.players.find((p) => p.name === playerName);

  const handleStartGame = () => {
    if (!roomCode || !gameState?.gameType) return;

    // Emit immediately - don't block on audio
    emit({
      type: "game:start",
      payload: { roomCode, gameType: gameState.gameType },
    });

    // Audio in background (non-blocking)
    if (!isUnlocked) {
      unlockAudio()
        .then(() => playSound("all-ready"))
        .catch(() => {});
    } else {
      playSound("all-ready");
    }
  };

  if (!roomCode) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
          No room code provided
        </p>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-5xl mb-6 animate-float">👾</div>
        <div
          className="text-xl mb-2 animate-pulse"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--neon-cyan)",
          }}
        >
          JOINING ROOM
        </div>
        <div className="room-code text-3xl">{roomCode}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen p-5">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span
            className="text-sm text-white/40"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            ROOM
          </span>
          <span className="room-code text-2xl">{roomCode}</span>
        </div>
        {currentPlayer && (
          <p
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--neon-green)",
            }}
          >
            Welcome, {currentPlayer.name}!
          </p>
        )}
      </div>

      {/* Connection Status */}
      {!isConnected && (
        <div
          className="mb-4 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm"
          style={{
            background: "rgba(240, 255, 0, 0.1)",
            border: "1px solid var(--neon-yellow)",
            color: "var(--neon-yellow)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: "var(--neon-yellow)" }}
          />
          Reconnecting...
        </div>
      )}

      {/* Player Count Badge */}
      <div className="flex justify-center mb-6">
        <div
          className="px-6 py-3 rounded-lg"
          style={{
            background: "var(--noir-dark)",
            border: "1px solid rgba(0, 245, 255, 0.2)",
          }}
        >
          <span
            className="text-2xl font-bold"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--neon-cyan)",
            }}
          >
            {gameState.players.length}
          </span>
          <span
            className="text-white/40 ml-2"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {gameState.players.length === 1 ? "PLAYER" : "PLAYERS"}
          </span>
        </div>
      </div>

      {/* Player List */}
      <div className="flex-1 space-y-3 mb-6 overflow-y-auto">
        {gameState.players.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4 animate-float">👾</div>
            <p
              className="text-white/40"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              No players yet...
            </p>
          </div>
        ) : (
          gameState.players.map((player, index) => {
            const isCurrentPlayer = player.name === playerName;
            return (
              <div
                key={player.id}
                className={`player-card p-4 rounded-xl animate-slide-up ${isCurrentPlayer ? "neon-border-cyan" : ""}`}
                style={{
                  animationDelay: `${index * 0.05}s`,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div
                      className="text-2xl animate-float"
                      style={{ animationDelay: `${index * 0.2}s` }}
                    >
                      {avatars[index % avatars.length]}
                    </div>

                    {/* Name & Score */}
                    <div>
                      <div
                        className="font-bold"
                        style={{
                          fontFamily: "var(--font-display)",
                          color: isCurrentPlayer ? "var(--neon-cyan)" : "white",
                        }}
                      >
                        {player.name}
                      </div>
                      <div
                        className="text-xs text-white/40"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {player.score} PTS
                      </div>
                    </div>
                  </div>

                  {/* You badge or connection status */}
                  {isCurrentPlayer ? (
                    <span
                      className="text-xs px-3 py-1 rounded-full"
                      style={{
                        background: "var(--neon-cyan)",
                        color: "var(--noir-black)",
                        fontFamily: "var(--font-display)",
                      }}
                    >
                      YOU
                    </span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: player.isConnected
                            ? "var(--neon-green)"
                            : "var(--neon-orange)",
                          boxShadow: player.isConnected
                            ? "0 0 8px rgba(0, 255, 136, 0.5)"
                            : "0 0 8px rgba(255, 102, 0, 0.5)",
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Game Status / Start Button */}
      {gameState.players.length < 2 ? (
        <div
          className="mb-4 px-4 py-4 rounded-xl text-center"
          style={{
            background: "rgba(240, 255, 0, 0.05)",
            border: "1px solid rgba(240, 255, 0, 0.2)",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--neon-yellow)",
            }}
          >
            Waiting for more players...
          </p>
          <p
            className="text-xs text-white/30 mt-1"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Need at least 2 to start
          </p>
        </div>
      ) : (
        <button
          onClick={handleStartGame}
          disabled={!isConnected}
          className="arcade-button w-full py-5 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed animate-glow-pulse"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--neon-green)",
            borderColor: "var(--neon-green)",
            fontSize: "1.25rem",
          }}
        >
          <span className="flex items-center justify-center gap-3">
            <span>🎮</span>
            START GAME
          </span>
        </button>
      )}

      {/* Footer */}
      <div className="mt-4 text-center">
        <p
          className="text-xs text-white/20"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          More players can join via QR code on TV
        </p>
      </div>
    </div>
  );
}

export default function PlayerLobbyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-4xl mb-4 animate-float">👾</div>
            <p
              className="neon-text-cyan"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Loading...
            </p>
          </div>
        </div>
      }
    >
      <PlayerLobbyContent />
    </Suspense>
  );
}
