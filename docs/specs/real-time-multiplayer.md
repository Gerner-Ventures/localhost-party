---
title: "Real-Time Multiplayer System"
status: in_progress
owner: nick
team: localhost-party
ticket_project: localhost-party
created: 2026-02-07
updated: 2026-02-07
tags: [multiplayer, websocket, rooms, real-time]
---

# Real-Time Multiplayer System

Core multiplayer infrastructure powering localhost:party — room management, WebSocket communication, player lifecycle, and the dual-view (display/controller) architecture.

## 1. Background

<!-- specwright:system:1 status:done -->

localhost:party is a Jackbox-style party game platform where one device serves as the shared display (TV/projector) and each player uses their phone as a controller. Real-time communication is essential — game state, player actions, and AI host narration must sync instantly across all connected devices.

The system uses Socket.io for WebSocket transport with a standalone server deployed on Railway, separate from the Next.js app on Vercel.

## 2. Room Management

<!-- specwright:system:2 status:done -->

### 2.1 Room Lifecycle

Rooms are created when a host starts a new game session. A short alphanumeric room code is generated for players to join. Rooms transition through states: lobby → in-game → results → closed. Rooms are automatically cleaned up after inactivity timeout.

### 2.2 Player Management

Players join by entering the room code on their phone. Each player gets a unique ID, display name, and avatar. The system tracks connection state and handles reconnection within a grace period. Host designation passes to the next player if the original host disconnects.

### Acceptance Criteria

- [x] Room creation with unique codes
- [x] Player join/leave lifecycle
- [x] Room state machine (lobby → game → results)
- [x] Reconnection handling
- [ ] Room persistence across server restarts
- [ ] Spectator mode for late joiners

## 3. WebSocket Protocol

<!-- specwright:system:3 status:done -->

### 3.1 Event Types

The protocol defines typed events for room management (join, leave, ready), game state (start, phase-change, submit, vote), and system messages (error, heartbeat, sync). All events use TypeScript interfaces from `lib/types/websocket.ts`.

### 3.2 State Synchronization

The server is the source of truth for game state. On each state change, the server broadcasts the full game state to all room participants. The display and controller views subscribe to the same events but render different UIs based on the route group.

### 3.3 Dual View Architecture

Next.js route groups separate the display (`(display)/`) and controller (`(controller)/`) views. Both connect to the same WebSocket room. The display shows the shared game board, prompts, and results. Controllers show per-player inputs (text entry, drawing canvas, voting buttons).

### Acceptance Criteria

- [x] Typed WebSocket events with TypeScript interfaces
- [x] Server-authoritative state management
- [x] Display/controller view separation
- [x] Real-time state broadcast on changes
- [ ] Event replay for reconnecting clients
- [ ] Bandwidth optimization (delta updates instead of full state)

## 4. AI Host Integration

<!-- specwright:system:4 status:in_progress -->

### 4.1 Agent Manager

`lib/agents/core/agent-manager.ts` coordinates AI interactions. The host persona comments on game events, judges player submissions, and narrates transitions. Rate limiting prevents excessive API calls.

### 4.2 Event Detection

`lib/agents/core/event-detector.ts` monitors game state changes and triggers AI responses at appropriate moments (round start, all submissions in, voting complete, etc.).

### 4.3 Text-to-Speech

AI host dialogue is spoken aloud via ElevenLabs TTS. The narrator system (`lib/audio/narrator.ts`) queues speech segments and manages playback timing with game events.

### Acceptance Criteria

- [x] AI host generates contextual commentary
- [x] Rate limiting prevents API cost overruns
- [x] TTS narration with ElevenLabs
- [ ] Multiple host personas with distinct voices
- [ ] Host adapts tone based on game energy/pace

## 5. Game Engine

<!-- specwright:system:5 status:in_progress -->

### 5.1 Game Interface

Games implement a common interface defined in `lib/games/handlers.ts`. Each game provides phase definitions, state transitions, scoring logic, and AI prompts. The engine manages the game loop: advance phases on timers or when all players submit.

### 5.2 Quiplash

Fully implemented party game where players write funny responses to prompts. Phases: prompt distribution → response writing → head-to-head voting → AI judge commentary → scoring. Supports 3-8 players.

### 5.3 Pixel Showdown

Drawing game in progress. Players draw based on AI-generated prompts. The AI judges drawings and provides humorous commentary. Phases: prompt reveal → drawing → gallery → judging → scoring.

### Acceptance Criteria

- [x] Common game interface/handler pattern
- [x] Quiplash fully playable end-to-end
- [ ] Pixel Showdown fully playable
- [ ] Game selection screen in lobby
- [ ] Configurable round counts and timers
- [ ] Minimum 3 games available for launch

## Open Questions

- Should game state persist to Neon DB or stay in-memory only?
- How do we handle games with asymmetric player counts (e.g., one player is the "spy")?
- What's the latency budget for TTS narration between game phases?
