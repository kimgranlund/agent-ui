---
id: T-0575
title: "Removed CodeMirror editors in ui-agent-admin leave no listeners after garbage collection"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P3
depends: []
created: 2026-10-29
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
Mounting and removing ui-agent-admin leaves no event listeners reachable on the removed CodeMirror DOM after garbage collection, or the report shows measured evidence that they are collected.

## Intent
- Do: measure in Chromium (a CDP heap snapshot or `queryObjects`, with a forced GC) whether the about 106 listeners per mount on detached CodeMirror nodes are collected; if retained, find the holder (an editor not destroyed, a document listener, a ResizeObserver or IntersectionObserver) and fix it, with a browser test that fails on base.
- Done when: the report gives retained counts before and after across 5 mount rounds; any fix has a failing-first test; the app browser tests and `npm run check` exit 0.

## Context
T-0562 (PR 2353) found ui-agent-admin's three lazy CodeMirror editors leave about 106 listeners per round on detached nodes outside the host; the leak gate does not count them and GC reclaim was not measured (no gc hook in the browser runner). CodeMirror is the ruled lazy exception on `@agent-ui/code/editor` (ADR-0139).

## Acceptance criteria
1. In chromium, five mount and remove rounds of ui-agent-admin each leave CodeMirror listeners on detached nodes before a forced GC and none after it, with no host or `.cm-editor` still reachable; a negative control that holds the editors keeps them and their listeners through GC: `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/app/src/controls/agent-admin/agent-admin-gc.browser.test.ts` exits 0.
2. `npm run test:browser:packages:app` exits 0.
3. `npm run check` exits 0.

## Constraints
No em dashes. No paid runs; agent-admin stays keyless. Browser tests through scripts/gate_lock.py.
- Lane: solo because size L2 (steps.py lane)

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 11d20e79fa13
- Changed: Removed CodeMirror editors in ui-agent-admin leave no listeners after GC, pinned by a standing browser guard
- Commits: none
- Check: 1 five mount rounds, CodeMirror listeners before GC and none after, with a holding negative control: pass
- Check: 2 `npm run test:browser:packages:app`: pass
- Check: 3 `npm run check`: pass
- Follow-up: note: agent-admin-gc.browser.test.ts:2-4 and the handoff say about 100 to... -> notes.md
