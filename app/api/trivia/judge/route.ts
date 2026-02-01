import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  JudgeAnswerRequest,
  JudgeAnswerResponse,
} from "@/lib/types/pixel-showdown";

// Rate limiting
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 50; // Higher limit for judging (happens frequently)
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

// Singleton Anthropic client
const anthropicApiKey = process.env.LH_PARTY_ANTHROPIC_API_KEY;
const anthropicClient = anthropicApiKey
  ? new Anthropic({ apiKey: anthropicApiKey })
  : null;

const SYSTEM_PROMPT = `You are a trivia answer judge for a party game. Your job is to determine if a player's answer is correct.

Be lenient and fair:
- Accept minor spelling errors (e.g., "Einsten" for "Einstein")
- Accept common nicknames or abbreviations (e.g., "NYC" for "New York City")
- Accept partial answers if they contain the key information
- Accept answers with extra words if the core answer is correct
- Be case-insensitive

Always respond with valid JSON only, no additional text.`;

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
      { error: "AI service not configured" },
      { status: 503 }
    );
  }

  try {
    const body: JudgeAnswerRequest = await request.json();

    if (!body.questionText || !body.correctAnswer || !body.playerAnswer) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Quick check: exact match (case-insensitive)
    const normalizedCorrect = body.correctAnswer.toLowerCase().trim();
    const normalizedPlayer = body.playerAnswer.toLowerCase().trim();

    if (normalizedCorrect === normalizedPlayer) {
      return NextResponse.json({
        isCorrect: true,
        confidence: 1.0,
        explanation: "Exact match",
      } satisfies JudgeAnswerResponse);
    }

    // Check acceptable answers
    if (body.acceptableAnswers?.length) {
      for (const acceptable of body.acceptableAnswers) {
        if (acceptable.toLowerCase().trim() === normalizedPlayer) {
          return NextResponse.json({
            isCorrect: true,
            confidence: 1.0,
            explanation: "Matched acceptable answer",
          } satisfies JudgeAnswerResponse);
        }
      }
    }

    // Use AI for fuzzy matching
    const userPrompt = `Question: "${body.questionText}"
Correct Answer: "${body.correctAnswer}"
${body.acceptableAnswers?.length ? `Also acceptable: ${body.acceptableAnswers.join(", ")}` : ""}

Player's Answer: "${body.playerAnswer}"

Is the player's answer correct? Consider spelling errors, partial matches, and common variations.

Respond with JSON only:
{
  "isCorrect": true/false,
  "confidence": 0.0-1.0,
  "explanation": "brief reason"
}`;

    const response = await anthropicClient.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 150,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const responseText =
      response.content[0]?.type === "text" ? response.content[0].text : null;

    if (!responseText) {
      // Fallback to strict matching
      return NextResponse.json({
        isCorrect: false,
        confidence: 0.5,
        explanation: "Could not evaluate answer",
      } satisfies JudgeAnswerResponse);
    }

    // Parse response
    let result: JudgeAnswerResponse;
    try {
      result = JSON.parse(responseText);
    } catch {
      // Try to extract JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        return NextResponse.json({
          isCorrect: false,
          confidence: 0.5,
          explanation: "Could not parse evaluation",
        } satisfies JudgeAnswerResponse);
      }
    }

    return NextResponse.json({
      isCorrect: Boolean(result.isCorrect),
      confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
      explanation: result.explanation,
    } satisfies JudgeAnswerResponse);
  } catch (error) {
    console.error("[Trivia Judge API] Error:", error);
    return NextResponse.json(
      { error: "Failed to judge answer" },
      { status: 500 }
    );
  }
}
