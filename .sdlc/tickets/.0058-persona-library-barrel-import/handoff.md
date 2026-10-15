---
id: T-0058
title: "persona-library-pattern: import createMemoryStore from the settings-memory-store subpath, not the app barrel"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-08
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
`site/pages/persona-library-pattern.ts` stops loading the whole `@agent-ui/app` barrel (and the renderer) just for `createMemoryStore`.

## Intent
- Do: change its import to the `@agent-ui/app/settings-memory-store` subpath; check the export exists in app's package.json exports and the page still builds.
- Non-goals: any other page; the renderer-lazy work (deferred, see .sdlc/tickets/.0055-renderer-lazy-spike/design.md).
- Done when: `npm run check` and the page's tests exit 0; `npm run size` exit 0; no em dashes added.

## Context
Found by the T-0055 spike (design.md section 4/5). The only other runtime barrel import is `site/lib/a2ui-live.ts`, which does render surfaces, so leave it.

## Constraints
One-file change. Imports point inward only. Commit locally; no push.

## Closed

2026-10-08: Merged in #1874
