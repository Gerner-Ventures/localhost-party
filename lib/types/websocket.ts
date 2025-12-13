import { Player } from './player';
import { GameState, GameType } from './game';

// Payload types for submit/vote events
export interface SubmitPayload {
  roomCode: string;
  data: string | { choice?: string; optionId?: string; answerId?: string; value?: string | number | boolean; text?: string };
}

export interface VotePayload {
  roomCode: string;
  data: string | { choice?: string; optionId?: string; answerId?: string; value?: string | number | boolean; text?: string };
}

export type WebSocketEvent =
  | { type: 'display:join'; payload: { roomCode: string } }
  | { type: 'player:join'; payload: { roomCode: string; name: string } }
  | { type: 'player:joined'; payload: Player }
  | { type: 'player:left'; payload: { playerId: string } }
  | { type: 'player:error'; payload: { message: string } }
  | { type: 'game:state-update'; payload: GameState }
  | { type: 'game:start'; payload: { roomCode: string; gameType: GameType } }
  | { type: 'game:next-round'; payload: { roomCode: string } }
  | { type: 'player:submit'; payload: SubmitPayload }
  | { type: 'player:vote'; payload: VotePayload };
