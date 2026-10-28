---
id: T-0510
title: "Null and zero guards in browser tests become anti-vacuous asserts"
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
The five browser tests whose assert sits behind a null or zero guard (M1) and the low findings L1, L2, L5 and L8 assert the precondition instead, so a missing part or unresolved token fails the test.

## Intent
- Do: replace each guard with an explicit precondition assert (non-null, greater than zero) then the original assert; keep each test's claim otherwise identical. This covers the T-0495 swatch guard in text-field-geometry.browser.test.ts.
- Non-goals: production code.
- Done when: each changed test fails when its precondition is broken (one mutation per file noted in the report); `npm run check` and the touched tests (browser through `scripts/gate_lock.py`) exit 0.

## Context
From the T-0508 weak-test sweep (#2311), findings copied here:

M1. Guard drops the whole assert when the part is absent (the T-0495 shape):
- `packages/agent-ui/components/src/controls/text-field/text-field-geometry.browser.test.ts:871` `if (value !== null)`: today ui-swatch builds `[data-part="value"]` synchronously in its `connected()` effect (`swatch.ts:57-63`), so it runs; a rename or a lazy build turns the T-0495 regression test into a pass. Fix: `expect(value, 'anti-vacuous').not.toBeNull()` before the block, drop the `if`.
- `packages/agent-ui/components/src/controls/timeline-item/timeline-item.browser.test.ts:285` `if (details)`: same shape; selector matches today via ui-disclosure's `[data-part="details"]`. Fix: assert non-null, drop the `if`.
- `packages/agent-ui/components/src/controls/otp-field/otp-field.browser.test.ts:300` `if (describedBy !== null)`: if the editor loses `aria-describedby` entirely the "never the echo" test still passes (the no-id check above keeps half the claim). Fix: assert `describedBy` equals `message.id` unconditionally, or assert the null case explicitly.
- `packages/agent-ui/components/src/controls/form-popover/form-popover.browser.test.ts:338` `if (lgHeight > 0)`: the ramp check vanishes if `--md-sys-height-lg` stops resolving. Fix: `expect(lgHeight).toBeGreaterThan(0)` first.
- `packages/agent-ui/app/src/controls/conversation/conversation.browser.test.ts:1832` `if (after.display !== 'none')`: if every step's rail pseudo goes `display: none`, the "rail runs through the marker centre" check never runs. Fix: count the steps that measured a rail and expect at least one.
Proposed ticket: "Turn null and zero guards in five browser tests into anti-vacuous asserts".

Low findings folded in:
L1. `packages/agent-ui/components/src/controls/calendar/calendar.browser.test.ts:1601` `if (outside)`: July 2026 always has outside days, so it runs; a non-null assert makes that explicit.
L2. `packages/agent-ui/app/src/controls/agent-admin/genui-pack-library.test.ts:32` `if (library.length < 2) return`: three packs ship today, so it runs; the guard would silently retire it if packs shrank. Fix: `expect(library.length).toBeGreaterThanOrEqual(2)`.
L5. `packages/agent-ui/a2ui/src/live-agent/model-capabilities.test.ts:67-71`: the effort and thinking checks are guarded per combination; nothing pins that at least one combination sends `thinking` or `output_config.effort`. Fix: count the guarded hits and expect each to be non-zero.
L8. `packages/agent-ui/components/src/controls/css-order.browser.test.ts:238` `getPropertyValue('--ui-container-bg').trim()).not.toBe('')` is a resolves-to-anything assert; the next line's `backgroundColor` not transparent carries the claim. Fix: compare the value to the seed token.

## Constraints
Tests only. No em dashes. No paid runs.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 0008a066a97d
- Changed: Null and zero guards in browser tests become precondition asserts, which also exposed two checks that never ran
- Commits: none
- Check: 1 Each guarded assert in M1 (text-field swatch, timeline-item details, otp-field describedBy, form-...: pass
- Check: 2 Each changed test fails when its precondition breaks (one mutation per file in the report): pass
- Check: 3 `npm run check` exit 0: pass
- Check: 4 Touched tests exit 0: pass
- Follow-up: note: verifier did not re-run the builder's per-file mutations; bite... -> notes.md
