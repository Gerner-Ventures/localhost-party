'use client';

import Link from "next/link";

interface Game {
  id: string;
  name: string;
  description: string;
  playerCount: string;
  color: 'cyan' | 'magenta' | 'yellow' | 'green' | 'orange';
  icon: string;
}

const PLACEHOLDER_GAMES: Game[] = [
  {
    id: 'game-1',
    name: 'Pixel Showdown',
    description: 'Battle your friends in this fast-paced trivia challenge',
    playerCount: '3-8 players',
    color: 'cyan',
    icon: '🎮',
  },
  {
    id: 'game-2',
    name: 'Neon Bluff',
    description: 'Can you spot the faker? Deception meets creativity',
    playerCount: '4-10 players',
    color: 'magenta',
    icon: '🎭',
  },
  {
    id: 'game-3',
    name: 'Synth Quiz',
    description: 'Music, movies, and pop culture from the golden era',
    playerCount: '2-12 players',
    color: 'yellow',
    icon: '🎵',
  },
  {
    id: 'game-4',
    name: 'Retro Draw',
    description: 'Draw, guess, and laugh with pixelated masterpieces',
    playerCount: '3-8 players',
    color: 'green',
    icon: '🖼️',
  },
];

const colorClasses = {
  cyan: {
    border: 'border-[var(--neon-cyan)]',
    text: 'text-[var(--neon-cyan)]',
    glow: 'shadow-[0_0_20px_rgba(0,245,255,0.3)]',
    hoverGlow: 'hover:shadow-[0_0_30px_rgba(0,245,255,0.5),0_0_60px_rgba(0,245,255,0.3)]',
    bg: 'bg-[rgba(0,245,255,0.1)]',
  },
  magenta: {
    border: 'border-[var(--neon-magenta)]',
    text: 'text-[var(--neon-magenta)]',
    glow: 'shadow-[0_0_20px_rgba(255,0,170,0.3)]',
    hoverGlow: 'hover:shadow-[0_0_30px_rgba(255,0,170,0.5),0_0_60px_rgba(255,0,170,0.3)]',
    bg: 'bg-[rgba(255,0,170,0.1)]',
  },
  yellow: {
    border: 'border-[var(--neon-yellow)]',
    text: 'text-[var(--neon-yellow)]',
    glow: 'shadow-[0_0_20px_rgba(240,255,0,0.3)]',
    hoverGlow: 'hover:shadow-[0_0_30px_rgba(240,255,0,0.5),0_0_60px_rgba(240,255,0,0.3)]',
    bg: 'bg-[rgba(240,255,0,0.1)]',
  },
  green: {
    border: 'border-[var(--neon-green)]',
    text: 'text-[var(--neon-green)]',
    glow: 'shadow-[0_0_20px_rgba(0,255,136,0.3)]',
    hoverGlow: 'hover:shadow-[0_0_30px_rgba(0,255,136,0.5),0_0_60px_rgba(0,255,136,0.3)]',
    bg: 'bg-[rgba(0,255,136,0.1)]',
  },
  orange: {
    border: 'border-[var(--neon-orange)]',
    text: 'text-[var(--neon-orange)]',
    glow: 'shadow-[0_0_20px_rgba(255,102,0,0.3)]',
    hoverGlow: 'hover:shadow-[0_0_30px_rgba(255,102,0,0.5),0_0_60px_rgba(255,102,0,0.3)]',
    bg: 'bg-[rgba(255,102,0,0.1)]',
  },
};

function GameCard({ game, index }: { game: Game; index: number }) {
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
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Scanline effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none overflow-hidden rounded-lg">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.03)_2px,rgba(255,255,255,0.03)_4px)]" />
      </div>

      {/* Top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${colors.bg} opacity-50`} />

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
      <div className={`
        inline-block px-3 py-1 rounded-full
        ${colors.bg} ${colors.border} border
        text-xs uppercase tracking-widest
        ${colors.text}
      `}>
        {game.playerCount}
      </div>

      {/* Corner decorations */}
      <div className={`absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 ${colors.border} opacity-50`} />
      <div className={`absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 ${colors.border} opacity-50`} />
    </Link>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--noir-black)] grid-pattern relative overflow-hidden">
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

          {/* Decorative line */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <div className="h-[1px] w-16 bg-gradient-to-r from-transparent to-[var(--neon-cyan)]" />
            <div className="text-[var(--neon-yellow)] animate-neon-pulse">◆</div>
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
              <GameCard key={game.id} game={game} index={index} />
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
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--neon-magenta)] animate-neon-pulse" style={{ animationDelay: '0.5s' }} />
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--neon-yellow)] animate-neon-pulse" style={{ animationDelay: '1s' }} />
          </div>
        </footer>
      </main>
    </div>
  );
}
