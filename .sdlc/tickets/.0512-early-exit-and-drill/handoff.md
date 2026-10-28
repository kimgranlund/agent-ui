---
id: T-0512
title: "Early-exit tests pin the throw or the ok, and the drill reduced-motion test asserts the real duration"
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
The three early-exit or catch-assert tests (M3) pin the throw or the ok before asserting, and the drill reduced-motion test (M4) asserts the real transition duration under reduced motion.

## Intent
- Do: use `expect(() => ...).toThrow(...)` or `expect(result.ok).toBe(true)` before the dependent asserts; in drill.browser.test.ts assert the reduced-motion duration value instead of `typeof`.
- Non-goals: production code.
- Done when: each changed test fails when the pinned behavior changes (mutation noted); `npm run check` and the touched tests (browser through `scripts/gate_lock.py`) exit 0.

## Context
From the T-0508 weak-test sweep (#2311), findings copied here:

M3. Assert in `catch` with no throw pinned, or bail-out before the assert:
- `packages/agent-ui/devtools/src/capture/format.test.ts:128-136`: if `parseCapture` stops throwing on `backend: 'nope'`, the message test passes with no assert. Fix: `expect(() => ...).toThrow(/backend/)` and `/replay \| proxy \| a2a/`, or `expect.assertions(2)`.
- `packages/agent-ui/app/src/controls/agent-admin/skill-pack-opt-in.test.ts:204` `if (!minted.ok) return`, then only `.not.toContain` asserts: a failed mint or an empty composer both pass. Fix: `expect(minted.ok).toBe(true)` before the return, and one positive `toContain` with the copy enabled.
- `site/pages/agent-admin-persona-file.test.ts:621` `if (!result.ok) return` with no `expect(result.ok)` above. Fix: assert `result.ok` first.
Proposed ticket: "Pin the throw or the ok before three early-exit tests".

M4. `packages/agent-ui/components/src/controls/drill/drill.browser.test.ts:179` `expect(typeof transition).toBe('string')`: `getComputedStyle(...).transitionDuration` is always a string, so the test titled "a transition declaration that is neutralized under prefers-reduced-motion" checks neither the declaration nor the neutralization (`reduced` is computed and discarded). Fix: assert `transitionDuration` is not `0s` normally and is `0s` under CDP reduced-motion emulation (the `status-stream.browser.test.ts:353` Chromium-only leg shape).
Proposed ticket: "drill reduced-motion test asserts the real transition duration"

## Constraints
Tests only. No em dashes. No paid runs.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 0008a066a97d
- Changed: Early-exit tests pin the throw or the ok, and the drill reduced-motion test asserts the real duration
- Commits: none
- Check: 1 Do: the three early-exit tests pin the throw or the ok before the dependent asserts, and the dril...: pass
- Check: 2 Done when: each changed test fails when the pinned behavior changes: pass
- Check: 3 Done when: `npm run check` and the touched tests (browser through gate_lock.py) exit 0: pass
- Check: 4 Non-goals: no production code: pass
- Follow-up: note: packages/agent-ui/app/src/controls/agent-admin/skill-pack-opt-in.te... -> notes.md
- Follow-up: note: other if !x.ok return sites in skill-pack-opt-in.test.ts and... -> notes.md
