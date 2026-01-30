# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

localhost:party is an AI-powered party game suite (like Jackbox Games) with real-time multiplayer via WebSockets. Players join via phone (controller view) while the game runs on a TV (display view).

**Current state**: AI Quiplash is fully implemented. Other games are planned.

## Development Commands

```bash
# Development (with Doppler secrets - recommended)
npm run dev

# Development (without Doppler, uses .env.local)
npm run dev:local

# Quality checks
npm run lint              # ESLint
npm run type-check        # TypeScript check
npm run test              # Run all tests
npm run test:watch        # Tests in watch mode

# Database
npm run db:generate       # Generate Prisma client
npm run db:push           # Push schema to database
npm run db:studio         # Open Prisma Studio GUI
```

## Architecture

### Dual View System

- **Display view** (`/app/(display)/display/`): TV/main screen showing game state, QR codes for joining
- **Controller view** (`/app/(controller)/play/`): Mobile interface for players to submit answers, vote

### Server Architecture

- `server.ts`: Combined Next.js + Socket.io server handling HTTP and WebSocket on same port
- Room state stored in memory via `lib/shared-rooms.ts`
- WebSocket events follow pattern: `game:event-name` for game events, `player:event-name` for player actions

### Game State Machine

Games progress through phases: `lobby` → `prompt` → `submit` → `vote` → `results`

- Game logic lives in `lib/games/` (see `quiplash.ts` for reference implementation)
- Types in `lib/types/game.ts` define `GameState`, `GamePhase`, `GameSubmission`, `GameVote`

### Audio System

- `lib/audio/narrator.ts`: ElevenLabs TTS for AI narrator voice
- `lib/audio/sounds.ts`: Sound effect management via Howler.js
- `lib/context/AudioContext.tsx`: React context for audio state

### Validation

- Room codes: 4-character uppercase letters only (validated via `isValidRoomCode`)
- Input sanitization in `server.ts`: `sanitizePlayerName()`, `validatePayloadData()`
- Rate limiting on `/api/tts` endpoint (10 req/min per IP)

## Environment Variables

All deployment variables use `LH_PARTY_` prefix. Key variables:

```env
LH_PARTY_DATABASE_URL          # Neon PostgreSQL connection string
NEXT_PUBLIC_LH_PARTY_APP_URL   # App URL for QR codes
NEXT_PUBLIC_LH_PARTY_WS_URL    # WebSocket server URL
NEXT_PUBLIC_ELEVENLABS_API_KEY # ElevenLabs TTS API key
```

**Doppler configs**: `dev_personal` (local only), `dev`, `preview`, `prod`
**Critical**: Secrets in `dev_personal` do NOT sync to Vercel. Add to `dev`, `preview`, `prod` for deployments.

## Git Workflow

Uses Husky hooks:

- **Pre-commit**: Prettier + ESLint (max-warnings=0) + type-check
- **Commit-msg**: Conventional commits required (`feat:`, `fix:`, `refactor:`, etc.)

## Key Files

| Path                               | Purpose                                          |
| ---------------------------------- | ------------------------------------------------ |
| `server.ts`                        | Main server entry point (Next.js + Socket.io)    |
| `lib/games/quiplash.ts`            | AI Quiplash game logic (reference for new games) |
| `lib/types/game.ts`                | Core game state types                            |
| `lib/context/WebSocketContext.tsx` | Socket.io client React context                   |
| `lib/audio/narrator.ts`            | ElevenLabs TTS integration                       |
| `prisma/schema.prisma`             | Database schema                                  |

## Adding a New Game

1. Create game module in `lib/games/{game-name}.ts` with state machine
2. Create display view in `app/(display)/display/games/{game-name}/`
3. Create controller view in `app/(controller)/play/game/`
4. Add types in `lib/types/` with Zod validation
5. Update WebSocket handlers in `server.ts`

See `lib/games/quiplash.ts` and `.claude/skills/generate-game.md` for patterns.
