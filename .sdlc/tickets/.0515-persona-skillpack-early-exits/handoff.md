---
id: T-0515
title: "The remaining early exits in skill-pack-opt-in and persona-file tests pin ok before returning"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L1
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
Every `if (!x.ok) return` early exit in `packages/agent-ui/app/src/controls/agent-admin/skill-pack-opt-in.test.ts` (about 5) and `site/pages/agent-admin-persona-file.test.ts` (about 16) is preceded by an `expect(x.ok).toBe(true)` (or the test states and asserts the expected failure), so a failed mint or parse fails the test instead of passing it.

## Intent
- Do: apply the T-0512 pattern to each remaining site; where a test expects failure, assert `ok === false` explicitly instead.
- Non-goals: production code; the three sites T-0512 already fixed.
- Done when: `grep -n 'if (!.*\.ok) return'` in both files shows each remaining hit directly preceded by an ok assert; a mutation forcing the producer to fail reds the dependent tests (noted); `npm run check` and both test files exit 0.

## Context
T-0512 verifier note. T-0512 (#2314) fixed lines it named; the rest remain.

## Constraints
Tests only. No em dashes.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 833bd7dd69a1
- Changed: Every early exit in the skill-pack opt-in and persona-file tests pins ok before returning
- Commits: none
- Check: 1 every `if (!x.ok) return` hit in both files directly preceded by an ok assert: pass
- Check: 2 a mutation forcing the producer to fail reds the dependent tests: pass
- Check: 3 `npm run check` and both test files exit 0: pass
- Check: 4 tests only, no em dashes: pass
- Follow-up: note: redck.py deviations printed no process deviation lines. -> notes.md
