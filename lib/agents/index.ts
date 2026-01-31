// Agent system exports
export { AgentManager, getAgentManager } from "./core/agent-manager";
export { AgentRateLimiter } from "./core/rate-limiter";
export { EventDetector } from "./core/event-detector";

// Persona exports
export { chipSterling } from "./personas/host";
export { snarkySam } from "./personas/commentator";
export { getAgentVoice, getAgentVoiceId } from "./personas/voice-config";

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
} from "./personas/types";

export { DEFAULT_AGENT_CONFIG } from "./personas/types";
