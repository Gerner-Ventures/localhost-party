"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import type {
  AudioContextValue,
  AudioState,
  SoundEffectId,
  MusicTrackId,
  SoundOptions,
  MusicOptions,
  NarratorOptions,
} from "../audio/types";
import * as sounds from "../audio/sounds";
import { narrator } from "../audio/narrator";
import { AUDIO_VOLUMES } from "../audio/constants";

const AudioContext = createContext<AudioContextValue | undefined>(undefined);

const STORAGE_KEY = "localhost-party-audio-settings";

interface AudioProviderProps {
  children: React.ReactNode;
}

export function AudioProvider({ children }: AudioProviderProps) {
  // Load saved settings from localStorage
  const [state, setState] = useState<AudioState>(() => {
    if (typeof window === "undefined") {
      return {
        muted: false,
        volume: 1.0,
        musicVolume: AUDIO_VOLUMES.MUSIC_DEFAULT,
        isUnlocked: false,
        isSpeaking: false,
      };
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Invalid JSON, use defaults
      }
    }

    return {
      muted: false,
      volume: 1.0,
      musicVolume: AUDIO_VOLUMES.MUSIC_DEFAULT,
      isUnlocked: false,
      isSpeaking: false,
    };
  });

  // Save only persistent settings to localStorage (exclude temporary state like isSpeaking, isUnlocked)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const persistentState = {
        muted: state.muted,
        volume: state.volume,
        musicVolume: state.musicVolume,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistentState));
    }
  }, [state.muted, state.volume, state.musicVolume]);

  // Initialize sound system
  useEffect(() => {
    sounds.initializeSounds();
    sounds.setMasterVolume(state.volume);
    sounds.setMuted(state.muted);

    // Cleanup on unmount
    return () => {
      sounds.cleanup();
    };
  }, [state.volume, state.muted]);

  // Unlock audio on first user interaction
  const unlockAudio = useCallback(async () => {
    if (state.isUnlocked) return;

    try {
      await sounds.unlockAudioContext();
      setState((prev) => ({ ...prev, isUnlocked: true }));
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to unlock audio:", error);
      }
    }
  }, [state.isUnlocked]);

  // Play sound effect
  const playSound = useCallback(
    (soundId: SoundEffectId, options?: SoundOptions) => {
      if (state.muted) return;
      sounds.playSound(soundId, options);
    },
    [state.muted]
  );

  // Stop sound effect
  const stopSound = useCallback(
    (soundId: SoundEffectId, options?: SoundOptions) => {
      sounds.stopSound(soundId, options);
    },
    []
  );

  // Play music
  const playMusic = useCallback(
    (trackId: MusicTrackId, options?: MusicOptions) => {
      if (state.muted) return;
      sounds.playMusic(trackId, options);
    },
    [state.muted]
  );

  // Stop music
  const stopMusic = useCallback(
    (trackId: MusicTrackId, options?: SoundOptions) => {
      sounds.stopMusic(trackId, options);
    },
    []
  );

  // Set music volume
  const setMusicVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    setState((prev) => ({ ...prev, musicVolume: clampedVolume }));
    sounds.setMusicVolume(clampedVolume);
  }, []);

  // Speak text
  const speak = useCallback(
    async (text: string, options?: NarratorOptions) => {
      if (state.muted) {
        if (process.env.NODE_ENV === "development") {
          console.log("[Narrator - Muted]", text);
        }
        return;
      }

      setState((prev) => ({ ...prev, isSpeaking: true }));

      try {
        // Duck music if playing
        sounds.setMusicVolume(state.musicVolume * AUDIO_VOLUMES.MUSIC_DUCKING);

        await narrator.speak(text, options);
      } finally {
        // Restore music volume
        sounds.setMusicVolume(state.musicVolume);
        setState((prev) => ({ ...prev, isSpeaking: false }));
      }
    },
    [state.muted, state.musicVolume]
  );

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    narrator.stop();
    sounds.setMusicVolume(state.musicVolume);
    setState((prev) => ({ ...prev, isSpeaking: false }));
  }, [state.musicVolume]);

  // Set muted
  const setMuted = useCallback((muted: boolean) => {
    setState((prev) => ({ ...prev, muted }));
    sounds.setMuted(muted);
  }, []);

  // Set volume
  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    setState((prev) => ({ ...prev, volume: clampedVolume }));
    sounds.setMasterVolume(clampedVolume);
  }, []);

  const value: AudioContextValue = {
    playSound,
    stopSound,
    playMusic,
    stopMusic,
    setMusicVolume,
    speak,
    stopSpeaking,
    isSpeaking: state.isSpeaking,
    muted: state.muted,
    setMuted,
    volume: state.volume,
    setVolume,
    isUnlocked: state.isUnlocked,
    unlockAudio,
  };

  return (
    <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
  );
}

/**
 * Hook to use audio context
 */
export function useAudio(): AudioContextValue {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error("useAudio must be used within AudioProvider");
  }
  return context;
}
