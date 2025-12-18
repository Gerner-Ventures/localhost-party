// Audio system type definitions

export type SoundEffectId =
  | "button-click"
  | "player-join"
  | "submit-complete"
  | "vote-cast"
  | "phase-transition"
  | "all-ready"
  | "clock-tick"
  | "clock-tick-fast"
  | "time-up";

export type MusicTrackId = "lobby-theme" | "victory-fanfare";

export type VoiceId =
  | "game-host"
  | "dramatic-host"
  | "pirate"
  | "robot"
  | "butler"
  | "surfer"
  | "detective"
  | "shakespeare"
  | "valley-girl"
  | "announcer"
  | "electric"
  | "gamer"
  | "alien"
  | "retro"
  | "focused"
  | "intense"
  | "elegant"
  | "explorer";

export interface SoundOptions {
  volume?: number; // 0-1
  loop?: boolean;
  fadeIn?: number; // milliseconds
  fadeOut?: number; // milliseconds
}

export interface MusicOptions extends SoundOptions {
  loop?: boolean;
  duck?: boolean; // Lower volume when voice plays
}

export interface NarratorOptions {
  voice?: VoiceId;
  emotion?: "neutral" | "excited" | "dramatic" | "welcoming" | "intense";
  speed?: number; // 0.5 - 2.0
  pauseBefore?: number; // milliseconds
  pauseAfter?: number; // milliseconds
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export interface AudioContextValue {
  // Sound effects
  playSound: (soundId: SoundEffectId, options?: SoundOptions) => void;
  stopSound: (soundId: SoundEffectId, options?: SoundOptions) => void;

  // Music
  playMusic: (trackId: MusicTrackId, options?: MusicOptions) => void;
  stopMusic: (trackId: MusicTrackId, options?: SoundOptions) => void;
  setMusicVolume: (volume: number) => void;

  // Voice narration
  speak: (text: string, options?: NarratorOptions) => Promise<void>;
  stopSpeaking: () => void;
  isSpeaking: boolean;

  // Global controls
  muted: boolean;
  setMuted: (muted: boolean) => void;
  volume: number;
  setVolume: (volume: number) => void;

  // Audio unlock (browser autoplay restrictions)
  isUnlocked: boolean;
  unlockAudio: () => Promise<void>;
}

export interface AudioState {
  muted: boolean;
  volume: number;
  musicVolume: number;
  isUnlocked: boolean;
  isSpeaking: boolean;
}
