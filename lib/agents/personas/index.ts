// Persona exports
export { chipSterling, getHostPromptContext } from "./host";
export { snarkySam, getCommentatorPromptContext } from "./commentator";
export {
  getAgentVoice,
  getAgentVoiceId,
  AGENT_VOICE_CONFIG,
} from "./voice-config";

// Type exports
export type {
  AgentPersona,
  AgentResponse,
  AgentConfig,
  AgentRole,
  AgentTrigger,
  GameEvent,
  GameEventType,
  GameEventContext,
  PersonalityTraits,
} from "./types";

export { DEFAULT_AGENT_CONFIG } from "./types";
