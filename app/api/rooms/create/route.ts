import { NextRequest, NextResponse } from "next/server";
import { roomStore } from "@/lib/store";
import { GAME_IDS, type GameId } from "@/lib/constants/games";

const MAX_CODE_GENERATION_ATTEMPTS = 100;

/**
 * Generates a unique 4-letter room code.
 * Excludes confusing letters (I, O, L) that could be mistaken for numbers.
 * Recursively retries if the code already exists, up to MAX_CODE_GENERATION_ATTEMPTS.
 */
function generateRoomCode(attempt: number = 0): string {
  if (attempt >= MAX_CODE_GENERATION_ATTEMPTS) {
    throw new Error(
      "Unable to generate unique room code - too many active rooms"
    );
  }

  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ";
  let code = "";

  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  if (roomStore.get(code)) {
    return generateRoomCode(attempt + 1);
  }

  return code;
}

export async function POST(request: NextRequest) {
  try {
    // Parse optional game type from request body
    let gameType: GameId | null = null;
    let hasInvalidGameType = false;

    try {
      const body = await request.json();

      if (body.gameType) {
        // Validate gameType against allowed values from shared constants
        if (GAME_IDS.includes(body.gameType)) {
          gameType = body.gameType as GameId;
        } else {
          hasInvalidGameType = true;
          if (process.env.NODE_ENV === 'development') {
            console.warn(`Invalid gameType provided: ${body.gameType}. Allowed values: ${GAME_IDS.join(', ')}`);
          }
        }
      }
    } catch (parseError) {
      // No body or invalid JSON, proceed without game type
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to parse request body, proceeding without gameType:', parseError);
      }
    }

    // Return error for invalid game type (optional: can be removed if silent handling is preferred)
    if (hasInvalidGameType) {
      return NextResponse.json(
        { error: "Invalid game type", allowedTypes: GAME_IDS },
        { status: 400 }
      );
    }

    const code = generateRoomCode();
    const room = roomStore.create(code, gameType);

    if (process.env.NODE_ENV === 'development') {
      console.log(`🎉 Room created: ${code} (gameType: ${gameType})`);
    }

    return NextResponse.json({
      code: room.code,
      id: room.id,
      gameType,
    });
  } catch (error) {
    console.error("Error creating room:", error);
    return NextResponse.json(
      { error: "Failed to create room" },
      { status: 500 }
    );
  }
}
