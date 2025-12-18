# Audio Infrastructure

Complete audio system for localhost:party with sound effects, background music, and AI voice narration powered by ElevenLabs.

## Features

- ✅ Sound effects system with Howler.js
- ✅ Background music with auto-ducking during speech
- ✅ ElevenLabs TTS integration for AI narration
- ✅ Persistent mute/volume settings
- ✅ Browser autoplay policy handling
- ✅ Queue-based narration system
- ✅ TypeScript support

## Quick Start

### Basic Usage

```typescript
import { useAudio } from '@/lib/context/AudioContext';

function MyComponent() {
  const { playSound, speak, muted, setMuted } = useAudio();

  const handleClick = () => {
    // Play sound effect
    playSound('button-click');

    // Speak with AI voice
    speak('Welcome to the game!', {
      voice: 'game-host',
      emotion: 'excited'
    });
  };

  return (
    <div>
      <button onClick={handleClick}>
        Play Sound & Speak
      </button>
      <button onClick={() => setMuted(!muted)}>
        {muted ? 'Unmute' : 'Mute'}
      </button>
    </div>
  );
}
```

### Audio Unlock (Required for browsers)

```typescript
import { useAudio } from '@/lib/context/AudioContext';

function StartButton() {
  const { unlockAudio, isUnlocked } = useAudio();

  const handleStart = async () => {
    // Unlock audio on first user interaction
    if (!isUnlocked) {
      await unlockAudio();
    }

    // Now audio will play
    playSound('button-click');
  };

  return <button onClick={handleStart}>Start Game</button>;
}
```

## API Reference

### `useAudio()` Hook

Returns an `AudioContextValue` object with the following methods:

#### Sound Effects

```typescript
playSound(soundId: SoundEffectId, options?: SoundOptions): void
stopSound(soundId: SoundEffectId, options?: SoundOptions): void
```

**Available Sound IDs:**

- `button-click` - UI button interactions
- `player-join` - Player joins lobby
- `submit-complete` - Answer submitted
- `vote-cast` - Vote submitted
- `phase-transition` - Game phase changes
- `all-ready` - All players ready
- `clock-tick` - Timer ticking (normal)
- `clock-tick-fast` - Timer ticking (urgent)
- `time-up` - Timer expired

**Options:**

```typescript
{
  volume?: number;    // 0-1, default: 0.8
  loop?: boolean;     // default: false
  fadeIn?: number;    // milliseconds
  fadeOut?: number;   // milliseconds
}
```

#### Background Music

```typescript
playMusic(trackId: MusicTrackId, options?: MusicOptions): void
stopMusic(trackId: MusicTrackId, options?: SoundOptions): void
setMusicVolume(volume: number): void
```

**Available Music Tracks:**

- `lobby-theme` - Lobby background music
- `victory-fanfare` - Victory celebration

**Options:**

```typescript
{
  volume?: number;    // 0-1, default: 0.3
  loop?: boolean;     // default: true
  fadeIn?: number;    // milliseconds
  fadeOut?: number;   // milliseconds
  duck?: boolean;     // Lower volume during speech
}
```

#### Voice Narration

```typescript
speak(text: string, options?: NarratorOptions): Promise<void>
stopSpeaking(): void
isSpeaking: boolean
```

**Available Voices:**

- `game-host` - Energetic game show host
- `dramatic-host` - Theatrical, dramatic
- `pirate`, `robot`, `butler`, `surfer`, `detective`, `shakespeare`, `valley-girl`, `announcer` - Character voices
- `electric`, `gamer`, `alien`, `retro`, `focused`, `intense`, `elegant`, `explorer` - Avatar voices

**Options:**

```typescript
{
  voice?: VoiceId;          // default: 'game-host'
  emotion?: 'neutral' | 'excited' | 'dramatic' | 'welcoming' | 'intense';
  speed?: number;           // 0.5 - 2.0, default: 1.0
  pauseBefore?: number;     // milliseconds
  pauseAfter?: number;      // milliseconds
  onComplete?: () => void;
  onError?: (error: Error) => void;
}
```

#### Global Controls

```typescript
muted: boolean
setMuted(muted: boolean): void
volume: number                  // 0-1
setVolume(volume: number): void
isUnlocked: boolean
unlockAudio(): Promise<void>
```

## Examples

### Play Sound on Button Click

```typescript
const { playSound } = useAudio();

<button
  onClick={() => playSound('button-click')}
  className="arcade-button"
>
  Submit Answer
</button>
```

### Phase Transition with Voice

```typescript
const { speak, playSound } = useAudio();

useEffect(() => {
  if (gameState?.phase === "vote") {
    playSound("phase-transition");

    speak("All answers are in! Time to vote!", {
      voice: "game-host",
      emotion: "excited",
      pauseAfter: 1000,
    });
  }
}, [gameState?.phase]);
```

### Sequential Narration

```typescript
const { speak } = useAudio();

const announceWinners = async () => {
  await speak("And the scores are...", { pauseAfter: 2000 });
  await speak("In third place... Alice!", { pauseAfter: 1000 });
  await speak("In second place... Bob!", { pauseAfter: 1000 });
  await speak("And your winner... Charlie!", { emotion: "excited" });
};
```

### Background Music with Auto-Ducking

```typescript
const { playMusic, speak } = useAudio();

// Start lobby music
useEffect(() => {
  if (phase === "lobby") {
    playMusic("lobby-theme", {
      loop: true,
      fadeIn: 1000,
    });
  }
}, [phase]);

// Music automatically ducks when speaking
speak("Welcome to the game!"); // Music volume lowers to 30%
```

## Configuration

### Environment Variables

Add to `.env.local`:

```bash
# ElevenLabs API Key (required for voice narration)
NEXT_PUBLIC_ELEVENLABS_API_KEY=your_api_key_here
```

### Voice IDs

Configure ElevenLabs voice IDs in `/lib/audio/narrator.ts`:

```typescript
const VOICE_IDS: Record<VoiceId, string> = {
  "game-host": "your_elevenlabs_voice_id",
  "dramatic-host": "another_voice_id",
  // ... etc
};
```

## Architecture

### File Structure

```
lib/
  audio/
    types.ts         # TypeScript type definitions
    sounds.ts        # Howler.js sound effects manager
    narrator.ts      # ElevenLabs TTS wrapper
  context/
    AudioContext.tsx # React Context provider
public/
  sounds/            # Audio asset files
```

### How It Works

1. **AudioProvider** wraps the app and manages global audio state
2. **sounds.ts** handles sound effects and music using Howler.js
3. **narrator.ts** handles TTS generation and playback via ElevenLabs
4. Audio settings persist to localStorage
5. Browser autoplay restrictions handled automatically

### Audio Ducking

When voice narration plays, background music automatically lowers to 30% volume and restores when speech completes.

## Browser Compatibility

- ✅ Chrome/Edge (best support)
- ✅ Firefox
- ✅ Safari (requires user interaction to unlock)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

**Note:** All browsers require user interaction before audio can play. Call `unlockAudio()` on first button click.

## Troubleshooting

### Audio not playing

1. Check if audio is unlocked: `isUnlocked` should be `true`
2. Check if muted: `muted` should be `false`
3. Verify sound files exist in `/public/sounds/`
4. Check browser console for errors

### Voice narration not working

1. Verify `NEXT_PUBLIC_ELEVENLABS_API_KEY` is set
2. Check browser console for API errors
3. Ensure you're not hitting ElevenLabs rate limits
4. Voice will fall back to console.log if API unavailable

### Music won't loop seamlessly

1. Ensure audio file has proper loop points
2. Export with fade in/out at loop boundaries
3. Use OGG format for best loop quality

## Performance Tips

1. Preload common sounds in `initializeSounds()`
2. Use audio sprites for many small sounds
3. Cache generated TTS audio (future enhancement)
4. Compress audio files for web (128kbps MP3)
5. Limit concurrent sound effects (<5 at once)

## Related Issues

- [#25](https://github.com/njgerner/localhost-party/issues/25) - Audio Infrastructure (this implementation)
- [#26](https://github.com/njgerner/localhost-party/issues/26) - Sound Effects
- [#27](https://github.com/njgerner/localhost-party/issues/27) - Game Host Voice
- [#30](https://github.com/njgerner/localhost-party/issues/30) - Character Voices
- [#31](https://github.com/njgerner/localhost-party/issues/31) - AI Commentary

## License

Audio system code is part of localhost:party project.
Sound assets must be properly licensed (see `/public/sounds/README.md`).
