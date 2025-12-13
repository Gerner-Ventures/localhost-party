import { Player } from './player';
import { GameState, GameType } from './game';

export type WebSocketEvent =
  | { type: 'display:join'; payload: { roomCode: string } }
  | { type: 'player:join'; payload: { roomCode: string; name: string } }
  | { type: 'player:joined'; payload: Player }
  | { type: 'player:left'; payload: { playerId: string } }
  | { type: 'game:state-update'; payload: GameState }
  | { type: 'game:start'; payload: { roomCode: string; gameType: GameType } }
  | { type: 'player:submit'; payload: any }
  | { type: 'player:vote'; payload: any };
