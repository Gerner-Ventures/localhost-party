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

  describe("Speech Processing", () => {
    it("should process sequential speak calls", async () => {
      const mockBlob = new Blob(["audio"], { type: "audio/mpeg" });
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        blob: async () => mockBlob,
      });

      global.Audio = vi
        .fn()
        .mockImplementation(() => createMockAudio()) as unknown as typeof Audio;

      const promise1 = narrator.speak("test 1");
      await vi.runAllTimersAsync();
      await promise1;

      const promise2 = narrator.speak("test 2");
      await vi.runAllTimersAsync();
      await promise2;

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should handle concurrent speak calls safely", async () => {
      const mockBlob = new Blob(["audio"], { type: "audio/mpeg" });
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        blob: async () => mockBlob,
      });

      global.Audio = vi
        .fn()
        .mockImplementation(() => createMockAudio()) as unknown as typeof Audio;

      // Fire multiple requests — each new speak() calls stop() on the previous one.
      // Because fetch is mock-resolved, earlier calls may still fire the fetch,
      // but their generation check will cause them to bail after the response.
      // The key contract: only the LAST speech plays to completion.
      narrator.speak("test 0");
      narrator.speak("test 1");
      const lastPromise = narrator.speak("test 2");

      await vi.runAllTimersAsync();
      await lastPromise;

      // The last speak should have completed successfully
      // Verify the last call was for "test 2"
      const lastCall = (global.fetch as Mock).mock.calls.at(-1);
      expect(lastCall?.[0]).toBe("/api/tts");
      expect(lastCall?.[1].body).toContain("test 2");
    });

    it("should stop current speech immediately", async () => {
      const mockBlob = new Blob(["audio"], { type: "audio/mpeg" });
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        blob: async () => mockBlob,
      });

      global.Audio = vi
        .fn()
        .mockImplementation(() => createMockAudio()) as unknown as typeof Audio;

      narrator.speak("test 1");
      narrator.speak("test 2");

      // Stop immediately
      narrator.stop();

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

    it("should replace pending speech with new speech", async () => {
      // Make fetch hang so first speech stays in-flight
      (global.fetch as Mock).mockImplementation(() => new Promise(() => {}));

      global.Audio = vi
        .fn()
        .mockImplementation(() => createMockAudio()) as unknown as typeof Audio;

      narrator.speak("first");
      // While first is in-flight, start a new one — this calls stop() internally
      narrator.speak("second");

      // Second is now in-flight
      expect(narrator.isSpeaking).toBe(true);

      // Clean up
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
