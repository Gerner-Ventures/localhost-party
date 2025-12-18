import { NextResponse } from "next/server";

/**
 * API route to provide client-side configuration
 * This allows us to securely expose environment variables to the browser
 */
export async function GET() {
  return NextResponse.json({
    elevenlabsApiKey: process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || null,
  });
}
