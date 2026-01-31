"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  PLACEHOLDER_GAMES,
  type Game,
  type GameColor,
} from "@/lib/constants/games";
import { useAudio } from "@/lib/context/AudioContext";
import { AUDIO_VOLUMES, AUDIO_DURATIONS } from "@/lib/audio/constants";

// Animation timing constant
const CARD_ANIMATION_STAGGER_MS = 100;

const colorClasses: Record<
  GameColor,
  { border: string; text: string; glow: string; hoverGlow: string; bg: string }
> = {
  cyan: {
    border: "border-[var(--neon-cyan,#00f5ff)]",
    text: "text-[var(--neon-cyan,#00f5ff)]",
    glow: "shadow-[0_0_20px_rgba(0,245,255,0.3)]",
    hoverGlow:
      "hover:shadow-[0_0_30px_rgba(0,245,255,0.5),0_0_60px_rgba(0,245,255,0.3)]",
    bg: "bg-[rgba(0,245,255,0.1)]",
  },
  magenta: {
    border: "border-[var(--neon-magenta,#ff00aa)]",
    text: "text-[var(--neon-magenta,#ff00aa)]",
    glow: "shadow-[0_0_20px_rgba(255,0,170,0.3)]",
    hoverGlow:
      "hover:shadow-[0_0_30px_rgba(255,0,170,0.5),0_0_60px_rgba(255,0,170,0.3)]",
    bg: "bg-[rgba(255,0,170,0.1)]",
  },
  yellow: {
    border: "border-[var(--neon-yellow,#f0ff00)]",
    text: "text-[var(--neon-yellow,#f0ff00)]",
    glow: "shadow-[0_0_20px_rgba(240,255,0,0.3)]",
    hoverGlow:
      "hover:shadow-[0_0_30px_rgba(240,255,0,0.5),0_0_60px_rgba(240,255,0,0.3)]",
    bg: "bg-[rgba(240,255,0,0.1)]",
  },
  green: {
    border: "border-[var(--neon-green,#00ff88)]",
    text: "text-[var(--neon-green,#00ff88)]",
    glow: "shadow-[0_0_20px_rgba(0,255,136,0.3)]",
    hoverGlow:
      "hover:shadow-[0_0_30px_rgba(0,255,136,0.5),0_0_60px_rgba(0,255,136,0.3)]",
    bg: "bg-[rgba(0,255,136,0.1)]",
  },
  orange: {
    border: "border-[var(--neon-orange,#ff6600)]",
    text: "text-[var(--neon-orange,#ff6600)]",
    glow: "shadow-[0_0_20px_rgba(255,102,0,0.3)]",
    hoverGlow:
      "hover:shadow-[0_0_30px_rgba(255,102,0,0.5),0_0_60px_rgba(255,102,0,0.3)]",
    bg: "bg-[rgba(255,102,0,0.1)]",
  },
};

// Fallback narrator descriptions (used when AI is unavailable)
const FALLBACK_NARRATIONS: Record<string, string> = {
  quiplash:
    "Quip Clash. Battle of wits where the funniest answer wins. Get ready to make your friends laugh!",
  "game-1":
    "Pixel Showdown. Fast-paced trivia mayhem. How quick is your brain?",
  "game-2":
    "Neon Bluff. Spot the faker among real players. Deception has never been this neon!",
  "game-3":
    "Synth Quiz. Retro pop culture trivia. Let's see if you know your classics!",
  "game-4":
    "Retro Draw. Drawing meets guessing in pixelated glory. Unleash your inner artist!",
};

const FALLBACK_WELCOME =
  "Welcome to localhost party. The ultimate arcade experience powered by AI. Choose your game and let the fun begin!";

// Helper to fetch AI-generated narration with fallback
async function fetchNarration(
  type: "welcome" | "game-hover" | "game-select",
  options?: { gameId?: string; gameName?: string; gameDescription?: string },
  fallback?: string
): Promise<string> {
  try {
    const response = await fetch("/api/narrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...options }),
    });

    if (!response.ok) {
      throw new Error("API unavailable");
    }

    const data = await response.json();
    return data.text || fallback || "";
  } catch {
    // Fallback to preconfigured text if AI is unavailable
    return fallback || "";
  }
}

function GameCard({
  game,
  index,
  onHover,
  onClick,
}: {
  game: Game;
  index: number;
  onHover: (game: Game | null) => void;
  onClick: (game: Game) => void;
}) {
  const colors = colorClasses[game.color];

  return (
    <Link
      href={`/display?game=${game.id}`}
      className={`
        group relative block
        bg-[var(--noir-dark)]
        border-2 ${colors.border}
        ${colors.glow}
        ${colors.hoverGlow}
        rounded-lg p-6
        transition-all duration-300
        hover:scale-[1.02]
        hover:-translate-y-1
        animate-slide-up
      `}
      style={{ animationDelay: `${index * CARD_ANIMATION_STAGGER_MS}ms` }}
      onMouseEnter={() => onHover(game)}
      onMouseLeave={() => onHover(null)}
      onClick={() => {
        onClick(game);
      }}
    >
      {/* Scanline effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none overflow-hidden rounded-lg">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.03)_2px,rgba(255,255,255,0.03)_4px)]" />
      </div>

      {/* Top accent line */}
      <div
        className={`absolute top-0 left-0 right-0 h-[2px] ${colors.bg} opacity-50`}
      />

      {/* Icon */}
      <div className="text-5xl mb-4 transform group-hover:scale-110 transition-transform duration-300">
        {game.icon}
      </div>

      {/* Game name */}
      <h2
        className={`
          font-['Orbitron',sans-serif] font-bold text-xl mb-2
          ${colors.text}
          uppercase tracking-wider
        `}
      >
        {game.name}
      </h2>

      {/* Description */}
      <p className="text-gray-400 text-sm mb-4 leading-relaxed">
        {game.description}
      </p>

      {/* Player count badge */}
      <div
        className={`
        inline-block px-3 py-1 rounded-full
        ${colors.bg} ${colors.border} border
        text-xs uppercase tracking-widest
        ${colors.text}
      `}
      >
        {game.playerCount}
      </div>

      {/* Corner decorations */}
      <div
        className={`absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 ${colors.border} opacity-50`}
      />
      <div
        className={`absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 ${colors.border} opacity-50`}
      />
    </Link>
  );
}

export default function Home() {
  const { speak, playMusic, stopMusic, unlockAudio, isUnlocked, isSpeaking } =
    useAudio();
  const [hasPlayedWelcome, setHasPlayedWelcome] = useState(false);
  const [lastHoveredGame, setLastHoveredGame] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const [isMounted, setIsMounted] = useState(false);

  // Track when component mounts (client-side only)
  useEffect(() => {
    // Delay to next tick to avoid cascading renders
    const timer = setTimeout(() => setIsMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  // Handle initial welcome after first user interaction
  const handleInitialUnlock = async () => {
    if (!isUnlocked) {
      await unlockAudio();
    }

    if (!hasPlayedWelcome && isUnlocked) {
      setHasPlayedWelcome(true);

      // Start background music
      playMusic("lobby-theme", {
        loop: true,
        fadeIn: AUDIO_DURATIONS.FADE_IN_SLOW,
        volume: AUDIO_VOLUMES.HOME_MUSIC,
      });

      // AI-generated welcome narration (with fallback)
      const welcomeText = await fetchNarration("welcome", {}, FALLBACK_WELCOME);
      await speak(welcomeText, {
        voice: "game-host",
        emotion: "welcoming",
        pauseBefore: AUDIO_DURATIONS.NARRATOR_PAUSE_BEFORE,
      });
    }
  };

  // Handle game hover with debounce
  const handleGameHover = (game: Game | null) => {
    // Clear any pending hover timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    if (!game) {
      setLastHoveredGame(null);
      return;
    }

    // Don't narrate if already speaking or if we just narrated this game
    if (isSpeaking || lastHoveredGame === game.id) {
      return;
    }

    // Debounce hover - only speak if hovering for configured duration
    hoverTimeoutRef.current = setTimeout(async () => {
      // Don't execute if component has unmounted
      if (!isMountedRef.current) return;

      setLastHoveredGame(game.id);

      // AI-generated game description (with fallback)
      const narration = await fetchNarration(
        "game-hover",
        {
          gameId: game.id,
          gameName: game.name,
          gameDescription: game.description,
        },
        FALLBACK_NARRATIONS[game.id]
      );

      if (narration) {
        speak(narration, {
          voice: "game-host",
          emotion: "excited",
        });
      }
    }, AUDIO_DURATIONS.HOVER_DEBOUNCE);
  };

  // Handle game selection
  const handleGameClick = async (game: Game) => {
    await handleInitialUnlock();

    // AI-generated selection announcement (with fallback)
    const selectionText = await fetchNarration(
      "game-select",
      { gameId: game.id, gameName: game.name },
      `${game.name} selected. Get ready to party!`
    );

    await speak(selectionText, {
      voice: "game-host",
      emotion: "excited",
    });

    // Fade out music before navigation
    stopMusic("lobby-theme", { fadeOut: AUDIO_DURATIONS.FADE_OUT_FAST });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className="min-h-screen bg-[var(--noir-black)] grid-pattern relative overflow-hidden"
      onClick={handleInitialUnlock}
    >
      {/* Background glow effects */}
      <div className="absolute top-1/4 -left-32 w-64 h-64 bg-[var(--neon-cyan)] opacity-10 blur-[100px] rounded-full" />
      <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-[var(--neon-magenta)] opacity-10 blur-[100px] rounded-full" />

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-16">
        {/* Header */}
        <header className="text-center mb-16">
          <h1 className="font-['Orbitron',sans-serif] text-5xl md:text-7xl font-black mb-4 tracking-tight">
            <span className="neon-text-cyan">localhost</span>
            <span className="text-white">:</span>
            <span className="neon-text-magenta">party</span>
          </h1>
          <p className="text-gray-400 text-lg md:text-xl max-w-md mx-auto">
            AI-powered party games for the modern arcade
          </p>

          {/* Audio unlock hint (shows until first interaction) */}
          {/* Only render after mount to avoid hydration mismatch */}
          <div className="mt-6 min-h-[1.5rem]">
            {isMounted && !isUnlocked && (
              <div className="text-sm text-white/40 animate-pulse">
                Click anywhere to enable sound
              </div>
            )}
          </div>

          {/* Decorative line */}
          <div className="mt-2 flex items-center justify-center gap-4">
            <div className="h-[1px] w-16 bg-gradient-to-r from-transparent to-[var(--neon-cyan)]" />
            <div className="text-[var(--neon-yellow)] animate-neon-pulse">
              ◆
            </div>
            <div className="h-[1px] w-16 bg-gradient-to-l from-transparent to-[var(--neon-magenta)]" />
          </div>
        </header>

        {/* Games section */}
        <section>
          <h2 className="font-['Orbitron',sans-serif] text-2xl font-bold text-center mb-8 uppercase tracking-widest text-gray-300">
            Select Your Game
          </h2>

          {/* Games grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {PLACEHOLDER_GAMES.map((game, index) => (
              <GameCard
                key={game.id}
                game={game}
                index={index}
                onHover={handleGameHover}
                onClick={handleGameClick}
              />
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-20 text-center">
          <p className="text-gray-600 text-sm font-['Space_Mono',monospace]">
            INSERT COIN TO CONTINUE
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--neon-cyan)] animate-neon-pulse" />
            <span
              className="inline-block w-2 h-2 rounded-full bg-[var(--neon-magenta)] animate-neon-pulse"
              style={{ animationDelay: "0.5s" }}
            />
            <span
              className="inline-block w-2 h-2 rounded-full bg-[var(--neon-yellow)] animate-neon-pulse"
              style={{ animationDelay: "1s" }}
            />
          </div>
        </footer>
      </main>
    </div>
  );
}
