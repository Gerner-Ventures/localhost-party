import type { VoiceId, NarratorOptions } from "./types";
import { RATE_LIMITS } from "./constants";

// Voice ID mapping for ElevenLabs
const VOICE_IDS: Record<VoiceId, string> = {
  "game-host": "lIkvgvMqGbN2y0vNTyg8", // Custom: Localhost Party Host
  "dramatic-host": "pNInz6obpgDQGcFmaJgB", // Adam - brash and confident
  pirate: "SOYHLrjzK2X1ezoPC6cr", // Harry - animated warrior
  robot: "N2lVS1w4EtoT3dr4eOWO", // Callum - gravelly, unsettling
  butler: "JBFqnCBsd6RMkjVDRZzb", // George - warm British resonance
  surfer: "IKne3meq5aSn9XLyUdCD", // Charlie - young Australian, energetic
  detective: "onwK4e9ZLuTAKqWW03F9", // Daniel - British, formal
  shakespeare: "JBFqnCBsd6RMkjVDRZzb", // George - warm British
  "valley-girl": "FGY2WhTYpPnrIDTdsKH5", // Laura - sassy young female
  announcer: "pqHfZKP75CvOlQylNhV4", // Bill - crisp, friendly narrator
  electric: "TX3LPaxmHKxFdv7VOQHJ", // Liam - energetic young male
  gamer: "IKne3meq5aSn9XLyUdCD", // Charlie - hyped Australian
  alien: "N2lVS1w4EtoT3dr4eOWO", // Callum - unsettling edge
  retro: "CwhRBWXzGAHq8TQ4Fs17", // Roger - classy, easy going
  focused: "cjVigY5qzO86Huf0OWal", // Eric - smooth, professional
  intense: "pNInz6obpgDQGcFmaJgB", // Adam - aggressive confidence
  elegant: "Xb7hH8MSUJpSbSDYk0k2", // Alice - British professional
  explorer: "nPczCjzI2devNBz1zQrb", // Brian - resonant, comforting
};

class Narrator {
  private isProcessing = false;
  private currentAudio: HTMLAudioElement | null = null;
  private currentReject: ((error: Error) => void) | null = null;
  private callTimestamps: number[] = [];
  private generation = 0; // Incremented by stop() to invalidate stale speech

  constructor() {
    // Narrator now uses server-side proxy for TTS
    // No API key needed on client side
  }

  /**
   * Speak text using ElevenLabs TTS
   * Stops any current speech first — only one speech at a time.
   * Queuing is handled by AgentContext, not the narrator.
   */
  async speak(text: string, options: NarratorOptions = {}): Promise<void> {
    if (text.length > RATE_LIMITS.NARRATOR_MAX_TEXT_LENGTH) {
      throw new Error(
        `Text exceeds maximum length of ${RATE_LIMITS.NARRATOR_MAX_TEXT_LENGTH} characters`
      );
    }

    this.stop();
    const sanitizedText = text.replace(/[<>]/g, "");

    this.isProcessing = true;
    const myGeneration = this.generation;

    try {
      if (options.pauseBefore) {
        await this.sleep(options.pauseBefore);
        if (this.generation !== myGeneration) return;
      }

      await this.generateAndPlay(sanitizedText, options, myGeneration);
      if (this.generation !== myGeneration) return;

      if (options.pauseAfter) {
        await this.sleep(options.pauseAfter);
        if (this.generation !== myGeneration) return;
      }

      options.onComplete?.();
    } catch (error) {
      if (this.generation !== myGeneration) return;
      if (error instanceof Error && error.message === "Speech interrupted")
        return;

      if (process.env.NODE_ENV === "development") {
        console.error("Narration error:", error);
      }
      options.onError?.(error as Error);
      throw error;
    } finally {
      if (this.generation === myGeneration) {
        this.isProcessing = false;
      }
    }
  }

  /**
   * Stop current speech.
   */
  stop(): void {
    this.generation++;
    if (this.currentAudio) {
      if (this.currentReject) {
        this.currentReject(new Error("Speech interrupted"));
        this.currentReject = null;
      }
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.isProcessing = false;
  }

  /**
   * Check if currently speaking
   */
  get isSpeaking(): boolean {
    return this.isProcessing;
  }

  /**
   * Check if rate limit is exceeded
   * Prevents API abuse by limiting calls to max per minute
   */
  private isRateLimited(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove timestamps older than 1 minute
    this.callTimestamps = this.callTimestamps.filter(
      (timestamp) => timestamp > oneMinuteAgo
    );

    // Check if we've exceeded the rate limit
    if (
      this.callTimestamps.length >= RATE_LIMITS.NARRATOR_MAX_CALLS_PER_MINUTE
    ) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[Narrator] Rate limit exceeded: ${this.callTimestamps.length} calls in the last minute. Max allowed: ${RATE_LIMITS.NARRATOR_MAX_CALLS_PER_MINUTE}`
        );
      }
      return true;
    }

    return false;
  }

  /**
   * Record an API call for rate limiting
   */
  private recordApiCall(): void {
    this.callTimestamps.push(Date.now());
  }

  /**
   * Generate speech and play it.
   * Checks generation after each async step to bail out if stop() was called.
   */
  private async generateAndPlay(
    text: string,
    options: NarratorOptions,
    expectedGeneration: number
  ): Promise<void> {
    // Check rate limit before making API call
    if (this.isRateLimited()) {
      if (process.env.NODE_ENV === "development") {
        console.log("[Narrator - Rate Limited]", text);
      }
      return;
    }

    try {
      const voiceId = VOICE_IDS[options.voice || "game-host"];
      const speed = options.speed || 1.0;

      // Record this API call for client-side rate limiting
      this.recordApiCall();

      // Call server-side TTS proxy (keeps API key secure)
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          voiceId,
          emotion: options.emotion || "neutral",
        }),
      });

      if (this.generation !== expectedGeneration) return;

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: response.statusText,
        }));

        if (process.env.NODE_ENV === "development") {
          console.error(
            `[Narrator] TTS API error [${response.status}]:`,
            error
          );
        }

        throw new Error(error.message || "TTS service error");
      }

      // Get audio blob from server
      const audioBlob = await response.blob();

      if (this.generation !== expectedGeneration) return;

      const audioUrl = URL.createObjectURL(audioBlob);

      // Play audio
      await this.playAudio(audioUrl, speed);

      // Cleanup
      URL.revokeObjectURL(audioUrl);
    } catch (error) {
      // If interrupted by stop(), rethrow so speak()'s generation check handles it
      if (error instanceof Error && error.message === "Speech interrupted") {
        throw error;
      }

      // If generation changed, bail silently — stop() already cleaned up
      if (this.generation !== expectedGeneration) return;

      // Fallback to silent mode for real TTS errors
      if (process.env.NODE_ENV === "development") {
        console.log("[Narrator - Fallback Mode]", text);
        console.warn(
          "TTS service unavailable, using silent fallback:",
          error instanceof Error ? error.message : error
        );
      }
      return;
    }
  }

  /**
   * Play audio from URL.
   * Tracks the reject function so stop() can interrupt cleanly.
   */
  private playAudio(url: string, playbackRate = 1.0): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      audio.playbackRate = playbackRate;

      this.currentAudio = audio;
      this.currentReject = reject;

      audio.addEventListener("ended", () => {
        this.currentAudio = null;
        this.currentReject = null;
        resolve();
      });

      audio.addEventListener("error", (error) => {
        this.currentAudio = null;
        this.currentReject = null;
        reject(error);
      });

      audio.play().catch(reject);
    });
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const narrator = new Narrator();

// Export for testing
export { Narrator };
