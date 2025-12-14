import { PrismaClient } from "./generated/prisma/client";
import { neon } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";

// Check if LH_PARTY_DATABASE_URL is configured
const databaseUrl = process.env.LH_PARTY_DATABASE_URL;

if (!databaseUrl) {
  console.warn(
    "⚠️  LH_PARTY_DATABASE_URL not found. Database persistence is disabled."
  );
  console.warn("   The game will work in-memory only.");
  console.warn(
    "   To enable persistence, add LH_PARTY_DATABASE_URL to your .env file."
  );
}

// Create Neon SQL client and adapter only if DATABASE_URL exists
const sql = databaseUrl ? neon(databaseUrl) : null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = sql ? new PrismaNeon(sql as any) : undefined;

// Prevent multiple instances in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | null;
};

// Create PrismaClient with adapter if available, otherwise null
// IMPORTANT: Always check `if (db)` before using - db is null when DATABASE_URL is not set
function createPrismaClient(): PrismaClient | null {
  if (!adapter) {
    return null;
  }
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error"] : ["error"],
  });
}

export const db: PrismaClient | null =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production" && db) {
  globalForPrisma.prisma = db;
}
