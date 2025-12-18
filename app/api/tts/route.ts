import { NextRequest, NextResponse } from "next/server";

const ELEVENLABS_API_KEY = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;

// Rate limiting store (in-memory, resets on server restart)
// In production, use Redis or similar persistent store
const rateLimitStore = new Map<string, number[]>();

const MAX_REQUESTS_PER_MINUTE = 10;
const MAX_TEXT_LENGTH = 1000;

/**
 * Server-side proxy for ElevenLabs TTS API
 * Keeps API key secure on the server
 */
export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";

    // Check rate limit
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Get existing timestamps for this IP
    let timestamps = rateLimitStore.get(clientIp) || [];

    // Remove old timestamps
    timestamps = timestamps.filter((ts) => ts > oneMinuteAgo);

    // Check if rate limit exceeded
    if (timestamps.length >= MAX_REQUESTS_PER_MINUTE) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: `Maximum ${MAX_REQUESTS_PER_MINUTE} requests per minute`,
        },
        { status: 429 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { text, voiceId, emotion } = body;

    // Validate input
    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Invalid input", message: "Text is required" },
        { status: 400 }
      );
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        {
          error: "Text too long",
          message: `Maximum ${MAX_TEXT_LENGTH} characters allowed`,
        },
        { status: 400 }
      );
    }

    if (!voiceId || typeof voiceId !== "string") {
      return NextResponse.json(
        { error: "Invalid input", message: "Voice ID is required" },
        { status: 400 }
      );
    }

    // Check API key
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json(
        {
          error: "Server configuration error",
          message: "API key not configured",
        },
        { status: 500 }
      );
    }

    // Record this request
    timestamps.push(now);
    rateLimitStore.set(clientIp, timestamps);

    // Voice settings based on emotion
    const stability = emotion === "excited" ? 0.3 : 0.5;
    const similarityBoost = 0.75;

    // Call ElevenLabs API
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
            style: emotion === "dramatic" ? 0.5 : 0,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      // Don't expose detailed API errors to client
      return NextResponse.json(
        { error: "TTS service error", message: "Failed to generate speech" },
        { status: response.status }
      );
    }

    // Stream the audio response
    const audioBlob = await response.blob();

    return new NextResponse(audioBlob, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error("[TTS API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: "Failed to process request" },
      { status: 500 }
    );
  }
}
