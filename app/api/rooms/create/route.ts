import { NextResponse } from "next/server";
import { roomStore } from "@/lib/store";

const MAX_CODE_GENERATION_ATTEMPTS = 100;

function generateRoomCode(attempt: number = 0): string {
  // Prevent infinite recursion
  if (attempt >= MAX_CODE_GENERATION_ATTEMPTS) {
    throw new Error(
      "Unable to generate unique room code - too many active rooms"
    );
  }

  // Generate a random 4-letter code
  // Exclude confusing letters: I, O, L (can look like 1, 0)
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ";
  let code = "";

  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  // Check if code already exists, regenerate if it does
  if (roomStore.get(code)) {
    return generateRoomCode(attempt + 1);
  }

  return code;
}

export async function POST() {
  try {
    const code = generateRoomCode();
    const room = roomStore.create(code);

    return NextResponse.json({
      code: room.code,
      id: room.id,
    });
  } catch (error) {
    console.error("Error creating room:", error);
    return NextResponse.json(
      { error: "Failed to create room" },
      { status: 500 }
    );
  }
}
