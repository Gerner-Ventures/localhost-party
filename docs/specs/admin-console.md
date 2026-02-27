---
title: "Admin Console"
status: draft
owner: ng
team: localhost-party
ticket_project: Gerner-Ventures/localhost-party
created: 2026-02-26
updated: 2026-02-26
tags: [admin, console, content-management]
---

# Admin Console

Build an admin console for content authoring, game configuration, and asset management — replacing hardcoded game data with a dynamic management interface.

## 1. Background

<!-- specwright:system:1 status:todo -->

Game content (prompts, configuration, audio assets) is currently hardcoded in source files. An admin console enables non-technical content management while maintaining the neon/arcade theme.

**Related:** [#56](https://github.com/Gerner-Ventures/localhost-party/issues/56), [#57](https://github.com/Gerner-Ventures/localhost-party/issues/57), [#58](https://github.com/Gerner-Ventures/localhost-party/issues/58), [#59](https://github.com/Gerner-Ventures/localhost-party/issues/59)

## 2. Foundation & Route Structure

<!-- specwright:system:2 status:todo -->
<!-- specwright:ticket:github:56 -->

Establish admin-only routes with reusable layout, navigation, and access control.

### Acceptance Criteria

- [ ] Admin routes at `/admin/*` separate from player-facing routes
- [ ] Admin layout with sidebar navigation and neon/arcade theme
- [ ] Basic access control prevents non-admin access
- [ ] Dashboard shows content counts and system status

## 3. Prompt Library Manager

<!-- specwright:system:3 status:todo -->
<!-- specwright:ticket:github:57 -->

CRUD interface for game prompts, replacing 26 hardcoded Quiplash prompts.

### Acceptance Criteria

- [ ] Create, read, update, delete prompts via admin UI
- [ ] Prompts support categorization and metadata
- [ ] Prompt usage tracking
- [ ] Import/export as JSON/CSV
- [ ] Game engine reads from dynamic source
- [ ] Existing prompts migrated as seed data

## 4. Game Configuration Editor

<!-- specwright:system:4 status:todo -->
<!-- specwright:ticket:github:58 -->

Visual editor for game settings, rules, and parameters without code changes.

### Acceptance Criteria

- [ ] Visual editor for game configuration (rounds, timers, scoring)
- [ ] Configuration changes without deployment
- [ ] Validation prevents invalid configurations
- [ ] Configuration history/versioning
- [ ] Default configuration preserved as fallback

## 5. Asset Manager

<!-- specwright:system:5 status:todo -->
<!-- specwright:ticket:github:59 -->

Upload, organize, preview, and manage audio and visual assets.

### Acceptance Criteria

- [ ] Upload audio files (M4A, MP3) and visual assets
- [ ] Preview audio in admin UI
- [ ] Organize assets into categories
- [ ] Dynamic asset references (not hardcoded paths)
- [ ] Existing assets migrated

## 6. Open Questions

- Storage backend for uploads? (S3, Vercel Blob, local)
- Database or file-based storage for prompts?
- Single admin vs. role-based access control?
