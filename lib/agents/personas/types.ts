import type { VoiceId } from "../../audio/types";
import type { GamePhase } from "../../types/game";

/**
 * Types of game events that can trigger agent responses
 */
export type GameEventType =
  | "phase:changed"
  | "player:joined"
  | "player:left"
  | "submission:received"
  | "all:submitted"
  | "vote:received"
  | "all:voted"
  | "round:complete"
  | "game:started"
  | "game:complete"
  | "idle:detected"
  // Pixel Showdown (Trivia) events
  | "trivia:category-announce"
  | "trivia:question-displayed"
  | "trivia:answer-revealed"
  | "trivia:hot-streak"
  | "trivia:fast-answer";

/**
 * A detected game event with context
 */
export interface GameEvent {
  type: GameEventType;
  timestamp: number;
  context: GameEventContext;
}

/**
 * Context provided to agents when generating responses
 */
export interface GameEventContext {
  roomCode: string;
  phase: GamePhase;
  previousPhase?: GamePhase;
  currentRound: number;
  totalPlayers: number;
  playerNames: string[];
  // Event-specific context
  playerName?: string; // For player:joined, player:left
  submissionCount?: number; // For submission events
  voteCount?: number; // For vote events
  scores?: Record<string, number>; // Player scores
  winnerName?: string; // For round/game complete
  recentSubmissions?: string[]; // Last few submissions (for commentary)
  // Trivia-specific context
  category?: string; // Current trivia category
  questionNumber?: number; // Current question in round
  correctAnswer?: string; // The correct answer (for reveal)
  correctPlayers?: string[]; // Players who got it right
  streakPlayer?: string; // Player on a streak
  streakCount?: number; // Length of streak
  fastPlayer?: string; // Player who answered quickly
  responseTimeMs?: number; // How fast they answered
}

/**
 * When an agent should speak
 */
export interface AgentTrigger {
  event: GameEventType;
  probability: number; // 0-1 chance of triggering
  cooldownMs: number; // Minimum time between triggers of this type
  priority: number; // Higher = speaks first (0-100)
  phaseFilter?: GamePhase[]; // Only trigger during these phases
}

/**
 * Personality traits that influence response generation
 */
export interface PersonalityTraits {
  enthusiasm: number; // 0-1: How excited/energetic
  snarkiness: number; // 0-1: How sarcastic/witty
  verbosity: number; // 0-1: How much they talk
  formality: number; // 0-1: How formal vs casual
}

/**
 * Role an agent plays in the game
 */
export type AgentRole = "host" | "commentator" | "judge";

/**
 * Definition of an AI agent persona
 */
export interface AgentPersona {
  id: string;
  name: string;
  role: AgentRole;
  personality: string; // System prompt describing character
  voice: VoiceId;
  traits: PersonalityTraits;
  triggers: AgentTrigger[];
  // Response generation settings
  maxTokens: number;
  temperature: number;
}

/**
 * A generated response from an agent
 */
export interface AgentResponse {
  agentId: string;
  agentName: string;
  text: string;
  voice: VoiceId;
  emotion: "neutral" | "excited" | "dramatic" | "welcoming" | "intense";
  priority: number;
  timestamp: number;
}

/**
 * Configuration for the agent system
 */
export interface AgentConfig {
  enabled: boolean;
  maxUtterancesPerMinute: number;
  maxUtterancesPerGame: number;
  minIntervalMs: number;
  maxTokensPerResponse: number;
}

/**
 * Default agent system configuration
 */
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  enabled: true,
  maxUtterancesPerMinute: 6,
  maxUtterancesPerGame: 50,
  minIntervalMs: 2000,
  maxTokensPerResponse: 150,
};
