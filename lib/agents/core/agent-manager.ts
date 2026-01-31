import Anthropic from "@anthropic-ai/sdk";
import type { GameState } from "../../types/game";
import type {
  AgentPersona,
  AgentResponse,
  AgentConfig,
  GameEvent,
} from "../personas/types";
import { DEFAULT_AGENT_CONFIG } from "../personas/types";
import { chipSterling, getHostPromptContext } from "../personas/host";
import {
  snarkySam,
  getCommentatorPromptContext,
} from "../personas/commentator";
import { getAgentVoice } from "../personas/voice-config";
import { AgentRateLimiter } from "./rate-limiter";
import { EventDetector } from "./event-detector";

/**
 * AgentManager orchestrates multiple AI agent personas.
 * It detects game events, triggers appropriate agents, and generates responses.
 */
export class AgentManager {
  private anthropic: Anthropic | null = null;
  private personas: Map<string, AgentPersona> = new Map();
  private rateLimiter: AgentRateLimiter;
  private eventDetector: EventDetector;
  private previousStates: Map<string, GameState> = new Map(); // Per-room state tracking
  private config: AgentConfig;

  constructor(config: Partial<AgentConfig> = {}) {
    this.config = { ...DEFAULT_AGENT_CONFIG, ...config };
    this.rateLimiter = new AgentRateLimiter(this.config);
    this.eventDetector = new EventDetector();

    // Initialize Anthropic client if API key is available
    const apiKey = process.env.LH_PARTY_ANTHROPIC_API_KEY;
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    } else {
      console.warn(
        "[AgentManager] No Anthropic API key found. AI agents will be disabled."
      );
    }

    // Register default personas
    this.registerPersona(chipSterling);
    this.registerPersona(snarkySam);
  }

  /**
   * Register an agent persona
   */
  registerPersona(persona: AgentPersona): void {
    this.personas.set(persona.id, persona);
    console.log(`[AgentManager] Registered persona: ${persona.name}`);
  }

  /**
   * Handle a game state change and generate agent responses
   */
  async handleGameStateChange(
    roomCode: string,
    currentState: GameState
  ): Promise<AgentResponse[]> {
    if (!this.rateLimiter.isEnabled() || !this.anthropic) {
      return [];
    }

    const previousState = this.previousStates.get(roomCode) || null;
    this.previousStates.set(roomCode, { ...currentState });

    // Detect events from state change
    const events = this.eventDetector.detectEvents(previousState, currentState);
    if (events.length === 0) {
      return [];
    }

    // Reset idle timer on any activity
    this.eventDetector.resetIdleTimer();

    // Generate responses for events
    const responses: AgentResponse[] = [];

    for (const event of events) {
      const eventResponses = await this.generateResponsesForEvent(event);
      responses.push(...eventResponses);
    }

    // Sort by priority (highest first)
    responses.sort((a, b) => b.priority - a.priority);

    return responses;
  }

  /**
   * Generate agent responses for a single event
   */
  private async generateResponsesForEvent(
    event: GameEvent
  ): Promise<AgentResponse[]> {
    const responses: AgentResponse[] = [];

    for (const [, persona] of this.personas) {
      // Find matching trigger
      const trigger = persona.triggers.find((t) => {
        if (t.event !== event.type) return false;
        if (t.phaseFilter && !t.phaseFilter.includes(event.context.phase)) {
          return false;
        }
        return true;
      });

      if (!trigger) continue;

      // Check probability
      if (Math.random() > trigger.probability) continue;

      // Check cooldown
      if (this.rateLimiter.isTriggerOnCooldown(persona.id, event.type)) {
        continue;
      }

      // Check global rate limit
      const canSpeak = this.rateLimiter.canSpeak();
      if (!canSpeak.allowed) {
        console.log(
          `[AgentManager] Rate limited ${persona.name}: ${canSpeak.reason}`
        );
        continue;
      }

      // Generate response
      try {
        const response = await this.generateResponse(persona, event);
        if (response) {
          responses.push(response);
          this.rateLimiter.recordUtterance(
            persona.id,
            event.type,
            trigger.cooldownMs
          );
        }
      } catch (error) {
        console.error(
          `[AgentManager] Error generating response for ${persona.name}:`,
          error
        );
      }
    }

    return responses;
  }

  /**
   * Generate a response from a specific persona for an event
   */
  private async generateResponse(
    persona: AgentPersona,
    event: GameEvent
  ): Promise<AgentResponse | null> {
    if (!this.anthropic) return null;

    // Get context-specific prompt
    const contextPrompt = this.getContextPrompt(persona, event);
    if (!contextPrompt) return null;

    const userPrompt = `
Current game state:
- Room: ${event.context.roomCode}
- Phase: ${event.context.phase}
- Round: ${event.context.currentRound}
- Players: ${event.context.playerNames.join(", ")}
${event.context.winnerName ? `- Winner: ${event.context.winnerName}` : ""}

Event: ${event.type}

${contextPrompt}

Respond in character with a brief spoken line (1-3 sentences max).`;

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: persona.maxTokens,
        temperature: persona.temperature,
        system: persona.personality,
        messages: [{ role: "user", content: userPrompt }],
      });

      const text =
        response.content[0]?.type === "text" ? response.content[0].text : null;

      if (!text) return null;

      // Clean up response (remove quotes if present)
      const cleanedText = text.replace(/^["']|["']$/g, "").trim();

      // Get voice config
      const voiceConfig = getAgentVoice(persona.id);

      return {
        agentId: persona.id,
        agentName: persona.name,
        text: cleanedText,
        voice: persona.voice,
        emotion: voiceConfig?.emotion || "neutral",
        priority: this.getTriggerPriority(persona, event.type),
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(`[AgentManager] Claude API error:`, error);
      return null;
    }
  }

  /**
   * Get context-specific prompt for a persona and event
   */
  private getContextPrompt(persona: AgentPersona, event: GameEvent): string {
    const context = {
      phase: event.context.phase,
      playerName: event.context.playerName,
      playerNames: event.context.playerNames,
      currentRound: event.context.currentRound,
      winnerName: event.context.winnerName,
      scores: event.context.scores,
      recentSubmissions: event.context.recentSubmissions,
      submissionCount: event.context.submissionCount,
      totalPlayers: event.context.totalPlayers,
    };

    switch (persona.role) {
      case "host":
        return getHostPromptContext(event.type, context);
      case "commentator":
        return getCommentatorPromptContext(event.type, context);
      default:
        return "";
    }
  }

  /**
   * Get trigger priority for a persona and event type
   */
  private getTriggerPriority(persona: AgentPersona, eventType: string): number {
    const trigger = persona.triggers.find((t) => t.event === eventType);
    return trigger?.priority || 50;
  }

  /**
   * Reset state for a new game in a room
   */
  resetGame(roomCode: string): void {
    this.previousStates.delete(roomCode);
    this.rateLimiter.resetGame();
  }

  /**
   * Enable or disable the agent system
   */
  setEnabled(enabled: boolean): void {
    this.rateLimiter.setEnabled(enabled);
  }

  /**
   * Check if agent system is enabled
   */
  isEnabled(): boolean {
    return this.rateLimiter.isEnabled() && this.anthropic !== null;
  }

  /**
   * Get current rate limiting stats
   */
  getStats(): ReturnType<AgentRateLimiter["getStats"]> {
    return this.rateLimiter.getStats();
  }

  /**
   * Get registered personas
   */
  getPersonas(): AgentPersona[] {
    return Array.from(this.personas.values());
  }
}

// Singleton instance for server use
let agentManagerInstance: AgentManager | null = null;

/**
 * Get the singleton AgentManager instance
 */
export function getAgentManager(config?: Partial<AgentConfig>): AgentManager {
  if (!agentManagerInstance) {
    agentManagerInstance = new AgentManager(config);
  }
  return agentManagerInstance;
}
