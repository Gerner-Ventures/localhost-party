# Sound Effects Directory

This directory contains all sound effects and music for the game.

## 🎵 Current Status

### ✅ Implemented Features

- **Sound Effects System**: 9 different sound effects loaded on-demand
- **Narrator System**: ElevenLabs TTS with 17 voices, context-aware
- **Home Page Narrator**: Welcome message + game descriptions on hover
- **Music Playback**: Ready to play background music with ducking

### ⏳ Needs Music File

- `music/lobby-theme.mp3` - See `music/MUSIC_GENERATION_GUIDE.md`

## Directory Structure

```
sounds/
├── *.m4a           # Sound effects in M4A format (primary, 5-10KB)
├── *.mp3           # Sound effects in MP3 format (fallback, 17-33KB)
├── *.wav           # Original WAV files (can be deleted)
├── *.aiff          # Original AIFF files (can be deleted)
└── music/          # Background music tracks
    ├── .gitkeep
    └── MUSIC_GENERATION_GUIDE.md
```

## Sound Effects

All sound effects are stored in M4A (primary, optimized for web) and MP3 (fallback) formats.

### Current Sound Effects

| Sound ID           | File                   | Usage               | Size (M4A) |
| ------------------ | ---------------------- | ------------------- | ---------- |
| `button-click`     | `button-click-sys.m4a` | UI button clicks    | 4.7KB      |
| `player-join`      | `player-join.m4a`      | Player joins lobby  | 7.8KB      |
| `submit-complete`  | `submit-complete.m4a`  | Answer submitted    | 7.3KB      |
| `vote-cast`        | `vote-cast.m4a`        | Vote submitted      | 6.2KB      |
| `phase-transition` | `phase-transition.m4a` | Game phase changes  | 8.8KB      |
| `all-ready`        | `all-ready.m4a`        | Game ready to start | 6.9KB      |
| `clock-tick`       | `clock-tick.m4a`       | Countdown tick      | 6.0KB      |
| `clock-tick-fast`  | `clock-tick-fast.m4a`  | Fast countdown      | 7.1KB      |
| `time-up`          | `time-up.m4a`          | Time expired        | 7.3KB      |

**Total size:** ~62KB (M4A) vs ~154KB (MP3) - M4A saves 60% bandwidth!

## 🎙️ Narrator System

**Voice Engine:** ElevenLabs Text-to-Speech
**Available Voices:** 17 (game-host, pirate, robot, valley-girl, announcer, etc.)
**Features:**

- Sequential narration queue
- Automatic music ducking (70% when speaking)
- Context-aware game descriptions
- Emotion control (neutral, excited, dramatic, welcoming, intense)
- Speed control (0.5x - 2.0x)

**Current Usage:**

- **Home Page** (`/`): Welcome message + game hover descriptions
- **Future**: In-game announcements, results narration, etc.

See `lib/audio/narrator.ts` for implementation.

## Music Tracks

Background music tracks are stored in the `music/` subdirectory.

### Music Files

| Track ID          | File                  | Usage                | Loop | Status        |
| ----------------- | --------------------- | -------------------- | ---- | ------------- |
| `lobby-theme`     | `lobby-theme.mp3`     | Home page background | Yes  | ⏳ **Needed** |
| `victory-fanfare` | `victory-fanfare.mp3` | End game celebration | No   | ⏳ Future     |

**To add music:** See `music/MUSIC_GENERATION_GUIDE.md` for generation options.

## File Format Guidelines

### Sound Effects

- **Primary Format**: M4A (AAC codec) - Best compression
- **Fallback Format**: MP3 - Universal compatibility
- **Target Size**: 5-10KB per sound
- **Sample Rate**: 44.1kHz
- **Bit Rate**: 128kbps

### Music

- **Format**: MP3 (or M4A)
- **Target Size**: < 5MB
- **Duration**: 60-120 seconds (design for seamless looping)
- **Sample Rate**: 44.1kHz or 48kHz
- **Bit Rate**: 192kbps recommended

## 🎮 Where Sounds Are Used

### Home Page (`/`)

- **Narrator**: Welcome message on first click
- **Narrator**: Game descriptions on hover (500ms delay)
- **Narrator**: Game selection confirmation
- **Music**: `lobby-theme` (loops, 20% volume, ducks when narrator speaks)

### Lobby (`/play/lobby`)

- `player-join` - New player joins (auto-triggered)
- `all-ready` - Start game button

### Game Controller (`/play/game`)

- `submit-complete` - Submit answer button
- `vote-cast` - Vote button
- `button-click` - Next round button

### Display Screen (`/display`)

- `phase-transition` - Game phase changes
- `player-join` - Player joins (via RoomLobby component)

## Adding New Sounds

1. Create the sound file in M4A format (use ffmpeg, online converter, or audio editor)
2. Create a fallback MP3 version
3. Place both files in this directory with same base name
4. Update `lib/audio/sounds.ts`:
   ```typescript
   // Add to SOUND_PATHS
   "new-sound-id": ["/sounds/new-sound.m4a", "/sounds/new-sound.mp3"]
   ```
5. Add the sound ID to `lib/audio/types.ts`:
   ```typescript
   export type SoundEffectId =
     | "button-click"
     | "new-sound-id"  // Add here
     | ...
   ```
6. Use in components:
   ```typescript
   const { playSound } = useAudio();
   playSound("new-sound-id");
   ```

## Testing Sounds

### Test Individual Files

Visit directly in browser:

```
http://localhost:3000/sounds/button-click-sys.m4a
http://localhost:3000/sounds/music/lobby-theme.mp3
```

### Test In-App

1. **Home page narrator**: `http://localhost:3000` (click, then hover over games)
2. **Lobby sounds**: Join a room with 2+ players, click start
3. **Game sounds**: Play a round, submit answers, vote

### Check Console Logs

Look for:

```
[Audio] Loading sound: button-click
[Audio] ✅ Sound loaded: button-click
[Audio] Playing sound: button-click
[Audio] Play started, ID: 1
```

## 🧹 Cleanup Recommendations

You can safely delete these unused formats to save space:

```bash
rm public/sounds/*.wav   # ~33-48KB each, not used
rm public/sounds/*.aiff  # ~20-42KB each, not used
```

Keep only M4A and MP3 files. This will free up ~500KB+.

## Credits

- Sound effects: Generated using text-to-audio AI tools
- Narrator: ElevenLabs Text-to-Speech API
- Music: (Add your source when you add the file)

All sounds should be properly licensed for use in this project.
