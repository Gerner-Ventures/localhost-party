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
├── app/                 # Next.js app router
│   ├── api/            # REST API endpoints
│   ├── display/        # TV/main screen views
│   └── play/           # Player controller views
├── agents/             # Claude Agent SDK agents
│   ├── host-agent.ts   # Dynamic game host
│   ├── judge-agent.ts  # Game judging
│   └── content-agent.ts # Content generation
├── lib/
│   ├── ai/             # Direct Claude API integration
│   ├── games/          # Game logic modules
│   └── prisma/         # Database utilities
└── prisma/             # Database schema
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
cp .env.example .env
```

Add your credentials:

```
DATABASE_URL="your-neon-database-url"
ANTHROPIC_API_KEY="your-anthropic-api-key"
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

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Type check TypeScript files

### Git Hooks

This project uses [Husky](https://typicode.github.io/husky/) to enforce code quality:

**Pre-commit:**

- Formats and lints staged files with Prettier and ESLint
- Type checks the entire project

**Pre-push:**

- Attempts to build the project (currently non-blocking due to turbo/SWC issue)

**Commit Message:**

- Validates commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
- Allowed types: `feat`, `fix`, `refactor`, `style`, `test`, `docs`, `chore`, `build`, `ci`, `perf`, `revert`

**Bypass hooks:** In emergencies, you can skip hooks with `git commit --no-verify` or `git push --no-verify`

## How to Play

1. Open the app on a large screen (TV/computer)
2. Create a new game room
3. Players join on their phones using the room code
4. Select a game from the suite
5. Follow the AI host's instructions
6. Have fun!

## Contributing

This is a weekend project, but contributions are welcome! Check out the issues tab for planned features and improvements.

## License

MIT

## Acknowledgments

- Inspired by Jackbox Games
- Powered by Anthropic's Claude AI
- Built with love over a weekend
