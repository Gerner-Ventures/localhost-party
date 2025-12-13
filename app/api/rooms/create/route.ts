import { NextResponse } from 'next/server';
import { roomStore } from '@/lib/store';

function generateRoomCode(): string {
  // Generate a random 4-letter code
  // Exclude confusing letters: I, O, L (can look like 1, 0)
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  let code = '';

  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  // Check if code already exists, regenerate if it does
  if (roomStore.get(code)) {
    return generateRoomCode();
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
    console.error('Error creating room:', error);
    return NextResponse.json(
      { error: 'Failed to create room' },
      { status: 500 }
    );
  }
}
