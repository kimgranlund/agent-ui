---
id: T-0501
title: "An empty round after a SURFACE_DROPPED, SURFACE_CLAIMED or CHANGE_CLAIMED repair re-sends that repair ask, not the PARSE hint"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
An empty model round after a SURFACE_DROPPED, SURFACE_CLAIMED or CHANGE_CLAIMED repair (and the T-0428 change-claim repair) re-sends that same repair ask with its forced render, as T-0499 made the semantic repair do, instead of falling back to the PARSE hint and losing the failure it was repairing.

## Intent
- Do: generalize the T-0499 `semanticRepairPending` guard in `packages/agent-ui/a2ui/src/agent/produce.ts` (around :1534, :1646, :1997) so each forced repair remembers its pending failures and an empty next round re-sends them; failing-first scripted-adapter tests per repair kind beside `packages/agent-ui/a2ui/src/live-agent/produce-empty-repair.test.ts`; the plain empty-round PARSE path stays unchanged and tested.
- Non-goals: editing any hint text (SURFACE_DROPPED_HINT, SURFACE_CLAIMED_HINT, CHANGE_CLAIMED_HINT or grammar); any paid run.
- Done when: the new tests fail at base and pass after; `npm run check` and the a2ui agent and live-agent tests exit 0; the prompt-equivalence baseline is untouched.

## Context
T-0499 verifier note: produce.ts:2078-2086 guard covers only the T-0298 semantic repair; SURFACE_DROPPED (T-0281), SURFACE_CLAIMED (T-0442), CHANGE_CLAIMED (T-0448) and T-0428 still fall to PARSE on an empty round. The hint constants sit at produce.ts:1176-1210 and are assembled at :762-765.

## Constraints
No model-read text changes; if one seems needed, stop and report it (it needs a Fable review). No em dashes.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- `npx vitest run packages/agent-ui/a2ui/src/live-agent/produce-empty-repair.test.ts` exits 0; its four T-0501 kind tests (SURFACE_DROPPED, SURFACE_CLAIMED, CHANGE_CLAIMED, T-0428) fail at base 993df8785 with the PARSE hint sent instead of the repair.
- `npx vitest run packages/agent-ui/a2ui/src/agent packages/agent-ui/a2ui/src/live-agent` exits 0.
- `npm run check` exits 0.
- `git diff --quiet 993df87857a23e6427d71ae2e08f892e9df36880 -- packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.baseline.json` exits 0, and no hint constant in produce.ts changes.

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 993df87857a2
- Changed: an empty round after any forced repair re-sends that repair ask instead of the PARSE hint
- Commits: none
- Check: 1 produce-empty-repair.test.ts exits 0 and its four T-0501 kind tests fail at base 993df8785 with t...: pass
- Check: 2 `npx vitest run packages/agent-ui/a2ui/src/agent packages/agent-ui/a2ui/src/live-agent` exits 0: pass
- Check: 3 `npm run check` exits 0: pass
- Check: 4 prompt-equivalence baseline untouched and no hint constant changed: pass
- Follow-up: note: produce.ts:2014-2018 and :1948-1952, :2136-2140: the valid-round... -> notes.md
