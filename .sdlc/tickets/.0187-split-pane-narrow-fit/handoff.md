---
id: T-0187
title: "split-pane demo stacks or scrolls at 400px instead of overflowing the column"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The split-pane demo stops ending 63px past the 400px column: it stacks or scrolls at narrow widths, so `demo/split-pane-demo#column` leaves the render allowlist.

## Intent
- Do: Stack or scroll the specimen at narrow widths; delete the allowlist line.
- Non-goals: other allowlist entries.
- Done when: render lint `demo/split-pane-demo` green in both engines with no entry; screenshot viewed.

## Context
Filed by T-0170 (lint allowlist owners, 2026-10-14), which repointed the allowlist reason to this ticket.

## Constraints
Never add an allowlist entry without an owner (T-0170 format check). No em dashes.

## Acceptance criteria
- `scripts/dogfood-render-allowlist.json` has no `demo/split-pane-demo` key.
- `npx vitest run --config vitest.browser.config.ts --project site site/pages/dogfood-render.browser.test.ts site/pages/split-pane-demo.browser.test.ts` exits 0 in chromium and webkit (the stale-entry check included).
- `npm run check` exits 0.
- At a 400px viewport the bounded split's frame scrolls inline (scrollLeft > 0 after scrolling) and the Inspector pane is visible once scrolled.

## Outcome

2026-10-18 · lane: full L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: ecad202386a5
- Changed: Split-pane demo scrolls inside its frame at 400px (#2129)
- Commits: 16ac4b6 T-0187: split-pane demo scrolls at 400px instead of overflowing the column (#2129)
- Check: 1 allowlist has no `demo/split-pane-demo` key: pass
- Check: 2 render lint plus split-pane browser test exit 0 in chromium and webkit: pass
- Check: 3 `npm run check` exits 0: pass
- Check: 4 at 400px the bounded split frame scrolls inline and the Inspector is visible once scrolled: pass
- Follow-up: note: the red-checkpoint deviations script printed nothing no red... -> notes.md
- Follow-up: note: the throwaway worktrees were removed; two scratch log files under... -> notes.md
