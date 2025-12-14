// Shared game constants used across frontend and API
// When adding new games, update this file and both will stay in sync

export const GAME_IDS = [
  "quiplash",
  "game-1",
  "game-2",
  "game-3",
  "game-4",
] as const;
export type GameId = (typeof GAME_IDS)[number];

// Placeholder game metadata - will be replaced with real games
export const PLACEHOLDER_GAMES = [
  {
    id: "quiplash" as GameId,
    name: "Quip Clash",
    description:
      "Battle of wits! Answer prompts and vote for the funniest responses",
    playerCount: "2-8 players",
    color: "orange" as const,
    icon: "💬",
  },
  {
    id: "game-1" as GameId,
    name: "Pixel Showdown",
    description: "Battle your friends in this fast-paced trivia challenge",
    playerCount: "3-8 players",
    color: "cyan" as const,
    icon: "🎮",
  },
  {
    id: "game-2" as GameId,
    name: "Neon Bluff",
    description: "Can you spot the faker? Deception meets creativity",
    playerCount: "4-10 players",
    color: "magenta" as const,
    icon: "🎭",
  },
  {
    id: "game-3" as GameId,
    name: "Synth Quiz",
    description: "Music, movies, and pop culture from the golden era",
    playerCount: "2-12 players",
    color: "yellow" as const,
    icon: "🎵",
  },
  {
    id: "game-4" as GameId,
    name: "Retro Draw",
    description: "Draw, guess, and laugh with pixelated masterpieces",
    playerCount: "3-8 players",
    color: "green" as const,
    icon: "🖼️",
  },
] as const;

export type GameColor = "cyan" | "magenta" | "yellow" | "green" | "orange";

export interface Game {
  id: GameId;
  name: string;
  description: string;
  playerCount: string;
  color: GameColor;
  icon: string;
}
