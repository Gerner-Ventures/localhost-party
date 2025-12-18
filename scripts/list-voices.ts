#!/usr/bin/env tsx
/**
 * List available ElevenLabs voices
 * Run with: npx tsx scripts/list-voices.ts
 */

const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;

if (!apiKey) {
  console.error("❌ NEXT_PUBLIC_ELEVENLABS_API_KEY not found in environment");
  process.exit(1);
}

async function listVoices() {
  try {
    console.log("🎤 Fetching available ElevenLabs voices...\n");

    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: {
        "xi-api-key": apiKey!,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      voices: Array<{
        name: string;
        voice_id: string;
        category?: string;
        labels?: Record<string, string>;
        description?: string;
      }>;
    };
    const voices = data.voices;

    console.log(`Found ${voices.length} voices:\n`);
    console.log("═══════════════════════════════════════════");

    voices.forEach((voice) => {
      console.log(`\n📢 ${voice.name}`);
      console.log(`   ID: ${voice.voice_id}`);
      console.log(`   Category: ${voice.category || "N/A"}`);
      console.log(
        `   Labels: ${Object.entries(voice.labels || {})
          .map(([k, v]) => `${k}:${v}`)
          .join(", ")}`
      );
      if (voice.description) {
        console.log(`   Description: ${voice.description}`);
      }
    });

    console.log("\n═══════════════════════════════════════════");
    console.log(`\nTotal: ${voices.length} voices available`);
  } catch (error: unknown) {
    console.error(
      "❌ Error fetching voices:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

listVoices();
