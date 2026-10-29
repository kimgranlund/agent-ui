---
id: T-0543
title: "A standing browser test proves no control leaks listeners, observers, intervals or popovers after removal"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L1
priority: P2         # P1 | P2 | P3
depends: []
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
A standing `*.browser.test.ts` in the components (or app) shard connects, removes and reconnects every registered control and the app hosts, and fails if any window or document listener, observer, interval or open popover survives removal, or if host listener counts grow across reconnect.

## Intent
- Do: promote the T-0535 probe (its files are in this ticket's artifacts dir under `probe/`) into the repo's browser test layout and shard config without re-monolithing the shards (skill `component-testing`); keep it under a sensible time budget; prove it bites by adding a scratch leaking listener to one control (noted, reverted).
- Done when: the test passes on the tree in Chromium (WebKit too if its instrumentation works there, else say why) and fails under the mutation; `npm run check` exits 0.

## Context
From the T-0535 cleanup and leak sweep (#2336):

### High
None confirmed. No listener, observer, interval or top-layer leak reproduced in a real engine, and no static read found a global listener or observer outside a released path.
- Proposed ticket (High group): none for a defect. Optional chore: promote the probe to a standing `*.browser.test.ts` gate in the components shard (assert zero globals/observers/intervals after removal and equal host listener counts across reconnects for every `CONTROLS` tag) so a future control cannot regress the fleet-wide zero.

## Constraints
Browser runs through `scripts/gate_lock.py`. No em dashes.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 006e977b7e5d
- Changed: A standing leak gate connects, removes and reconnects every control and app host in both engines and fails on any leaked listener, observer, interval or popover
- Commits: none
- Check: 1 The leak gate passes on the tree in Chromium (and WebKit if instrumentation works): pass
- Check: 2 The gate fails under a mutation: pass
- Check: 3 `npm run check` exits 0: pass
- Check: 4 Shards not re-monolithed: pass
- Follow-up: decide: packages/agent-ui/app/src/leak-gate.browser.test.ts: ui-agent-admin... -> notes.md
- Follow-up: note: the ResizeObserver loop console errors are noisy in the run output... -> notes.md
