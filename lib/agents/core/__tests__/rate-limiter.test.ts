import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AgentRateLimiter } from "../rate-limiter";

describe("AgentRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("canSpeak", () => {
    it("allows speaking when enabled and under limits", () => {
      const limiter = new AgentRateLimiter({ enabled: true });
      expect(limiter.canSpeak()).toEqual({ allowed: true });
    });

    it("rejects when disabled", () => {
      const limiter = new AgentRateLimiter({ enabled: false });
      const result = limiter.canSpeak();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("disabled");
    });

    it("enforces minimum interval between utterances", () => {
      const limiter = new AgentRateLimiter({
        enabled: true,
        minIntervalMs: 2000,
      });

      limiter.recordUtterance("agent1", "event1", 0);

      const result = limiter.canSpeak();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("interval");

      // Advance past interval
      vi.advanceTimersByTime(2001);
      expect(limiter.canSpeak().allowed).toBe(true);
    });

    it("enforces per-minute rate limit", () => {
      const limiter = new AgentRateLimiter({
        enabled: true,
        maxUtterancesPerMinute: 2,
        minIntervalMs: 0,
      });

      limiter.recordUtterance("a1", "e1", 0);
      limiter.recordUtterance("a1", "e2", 0);

      const result = limiter.canSpeak();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Per-minute");

      // Advance past the 1-minute window
      vi.advanceTimersByTime(61000);
      expect(limiter.canSpeak().allowed).toBe(true);
    });

    it("enforces per-game limit", () => {
      const limiter = new AgentRateLimiter({
        enabled: true,
        maxUtterancesPerGame: 2,
        maxUtterancesPerMinute: 100,
        minIntervalMs: 0,
      });

      limiter.recordUtterance("a1", "e1", 0);
      limiter.recordUtterance("a1", "e2", 0);

      const result = limiter.canSpeak();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Per-game");
    });
  });

  describe("isTriggerOnCooldown", () => {
    it("returns false when no cooldown is set", () => {
      const limiter = new AgentRateLimiter();
      expect(limiter.isTriggerOnCooldown("agent1", "event1")).toBe(false);
    });

    it("returns true during cooldown period", () => {
      const limiter = new AgentRateLimiter();
      limiter.recordUtterance("agent1", "event1", 5000);

      expect(limiter.isTriggerOnCooldown("agent1", "event1")).toBe(true);
    });

    it("returns false after cooldown expires", () => {
      const limiter = new AgentRateLimiter();
      limiter.recordUtterance("agent1", "event1", 5000);

      vi.advanceTimersByTime(5001);
      expect(limiter.isTriggerOnCooldown("agent1", "event1")).toBe(false);
    });

    it("tracks cooldowns per agent-event pair independently", () => {
      const limiter = new AgentRateLimiter();
      limiter.recordUtterance("agent1", "event1", 5000);

      expect(limiter.isTriggerOnCooldown("agent1", "event1")).toBe(true);
      expect(limiter.isTriggerOnCooldown("agent1", "event2")).toBe(false);
      expect(limiter.isTriggerOnCooldown("agent2", "event1")).toBe(false);
    });
  });

  describe("resetGame", () => {
    it("resets game utterance count", () => {
      const limiter = new AgentRateLimiter({
        enabled: true,
        maxUtterancesPerGame: 2,
        maxUtterancesPerMinute: 100,
        minIntervalMs: 0,
      });

      limiter.recordUtterance("a1", "e1", 0);
      limiter.recordUtterance("a1", "e2", 0);
      expect(limiter.canSpeak().allowed).toBe(false);

      limiter.resetGame();
      expect(limiter.canSpeak().allowed).toBe(true);
    });

    it("clears trigger cooldowns", () => {
      const limiter = new AgentRateLimiter();
      limiter.recordUtterance("agent1", "event1", 99999);

      expect(limiter.isTriggerOnCooldown("agent1", "event1")).toBe(true);

      limiter.resetGame();
      expect(limiter.isTriggerOnCooldown("agent1", "event1")).toBe(false);
    });
  });

  describe("setEnabled / isEnabled", () => {
    it("toggles enabled state", () => {
      const limiter = new AgentRateLimiter({ enabled: true });
      expect(limiter.isEnabled()).toBe(true);

      limiter.setEnabled(false);
      expect(limiter.isEnabled()).toBe(false);
      expect(limiter.canSpeak().allowed).toBe(false);

      limiter.setEnabled(true);
      expect(limiter.isEnabled()).toBe(true);
    });
  });

  describe("getStats", () => {
    it("returns current statistics", () => {
      const limiter = new AgentRateLimiter({
        enabled: true,
        minIntervalMs: 0,
      });

      limiter.recordUtterance("a1", "e1", 0);
      limiter.recordUtterance("a1", "e2", 0);

      const stats = limiter.getStats();
      expect(stats.utterancesThisMinute).toBe(2);
      expect(stats.utterancesThisGame).toBe(2);
      expect(stats.enabled).toBe(true);
    });

    it("cleans up expired timestamps from per-minute count", () => {
      const limiter = new AgentRateLimiter({
        enabled: true,
        minIntervalMs: 0,
      });

      limiter.recordUtterance("a1", "e1", 0);
      vi.advanceTimersByTime(61000);

      const stats = limiter.getStats();
      expect(stats.utterancesThisMinute).toBe(0);
      expect(stats.utterancesThisGame).toBe(1);
    });
  });
});
