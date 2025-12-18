#!/usr/bin/env tsx
/**
 * Download free sound effects from freesound.org
 * These are Creative Commons licensed sounds
 */

import fs from "fs";
import path from "path";

// Using direct links to royalty-free sounds from various sources
// These are placeholder URLs - we'll use simple web audio generated sounds instead

const outputDir = path.join(process.cwd(), "public", "sounds");

// Simple beep generator using Web Audio API concepts
// We'll create minimal valid MP3 files using a different approach

async function downloadSound(url: string, filename: string) {
  try {
    console.log(`📥 Downloading: ${filename}`);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const outputPath = path.join(outputDir, filename);
    fs.writeFileSync(outputPath, buffer);

    console.log(`   ✅ Saved: ${filename}`);
    return true;
  } catch (error) {
    console.error(`   ❌ Failed: ${filename}`, error);
    return false;
  }
}

// Using Pixabay's royalty-free sound effects (no attribution required)
const sounds = [
  {
    url: "https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3",
    file: "button-click.mp3",
  },
  {
    url: "https://cdn.pixabay.com/download/audio/2022/03/10/audio_2c87ba0588.mp3",
    file: "player-join.mp3",
  },
  {
    url: "https://cdn.pixabay.com/download/audio/2021/08/04/audio_12b0c7443c.mp3",
    file: "submit-complete.mp3",
  },
  {
    url: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_7e1b221ece.mp3",
    file: "vote-cast.mp3",
  },
  {
    url: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3",
    file: "phase-transition.mp3",
  },
  {
    url: "https://cdn.pixabay.com/download/audio/2021/08/09/audio_49755dba0f.mp3",
    file: "all-ready.mp3",
  },
  {
    url: "https://cdn.pixabay.com/download/audio/2022/03/24/audio_c08836200f.mp3",
    file: "clock-tick.mp3",
  },
  {
    url: "https://cdn.pixabay.com/download/audio/2022/03/24/audio_3dae88c7c0.mp3",
    file: "clock-tick-fast.mp3",
  },
  {
    url: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_4abbbc0ca3.mp3",
    file: "time-up.mp3",
  },
];

async function main() {
  console.log("🎮 Downloading royalty-free sound effects\n");

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let successCount = 0;

  for (const sound of sounds) {
    const success = await downloadSound(sound.url, sound.file);
    if (success) successCount++;

    // Small delay between downloads
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log("\n═══════════════════════════════════════════");
  console.log(
    `✅ Successfully downloaded: ${successCount}/${sounds.length} sounds`
  );
  console.log("═══════════════════════════════════════════");

  if (successCount === sounds.length) {
    console.log("\n🎉 All sound effects ready!");
    console.log("Refresh your browser to hear them.");
  }
}

main().catch(console.error);
