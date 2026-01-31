import { Player } from "./player";

export type GameType =
  | "quiplash"
  | "pixel-showdown"
  | "drawful"
  | "fibbage"
  | "murder-mystery"
  | "rap-battle";

export type GamePhase =
  | "lobby"
  | "prompt"
  | "submit"
  | "vote"
  | "results"
  // Pixel Showdown phases
  | "category_announce"
  | "question"
  | "answer_reveal"
  | "leaderboard"
  | "round_results"
  | "game_results";

// Submission made by a player during gameplay
export interface GameSubmission {
  playerId: string;
  playerName: string;
  data: unknown;
  timestamp: number;
}

// Vote cast by a player
export interface GameVote {
  playerId: string;
  playerName: string;
  data: unknown;
  timestamp: number;
}

// Prompt for games like Quiplash
export interface GamePrompt {
  id: string;
  text: string;
  assignedPlayerIds?: string[];
}

export interface GameState {
  roomCode: string;
  gameType: GameType | null;
  currentRound: number;
  phase: GamePhase;
  players: Player[];
  // Game-specific state with proper types
  submissions?: GameSubmission[];
  votes?: GameVote[];
  prompts?: GamePrompt[];
  currentPromptIndex?: number;
  roundResults?: Record<string, number>;
  timeRemaining?: number;
}
