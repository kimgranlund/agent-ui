---
id: T-0593
title: "The producer's semantic-check rows load lazily, so new checks stop growing the eager agent bundle"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2
depends: []
created: 2026-10-29
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The eager `@agent-ui/a2ui/agent` bundle stops growing with every producer semantic check: the check rows (composite moments, hidden-state checks and the other semantic check modules) load in a lazy chunk that `produce()` awaits on first use, and the eager size drops well below today's budget.

## Intent
- Do: measure which modules make up the eager agent bundle (`node scripts/measure-size.mjs` plus a bundle breakdown); move the semantic-check modules behind one dynamic import awaited inside the produce loop (keeping behaviour and order identical); keep the layering trip-wires green; re-pin the `@agent-ui/a2ui/agent` budget to the new eager size plus about 1 KiB, citing Kim's 2026-10-29 approval.
- Non-goals: changing any check's logic or any model-read text.
- Done when: the eager agent size is at least 8 KiB gz smaller than before; every a2ui suite, probe replay and `npm run check` exits 0; a test shows the checks still run on the first produce turn.

## Context
The budget was raised three times on 2026-10-29 (86,784 to 87,808 to 88,832 to 90,112 B gz), each time because a new producer check landed (T-0578, T-0586, T-0590). Kim chose a raise plus this trim on 2026-10-29.

## Constraints
No em dashes. No paid runs. Model-read text unchanged. Regenerate generated files with their scripts.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- `node scripts/measure-size.mjs` exits 0 and its `@agent-ui/a2ui/agent` row prints an eager figure at least 8192 B gz under the base 88788 (80362 measured) plus a nonzero lazy chunk.
- `npx vitest run packages/agent-ui/a2ui/src/live-agent/produce-lazy-composites.test.ts` exits 0: a turn with no checks never loads `catalog/composite-moments.ts`; the first turn with checks runs them on round 1 and binds the missing composite on round 2.
- `npx vitest run packages/agent-ui/a2ui scripts/e2e-admin/probe/replays` exits 0.
- `npm run check` exits 0.

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 8fddeee17df0
- Changed: The producer's composite-moment checks load lazily, cutting the eager agent bundle by about 8 KiB
- Commits: none
- Check: 1 measure-size agent row at least 8192 B gz under 88788 plus a nonzero lazy chunk: pass
- Check: 2 produce-lazy-composites.test.ts exits 0: pass
- Check: 3 a2ui and probe replays suites exit 0: pass
- Check: 4 npm run check exits 0: pass
- Follow-up: note: redck.py deviations printed no process deviation lines; no red... -> notes.md
- Follow-up: note: the .sdlc/notes/notes.md:1447 line still cites the old 88671... -> notes.md
