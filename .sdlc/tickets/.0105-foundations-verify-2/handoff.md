---
id: T-0105
title: "Foundations Wave 2 batched verification, bundle 2 (ADR-0245)"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Independent batched check of the ADR-0245 Wave 1 lanes in bundle 2 (lanes a06 to a10, widgets, app, a2ui, code and site). The integration branch integ/foundations-wave1 (this worktree) is all ten lanes merged on main. Kim's rulings: dark launch (default pages byte-identical), batched verification, a pass is final, nits (em dashes, comments, wording) go to ## Notes and never fail the build.

## Acceptance criteria
1. `node scripts/foundations-census.mjs --gate` exits 0 (green; only the deferred cut entries remain).
2. `npx vitest run packages/agent-ui/a2ui packages/agent-ui/app packages/agent-ui/code` exits 0.
3. `npx vitest run --config vitest.browser.config.ts --project packages-rest packages/agent-ui/app` exits 0.
4. `git diff --quiet origin/main HEAD -- 'packages/agent-ui/app/**/__baselines__' 'packages/agent-ui/a2ui/**/__baselines__'` exits 0 (no default golden changed in app or a2ui).
5. `npx vitest run site/lib site/pages` exits 0 (the site migration and the theme-provider fixture).
6. `grep -rn "glyph" site/pages/icon-demo.ts packages/agent-ui/components/src/controls/product-card/product-card.ts | grep -v "data-part\|symbol" | head -0` exits 0.

## Closed

2026-10-13: merged via the foundations campaign (#1920 to #1932, ADR-0245)
