import React, { useEffect } from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { AudioProvider, useAudio } from "../AudioContext";
import { AUDIO_VOLUMES } from "../../audio/constants";
import * as sounds from "../../audio/sounds";

// Mock the sounds module
vi.mock("../../audio/sounds", () => ({
  initializeSounds: vi.fn(),
  setMasterVolume: vi.fn(),
  setMuted: vi.fn(),
  setMusicVolume: vi.fn(),
  playSound: vi.fn(),
  stopSound: vi.fn(),
  playMusic: vi.fn(),
  stopMusic: vi.fn(),
  unlockAudioContext: vi.fn().mockResolvedValue(undefined),
  cleanup: vi.fn(),
}));

// Mock the narrator module
vi.mock("../../audio/narrator", () => ({
  narrator: {
    speak: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
  },
}));

// Test component to access audio context
function TestComponent({
  onContextReady,
}: {
  onContextReady: (context: ReturnType<typeof useAudio>) => void;
}) {
  const audioContext = useAudio();

  useEffect(() => {
    onContextReady(audioContext);
  }, [audioContext, onContextReady]);

  return null;
}

describe("AudioContext - Music Ducking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should duck music volume when narrator speaks", async () => {
    let audioContext: ReturnType<typeof useAudio> | null = null;

    await act(async () => {
      render(
        <AudioProvider>
          <TestComponent
            onContextReady={(ctx) => {
              audioContext = ctx;
            }}
          />
        </AudioProvider>
      );
    });

    expect(audioContext).not.toBeNull();

    // Set initial music volume
    await act(async () => {
      audioContext!.setMusicVolume(0.5);
    });

    // Start speaking
    let speakPromise: Promise<void>;
    await act(async () => {
      speakPromise = audioContext!.speak("test narration");
    });

    // Music volume should be ducked (0.5 * 0.3 = 0.15)
    await waitFor(() => {
      expect(sounds.setMusicVolume).toHaveBeenCalledWith(
        0.5 * AUDIO_VOLUMES.MUSIC_DUCKING
      );
    });

    // Wait for narration to complete
    await act(async () => {
      await speakPromise!;
    });

    // Music volume should be restored
    await waitFor(() => {
      expect(sounds.setMusicVolume).toHaveBeenCalledWith(0.5);
    });
  });

  it("should restore music volume after narration completes", async () => {
    let audioContext: ReturnType<typeof useAudio> | null = null;

    await act(async () => {
      render(
        <AudioProvider>
          <TestComponent
            onContextReady={(ctx) => {
              audioContext = ctx;
            }}
          />
        </AudioProvider>
      );
    });

    expect(audioContext).not.toBeNull();

    const initialVolume = 0.3;
    await act(async () => {
      audioContext!.setMusicVolume(initialVolume);
    });

    await act(async () => {
      await audioContext!.speak("test");
    });

    // After speaking completes, volume should be restored
    await waitFor(() => {
      expect(sounds.setMusicVolume).toHaveBeenLastCalledWith(initialVolume);
    });
  });

  it("should not speak when muted", async () => {
    let audioContext: ReturnType<typeof useAudio> | null = null;

    await act(async () => {
      render(
        <AudioProvider>
          <TestComponent
            onContextReady={(ctx) => {
              audioContext = ctx;
            }}
          />
        </AudioProvider>
      );
    });

    expect(audioContext).not.toBeNull();

    // Mute audio
    await act(async () => {
      audioContext!.setMuted(true);
    });

    // Try to speak
    await act(async () => {
      await audioContext!.speak("test");
    });

    // Narrator should not have been called
    const { narrator } = await import("../../audio/narrator");
    expect(narrator.speak).not.toHaveBeenCalled();
  });

  it("should track isSpeaking state correctly", async () => {
    let audioContext: ReturnType<typeof useAudio> | null = null;

    await act(async () => {
      render(
        <AudioProvider>
          <TestComponent
            onContextReady={(ctx) => {
              audioContext = ctx;
            }}
          />
        </AudioProvider>
      );
    });

    expect(audioContext).not.toBeNull();
    expect(audioContext!.isSpeaking).toBe(false);

    // Start speaking and wait for completion
    await act(async () => {
      await audioContext!.speak("test");
    });

    // After completion, should no longer be speaking
    expect(audioContext!.isSpeaking).toBe(false);
  });
});

describe("AudioContext - LocalStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should only save persistent settings to localStorage", async () => {
    let audioContext: ReturnType<typeof useAudio> | null = null;

    await act(async () => {
      render(
        <AudioProvider>
          <TestComponent
            onContextReady={(ctx) => {
              audioContext = ctx;
            }}
          />
        </AudioProvider>
      );
    });

    expect(audioContext).not.toBeNull();

    // Change persistent settings
    await act(async () => {
      audioContext!.setMuted(true);
      audioContext!.setVolume(0.5);
      audioContext!.setMusicVolume(0.3);
    });

    // Trigger speaking (changes isSpeaking but shouldn't save to localStorage)
    await act(async () => {
      await audioContext!.speak("test");
    });

    // Check localStorage
    const saved = JSON.parse(
      localStorage.getItem("localhost-party-audio-settings") || "{}"
    );

    // Should have persistent settings
    expect(saved.muted).toBe(true);
    expect(saved.volume).toBe(0.5);
    expect(saved.musicVolume).toBe(0.3);

    // Should NOT have temporary state
    expect(saved.isSpeaking).toBeUndefined();
    expect(saved.isUnlocked).toBeUndefined();
  });

  it("should load settings from localStorage on mount", async () => {
    const settings = {
      muted: true,
      volume: 0.7,
      musicVolume: 0.4,
    };

    localStorage.setItem(
      "localhost-party-audio-settings",
      JSON.stringify(settings)
    );

    let audioContext: ReturnType<typeof useAudio> | null = null;

    await act(async () => {
      render(
        <AudioProvider>
          <TestComponent
            onContextReady={(ctx) => {
              audioContext = ctx;
            }}
          />
        </AudioProvider>
      );
    });

    expect(audioContext).not.toBeNull();
    // Settings should be loaded (we can't directly check state, but we can verify the setters were called)
    expect(sounds.setMuted).toHaveBeenCalledWith(true);
    expect(sounds.setMasterVolume).toHaveBeenCalledWith(0.7);
  });
});
