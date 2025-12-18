# How to Download the Synthwave Background Music

You've selected this track:
**Synthwave Background** by Ianfirmusic
https://pixabay.com/music/synthwave-synthwave-background-403311/

## Quick Download (30 seconds)

1. **Open the link**: https://pixabay.com/music/synthwave-synthwave-background-403311/

2. **Click the green "Download" button** on the right side

3. **The file will download** as something like `synthwave-background-403311.mp3`

4. **Rename the file** to `lobby-theme.mp3`

5. **Move it to this folder**: `public/sounds/music/lobby-theme.mp3`

6. **Refresh your browser** - music should play!

---

## Alternative: Drag and Drop

If you have the file downloaded:

```bash
# From your Downloads folder
mv ~/Downloads/synthwave-background-403311.mp3 public/sounds/music/lobby-theme.mp3
```

Then refresh the page!

---

## What Should Happen

After adding the file:

1. **Refresh** http://localhost:3000
2. **Click anywhere** on the page
3. **HEAR**:
   - 🔊 AI narrator: "Welcome to localhost party..."
   - 🎵 Background music fades in (2 seconds)
4. **Hover over a game**:
   - 🔊 Narrator describes the game
   - 🎵 Music ducks to 30% volume (quieter)
5. **Move mouse away**:
   - 🎵 Music returns to 20% volume
6. **Click a game**:
   - 🔊 Narrator: "[Game] selected. Get ready to party!"
   - 🎵 Music fades out (1 second)

---

## File Details

- **Track**: Synthwave Background
- **Artist**: Ianfirmusic
- **License**: Pixabay License (free for commercial use, no attribution required)
- **Duration**: ~2:30 (loops seamlessly)
- **Size**: ~2-3 MB
- **Format**: MP3

---

## Troubleshooting

**Music doesn't play after adding file?**

1. Check filename: `ls public/sounds/music/lobby-theme.mp3`
2. Check file size: `ls -lh public/sounds/music/lobby-theme.mp3` (should be > 1MB)
3. Test direct access: http://localhost:3000/sounds/music/lobby-theme.mp3
4. Check console for errors

**Music plays but narrator doesn't work?**

- Make sure ElevenLabs API key is in `.env.local`
- Restart dev server: `npm run dev`
- Check console for `ElevenLabs API key configured for narrator`

---

## Quick Test

After adding the file, test in browser console:

```javascript
// Should return the file
fetch("/sounds/music/lobby-theme.mp3").then((r) =>
  console.log("Size:", r.headers.get("content-length"))
);
```

---

You're one download away from the complete experience! 🎵🎙️
