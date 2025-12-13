# localhost:party

An AI-powered party game suite inspired by Jackbox Games, featuring dynamic AI hosts, real-time multiplayer gameplay, and customizable content generation.

## Features

- **AI-Powered Gameplay**: Leverages Claude AI for dynamic content generation, intelligent game hosting, and real-time judging
- **Multiplayer Fun**: Real-time WebSocket-based gameplay with room codes
- **Multiple Games**:
  - AI Quiplash - Witty responses judged by AI
  - AI Drawful - Drawing prompts with AI-generated challenges
  - Fibbage with AI - AI generates plausible fake answers
  - Murder Mystery Generator - Unique mysteries created on the fly
  - Rap Battle - AI judges and provides commentary
- **Dual View System**: Separate display (TV) and controller (phone) interfaces
- **Dynamic AI Host**: Context-aware game host that responds to player actions

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend**: Next.js API Routes, Custom WebSocket Server (Socket.io)
- **Database**: Neon (Serverless Postgres), Prisma ORM
- **AI**: Claude API (Anthropic), Claude Agent SDK
- **Deployment**: Vercel (app), Neon (database)

## Project Structure

```
localhost-party/
├── app/                     # Next.js app router
│   ├── (display)/          # TV/main screen route group
│   │   └── display/        # Display views (lobby, game, results)
│   ├── (controller)/       # Mobile controller route group
│   │   └── play/           # Player controller views
│   └── api/                # REST API endpoints
├── components/
│   ├── display/            # Display view components
│   └── controller/         # Controller view components
├── lib/
│   ├── types/              # Shared TypeScript types
│   ├── context/            # React context providers
│   ├── games/              # Game logic modules
│   └── store.ts            # In-memory data store (temporary)
└── prisma/                 # Database schema (to be set up)
```

## Getting Started

### Prerequisites

- Node.js 20+ and npm
- Neon database (free tier works great)
- Anthropic API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/localhost-party.git
cd localhost-party
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Add your credentials:
```
DATABASE_URL="your-neon-database-url"
ANTHROPIC_API_KEY="your-anthropic-api-key"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_WS_URL="http://localhost:3000"
```

4. Initialize the database:
```bash
npx prisma generate
npx prisma db push
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) to see the app

> **⚡ Quick Start**: See [QUICK_START.md](QUICK_START.md) for a 2-minute setup guide
>
> **🎉 WebSocket Server**: Real-time features are now working! See [WEBSOCKET_TEST_GUIDE.md](WEBSOCKET_TEST_GUIDE.md) to test multiplayer sync.

## Development

- `npm run dev` - Start development server (custom Next.js + Socket.io server)
- `npm run dev:next` - Start Next.js only (without WebSocket)
- `npm run build` - Build for production
- `npm run start` - Start production server (with WebSocket)
- `npm run start:next` - Start Next.js production (without WebSocket)
- `npm run lint` - Run ESLint

## How to Play

### Display View (TV/Large Screen)

1. Navigate to `/display` on your large screen or TV
2. A unique 4-letter room code will be generated automatically
3. A QR code will be displayed for easy joining
4. Wait for players to join

### Controller View (Mobile/Phone)

1. Open `/play` on your mobile device
2. Enter the 4-letter room code shown on the TV
3. Enter your name
4. Wait in the lobby for other players
5. Once at least 2 players have joined, anyone can tap "Start Game"
6. Follow the on-screen instructions to play

### Tips

- Display view is optimized for large screens (1080p/4K)
- Controller view is optimized for mobile devices
- At least 2 players required to start a game
- Players can join mid-game by scanning the QR code

## Contributing

This is a weekend project, but contributions are welcome! Check out the issues tab for planned features and improvements.

## License

MIT

## Acknowledgments

- Inspired by Jackbox Games
- Powered by Anthropic's Claude AI
- Built with love over a weekend
