import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  TriviaQuestion,
  GenerateQuestionsRequest,
} from "@/lib/types/pixel-showdown";
import { DEFAULT_PIXEL_SHOWDOWN_CONFIG } from "@/lib/types/pixel-showdown";

// Rate limiting
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20; // requests per minute
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

const SYSTEM_PROMPT = `You are a trivia question generator for a party game called Pixel Showdown.

Generate engaging, fun trivia questions suitable for a casual party setting with friends and family.

Guidelines:
- Questions should be challenging but not obscure
- Avoid offensive, controversial, or overly niche topics
- Include a mix of question types: pop culture, science, history, geography, entertainment
- For multiple choice, provide exactly 4 options with 1 correct answer
- Make incorrect options plausible but clearly wrong if you know the topic
- Keep questions concise and easy to read quickly

Always respond with valid JSON only, no additional text.`;

function getPointValue(difficulty: "easy" | "medium" | "hard"): number {
  switch (difficulty) {
    case "easy":
      return 100;
    case "medium":
      return 200;
    case "hard":
      return 300;
  }
}

function getTimeLimit(
  difficulty: "easy" | "medium" | "hard",
  type: "multiple_choice" | "free_text"
): number {
  // Free text gets more time
  const baseTime = type === "free_text" ? 20 : 15;

  switch (difficulty) {
    case "easy":
      return baseTime;
    case "medium":
      return baseTime - 2;
    case "hard":
      return baseTime - 4;
  }
}

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
    const body: GenerateQuestionsRequest = await request.json();

    const count = Math.min(body.count || 5, 10); // Max 10 questions at once
    const difficulty = body.difficulty || "medium";
    const category =
      body.category ||
      DEFAULT_PIXEL_SHOWDOWN_CONFIG.categories[
        Math.floor(
          Math.random() * DEFAULT_PIXEL_SHOWDOWN_CONFIG.categories.length
        )
      ];

    // Determine mix of question types (mostly multiple choice, some free text)
    const mcCount = Math.ceil(count * 0.7);
    const ftCount = count - mcCount;

    const userPrompt = `Generate ${count} ${difficulty} trivia questions about "${category}".

Create ${mcCount} multiple choice questions and ${ftCount} free text questions.

Return as a JSON array with this exact structure:
[
  {
    "text": "The question text",
    "type": "multiple_choice",
    "category": "${category}",
    "difficulty": "${difficulty}",
    "correctAnswer": "The correct answer",
    "options": ["Option A", "Option B", "Option C", "Option D"]
  },
  {
    "text": "Another question",
    "type": "free_text",
    "category": "${category}",
    "difficulty": "${difficulty}",
    "correctAnswer": "The answer",
    "acceptableAnswers": ["alt1", "alt2"]
  }
]

For multiple choice: options must include the correct answer.
For free text: include common alternative answers or spellings in acceptableAnswers.

Respond with ONLY the JSON array, no other text.`;

    const response = await anthropicClient.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    // Extract text from response
    const responseText =
      response.content[0]?.type === "text" ? response.content[0].text : null;

    if (!responseText) {
      return NextResponse.json(
        { error: "Failed to generate questions" },
        { status: 500 }
      );
    }

    // Parse JSON response
    let rawQuestions;
    try {
      rawQuestions = JSON.parse(responseText);
    } catch {
      // Try to extract JSON from response if it has extra text
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        rawQuestions = JSON.parse(jsonMatch[0]);
      } else {
        return NextResponse.json(
          { error: "Failed to parse questions" },
          { status: 500 }
        );
      }
    }

    // Validate and transform questions
    const questions: TriviaQuestion[] = rawQuestions.map(
      (
        q: {
          text: string;
          type: "multiple_choice" | "free_text";
          category: string;
          difficulty: "easy" | "medium" | "hard";
          correctAnswer: string;
          options?: string[];
          acceptableAnswers?: string[];
        },
        i: number
      ) => ({
        id: `q-${Date.now()}-${i}`,
        text: q.text,
        type: q.type || "multiple_choice",
        category: q.category || category,
        difficulty: q.difficulty || difficulty,
        correctAnswer: q.correctAnswer,
        options: q.options,
        acceptableAnswers: q.acceptableAnswers,
        timeLimit: getTimeLimit(
          q.difficulty || difficulty,
          q.type || "multiple_choice"
        ),
        pointValue: getPointValue(q.difficulty || difficulty),
      })
    );

    return NextResponse.json({ questions, category });
  } catch (error) {
    console.error("[Trivia Generate API] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate questions" },
      { status: 500 }
    );
  }
}
