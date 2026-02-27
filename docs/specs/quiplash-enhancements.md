---
title: "Quiplash Head-to-Head Matchups"
status: draft
owner: ng
team: localhost-party
ticket_project: Gerner-Ventures/localhost-party
created: 2026-02-26
updated: 2026-02-26
tags: [quiplash, gameplay, matchups]
---

# Quiplash Head-to-Head Matchups

Implement true Quiplash-style head-to-head matchups where two players answer the same prompt and compete directly.

## 1. Background

<!-- specwright:system:1 status:todo -->

Currently each player gets a unique prompt. Classic Quiplash pairs two players on the same prompt for direct competition and funnier voting moments.

**Related:** [#52](https://github.com/Gerner-Ventures/localhost-party/issues/52)

## 2. Head-to-Head System

<!-- specwright:system:2 status:todo -->
<!-- specwright:ticket:github:52 -->

### Acceptance Criteria

- [ ] Players paired and assigned the same prompt
- [ ] Voting UI shows two answers side-by-side (anonymous)
- [ ] Paired players cannot vote on their own matchup
- [ ] Scoring reflects vote margin with bonus for unanimous wins
- [ ] Odd number of players handled gracefully
- [ ] Prompt displayed during voting for context

## 3. Open Questions

- Should pairings rotate across rounds?
- How to handle disconnected paired players?
