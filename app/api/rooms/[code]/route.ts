import { NextResponse } from 'next/server';
import { roomStore } from '@/lib/store';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const upperCode = code.toUpperCase();

    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 Looking for room: ${upperCode}`);
    }
    const room = roomStore.get(upperCode);
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 Room lookup result:`, room ? `Found (${room.code})` : 'Not found');
    }

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(room);
  } catch (error) {
    console.error('Error fetching room:', error);
    return NextResponse.json(
      { error: 'Failed to fetch room' },
      { status: 500 }
    );
  }
}
