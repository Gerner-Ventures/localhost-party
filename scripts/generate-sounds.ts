#!/usr/bin/env tsx
/**
 * Generate sound effects using ElevenLabs Sound Effects API
 * Run with: npx tsx scripts/generate-sounds.ts
 */

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import fs from "fs";
import path from "path";

const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;

if (!apiKey) {
  console.error("❌ NEXT_PUBLIC_ELEVENLABS_API_KEY not found in environment");
  process.exit(1);
}

const client = new ElevenLabsClient({ apiKey });

// Sound effect definitions with prompts for ElevenLabs
const soundEffects = [
  {
    id: "button-click",
    prompt:
      "Retro arcade button click, short crisp digital beep, satisfying UI feedback sound",
    duration: 0.5,
  },
  {
    id: "player-join",
    prompt:
      "Upbeat arcade chime when player joins, bright digital notification sound with positive energy",
    duration: 1.0,
  },
  {
    id: "submit-complete",
    prompt:
      "Satisfying completion sound, arcade-style success chime, bright and rewarding feedback tone",
    duration: 1.2,
  },
  {
    id: "vote-cast",
    prompt:
      "Quick confirmation blip, arcade voting feedback sound, subtle digital acknowledgment",
    duration: 0.6,
  },
  {
    id: "phase-transition",
    prompt:
      "Dramatic game phase transition sound, arcade whoosh with rising digital tones, exciting progression",
    duration: 1.5,
  },
  {
    id: "all-ready",
    prompt:
      "Triumphant ready-up sound, arcade-style fanfare when all players ready, energetic and exciting",
    duration: 1.5,
  },
  {
    id: "clock-tick",
    prompt:
      "Subtle arcade timer tick, gentle digital metronome sound, calm countdown pulse",
    duration: 0.3,
  },
  {
    id: "clock-tick-fast",
    prompt:
      "Urgent arcade timer tick, faster digital metronome with slight tension, quickening countdown",
    duration: 0.2,
  },
  {
    id: "time-up",
    prompt:
      "Dramatic time's up alarm, arcade buzzer with urgency, attention-grabbing end-of-time signal",
    duration: 1.5,
  },
];

const outputDir = path.join(process.cwd(), "public", "sounds");

async function generateSoundEffect(
  soundId: string,
  prompt: string,
  duration: number
) {
  try {
    console.log(`🎵 Generating: ${soundId}`);
    console.log(`   Prompt: ${prompt}`);

    // Generate sound effect using ElevenLabs in PCM WAV format (better browser compatibility)
    const response = await client.textToSoundEffects.convert({
      text: prompt,
      durationSeconds: duration,
      promptInfluence: 0.5, // Balance between prompt and quality
      outputFormat: "pcm_44100", // PCM WAV format - universally compatible
    });

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save the audio file as WAV
    const outputPath = path.join(outputDir, `${soundId}.wav`);
    const chunks: Uint8Array[] = [];

    // Handle response as async iterable
    const reader = response.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }

    const audioBuffer = Buffer.concat(chunks);
    fs.writeFileSync(outputPath, audioBuffer);

    console.log(`   ✅ Saved to: ${outputPath}`);
    console.log("");

    return true;
  } catch (error) {
    console.error(`   ❌ Error generating ${soundId}:`, error);
    return false;
  }
}

async function main() {
  console.log("🎮 Generating arcade-style sound effects with ElevenLabs\n");
  console.log(`Output directory: ${outputDir}\n`);

  let successCount = 0;
  let failCount = 0;

  for (const sound of soundEffects) {
    const success = await generateSoundEffect(
      sound.id,
      sound.prompt,
      sound.duration
    );

    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // Add a small delay between requests to be nice to the API
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log("═══════════════════════════════════════════");
  console.log(`✅ Successfully generated: ${successCount} sounds`);
  if (failCount > 0) {
    console.log(`❌ Failed: ${failCount} sounds`);
  }
  console.log("═══════════════════════════════════════════");

  if (successCount === soundEffects.length) {
    console.log("\n🎉 All sound effects generated successfully!");
    console.log("Refresh your browser to hear them in action.");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
