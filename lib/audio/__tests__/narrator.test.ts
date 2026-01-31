import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type Mock,
} from "vitest";
import { Narrator } from "../narrator";
import { RATE_LIMITS } from "../constants";

// Mock fetch for TTS API
global.fetch = vi.fn() as Mock;

describe("Narrator", () => {
  let narrator: Narrator;

  // Helper to create a mock audio element that auto-triggers 'ended'
  function createMockAudio() {
    const listeners: Record<string, (() => void)[]> = {};
    return {
      playbackRate: 1,
      play: vi.fn().mockImplementation(() => {
        // Trigger 'ended' event after a short delay
        setTimeout(() => {
          listeners["ended"]?.forEach((cb) => cb());
        }, 10);
        return Promise.resolve();
      }),
      pause: vi.fn(),
      addEventListener: vi.fn((event: string, cb: () => void) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(cb);
      }),
      removeEventListener: vi.fn(),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    narrator = new Narrator();

    // Setup default mocks
    global.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    narrator.stop();
    vi.useRealTimers();
  });

  describe("Queue Processing", () => {
    it("should process queue items sequentially", async () => {
      const mockBlob = new Blob(["audio"], { type: "audio/mpeg" });
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        blob: async () => mockBlob,
      });

      global.Audio = vi
        .fn()
        .mockImplementation(() => createMockAudio()) as unknown as typeof Audio;

      const promise1 = narrator.speak("test 1");
      const promise2 = narrator.speak("test 2");

      await vi.runAllTimersAsync();
      await Promise.all([promise1, promise2]);

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should handle concurrent queue modifications safely", async () => {
      const mockBlob = new Blob(["audio"], { type: "audio/mpeg" });
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        blob: async () => mockBlob,
      });

      global.Audio = vi
        .fn()
        .mockImplementation(() => createMockAudio()) as unknown as typeof Audio;

      // Fire multiple requests simultaneously
      const promises = Array.from({ length: 3 }, (_, i) =>
        narrator.speak(`test ${i}`)
      );

      await vi.runAllTimersAsync();
      await Promise.all(promises);

      // All should complete without errors
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it("should stop queue and clear pending items", async () => {
      const mockBlob = new Blob(["audio"], { type: "audio/mpeg" });
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        blob: async () => mockBlob,
      });

      global.Audio = vi
        .fn()
        .mockImplementation(() => createMockAudio()) as unknown as typeof Audio;

      // Queue multiple items
      narrator.speak("test 1");
      narrator.speak("test 2");

      // Stop immediately
      narrator.stop();

      // Queue should be cleared
      expect(narrator.isSpeaking).toBe(false);
    });
  });

  describe("Input Validation", () => {
    it("should reject text exceeding max length", async () => {
      const longText = "a".repeat(RATE_LIMITS.NARRATOR_MAX_TEXT_LENGTH + 1);

      await expect(narrator.speak(longText)).rejects.toThrow(
        /exceeds maximum length/
      );
    });

    it("should accept text within max length", async () => {
      const validText = "a".repeat(100); // Use shorter text for faster test

      const mockBlob = new Blob(["audio"], { type: "audio/mpeg" });
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        blob: async () => mockBlob,
      });

      global.Audio = vi
        .fn()
        .mockImplementation(() => createMockAudio()) as unknown as typeof Audio;

      const promise = narrator.speak(validText);
      await vi.runAllTimersAsync();
      await expect(promise).resolves.not.toThrow();
    });

    it("should reject when queue is full", async () => {
      // Make fetch hang to prevent queue from processing
      (global.fetch as Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves, keeps first item processing
      );

      global.Audio = vi
        .fn()
        .mockImplementation(() => createMockAudio()) as unknown as typeof Audio;

      // Fill the queue - first call starts processing, rest queue up
      // Queue size is 5, but one is being processed, so we can queue 5 more before overflow
      const promises: Promise<void>[] = [];
      for (let i = 0; i < RATE_LIMITS.NARRATOR_MAX_QUEUE_SIZE + 1; i++) {
        promises.push(narrator.speak(`test ${i}`));
      }

      // This one should fail (queue full) - the 7th item (1 processing + 5 queued = 6, 7th rejected)
      await expect(narrator.speak("overflow")).rejects.toThrow(/queue is full/);

      // Clean up - stop the narrator to reject hanging promises
      narrator.stop();
    });

    it("should sanitize HTML characters", async () => {
      const mockBlob = new Blob(["audio"], { type: "audio/mpeg" });
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        blob: async () => mockBlob,
      });

      global.Audio = vi
        .fn()
        .mockImplementation(() => createMockAudio()) as unknown as typeof Audio;

      const promise = narrator.speak("<script>alert('xss')</script>");
      await vi.runAllTimersAsync();
      await promise;

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/tts",
        expect.objectContaining({
          body: expect.stringContaining("scriptalert('xss')/script"),
        })
      );
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce rate limits", async () => {
      const mockBlob = new Blob(["audio"], { type: "audio/mpeg" });
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        blob: async () => mockBlob,
      });

      global.Audio = vi
        .fn()
        .mockImplementation(() => createMockAudio()) as unknown as typeof Audio;

      // Make calls up to the rate limit (process them sequentially)
      for (let i = 0; i < RATE_LIMITS.NARRATOR_MAX_CALLS_PER_MINUTE; i++) {
        const promise = narrator.speak(`test ${i}`);
        await vi.runAllTimersAsync();
        await promise;
      }

      expect(global.fetch).toHaveBeenCalledTimes(
        RATE_LIMITS.NARRATOR_MAX_CALLS_PER_MINUTE
      );

      // Next call should be rate limited (no fetch call)
      vi.clearAllMocks();
      const rateLimitedPromise = narrator.speak("rate limited");
      await vi.runAllTimersAsync();
      await rateLimitedPromise;

      // Should not have called fetch (rate limited, uses fallback)
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle API errors gracefully", async () => {
      (global.fetch as Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: "Server error" }),
      });

      const promise = narrator.speak("test");
      await vi.runAllTimersAsync();

      // Should not throw, falls back to silent mode
      await expect(promise).resolves.not.toThrow();
    });

    it("should handle network errors gracefully", async () => {
      (global.fetch as Mock).mockRejectedValue(new Error("Network error"));

      const promise = narrator.speak("test");
      await vi.runAllTimersAsync();

      // Should not throw, falls back to silent mode
      await expect(promise).resolves.not.toThrow();
    });
  });
});
