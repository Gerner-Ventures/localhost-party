---
title: "AI Agent Avatars & Player Characters"
status: draft
owner: ng
team: localhost-party
ticket_project: Gerner-Ventures/localhost-party
created: 2026-02-26
updated: 2026-02-26
tags: [ai, agents, avatars, elevenlabs]
---

# AI Agent Avatars & Player Characters

Expand the AI agent system from game-level personas to player-level character agents with custom dialogue and voice via ElevenLabs.

## 1. Background

<!-- specwright:system:1 status:todo -->

The current AI system provides game-level personas (Chip Sterling as host). This adds player-level character agents and AI avatars with distinct visual/vocal identities.

**Related:** [#60](https://github.com/Gerner-Ventures/localhost-party/issues/60), [#61](https://github.com/Gerner-Ventures/localhost-party/issues/61)

## 2. AI Agent Avatars (ElevenLabs Integration)

<!-- specwright:system:2 status:todo -->
<!-- specwright:ticket:github:60 -->

Create AI agent avatars with distinct visual appearances and synthesized voices.

### Acceptance Criteria

- [ ] AI agents have distinct visual avatars in game UI
- [ ] AI agents have unique synthesized voices via ElevenLabs
- [ ] Agents react dynamically to game events
- [ ] Voice generation is server-side only

## 3. Player Character Agents

<!-- specwright:system:3 status:todo -->
<!-- specwright:ticket:github:61 -->

Enable players to create custom AI character agents that speak dialogue during games.

### Acceptance Criteria

- [ ] Players can create/customize a character with name and personality
- [ ] Characters speak pre-set catchphrases or player-input text
- [ ] Characters react to game events
- [ ] Character dialogue generated via AI with personality constraints
- [ ] Character voices are synthesized and distinct

## 4. Open Questions

- ElevenLabs voice limits per session? (API rate limits, cost)
- Player characters persist across sessions or per-session?
- Voice cloning vs. pre-built voices?
