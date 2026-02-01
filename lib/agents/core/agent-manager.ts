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
import { logDebug, logInfo, logWarn, logError } from "../../logger";
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
  private roomEnabledStates: Map<string, boolean> = new Map(); // Per-room enabled state
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
      logWarn(
        "Agent",
        "No Anthropic API key found. AI agents will be disabled."
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
    logInfo("Agent", `Registered persona: ${persona.name}`);
  }

  /**
   * Handle a game state change and generate agent responses
   */
  async handleGameStateChange(
    roomCode: string,
    currentState: GameState
  ): Promise<AgentResponse[]> {
    // Check both global and per-room enabled state
    const roomEnabled = this.roomEnabledStates.get(roomCode) ?? true; // Default to enabled
    if (!this.rateLimiter.isEnabled() || !this.anthropic || !roomEnabled) {
      return [];
    }

    const previousState = this.previousStates.get(roomCode) || null;
    this.previousStates.set(roomCode, structuredClone(currentState));

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
        logDebug("Agent", `Rate limited ${persona.name}: ${canSpeak.reason}`);
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
        logError(
          "Agent",
          `Error generating response for ${persona.name}`,
          error
        );
      }
    }

    return responses;
  }

  /**
   * Sanitize player names to prevent prompt injection
   */
  private sanitizePlayerName(name: string): string {
    return name
      .replace(/[<>]/g, "") // Remove HTML brackets
      .replace(/[\r\n]+/g, " ") // Replace newlines with spaces
      .replace(/system|user|assistant|human/gi, "") // Remove role keywords
      .trim()
      .slice(0, 20); // Enforce max length
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

    // Sanitize all player names to prevent prompt injection
    const sanitizedPlayerNames = event.context.playerNames.map((name) =>
      this.sanitizePlayerName(name)
    );
    const sanitizedWinnerName = event.context.winnerName
      ? this.sanitizePlayerName(event.context.winnerName)
      : null;

    const userPrompt = `
Current game state:
- Room: ${event.context.roomCode}
- Phase: ${event.context.phase}
- Round: ${event.context.currentRound}
- Players: ${sanitizedPlayerNames.join(", ")}
${sanitizedWinnerName ? `- Winner: ${sanitizedWinnerName}` : ""}

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
      logError("Agent", "Claude API error", error);
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
      // Trivia-specific context
      category: event.context.category,
      questionNumber: event.context.questionNumber,
      correctAnswer: event.context.correctAnswer,
      correctPlayers: event.context.correctPlayers,
      streakPlayer: event.context.streakPlayer,
      streakCount: event.context.streakCount,
      fastPlayer: event.context.fastPlayer,
      responseTimeMs: event.context.responseTimeMs,
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
   * Clean up room state when a room is closed
   */
  cleanupRoom(roomCode: string): void {
    this.previousStates.delete(roomCode);
    this.roomEnabledStates.delete(roomCode);
  }

  /**
   * Enable or disable the agent system globally
   */
  setEnabled(enabled: boolean): void {
    this.rateLimiter.setEnabled(enabled);
  }

  /**
   * Enable or disable agents for a specific room
   */
  setRoomEnabled(roomCode: string, enabled: boolean): void {
    this.roomEnabledStates.set(roomCode, enabled);
  }

  /**
   * Check if agents are enabled for a specific room
   */
  isRoomEnabled(roomCode: string): boolean {
    return this.roomEnabledStates.get(roomCode) ?? true; // Default to enabled
  }

  /**
   * Check if agent system is enabled globally
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
