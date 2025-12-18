#!/bin/bash
# Script to prepare all files for PR

echo "🎵 Preparing Audio System PR..."
echo ""

# Navigate to project root
cd "$(dirname "$0")/.."

echo "📊 Checking file sizes..."
echo "Sound effects (M4A):"
du -sh public/sounds/*.m4a 2>/dev/null | awk '{sum+=$1} END {print "Total:", sum, "KB"}'

echo ""
echo "Music files:"
ls -lh public/sounds/music/*.mp3 2>/dev/null | awk '{print $5, $9}' || echo "No music files found"

echo ""
echo "📝 Files to be added:"
echo ""

# Show what will be staged
git status --short

echo ""
echo "🔍 Running TypeScript check..."
npm run type-check

if [ $? -eq 0 ]; then
    echo "✅ TypeScript check passed!"
else
    echo "❌ TypeScript errors found. Please fix before committing."
    exit 1
fi

echo ""
echo "📦 Ready to stage files? (y/n)"
read -r response

if [[ "$response" =~ ^[Yy]$ ]]; then
    echo ""
    echo "Adding files..."

    # Add core code changes
    git add app/page.tsx
    git add app/layout.tsx
    git add app/\(display\)/display/page.tsx
    git add app/api/config/
    git add lib/audio/narrator.ts
    git add lib/audio/sounds.ts
    git add lib/context/AudioContext.tsx

    # Add sound files
    git add public/sounds/*.m4a
    git add public/sounds/*.mp3
    git add public/sounds/README.md

    # Add music if exists
    if [ -f "public/sounds/music/lobby-theme.mp3" ]; then
        git add public/sounds/music/lobby-theme.mp3
        echo "✅ Added lobby-theme.mp3"
    else
        echo "⚠️  No lobby-theme.mp3 found (skipping)"
    fi

    # Add music guide
    git add public/sounds/music/MUSIC_GENERATION_GUIDE.md

    # Add documentation (optional)
    echo ""
    echo "Add documentation files? (y/n)"
    read -r doc_response

    if [[ "$doc_response" =~ ^[Yy]$ ]]; then
        git add HOME_PAGE_AUDIO_IMPLEMENTATION.md
        git add TESTING_GUIDE.md
        git add DEPLOYMENT_CHECKLIST.md
        git add SOUND_SWITCH_SUMMARY.md
        git add QUICK_FIX_SUMMARY.md
        echo "✅ Added documentation files"
    fi

    echo ""
    echo "📊 Staged files:"
    git status --short

    echo ""
    echo "✅ Files staged! Ready to commit."
    echo ""
    echo "Suggested commit message:"
    echo "───────────────────────────────────────────"
    cat << 'EOF'
feat: add narrator, background music, and sound effects

- Add AI narrator with ElevenLabs integration on home page
- Implement context-aware game descriptions on hover
- Add background music that continues from home → display lobby
- Music ducks when narrator speaks (20% → 6%)
- Switch to generated sound effects (vs system sounds)
- Music stops when game starts
- Add proper error handling and fallbacks
- Fix hydration errors
- Update to eleven_turbo_v2_5 model for free tier

Sound files: 9 effects (M4A + MP3 fallback, ~62KB)
Music: lobby-theme.mp3 (synthwave, ~2.5MB)
Voice: ElevenLabs TTS with 17 voices available
EOF
    echo "───────────────────────────────────────────"
    echo ""
    echo "Run this to commit:"
    echo "git commit -F- << 'EOF'"
    echo "[paste commit message above]"
    echo "EOF"
else
    echo "Cancelled."
    exit 0
fi
