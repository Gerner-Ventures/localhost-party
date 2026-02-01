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

// Speech queue for sequential narration
interface NarrationQueueItem {
  text: string;
  options: NarratorOptions;
  resolve: () => void;
  reject: (error: Error) => void;
}

class Narrator {
  private queue: NarrationQueueItem[] = [];
  private isProcessing = false;
  private currentAudio: HTMLAudioElement | null = null;
  private callTimestamps: number[] = [];
  private apiKeyInvalid = false;
  private apiKeyWarningShown = false;

  constructor() {
    // Narrator now uses server-side proxy for TTS
    // No API key needed on client side
  }

  /**
   * Speak text using ElevenLabs TTS
   * Validates input length and queue size to prevent abuse
   */
  async speak(text: string, options: NarratorOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      // Validate text length
      if (text.length > RATE_LIMITS.NARRATOR_MAX_TEXT_LENGTH) {
        const error = new Error(
          `Text exceeds maximum length of ${RATE_LIMITS.NARRATOR_MAX_TEXT_LENGTH} characters`
        );
        reject(error);
        return;
      }

      // Validate queue size to prevent spam
      if (this.queue.length >= RATE_LIMITS.NARRATOR_MAX_QUEUE_SIZE) {
        const error = new Error(
          `Narrator queue is full (max ${RATE_LIMITS.NARRATOR_MAX_QUEUE_SIZE} items)`
        );
        reject(error);
        return;
      }

      // Sanitize text (basic XSS prevention, though TTS doesn't render HTML)
      const sanitizedText = text.replace(/[<>]/g, "");

      this.queue.push({ text: sanitizedText, options, resolve, reject });

      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Stop current speech and clear queue
   */
  stop(): void {
    this.queue = [];
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.isProcessing = false;
  }

  /**
   * Check if currently speaking
   */
  get isSpeaking(): boolean {
    return this.isProcessing || this.queue.length > 0;
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
   * Process narration queue
   */
  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const item = this.queue.shift();

    // Guard against concurrent queue modifications
    if (!item) {
      this.isProcessing = false;
      return;
    }

    try {
      // Pause before speaking if specified
      if (item.options.pauseBefore) {
        await this.sleep(item.options.pauseBefore);
      }

      // Generate and play speech
      await this.generateAndPlay(item.text, item.options);

      // Pause after speaking if specified
      if (item.options.pauseAfter) {
        await this.sleep(item.options.pauseAfter);
      }

      // Call completion callback
      if (item.options.onComplete) {
        item.options.onComplete();
      }

      item.resolve();
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Narration error:", error);
      }

      if (item.options.onError) {
        item.options.onError(error as Error);
      }

      item.reject(error as Error);
    }

    // Process next item
    this.processQueue();
  }

  /**
   * Generate speech and play it
   */
  private async generateAndPlay(
    text: string,
    options: NarratorOptions
  ): Promise<void> {
    // Check rate limit before making API call
    if (this.isRateLimited()) {
      if (process.env.NODE_ENV === "development") {
        console.log("[Narrator - Rate Limited]", text);
      }
      await this.sleep(text.length * 50); // Simulate speech duration
      return;
    }

    // Skip API calls if we've detected an invalid API key
    if (this.apiKeyInvalid) {
      await this.sleep(text.length * 50); // Simulate speech duration
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

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: response.statusText,
        }));

        // Handle auth/config errors by disabling TTS (show warning once)
        if (response.status === 401 || response.status === 500) {
          this.apiKeyInvalid = true;
          if (
            !this.apiKeyWarningShown &&
            process.env.NODE_ENV === "development"
          ) {
            this.apiKeyWarningShown = true;
            console.warn(
              "[Narrator] TTS disabled - API key invalid or not configured. " +
                "Set NEXT_PUBLIC_ELEVENLABS_API_KEY in your environment."
            );
          }
          // Fall through to silent mode instead of throwing
          await this.sleep(text.length * 50);
          return;
        }

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
      const audioUrl = URL.createObjectURL(audioBlob);

      // Play audio
      await this.playAudio(audioUrl, speed);

      // Cleanup
      URL.revokeObjectURL(audioUrl);
    } catch (error) {
      // Fallback to silent mode
      if (process.env.NODE_ENV === "development") {
        console.log("[Narrator - Fallback Mode]", text);
        console.warn(
          "TTS service unavailable, using silent fallback:",
          error instanceof Error ? error.message : error
        );
      }
      await this.sleep(text.length * 50);
    }
  }

  /**
   * Play audio from URL
   */
  private playAudio(url: string, playbackRate = 1.0): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      audio.playbackRate = playbackRate;

      this.currentAudio = audio;

      audio.addEventListener("ended", () => {
        this.currentAudio = null;
        resolve();
      });

      audio.addEventListener("error", (error) => {
        this.currentAudio = null;
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
