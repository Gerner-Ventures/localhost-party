---
title: "Production Hardening"
status: draft
owner: ng
team: localhost-party
ticket_project: Gerner-Ventures/localhost-party
created: 2026-02-26
updated: 2026-02-26
tags: [testing, production, technical-debt]
---

# Production Hardening

Improve production readiness through test coverage, code deduplication, and WebSocket rate limiting.

## 1. Background

<!-- specwright:system:1 status:todo -->

Technical debt: duplicated code between `server.ts` and `websocket-server`, no test coverage for game logic, and no WebSocket rate limiting.

**Related:** [#53](https://github.com/Gerner-Ventures/localhost-party/issues/53)

## 2. Test Coverage

<!-- specwright:system:2 status:todo -->
<!-- specwright:ticket:github:53 -->

### Acceptance Criteria

- [ ] Unit tests for `lib/games/quiplash.ts`
- [ ] Unit tests for WebSocket event handlers
- [ ] Unit tests for AI prompt generation
- [ ] Integration tests for game flow
- [ ] CI pipeline runs tests on every PR

## 3. Code Deduplication

<!-- specwright:system:3 status:todo -->
<!-- specwright:ticket:github:53 -->

### Acceptance Criteria

- [ ] Shared game logic extracted into reusable modules
- [ ] Single source of truth for game state management
- [ ] WebSocket server imports shared modules

## 4. WebSocket Rate Limiting

<!-- specwright:system:4 status:todo -->
<!-- specwright:ticket:github:53 -->

### Acceptance Criteria

- [ ] Rate limiting per-connection for event emissions
- [ ] Configurable rate limit thresholds
- [ ] Warning before disconnection
- [ ] Normal gameplay pace unaffected

## 5. Open Questions

- Test framework? (Jest, Vitest, Playwright for e2e?)
- Acceptable rate limits for normal gameplay?
