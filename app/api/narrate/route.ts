import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Rate limiting - simple in-memory store
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // requests per minute
const RATE_WINDOW_MS = 60000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now > record.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  if (record.count >= RATE_LIMIT) {
    return true;
  }

  record.count++;
  return false;
}

// Chip Sterling's personality for consistent voice
const CHIP_STERLING_SYSTEM = `You are Chip Sterling, the enthusiastic host of localhost:party, a hilarious AI-powered party game arcade.

PERSONALITY:
- Warm, welcoming, and genuinely excited
- Classic game show host energy - think a friendlier version of retro TV hosts
- Encouraging without being cheesy, witty without being mean
- You make everyone feel like they're about to have an amazing time

SPEAKING STYLE:
- Short, punchy sentences that work well when spoken aloud
- Use dramatic pauses (indicated by "...")
- Keep it brief - 1-2 sentences max
- Never use emojis or special characters
- Sound natural and conversational

RULES:
- Never break character or acknowledge being an AI
- Never use technical jargon
- Be exciting but authentic, not over-the-top fake`;

type NarrationType = "welcome" | "game-hover" | "game-select";

interface NarrateRequest {
  type: NarrationType;
  gameId?: string;
  gameName?: string;
  gameDescription?: string;
}

const prompts: Record<NarrationType, (req: NarrateRequest) => string> = {
  welcome: () =>
    "Greet visitors to localhost:party, the ultimate AI-powered party game arcade. Make them excited to pick a game and start playing!",
  "game-hover": (req) =>
    `Briefly describe the game "${req.gameName}" in an exciting way. The game is about: ${req.gameDescription}. Make it sound fun in one short sentence!`,
  "game-select": (req) =>
    `The player just selected "${req.gameName}"! Give a quick, excited send-off as they're about to start playing.`,
};

export async function POST(request: NextRequest) {
  // Get client IP for rate limiting
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429 }
    );
  }

  // Check for API key
  const apiKey = process.env.LH_PARTY_ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI narration not configured" },
      { status: 503 }
    );
  }

  try {
    const body: NarrateRequest = await request.json();

    if (!body.type || !prompts[body.type]) {
      return NextResponse.json(
        { error: "Invalid narration type" },
        { status: 400 }
      );
    }

    const anthropic = new Anthropic({ apiKey });
    const userPrompt = prompts[body.type](body);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 100,
      temperature: 0.8,
      system: CHIP_STERLING_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : null;

    if (!text) {
      return NextResponse.json(
        { error: "Failed to generate narration" },
        { status: 500 }
      );
    }

    // Clean up response
    const cleanedText = text.replace(/^["']|["']$/g, "").trim();

    return NextResponse.json({ text: cleanedText });
  } catch (error) {
    console.error("[Narrate API] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate narration" },
      { status: 500 }
    );
  }
}
