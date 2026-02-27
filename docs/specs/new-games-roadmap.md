---
title: "New Games Roadmap"
status: draft
owner: ng
team: localhost-party
ticket_project: Gerner-Ventures/localhost-party
created: 2026-02-26
updated: 2026-02-26
tags: [games, roadmap, fibbage, drawful]
---

# New Games Roadmap

Track development of new party games beyond Quiplash, starting with Fibbage.

## 1. Background

<!-- specwright:system:1 status:todo -->

Localhost Party currently supports Quiplash only. The game engine can support additional party games. Priority: Fibbage, AI Drawful, Murder Mystery, Rap Battle.

**Related:** [#54](https://github.com/Gerner-Ventures/localhost-party/issues/54)

## 2. Fibbage with AI

<!-- specwright:system:2 status:todo -->
<!-- specwright:ticket:github:54 -->

Players write believable fake answers to trivia questions, then identify the real answer.

### Acceptance Criteria

- [ ] AI generates trivia facts with correct answers
- [ ] Players submit fake answers
- [ ] Voting UI shows all answers randomly ordered
- [ ] Scoring: points for finding real answer + points when others pick your fake
- [ ] AI validates fakes aren't too close to real answer

## 3. AI Drawful

<!-- specwright:system:3 status:draft -->

Players draw AI-generated prompts, others guess what was drawn.

## 4. Murder Mystery Generator

<!-- specwright:system:4 status:draft -->

AI-generated murder mystery scenarios with character assignments and deduction.

## 5. Rap Battle

<!-- specwright:system:5 status:draft -->

Players write rap verses on given topics, AI judges flow/rhyme/content.

## 6. Open Questions

- Separate packages or unified game engine?
- Minimum player counts per game?
- AI opponents for all game types?
