---
id: T-0104
title: "Foundations Wave 2 batched verification, bundle 1 (ADR-0245)"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Independent batched check of the ADR-0245 Wave 1 lanes in bundle 1 (lanes a01 to a05, the controls). The integration branch integ/foundations-wave1 (this worktree) is all ten lanes merged on main. Kim's rulings: dark launch (default pages byte-identical), batched verification, a pass is final, nits (em dashes, comments, wording) go to ## Notes and never fail the build.

## Acceptance criteria
1. `node scripts/foundations-census.mjs --gate` exits 0 (green; only the deferred cut entries remain).
2. `npm run check` exits 0.
3. `npx vitest run --config vitest.browser.config.ts --project packages $(ls packages/agent-ui/components/src/controls/*/*foundations*.browser.test.ts)` exits 0 (each migrated control's geometry inside and outside a data-tier region).
4. `git diff --quiet origin/main HEAD -- 'packages/agent-ui/components/src/controls/**/__baselines__' 'site/pages/__baselines__'` exits 0 (the leak gate: no default golden changed).
5. `node scripts/foundations-probe.mjs --tags ui-button,ui-text-field,ui-toggle` exits 0 (host height, padding and radius equal the scale.mjs values at sm, md and lg).
6. `git diff --quiet origin/main HEAD -- packages/agent-ui/shared/src/tokens/dimensions.css packages/agent-ui/shared/src/tokens/dimensions.test.ts` exits 0.

## Closed

2026-10-13: merged via the foundations campaign (#1920 to #1932, ADR-0245)
