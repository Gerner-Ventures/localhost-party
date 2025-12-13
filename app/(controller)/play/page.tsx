"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWebSocket } from "@/lib/context/WebSocketContext";

// Sanitize player name to prevent XSS and other injection attacks
function sanitizePlayerName(name: string): string {
  return name
    .trim()
    .replace(/[<>'"&]/g, "") // Remove potentially dangerous characters
    .replace(/\s+/g, " ") // Normalize whitespace
    .slice(0, 20); // Enforce max length
}

function JoinRoomContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { joinRoom, isConnected } = useWebSocket();

  const [roomCode, setRoomCode] = useState(
    searchParams.get("code")?.toUpperCase() || ""
  );
  const [playerName, setPlayerName] = useState("");
  const [error, setError] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  // Load saved player name from localStorage if it exists
  useEffect(() => {
    const savedName = localStorage.getItem("playerName");
    if (savedName) {
      setPlayerName(savedName);
    }
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsJoining(true);

    // Sanitize inputs
    const sanitizedName = sanitizePlayerName(playerName);
    const normalizedCode = roomCode.toUpperCase();

    if (!normalizedCode || !sanitizedName) {
      setError("Please fill in all fields");
      setIsJoining(false);
      return;
    }

    if (sanitizedName.length < 1) {
      setError("Name cannot be empty");
      setIsJoining(false);
      return;
    }

    if (normalizedCode.length !== 4) {
      setError("Room code must be 4 characters");
      setIsJoining(false);
      return;
    }

    try {
      // Validate room exists via API first
      const res = await fetch(`/api/rooms/${normalizedCode}`);
      if (!res.ok) {
        throw new Error("Room not found");
      }

      // Join via WebSocket and wait for server confirmation
      const player = await joinRoom(normalizedCode, sanitizedName);
      console.log("✅ Joined as player:", player);

      // Store player info in localStorage only after successful join
      localStorage.setItem("playerName", sanitizedName);
      localStorage.setItem("roomCode", normalizedCode);

      // Navigate to lobby after server confirms join
      router.push(`/play/lobby?code=${normalizedCode}`);
    } catch (err) {
      console.error("Error joining room:", err);
      const message =
        err instanceof Error ? err.message : "Failed to join room";
      setError(
        message === "Room not found"
          ? "Room not found. Check the code and try again."
          : message
      );
      setIsJoining(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <div className="w-full max-w-sm">
        {/* Logo/Title */}
        <div className="text-center mb-10">
          <h1
            className="text-3xl font-black tracking-tight mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <span className="neon-text-cyan">local</span>
            <span className="neon-text-magenta">host</span>
            <span className="text-white/60">:</span>
            <span className="neon-text-yellow">party</span>
          </h1>
          <p
            className="text-white/40 text-sm"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Party games powered by AI
          </p>
        </div>

        {/* Join Form */}
        <form onSubmit={handleJoin} className="space-y-5">
          {/* Room Code Input */}
          <div>
            <label
              htmlFor="roomCode"
              className="block text-xs uppercase tracking-[0.2em] mb-2"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--neon-cyan)",
              }}
            >
              Room Code
            </label>
            <input
              id="roomCode"
              type="text"
              value={roomCode}
              onChange={(e) =>
                setRoomCode(e.target.value.toUpperCase().slice(0, 4))
              }
              maxLength={4}
              className="arcade-input w-full px-5 py-4 text-2xl font-bold text-center uppercase tracking-[0.3em] rounded-lg"
              style={{ fontFamily: "var(--font-display)" }}
              placeholder="XXXX"
              autoComplete="off"
              required
            />
          </div>

          {/* Player Name Input */}
          <div>
            <label
              htmlFor="playerName"
              className="block text-xs uppercase tracking-[0.2em] mb-2"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--neon-cyan)",
              }}
            >
              Your Name
            </label>
            <input
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value.slice(0, 20))}
              maxLength={20}
              className="arcade-input w-full px-5 py-4 text-lg rounded-lg"
              style={{ fontFamily: "var(--font-mono)" }}
              placeholder="Enter your name"
              autoComplete="off"
              required
            />
            <p
              className="text-xs text-white/30 mt-2 text-right"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {playerName.length}/20
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div
              className="px-4 py-3 rounded-lg text-center text-sm"
              style={{
                background: "rgba(255, 0, 170, 0.1)",
                border: "1px solid var(--neon-magenta)",
                color: "var(--neon-magenta)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {error}
            </div>
          )}

          {/* Connection Status */}
          {!isConnected && (
            <div
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm"
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
              Connecting to server...
            </div>
          )}

          {/* Join Button */}
          <button
            type="submit"
            disabled={!isConnected || isJoining || !roomCode || !playerName}
            className="arcade-button w-full py-4 text-lg rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              fontFamily: "var(--font-display)",
              color: isConnected && !isJoining ? "var(--neon-cyan)" : "white",
              borderColor:
                isConnected && !isJoining
                  ? "var(--neon-cyan)"
                  : "rgba(255,255,255,0.2)",
            }}
          >
            {isJoining ? (
              <span className="flex items-center justify-center gap-2">
                <span
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: "var(--neon-cyan)" }}
                />
                JOINING...
              </span>
            ) : isConnected ? (
              "JOIN GAME"
            ) : (
              "CONNECTING..."
            )}
          </button>
        </form>

        {/* Instructions */}
        <div className="mt-8 text-center">
          <p
            className="text-white/30 text-xs"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Enter the 4-letter code from the TV screen
          </p>
        </div>

        {/* Decorative element */}
        <div className="mt-12 flex justify-center gap-2">
          {["🎮", "👾", "🕹️"].map((emoji, i) => (
            <span
              key={i}
              className="text-2xl animate-float"
              style={{ animationDelay: `${i * 0.3}s` }}
            >
              {emoji}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function JoinRoomPage() {
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
      <JoinRoomContent />
    </Suspense>
  );
}
