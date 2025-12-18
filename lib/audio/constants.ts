/**
 * Audio system configuration constants
 */

// ElevenLabs API Models
export const ELEVENLABS_MODELS = {
  TURBO_V2_5: "eleven_turbo_v2_5",
} as const;

// Volume levels (0.0 to 1.0)
export const AUDIO_VOLUMES = {
  HOME_MUSIC: 0.2, // Quieter for home page
  LOBBY_MUSIC: 0.25, // Slightly louder for lobby
  MUSIC_DUCKING: 0.3, // Music volume multiplier when narrator speaks (0.3 = 30% of original)
  SOUND_EFFECTS: 0.8, // Default sound effect volume
  MUSIC_DEFAULT: 0.3, // Default music volume
} as const;

// Timing durations (milliseconds)
export const AUDIO_DURATIONS = {
  FADE_IN_SLOW: 2000, // Slow fade in for music
  FADE_OUT_MEDIUM: 1500, // Medium fade out for music
  FADE_OUT_FAST: 1000, // Fast fade out
  FADE_OUT_QUICK: 500, // Quick fade out
  NARRATOR_PAUSE_BEFORE: 500, // Pause before narrator starts speaking
  HOVER_DEBOUNCE: 500, // Debounce delay for game hover narration
} as const;

// Rate limiting and validation
export const RATE_LIMITS = {
  NARRATOR_MAX_CALLS_PER_MINUTE: 10, // Maximum narrator API calls per minute
  NARRATOR_COOLDOWN_MS: 6000, // Cooldown between narrator calls (60000ms / 10 = 6000ms)
  NARRATOR_MAX_TEXT_LENGTH: 1000, // Maximum characters per narration (ElevenLabs free tier consideration)
  NARRATOR_MAX_QUEUE_SIZE: 5, // Maximum queued narrations to prevent spam
} as const;
