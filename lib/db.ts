import { PrismaClient } from "./generated/prisma/client";
import { neon } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";

// Check if DATABASE_URL is configured
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn("⚠️  DATABASE_URL not found. Database persistence is disabled.");
  console.warn("   The game will work in-memory only.");
  console.warn("   To enable persistence, add DATABASE_URL to your .env file.");
}

// Create Neon SQL client and adapter only if DATABASE_URL exists
const sql = databaseUrl ? neon(databaseUrl) : null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = sql ? new PrismaNeon(sql as any) : undefined;

// Prevent multiple instances in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Create PrismaClient with adapter if available
export const db =
  globalForPrisma.prisma ??
  (adapter
    ? new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === "development" ? ["error"] : ["error"],
      })
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (null as any)); // Database disabled, will error if used

if (process.env.NODE_ENV !== "production" && db) {
  globalForPrisma.prisma = db;
}
