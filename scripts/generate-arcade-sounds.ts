#!/usr/bin/env tsx
/**
 * Generate arcade-style sound effects as WAV files using pure Node.js.
 * No external dependencies (sox, ffmpeg) needed.
 *
 * Run with: npx tsx scripts/generate-arcade-sounds.ts
 */

import fs from "fs";
import path from "path";

const SAMPLE_RATE = 44100;
const outputDir = path.join(process.cwd(), "public", "sounds");

/** Generate a sine wave tone */
function sineWave(
  frequency: number,
  duration: number,
  volume: number = 0.5,
  sampleRate: number = SAMPLE_RATE
): number[] {
  const samples = Math.floor(sampleRate * duration);
  const result: number[] = [];
  for (let i = 0; i < samples; i++) {
    result.push(Math.sin(2 * Math.PI * frequency * (i / sampleRate)) * volume);
  }
  return result;
}

/** Apply fade in/out to avoid clicks */
function applyEnvelope(
  samples: number[],
  fadeInMs: number,
  fadeOutMs: number
): number[] {
  const fadeInSamples = Math.floor((fadeInMs / 1000) * SAMPLE_RATE);
  const fadeOutSamples = Math.floor((fadeOutMs / 1000) * SAMPLE_RATE);
  return samples.map((s, i) => {
    let gain = 1;
    if (i < fadeInSamples) gain = i / fadeInSamples;
    if (i > samples.length - fadeOutSamples)
      gain = (samples.length - i) / fadeOutSamples;
    return s * gain;
  });
}

/** Mix multiple sample arrays together */
function mix(...arrays: number[][]): number[] {
  const maxLen = Math.max(...arrays.map((a) => a.length));
  const result: number[] = new Array(maxLen).fill(0);
  for (const arr of arrays) {
    for (let i = 0; i < arr.length; i++) {
      result[i] += arr[i];
    }
  }
  // Normalize to prevent clipping
  const peak = Math.max(...result.map(Math.abs));
  if (peak > 0.95) {
    const scale = 0.95 / peak;
    for (let i = 0; i < result.length; i++) result[i] *= scale;
  }
  return result;
}

/** Concatenate sample arrays with optional gap */
function concat(...parts: { samples: number[]; gapMs?: number }[]): number[] {
  const result: number[] = [];
  for (const part of parts) {
    result.push(...part.samples);
    if (part.gapMs) {
      result.push(
        ...new Array(Math.floor((part.gapMs / 1000) * SAMPLE_RATE)).fill(0)
      );
    }
  }
  return result;
}

/** Frequency sweep (rising or falling) */
function sweep(
  startFreq: number,
  endFreq: number,
  duration: number,
  volume: number = 0.4
): number[] {
  const samples = Math.floor(SAMPLE_RATE * duration);
  const result: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t = i / samples;
    const freq = startFreq + (endFreq - startFreq) * t;
    result.push(Math.sin(2 * Math.PI * freq * (i / SAMPLE_RATE)) * volume);
  }
  return result;
}

/** Write samples as 16-bit PCM WAV */
function writeWav(filePath: string, samples: number[]): void {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = SAMPLE_RATE * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * (bitsPerSample / 8);
  const fileSize = 36 + dataSize;

  const buffer = Buffer.alloc(44 + dataSize);
  let offset = 0;

  // RIFF header
  buffer.write("RIFF", offset);
  offset += 4;
  buffer.writeUInt32LE(fileSize, offset);
  offset += 4;
  buffer.write("WAVE", offset);
  offset += 4;

  // fmt chunk
  buffer.write("fmt ", offset);
  offset += 4;
  buffer.writeUInt32LE(16, offset);
  offset += 4; // chunk size
  buffer.writeUInt16LE(1, offset);
  offset += 2; // PCM format
  buffer.writeUInt16LE(numChannels, offset);
  offset += 2;
  buffer.writeUInt32LE(SAMPLE_RATE, offset);
  offset += 4;
  buffer.writeUInt32LE(byteRate, offset);
  offset += 4;
  buffer.writeUInt16LE(blockAlign, offset);
  offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset);
  offset += 2;

  // data chunk
  buffer.write("data", offset);
  offset += 4;
  buffer.writeUInt32LE(dataSize, offset);
  offset += 4;

  // Write samples
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    const int16 = Math.floor(clamped * 32767);
    buffer.writeInt16LE(int16, offset);
    offset += 2;
  }

  fs.writeFileSync(filePath, buffer);
}

// Sound effect generators
const soundGenerators: Record<string, () => number[]> = {
  "button-click": () => {
    // Short crisp click - high freq blip
    const tone = sineWave(2200, 0.04, 0.6);
    return applyEnvelope(tone, 2, 15);
  },

  "player-join": () => {
    // Rising two-tone chime
    const tone1 = applyEnvelope(sineWave(523, 0.12, 0.5), 5, 30); // C5
    const tone2 = applyEnvelope(sineWave(784, 0.18, 0.5), 5, 50); // G5
    return concat({ samples: tone1, gapMs: 30 }, { samples: tone2 });
  },

  "submit-complete": () => {
    // Three-note success chime (C-E-G)
    const t1 = applyEnvelope(sineWave(523, 0.1, 0.45), 5, 25); // C5
    const t2 = applyEnvelope(sineWave(659, 0.1, 0.45), 5, 25); // E5
    const t3 = applyEnvelope(sineWave(784, 0.2, 0.5), 5, 60); // G5
    return concat(
      { samples: t1, gapMs: 20 },
      { samples: t2, gapMs: 20 },
      { samples: t3 }
    );
  },

  "vote-cast": () => {
    // Quick confirmation blip
    const tone = sineWave(1100, 0.06, 0.4);
    return applyEnvelope(tone, 3, 20);
  },

  "phase-transition": () => {
    // Rising sweep with harmonics
    const s = sweep(300, 1200, 0.35, 0.4);
    const harmonic = sweep(600, 2400, 0.35, 0.15);
    return applyEnvelope(mix(s, harmonic), 10, 80);
  },

  "all-ready": () => {
    // Ascending fanfare (C-E-G-C)
    const t1 = applyEnvelope(sineWave(523, 0.1, 0.4), 5, 20);
    const t2 = applyEnvelope(sineWave(659, 0.1, 0.4), 5, 20);
    const t3 = applyEnvelope(sineWave(784, 0.1, 0.4), 5, 20);
    const t4 = applyEnvelope(sineWave(1047, 0.3, 0.5), 5, 80);
    return concat(
      { samples: t1, gapMs: 15 },
      { samples: t2, gapMs: 15 },
      { samples: t3, gapMs: 15 },
      { samples: t4 }
    );
  },

  "clock-tick": () => {
    // Subtle tick
    const tone = sineWave(800, 0.025, 0.3);
    return applyEnvelope(tone, 1, 10);
  },

  "clock-tick-fast": () => {
    // Higher, sharper tick
    const tone = sineWave(1000, 0.02, 0.35);
    return applyEnvelope(tone, 1, 8);
  },

  "time-up": () => {
    // Descending two-tone buzzer
    const t1 = applyEnvelope(sineWave(880, 0.2, 0.5), 5, 30);
    const t2 = applyEnvelope(sineWave(440, 0.35, 0.5), 5, 100);
    return concat({ samples: t1, gapMs: 30 }, { samples: t2 });
  },
};

async function main() {
  console.log("Generating arcade sound effects\n");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const [id, generate] of Object.entries(soundGenerators)) {
    const samples = generate();
    const wavPath = path.join(outputDir, `${id}.wav`);
    writeWav(wavPath, samples);

    const duration = (samples.length / SAMPLE_RATE).toFixed(2);
    console.log(`  ${id}.wav (${duration}s)`);
  }

  console.log(
    `\nGenerated ${Object.keys(soundGenerators).length} sound effects`
  );
  console.log("Restart the dev server to hear them.");
}

main().catch(console.error);
