import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { narrator } from "../narrator";
import { RATE_LIMITS } from "../constants";

// Mock fetch for TTS API
global.fetch = vi.fn() as Mock;

describe("Narrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    narrator.stop(); // Clear queue before each test
  });

  describe("Queue Processing", () => {
    it("should process queue items sequentially", async () => {
      const mockBlob = new Blob(["audio"], { type: "audio/mpeg" });
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        blob: async () => mockBlob,
      });

      // Mock URL.createObjectURL
      global.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
      global.URL.revokeObjectURL = vi.fn();

      // Mock HTMLAudioElement
      const mockAudio = {
        play: vi.fn().mockResolvedValue(undefined),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      global.HTMLAudioElement = vi.fn(
        () => mockAudio
      ) as unknown as typeof HTMLAudioElement;

      const promise1 = narrator.speak("test 1");
      const promise2 = narrator.speak("test 2");

      await Promise.all([promise1, promise2]);

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should handle concurrent queue modifications safely", async () => {
      const mockBlob = new Blob(["audio"], { type: "audio/mpeg" });
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        blob: async () => mockBlob,
      });

      global.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
      global.URL.revokeObjectURL = vi.fn();

      const mockAudio = {
        play: vi.fn().mockResolvedValue(undefined),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      global.HTMLAudioElement = vi.fn(
        () => mockAudio
      ) as unknown as typeof HTMLAudioElement;

      // Fire multiple requests simultaneously
      const promises = Array.from({ length: 3 }, (_, i) =>
        narrator.speak(`test ${i}`)
      );

      await Promise.all(promises);

      // All should complete without errors
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it("should stop queue and clear pending items", () => {
      const promise = narrator.speak("test");
      narrator.stop();

      // The promise should reject since queue was cleared
      expect(promise).rejects.toThrow();
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
      const validText = "a".repeat(RATE_LIMITS.NARRATOR_MAX_TEXT_LENGTH);

      const mockBlob = new Blob(["audio"], { type: "audio/mpeg" });
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        blob: async () => mockBlob,
      });

      global.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
      global.URL.revokeObjectURL = vi.fn();

      const mockAudio = {
        play: vi.fn().mockResolvedValue(undefined),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      global.HTMLAudioElement = vi.fn(
        () => mockAudio
      ) as unknown as typeof HTMLAudioElement;

      await expect(narrator.speak(validText)).resolves.not.toThrow();
    });

    it("should reject when queue is full", async () => {
      const mockBlob = new Blob(["audio"], { type: "audio/mpeg" });
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        blob: async () => mockBlob,
      });

      // Fill the queue (don't await to keep them queued)
      Array.from({ length: RATE_LIMITS.NARRATOR_MAX_QUEUE_SIZE }, (_, i) =>
        narrator.speak(`test ${i}`)
      );

      // This one should fail (queue full)
      await expect(narrator.speak("overflow")).rejects.toThrow(/queue is full/);

      // Stop to clean up
      narrator.stop();
    });

    it("should sanitize HTML characters", async () => {
      const mockBlob = new Blob(["audio"], { type: "audio/mpeg" });
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        blob: async () => mockBlob,
      });

      global.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
      global.URL.revokeObjectURL = vi.fn();

      const mockAudio = {
        play: vi.fn().mockResolvedValue(undefined),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      global.HTMLAudioElement = vi.fn(
        () => mockAudio
      ) as unknown as typeof HTMLAudioElement;

      await narrator.speak("<script>alert('xss')</script>");

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

      global.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
      global.URL.revokeObjectURL = vi.fn();

      const mockAudio = {
        play: vi.fn().mockResolvedValue(undefined),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      global.HTMLAudioElement = vi.fn(
        () => mockAudio
      ) as unknown as typeof HTMLAudioElement;

      // Exceed rate limit
      const promises = Array.from(
        { length: RATE_LIMITS.NARRATOR_MAX_CALLS_PER_MINUTE + 1 },
        (_, i) => narrator.speak(`test ${i}`)
      );

      await Promise.all(promises);

      // Should have only made MAX_CALLS_PER_MINUTE actual API calls
      // The rest should have been rate limited (silent fallback)
      expect(global.fetch).toHaveBeenCalledTimes(
        RATE_LIMITS.NARRATOR_MAX_CALLS_PER_MINUTE
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle API errors gracefully", async () => {
      (global.fetch as Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: "Server error" }),
      });

      // Should not throw, falls back to silent mode
      await expect(narrator.speak("test")).resolves.not.toThrow();
    });

    it("should handle network errors gracefully", async () => {
      (global.fetch as Mock).mockRejectedValue(new Error("Network error"));

      // Should not throw, falls back to silent mode
      await expect(narrator.speak("test")).resolves.not.toThrow();
    });
  });
});
