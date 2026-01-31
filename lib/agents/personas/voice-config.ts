import type { VoiceId } from "../../audio/types";

/**
 * Voice configuration for each AI agent persona.
 * Maps agent IDs to their ElevenLabs voice settings.
 *
 * Voice IDs must match those defined in lib/audio/narrator.ts
 */

export interface AgentVoiceConfig {
  voiceId: VoiceId;
  name: string;
  description: string;
  emotion: "neutral" | "excited" | "dramatic" | "welcoming" | "intense";
}

/**
 * Voice mappings for AI agent personas
 */
export const AGENT_VOICE_CONFIG: Record<string, AgentVoiceConfig> = {
  "chip-sterling": {
    voiceId: "announcer", // Bill - crisp, friendly narrator
    name: "Bill",
    description: "Crisp, friendly narrator perfect for game hosting",
    emotion: "excited",
  },
  "snarky-sam": {
    voiceId: "surfer", // Charlie - young Australian, energetic
    name: "Charlie",
    description: "Young Australian voice with energetic delivery",
    emotion: "neutral",
  },
};

/**
 * Get voice configuration for an agent
 */
export function getAgentVoice(agentId: string): AgentVoiceConfig | undefined {
  return AGENT_VOICE_CONFIG[agentId];
}

/**
 * Get the VoiceId for an agent (for narrator integration)
 */
export function getAgentVoiceId(agentId: string): VoiceId {
  return AGENT_VOICE_CONFIG[agentId]?.voiceId || "game-host";
}
