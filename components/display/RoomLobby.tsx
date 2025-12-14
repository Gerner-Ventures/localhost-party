"use client";

import { QRCodeSVG } from "qrcode.react";
import type { Player } from "@/lib/types";

interface RoomLobbyProps {
  roomCode: string;
  players: Player[];
}

export function RoomLobby({ roomCode, players }: RoomLobbyProps) {
  // Use configured URL, or Vercel's auto-provided URL, or fallback to localhost
  const appUrl =
    process.env.NEXT_PUBLIC_LH_PARTY_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000";
  const joinUrl = `${appUrl}/play?code=${roomCode}`;

  // Player avatars - arcade/gaming themed
  const avatars = ["⚡", "🎮", "👾", "🕹️", "🎯", "🔥", "💎", "🚀"];

  return (
    <div className="flex h-screen p-8 text-white">
      {/* Left Panel - Room Info */}
      <div className="w-1/3 flex flex-col items-center justify-center pr-8 border-r border-white/10">
        {/* Logo */}
        <div className="mb-12 text-center">
          <h1
            className="text-5xl font-black tracking-tight animate-neon-pulse"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <span className="neon-text-cyan">local</span>
            <span className="neon-text-magenta">host</span>
            <span className="text-white/80">:</span>
            <span className="neon-text-yellow">party</span>
          </h1>
        </div>

        {/* Room Code */}
        <div className="text-center mb-10">
          <p
            className="text-sm uppercase tracking-[0.3em] text-white/50 mb-4"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Room Code
          </p>
          <div className="room-code text-8xl animate-neon-flicker">
            {roomCode}
          </div>
        </div>

        {/* QR Code */}
        <div className="mb-10">
          <div className="qr-container rounded-xl p-6">
            <QRCodeSVG
              value={joinUrl}
              size={180}
              bgColor="#ffffff"
              fgColor="#0a0a0f"
              level="M"
            />
          </div>
        </div>

        {/* Join URL */}
        <div className="text-center">
          <p className="text-sm text-white/40 mb-2">Scan or visit</p>
          <p
            className="text-lg neon-text-cyan"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {appUrl}/play
          </p>
        </div>
      </div>

      {/* Right Panel - Players */}
      <div className="w-2/3 pl-8 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h2
            className="text-4xl font-bold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <span className="text-white/60">Players</span>
            <span className="neon-text-cyan ml-4">[{players.length}]</span>
          </h2>

          {players.length >= 2 && (
            <div className="flex items-center gap-3 px-6 py-3 rounded-lg neon-border-cyan animate-glow-pulse">
              <span className="text-xl">🎮</span>
              <span
                className="text-lg"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--neon-cyan)",
                }}
              >
                READY TO START
              </span>
            </div>
          )}
        </div>

        {/* Players Grid */}
        {players.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-6 animate-float">👾</div>
              <p
                className="text-2xl text-white/40"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Waiting for players...
              </p>
              <p className="text-lg text-white/20 mt-2">
                Scan the QR code to join
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-4 gap-4">
              {players.map((player, index) => (
                <div
                  key={player.id}
                  className="player-card rounded-xl p-6 text-center animate-slide-up"
                  style={{
                    animationDelay: `${index * 0.1}s`,
                  }}
                >
                  {/* Avatar */}
                  <div
                    className="text-5xl mb-4 animate-float"
                    style={{ animationDelay: `${index * 0.2}s` }}
                  >
                    {avatars[index % avatars.length]}
                  </div>

                  {/* Name */}
                  <div
                    className="text-xl font-bold truncate mb-2"
                    style={{
                      fontFamily: "var(--font-display)",
                      color: "var(--neon-cyan)",
                    }}
                  >
                    {player.name}
                  </div>

                  {/* Score */}
                  <div
                    className="text-sm text-white/40"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {player.score} PTS
                  </div>

                  {/* Connection indicator */}
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: player.isConnected
                          ? "var(--neon-green)"
                          : "var(--neon-orange)",
                        boxShadow: player.isConnected
                          ? "0 0 10px rgba(0, 255, 136, 0.5)"
                          : "0 0 10px rgba(255, 102, 0, 0.5)",
                      }}
                    />
                    <span className="text-xs text-white/30">
                      {player.isConnected ? "ONLINE" : "OFFLINE"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Instructions */}
        <div className="mt-8 pt-6 border-t border-white/10">
          {players.length < 2 ? (
            <div className="flex items-center justify-center gap-4 text-white/40">
              <div
                className="w-3 h-3 rounded-full animate-pulse"
                style={{ backgroundColor: "var(--neon-yellow)" }}
              />
              <span style={{ fontFamily: "var(--font-mono)" }}>
                Need at least 2 players to start
              </span>
            </div>
          ) : (
            <div
              className="flex items-center justify-center gap-4"
              style={{ color: "var(--neon-green)" }}
            >
              <span className="text-2xl">✨</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>
                Any player can tap &ldquo;Start Game&rdquo; on their device
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
