import { Player } from './player';

export type GameType = 'quiplash' | 'drawful' | 'fibbage' | 'murder-mystery' | 'rap-battle';
export type GamePhase = 'lobby' | 'prompt' | 'submit' | 'vote' | 'results';

export interface GameState {
  roomCode: string;
  gameType: GameType | null;
  currentRound: number;
  phase: GamePhase;
  players: Player[];
  // Game-specific state can be added here
  [key: string]: any;
}
