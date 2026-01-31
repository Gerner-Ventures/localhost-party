import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { chipSterling } from "@/lib/agents/personas/host";

// Rate limiting - simple in-memory store
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // requests per minute
const RATE_WINDOW_MS = 60000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now > record.resetAt) {
    // Expired or new entry — reset cleans up stale data inline
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  if (record.count >= RATE_LIMIT) {
    return true;
  }

  record.count++;
  return false;
}

// Singleton Anthropic client (created once at module scope)
const anthropicApiKey = process.env.LH_PARTY_ANTHROPIC_API_KEY;
const anthropicClient = anthropicApiKey
  ? new Anthropic({ apiKey: anthropicApiKey })
  : null;

type NarrationType = "welcome" | "game-hover" | "game-select";

interface NarrateRequest {
  type: NarrationType;
  gameId?: string;
  gameName?: string;
  gameDescription?: string;
}

// Sanitize user input to prevent prompt injection
function sanitizeInput(input: string | undefined): string {
  if (!input) return "";
  return input
    .replace(/[<>]/g, "") // Remove HTML brackets
    .replace(/[\r\n]+/g, " ") // Replace newlines with spaces
    .trim()
    .slice(0, 200); // Limit length
}

const prompts: Record<NarrationType, (req: NarrateRequest) => string> = {
  welcome: () =>
    "Greet visitors to localhost:party, the ultimate AI-powered party game arcade. Make them excited to pick a game and start playing!",
  "game-hover": (req) => {
    const gameName = sanitizeInput(req.gameName);
    const gameDescription = sanitizeInput(req.gameDescription);
    return `Briefly describe the game "${gameName}" in an exciting way. The game is about: ${gameDescription}. Make it sound fun in one short sentence!`;
  },
  "game-select": (req) => {
    const gameName = sanitizeInput(req.gameName);
    return `The player just selected "${gameName}"! Give a quick, excited send-off as they're about to start playing.`;
  },
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

  if (!anthropicClient) {
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

    const userPrompt = prompts[body.type](body);

    const response = await anthropicClient.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 100,
      temperature: 0.8,
      system: chipSterling.personality,
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
