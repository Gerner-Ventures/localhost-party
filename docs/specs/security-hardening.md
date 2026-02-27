---
title: "Security Hardening"
status: draft
owner: ng
team: localhost-party
ticket_project: Gerner-Ventures/localhost-party
created: 2026-02-26
updated: 2026-02-26
tags: [security, api-keys, authentication, websocket]
---

# Security Hardening

Fix critical security vulnerabilities: exposed API keys, unauthenticated AI endpoints, and unauthorized WebSocket game manipulation.

## 1. Background

<!-- specwright:system:1 status:todo -->

A security review identified three categories of vulnerabilities: an API key exposed in the client bundle, unauthenticated AI service endpoints that allow quota abuse, and WebSocket game events with no authorization checks.

**Related:** [#76](https://github.com/Gerner-Ventures/localhost-party/issues/76), [#77](https://github.com/Gerner-Ventures/localhost-party/issues/77), [#78](https://github.com/Gerner-Ventures/localhost-party/issues/78)

## 2. Move ElevenLabs API Key Server-Side

<!-- specwright:system:2 status:todo -->
<!-- specwright:ticket:github:76 -->

The ElevenLabs API key uses the `NEXT_PUBLIC_` prefix, exposing it in the client-side JavaScript bundle.

**Fix:** Remove `NEXT_PUBLIC_` prefix. Route all ElevenLabs calls through server-side API routes.

### Acceptance Criteria

- [ ] ElevenLabs API key removed from `NEXT_PUBLIC_` environment variables
- [ ] All ElevenLabs API calls go through server-side routes only
- [ ] Client-side code does not contain or reference the ElevenLabs API key
- [ ] TTS functionality continues to work through the server-side proxy
- [ ] `/api/config` endpoint no longer exposes the API key

## 3. Authenticate AI Service Endpoints

<!-- specwright:system:3 status:todo -->
<!-- specwright:ticket:github:77 -->

API endpoints calling paid AI services (Anthropic Claude, ElevenLabs TTS) have no authentication.

### Acceptance Criteria

- [ ] All AI service endpoints require authentication
- [ ] Unauthenticated requests receive 401 response
- [ ] Rate limiting applied to prevent abuse even by authenticated users
- [ ] Existing game flow continues to work with authentication

## 4. Authorize WebSocket Game Events

<!-- specwright:system:4 status:todo -->
<!-- specwright:ticket:github:78 -->

WebSocket game control events have no authorization checks. Any client can manipulate any game room.

### Acceptance Criteria

- [ ] `game:start` and `game:restart` restricted to room host only
- [ ] `player:submit` and `player:vote` restricted to room participants only
- [ ] Unauthorized event attempts rejected with error message
- [ ] Room membership validated on each event

## 5. Open Questions

- What authentication mechanism for AI endpoints? (Session, API key, game room token?)
- Should rate limiting be per-user, per-room, or per-IP?
