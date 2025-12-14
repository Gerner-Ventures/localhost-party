import { Howl, Howler } from "howler";
import type {
  SoundEffectId,
  MusicTrackId,
  SoundOptions,
  MusicOptions,
} from "./types";

// Sound effect registry
const soundEffects = new Map<SoundEffectId, Howl>();
const musicTracks = new Map<MusicTrackId, Howl>();

// Sound effect paths - using M4A (AAC) format (universally supported)
const SOUND_PATHS: Record<SoundEffectId, string[]> = {
  "button-click": ["/sounds/button-click-sys.m4a"], // Test with system sound
  "player-join": ["/sounds/player-join.m4a"],
  "submit-complete": ["/sounds/submit-complete.m4a"],
  "vote-cast": ["/sounds/vote-cast.m4a"],
  "phase-transition": ["/sounds/phase-transition.m4a"],
  "all-ready": ["/sounds/all-ready.m4a"],
  "clock-tick": ["/sounds/clock-tick.m4a"],
  "clock-tick-fast": ["/sounds/clock-tick-fast.m4a"],
  "time-up": ["/sounds/time-up.m4a"],
};

const MUSIC_PATHS: Record<MusicTrackId, string> = {
  "lobby-theme": "/sounds/music/lobby-theme.mp3",
  "victory-fanfare": "/sounds/music/victory-fanfare.mp3",
};

/**
 * Initialize sound effects
 * Preloads commonly used sounds for instant playback
 */
export function initializeSounds(): void {
  // Don't preload - sounds will load on first play
  // This avoids errors on page load if files are missing
  console.log("Sound system initialized (sounds will load on demand)");
}

/**
 * Load a sound effect into memory
 */
function loadSound(soundId: SoundEffectId): Howl {
  if (soundEffects.has(soundId)) {
    return soundEffects.get(soundId)!;
  }

  const sound = new Howl({
    src: SOUND_PATHS[soundId], // Already an array of formats
    preload: true,
    volume: 0.8,
    onloaderror: (id, error) => {
      console.warn(`Sound effect "${soundId}" not found:`, error);
    },
  });

  soundEffects.set(soundId, sound);
  return sound;
}

/**
 * Load a music track into memory
 */
function loadMusic(trackId: MusicTrackId): Howl {
  if (musicTracks.has(trackId)) {
    return musicTracks.get(trackId)!;
  }

  const track = new Howl({
    src: [MUSIC_PATHS[trackId]],
    preload: true,
    volume: 0.3,
    loop: true,
    onloaderror: (id, error) => {
      console.warn(`Music track "${trackId}" not found:`, error);
    },
  });

  musicTracks.set(trackId, track);
  return track;
}

/**
 * Play a sound effect
 */
export function playSound(
  soundId: SoundEffectId,
  options: SoundOptions = {}
): void {
  const sound = loadSound(soundId);

  // Apply options
  if (options.volume !== undefined) {
    sound.volume(options.volume);
  }
  if (options.loop !== undefined) {
    sound.loop(options.loop);
  }

  // Play with fade in if specified
  if (options.fadeIn) {
    const targetVolume = options.volume ?? 0.8;
    sound.volume(0);
    sound.play();
    sound.fade(0, targetVolume, options.fadeIn);
  } else {
    sound.play();
  }
}

/**
 * Stop a sound effect
 */
export function stopSound(
  soundId: SoundEffectId,
  options: SoundOptions = {}
): void {
  const sound = soundEffects.get(soundId);
  if (!sound) return;

  if (options.fadeOut) {
    sound.fade(sound.volume(), 0, options.fadeOut);
    setTimeout(() => sound.stop(), options.fadeOut);
  } else {
    sound.stop();
  }
}

/**
 * Play background music
 */
export function playMusic(
  trackId: MusicTrackId,
  options: MusicOptions = {}
): void {
  const track = loadMusic(trackId);

  // Stop if already playing
  if (track.playing()) {
    track.stop();
  }

  // Apply options
  if (options.volume !== undefined) {
    track.volume(options.volume);
  }
  if (options.loop !== undefined) {
    track.loop(options.loop);
  }

  // Play with fade in if specified
  if (options.fadeIn) {
    const targetVolume = options.volume ?? 0.3;
    track.volume(0);
    track.play();
    track.fade(0, targetVolume, options.fadeIn);
  } else {
    track.play();
  }
}

/**
 * Stop background music
 */
export function stopMusic(
  trackId: MusicTrackId,
  options: SoundOptions = {}
): void {
  const track = musicTracks.get(trackId);
  if (!track) return;

  if (options.fadeOut) {
    track.fade(track.volume(), 0, options.fadeOut);
    setTimeout(() => track.stop(), options.fadeOut);
  } else {
    track.stop();
  }
}

/**
 * Set global music volume
 */
export function setMusicVolume(volume: number): void {
  musicTracks.forEach((track) => {
    if (track.playing()) {
      track.volume(volume);
    }
  });
}

/**
 * Set global master volume
 */
export function setMasterVolume(volume: number): void {
  Howler.volume(volume);
}

/**
 * Mute/unmute all audio
 */
export function setMuted(muted: boolean): void {
  Howler.mute(muted);
}

/**
 * Unlock audio context (for browser autoplay restrictions)
 * Must be called in response to user interaction
 */
export function unlockAudioContext(): Promise<void> {
  return new Promise((resolve) => {
    // Howler automatically handles unlocking on first interaction
    // We just need to attempt to play a silent sound
    const unlockSound = new Howl({
      src: [
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==",
      ],
      volume: 0,
    });

    unlockSound.once("unlock", () => {
      resolve();
    });

    unlockSound.play();
  });
}

/**
 * Check if audio context is unlocked
 */
export function isAudioUnlocked(): boolean {
  return Howler.ctx?.state === "running";
}

/**
 * Cleanup all sounds and music
 */
export function cleanup(): void {
  soundEffects.forEach((sound) => sound.unload());
  musicTracks.forEach((track) => track.unload());
  soundEffects.clear();
  musicTracks.clear();
}
