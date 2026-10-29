---
id: T-0541
title: "status-stream re-arms ticking on reconnect, and a disconnected open overlay closes and emits close"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2         # P1 | P2 | P3
depends: [T-0538]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
A reconnected ui-status-stream resumes ticking, and every overlay-family control (popover, menu, select, combo-box, form-popover, modal, drawer, tooltip) that is disconnected while open ends closed: `open` becomes false and it emits `close` as if dismissed, so a reconnect does not re-show it.

## Intent
- Do: call the ticking re-arm from status-stream `connected()`; in `traits/overlay.ts` cleanup (and any control model effect that re-opens from `open`), set the host's `open` false and emit `close` on disconnect while open; record the rule in the overlay descriptors and the owning reference doc as Kim's 2026-10-28 ruling; one connect, disconnect, reconnect browser test per control, failing on base.
- Non-goals: other overlay behavior.
- Done when: the new tests fail on base and pass after in Chromium and WebKit through `scripts/gate_lock.py`; existing overlay tests pass; `npm run check` exits 0.

## Context
From the T-0535 cleanup and leak sweep (#2336):

### Medium
1. `packages/agent-ui/components/src/controls/status-stream/status-stream.ts:376` (`connected()`) never calls `#refreshTicking()`; `disconnected()` at `:420` calls `this.#stopTicking()`. The only re-arm callers are `:498` (`appendEntry`), `:533` (`update`) and `:969` (`oneline`). Evidence (run, `status-stream-reconnect`): intervals 1 while connected with an `active` entry, 0 after removal, 0 after reconnect, and the elapsed text did not change across 1.1 s after reconnect. A moved or re-attached stream shows frozen elapsed times until the next entry update. Fix: call `this.#refreshTicking()` at the end of `connected()`.
2. `packages/agent-ui/components/src/traits/overlay.ts:827` (`cleanup()`, registered at `:848` via `host.effect(() => cleanup)`) hides the popup on disconnect but emits no `close`/`toggle` and leaves the host `open` prop true; each control's model effect (`tooltip.ts:158`, `popover.ts:128`, and the `modal.ts:108` / drawer equivalents) re-opens on reconnect. Evidence (run, `*-open-reconnect`): for ui-popover, ui-menu, ui-select, ui-tooltip, ui-modal and ui-drawer, `open` stays true after removal and the panel or dialog is showing again after reconnect (1 open before, 1 open after). For a DOM move this preserves state, but a two-way bind sees `open` true while the element is detached with no event, a hover-only tooltip re-shows with no hover, and a modal re-runs `showModal()` (focus trap, inert page) on re-insertion. Fix: decide the contract per family; for tooltip at least, set `open = false` in `disconnected()`; for the rest either announce `close` on disconnect or document reopen-on-reconnect in the descriptors.

- Proposed ticket (Medium group): "Reconnect contract for timers and overlays": re-arm status-stream ticking in `connected()`, and rule the overlay family's open-across-disconnect behaviour (close tooltip on disconnect; announce or document for popover, menu, select, combo-box, form-popover, modal, drawer), each with a connect, disconnect, reconnect browser test.

Ruling (Kim 2026-10-28): close and emit close on disconnect while open.

## Constraints
Browser runs through `scripts/gate_lock.py`. No em dashes.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- `npm run check` exits 0.
- The new contract tests pass in Chromium and WebKit (all 18 failed on base 387b335bf with the source fix reverted): `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.40.0/scripts/gate_lock.py run --need compute_units=2 --nice -- npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/reconnect-contract.browser.test.ts`
- The touched jsdom suites pass: `npx vitest run packages/agent-ui/components/src/traits packages/agent-ui/components/src/controls/popover packages/agent-ui/components/src/controls/menu packages/agent-ui/components/src/controls/select packages/agent-ui/components/src/controls/combo-box packages/agent-ui/components/src/controls/form-popover packages/agent-ui/components/src/controls/modal packages/agent-ui/components/src/controls/drawer packages/agent-ui/components/src/controls/tooltip packages/agent-ui/components/src/controls/status-stream`
- The existing overlay browser suites still pass: `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.40.0/scripts/gate_lock.py run --need compute_units=6 --nice -- npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/popover packages/agent-ui/components/src/controls/menu packages/agent-ui/components/src/controls/select packages/agent-ui/components/src/controls/combo-box packages/agent-ui/components/src/controls/form-popover packages/agent-ui/components/src/controls/modal packages/agent-ui/components/src/controls/drawer packages/agent-ui/components/src/traits packages/agent-ui/components/src/leak-gate.browser.test.ts`

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 387b335bfaa1
- Changed: A reconnected ui-status-stream resumes ticking, and overlay controls removed while open end closed and emit close
- Commits: none
- Check: 1 `npm run check` exits 0: pass
- Check: 2 New contract tests pass in Chromium and WebKit, and failed on base: pass
- Check: 3 Touched jsdom suites pass: pass
- Check: 4 Existing overlay browser suites still pass: pass
- Follow-up: note: dependents of the changed overlay trait outside the criteria app... -> notes.md
- Follow-up: note: criteria #2 and #4 named gate_lock; the queue never granted a slot... -> notes.md
- Follow-up: note: packages/agent-ui/components/src/leak-gate.browser.test.ts... -> notes.md
