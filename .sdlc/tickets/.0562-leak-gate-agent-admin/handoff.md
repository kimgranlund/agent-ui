---
id: T-0562
title: "The leak gate covers ui-agent-admin"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P3
depends: []
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
ui-agent-admin is covered by the standing leak gate, or its exclusion is backed by a measured reason.

## Intent
- Do: find why ui-agent-admin's host listener count drifts between mount rounds in chromium (1052 to 1133); if it is a real leak, fix it and remove the exclusion; if it is late lazy render, settle the subtree before counting and remove the exclusion.
- Non-goals: other app controls already in the gate.
- Done when: ui-agent-admin runs in `packages/agent-ui/app/src/leak-gate.browser.test.ts` with no exclusion (or the solo reports measured evidence that it cannot, for Kim); the app browser tests and `npm run check` exit 0.

## Context
From T-0543 (the standing leak gate): ui-agent-admin is excluded from the app gate because its host listener count moved 1052 to 1133 between rounds in chromium, which could be a lazily settling subtree or a real stack. The reason is in the test comment.

## Constraints
No em dashes. No paid runs; agent-admin flows must stay keyless. Browser tests through scripts/gate_lock.py.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- ui-agent-admin is an APP_HOSTS entry in `packages/agent-ui/app/src/leak-gate.browser.test.ts` with no exclusion comment, and its row passes in chromium and webkit: `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/app/src/leak-gate.browser.test.ts` exits 0.
- The settle arm is load-bearing: with ui-agent-admin's arm replaced by a no-op the chromium row fails with the host listeners stack on reconnect flag (measured by the solo, not a standing check).
- `npm run test:browser:packages:app` exits 0.
- `npm run check` exits 0.

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: d2277ede33d0
- Changed: The leak gate covers ui-agent-admin by waiting for its lazy editors to settle before counting
- Commits: none
- Check: 1 ui-agent-admin is an APP_HOSTS entry with no exclusion comment and its row passes in chromium and...: pass
- Check: 2 The settle arm is load-bearing: pass
- Check: 3 `npm run test:browser:packages:app` exits 0: pass
- Check: 4 `npm run check` exits 0: pass
- Follow-up: note: leak-gate.browser.test.ts settle arm waits 1.5 s quiet window per... -> notes.md
- Follow-up: decide: redck deviations: no process deviation: lines printed. -> notes.md
