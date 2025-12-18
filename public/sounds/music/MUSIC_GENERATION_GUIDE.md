# Background Music Generation Guide

## Current Status

✅ **Home page narrator is now active** with context-aware game descriptions
❌ **Background music file needed**: `lobby-theme.mp3`

## Options for Generating Background Music

### Option 1: ElevenLabs Music API (Recommended - Already Integrated)

The ElevenLabs SDK in your project includes a music generation API.

**Pros:**

- Already integrated with your codebase
- Same API key as narrator
- AI-generated, royalty-free
- Customizable with prompts

**How to use:**

```typescript
import { ElevenLabsClient } from "elevenlabs";

const client = new ElevenLabsClient({
  apiKey: process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY,
});

const music = await client.music.compose({
  text: "Upbeat retro synthwave arcade lobby music with neon vibes, 80s nostalgia, energetic but not overwhelming, loopable",
  duration: 120, // 2 minutes
  model: "eleven_monolingual_v1",
});

// Save the audio blob to public/sounds/music/lobby-theme.mp3
```

**Prompt suggestions for lobby music:**

- "Retro synthwave arcade lobby music, upbeat 80s electronic, neon aesthetic, loopable background track"
- "Chill arcade waiting room music, nostalgic 8-bit vibes mixed with modern synth, relaxing but exciting"
- "Cyberpunk arcade lobby ambience, futuristic synth pads, retro game sounds, energetic but subtle"

**Cost:** Check ElevenLabs pricing - typically $0.18/minute of generated audio

---

### Option 2: Suno AI (High Quality AI Music)

[suno.ai](https://suno.ai) - Specialized AI music generation platform

**Pros:**

- Very high quality AI music
- Specific genre/style control
- Can generate loopable tracks
- Free tier available

**How to use:**

1. Go to suno.ai
2. Create account (free tier: 50 credits/month = ~10 songs)
3. Prompt: "80s synthwave arcade lobby music, retro futuristic, neon vibes, loopable, instrumental, upbeat"
4. Download MP3 and place in `public/sounds/music/lobby-theme.mp3`

**Cost:** Free tier available, Pro: $10/month

---

### Option 3: Royalty-Free Music Libraries

Use existing royalty-free music

**Sources:**

- [Pixabay Music](https://pixabay.com/music/) - Free, no attribution
- [Uppbeat](https://uppbeat.io/) - Free with attribution
- [Free Music Archive](https://freemusicarchive.org/) - Various licenses
- [Incompetech](https://incompetech.com/) - Free with attribution

**Search terms:**

- "Synthwave lobby music"
- "Retro arcade background"
- "80s electronic instrumental"
- "Cyberpunk ambience"

**Pros:**

- Instant, no generation needed
- Professional quality
- Free options available

**Cons:**

- May not perfectly match your aesthetic
- Potential attribution requirements

---

### Option 4: Commission Custom Music

Hire a composer or producer

**Platforms:**

- Fiverr - $20-100 for short loop
- Upwork - $100-500 for custom track
- Soundbetter - Professional music producers

**Pros:**

- Perfect fit for your brand
- Full ownership
- Professional quality

**Cons:**

- More expensive
- Takes time (3-7 days typical)

---

### Option 5: Create Your Own (GarageBand/FL Studio/Ableton)

Use music production software

**Free options:**

- GarageBand (Mac) - Has synth presets perfect for retro arcade
- LMMS (Free, cross-platform)
- Audacity (Basic audio editing)

**Paid options:**

- FL Studio ($99-$499)
- Ableton Live ($99-$749)
- Logic Pro ($200)

**Tutorial approach:**

1. Use synth presets (look for "80s", "retro", "arcade", "synthwave")
2. Create simple chord progression (C-Am-F-G works great)
3. Add arpeggios and leads
4. Export as MP3, ensure it loops seamlessly

---

## Quick Start Recommendation

**Fastest path (< 5 minutes):**

1. Visit [Pixabay Music](https://pixabay.com/music/search/synthwave%20arcade/)
2. Download a suitable track (100% free, no attribution needed)
3. Rename to `lobby-theme.mp3`
4. Place in this directory

**Best quality for budget:**

1. Use Suno AI free tier
2. Generate with prompt: "80s retro synthwave arcade lobby music, instrumental, upbeat but chill, neon vibes, loopable"
3. Download and use

**Most integrated (uses existing stack):**

1. Create a script using ElevenLabs music API
2. Generate music programmatically
3. Saves directly to project

---

## File Requirements

**Format:** MP3 (preferred) or M4A
**Duration:** 60-120 seconds (will loop)
**File size:** < 5MB recommended
**Sample rate:** 44.1kHz or 48kHz
**Bit rate:** 128kbps minimum, 192kbps recommended

**Looping:** Ensure the track loops smoothly (fade in/out at ends or design for seamless loop)

---

## Once You Have the Music

Place the file here:

```
/public/sounds/music/lobby-theme.mp3
```

The home page will automatically start playing it after the user's first click!

---

## Testing

After adding the music file:

1. Open `http://localhost:3000`
2. Click anywhere on the page
3. Should hear:
   - Voice: "Welcome to localhost party..."
   - Background music fading in
4. Hover over a game card (wait 500ms)
   - Voice describes the game
   - Music volume drops 70% (ducking)
5. Click a game
   - Voice: "[Game name] selected. Get ready to party!"
   - Music fades out over 1 second
