#!/bin/bash
# Create simple test beep sounds using macOS say command and afplay
# These are just placeholders to test the sound system

mkdir -p public/sounds

# Use macOS `say` command to create simple audio files
say -v "Samantha" -o public/sounds/button-click.aiff "beep" --data-format=LEI16@22050
say -v "Samantha" -o public/sounds/player-join.aiff "player joined" --data-format=LEI16@22050
say -v "Samantha" -o public/sounds/submit-complete.aiff "submitted" --data-format=LEI16@22050
say -v "Samantha" -o public/sounds/vote-cast.aiff "vote" --data-format=LEI16@22050
say -v "Samantha" -o public/sounds/phase-transition.aiff "next phase" --data-format=LEI16@22050
say -v "Samantha" -o public/sounds/all-ready.aiff "ready" --data-format=LEI16@22050
say -v "Samantha" -o public/sounds/clock-tick.aiff "tick" --data-format=LEI16@22050
say -v "Samantha" -o public/sounds/clock-tick-fast.aiff "tick tick" --data-format=LEI16@22050
say -v "Samantha" -o public/sounds/time-up.aiff "times up" --data-format=LEI16@22050

echo "✅ Created 9 test sound files"
echo "These are simple voice placeholders - replace with better sounds later"
