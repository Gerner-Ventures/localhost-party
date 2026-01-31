import { Player } from "./player";
import { GameState, GameType } from "./game";
import type { VoiceId } from "../audio/types";

// Payload types for submit/vote events
export interface SubmitPayload {
  roomCode: string;
  data:
    | string
    | {
        choice?: string;
        optionId?: string;
        answerId?: string;
        value?: string | number | boolean;
        text?: string;
      };
}

export interface VotePayload {
  roomCode: string;
  data:
    | string
    | {
        choice?: string;
        optionId?: string;
        answerId?: string;
        value?: string | number | boolean;
        text?: string;
      };
}

// Agent speech payload
export interface AgentSpeakPayload {
  agentId: string;
  agentName: string;
  text: string;
  voice: VoiceId;
  emotion: "neutral" | "excited" | "dramatic" | "welcoming" | "intense";
  priority: number;
}

// Agent toggle payload
export interface AgentTogglePayload {
  enabled: boolean;
}

export type WebSocketEvent =
  | { type: "display:join"; payload: { roomCode: string } }
  | { type: "player:join"; payload: { roomCode: string; name: string } }
  | { type: "player:joined"; payload: Player }
  | { type: "player:left"; payload: { playerId: string } }
  | { type: "player:error"; payload: { message: string } }
  | { type: "game:state-update"; payload: GameState }
  | { type: "game:start"; payload: { roomCode: string; gameType: GameType } }
  | { type: "game:next-round"; payload: { roomCode: string } }
  | { type: "game:restart"; payload: { roomCode: string } }
  | { type: "player:submit"; payload: SubmitPayload }
  | { type: "player:vote"; payload: VotePayload }
  | { type: "agent:speak"; payload: AgentSpeakPayload }
  | { type: "agent:toggle"; payload: AgentTogglePayload };
