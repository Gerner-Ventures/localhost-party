---
description: Remove intermediate files and build artifacts
argument-hint: [scope]
allowed-tools: Bash(find:*), Bash(rm:*), Bash(du:*)
---

Clean up intermediate files that shouldn't be committed to git.

Scope argument: $ARGUMENTS

Available scopes:

- **full**: Remove all build artifacts, caches, and temp files
- **cache**: Remove only cache directories (.next/cache, .turbo, node_modules/.cache)
- **docs**: Remove markdown files that were created during work sessions (excluding README.md and docs in specified directories)
- **dry-run**: Show what would be removed without deleting

If no scope is provided, default to showing what would be cleaned (dry-run).

Files/directories to consider for cleanup:

- `.next/` (Next.js build output)
- `.turbo/` (Turbo cache)
- `node_modules/.cache/` (Package manager caches)
- `dist/` or `build/` directories
- `*.log` files
- `.DS_Store` files (macOS)
- Temporary markdown files (check with user before removing)

Before removing anything:

1. Show the current disk usage
2. List what will be removed
3. Calculate potential space savings
4. After cleanup, confirm what was removed and space saved

Be careful not to remove:

- `README.md`
- Files in `.claude/` directory
- Documentation in `docs/` or similar intended directories
- User-created content files
