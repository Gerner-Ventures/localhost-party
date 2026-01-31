import type { AgentConfig } from "../personas/types";
import { DEFAULT_AGENT_CONFIG } from "../personas/types";

/**
 * Rate limiter for AI agent utterances.
 * Prevents cost runaway and ensures natural conversation pacing.
 */
export class AgentRateLimiter {
  private config: AgentConfig;
  private utteranceTimestamps: number[] = [];
  private gameUtteranceCount = 0;
  private lastUtteranceTime = 0;
  private triggerCooldowns: Map<string, number> = new Map();

  constructor(config: Partial<AgentConfig> = {}) {
    this.config = { ...DEFAULT_AGENT_CONFIG, ...config };
  }

  /**
   * Check if an agent can speak right now
   */
  canSpeak(): { allowed: boolean; reason?: string } {
    if (!this.config.enabled) {
      return { allowed: false, reason: "Agent system is disabled" };
    }

    const now = Date.now();

    // Check minimum interval between utterances
    if (now - this.lastUtteranceTime < this.config.minIntervalMs) {
      return {
        allowed: false,
        reason: `Minimum interval not met (${this.config.minIntervalMs}ms)`,
      };
    }

    // Check per-minute rate limit
    const oneMinuteAgo = now - 60000;
    this.utteranceTimestamps = this.utteranceTimestamps.filter(
      (t) => t > oneMinuteAgo
    );

    if (this.utteranceTimestamps.length >= this.config.maxUtterancesPerMinute) {
      return {
        allowed: false,
        reason: `Per-minute limit reached (${this.config.maxUtterancesPerMinute}/min)`,
      };
    }

    // Check per-game limit
    if (this.gameUtteranceCount >= this.config.maxUtterancesPerGame) {
      return {
        allowed: false,
        reason: `Per-game limit reached (${this.config.maxUtterancesPerGame}/game)`,
      };
    }

    return { allowed: true };
  }

  /**
   * Check if a specific trigger is on cooldown for an agent
   */
  isTriggerOnCooldown(agentId: string, eventType: string): boolean {
    const key = `${agentId}:${eventType}`;
    const cooldownUntil = this.triggerCooldowns.get(key);
    if (!cooldownUntil) return false;
    return Date.now() < cooldownUntil;
  }

  /**
   * Record that an agent spoke (updates rate limiting state)
   */
  recordUtterance(
    agentId: string,
    eventType: string,
    cooldownMs: number
  ): void {
    const now = Date.now();
    this.utteranceTimestamps.push(now);
    this.gameUtteranceCount++;
    this.lastUtteranceTime = now;

    // Set trigger cooldown
    const key = `${agentId}:${eventType}`;
    this.triggerCooldowns.set(key, now + cooldownMs);
  }

  /**
   * Reset game-specific counters (call when starting a new game)
   */
  resetGame(): void {
    this.gameUtteranceCount = 0;
    this.triggerCooldowns.clear();
  }

  /**
   * Get current rate limiting stats
   */
  getStats(): {
    utterancesThisMinute: number;
    utterancesThisGame: number;
    enabled: boolean;
  } {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    this.utteranceTimestamps = this.utteranceTimestamps.filter(
      (t) => t > oneMinuteAgo
    );

    return {
      utterancesThisMinute: this.utteranceTimestamps.length,
      utterancesThisGame: this.gameUtteranceCount,
      enabled: this.config.enabled,
    };
  }

  /**
   * Enable or disable the agent system
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Check if agent system is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
