---
id: T-0456
title: "Round 13 fixes have keyless replay guards, and a strict tool use spike measures Haiku format failures"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-25
claimed_by: claude:a8ce3b21 2026-10-25
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The round 13 fixes cannot regress silently: each has a keyless replay test built from a live trace, and a short spike measures whether strict tool use removes Haiku's format failures.

## Context
T-0453's verifier: the cold compare fix "is proven only by the paid run". Same for StepFlow routing (T-0451), CHANGE_CLAIMED (T-0448) and the shopkeeper receipt (T-0452). `npm run chat:probe -- --from-trace` turns a live trace into a replay test. Round 13 traces: `.sdlc/evals/rounds/2026-10-24-r13-pattern/traces/2026-10-24.jsonl`; T-0453's live traces sit in its run records. T-0450's note proposed strict tool use; T-0453 samples 2 and 3 sent the a2uiMeta JSON as prose before one SURFACE_CLAIMED retry.

## Constraints
Replays are keyless and ride the existing scripts project. The spike spends under $2 and changes no default; it reports numbers and a recommendation.

## Done when
- One replay per fix (cold compare, shopkeeper receipt, StepFlow routing, CHANGE_CLAIMED), each red when its fix is reverted.
- A spike report in the artifacts dir: Haiku format-failure rate with and without strict tool use, same asks, with the recommendation.
- `npm run check` plus the touched folders' tests pass.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- The four guards pass on the current tree: `npx vitest run --project scripts scripts/e2e-admin/probe/replays/concierge-haiku-room-stepflow.test.mjs scripts/e2e-admin/probe/replays/shopkeeper-haiku-cart-receipt.test.mjs scripts/e2e-admin/probe/replays/shopkeeper-haiku-cold-compare.test.mjs scripts/e2e-admin/probe/replays/shopkeeper-haiku-add-claim-no-id.test.mjs` exits 0. CHANGE_CLAIMED (T-0448) is guarded by its existing r13 replays; the other three are new.
- Each guard goes red with its fix reverted (reverse-apply the fix commit's source, regenerate, run, restore): T-0451 `752995707` step-flow.md plus assets.gen.ts; T-0452 `71b85c74d` cart-summary SKILL.md alone, and the shopkeeper persona back to v4; T-0453 `2bd29f7f6` shopkeeper agent.md; T-0448 `8c4b9fe10` produce.ts. Logs in the artifacts dir `red/`.
- The spike report exists with both arms' numbers and a recommendation: `test -s .sdlc/runtime/tasks/0456-round13-replay-guards/spike-strict-tool-use.md` exits 0, and its spend is under $2.
- `npm run check` exits 0, and `npx vitest run --project scripts scripts/e2e-admin/probe` exits 0.

## Outcome

2026-10-25 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 609287843e27
- Changed: Round 13 fixes have keyless replay guards that go red when their fix is reverted; the strict tool use spike recommends not adopting it
- Commits: none
- Check: 1 The four guards pass on the current tree: pass
- Check: 2 Each guard goes red with its fix reverted: pass
- Check: 3 The spike report exists with both arms' numbers and a recommendation, spend under $2: pass
- Check: 4 `npm run check` exits 0, and `npx vitest run --project scripts scripts/e2e-admin/probe` exits 0: pass
- Follow-up: note: the T-0451 and T-0453 fixtures are the live runs' own probe... -> notes.md
- Follow-up: note: the persona and routing legs pin exact sentences, so a deliberate... -> notes.md
- Follow-up: note: the fix-revert recipe for T-0452 persona v4 is git show... -> notes.md
