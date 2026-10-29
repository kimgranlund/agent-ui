---
id: T-0524
title: "The remaining low weak-test findings (T-0508 L3, L4, L6, L7) assert what they claim"
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
The four remaining low findings from the T-0508 weak-test sweep assert what they claim, or say plainly in a comment why they are intentionally permissive.

## Intent
- Do: fix each finding below as its own line suggests; where a pass on empty input is the intended behavior of a gate (L7), keep it and add a test that the gate fails on a real violation if none exists.
- Non-goals: production code.
- Done when: each changed test or gate fails under a mutation that breaks its claim (noted per finding); `npm run check` and the touched tests exit 0.

## Context
From T-0508 (#2311):

L3. `site/lib/docs-grammar.test.ts:279` `expect(true).toBe(true)` in a "reported, non-failing" hygiene test: a warning dressed as a passing test. Fix: move to a script or `it.todo` with the note.
L4. `site/pages/dogfood-render.browser.test.ts:1139`: the per-rule anti-vacuous check runs only when `visited.size` equals the full subject count, so any filtered or partially failing run silently skips it (the failing subject still reds the file). Fix: log when skipped.
L6. `packages/agent-ui/a2ui/src/agent/asset-source.test.ts:29-33`, `devtools/src/capture/format.test.ts:101-105`: catch-block asserts already preceded by a `toThrow` on the same call, so safe; style only.
L7. Deliberate empty-state passes in gates: `scripts/hook_selftests.py:76-86` (no hooks dir and nothing registered), `scripts/claude_wiring_check.py:66-69` (no `.claude/agents` dir) and `:117` (the anchor sweep is advisory and always returns 0). Fine today, listed for completeness.

## Constraints
Tests and gate scripts only. No em dashes.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 7ec42c1856cb
- Changed: The remaining low weak-test findings assert their claim, and the hook and wiring gates gain bite selftests
- Commits: none
- Check: 1 Each changed test or gate fails under a mutation that breaks its claim: pass
- Check: 2 `npm run check` and the touched tests exit 0: pass
- Follow-up: note: site/pages/dogfood-render.browser.test.ts:1141 browser shard not... -> notes.md
