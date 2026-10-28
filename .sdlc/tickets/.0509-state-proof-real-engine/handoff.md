---
id: T-0509
title: "Real-engine :state() proof for answered, pending, dragging, checked and indeterminate; jsdom state guards report as skipped"
type: chore           # feature | bug | chore | spike | idea
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
Every `:state()` claim that today sits behind a jsdom `if (internals.states)` guard or a `?? true` fallback is proven in a real engine, and the jsdom tests report it as skipped rather than passing with no assert.

## Intent
- Do: add browser-leg assertions (`el.matches(':state(x)')`) for each H1 control and state with no real-engine proof; convert the jsdom guards in H1 and H2 to `it.skipIf(!('states' in ElementInternals.prototype))` or an equivalent that counts as skipped; drop the `?? true` / `?? false` fallbacks.
- Non-goals: control source changes (if a state is genuinely broken in the browser, stop and report it).
- Done when: each new browser assertion reds when its state's add is swapped for delete (one mutation shown per control family in the report); `npm run check` and the touched jsdom and browser tests (browser through `scripts/gate_lock.py`) exit 0.

## Context
From the T-0508 weak-test sweep (#2311), findings copied here:

H1. jsdom `:state()` asserts that never run, with no real-engine leg either. jsdom 29.1.1 has no `CustomStateSet` (`node -e` on the repo's jsdom: `'states' in ElementInternals.prototype` is false; `vitest.config.ts` sets `environment: 'jsdom'` with no setup polyfill), so every `if (internals.states)` / `if (!states) return` / `states?.has(x) ?? x` assert below is dead code in `npm test`. Confirmed by mutation: swapping `states?.add` for `states?.delete` at `multi-select.ts:229` (answered) and `status-stream.ts:387` (pending) left `multi-select.test.ts` and `status-stream.test.ts` green, 174 of 174 (reverted, tree clean). For these states no `*.browser.test.ts` anywhere matches `:state(<name>)` or `has('<name>')`, so nothing in the repo checks them:
- `packages/agent-ui/components/src/controls/multi-select/multi-select.test.ts:438,442` (answered)
- `packages/agent-ui/components/src/controls/combo-box/combo-box.test.ts:1566` (answered, whole test returns early)
- `packages/agent-ui/components/src/controls/radio/radio-group.test.ts:605` (answered, returns early)
- `packages/agent-ui/components/src/controls/segmented-control/segmented-control.test.ts:105` (answered, returns early)
- `packages/agent-ui/components/src/controls/select/select.test.ts:1372` (answered, returns early)
- `packages/agent-ui/components/src/controls/switch/switch.test.ts:122` (answered, returns early)
- `packages/agent-ui/components/src/controls/status-stream/status-stream.test.ts:1366,1389,1406` (pending, three whole tests return early)
- `packages/agent-ui/components/src/controls/file-drop/file-drop.test.ts:167,170` (dragging; `file-drop.browser.test.ts:100` names `:state(dragging)` in its describe title but its one test only checks `disabled`)
- `packages/agent-ui/components/src/controls/checkbox/checkbox.test.ts:244-283` (checked, indeterminate: only indirect, `checkbox.browser.test.ts:76-90` reads the `::after` mark geometry under `checked` / `indeterminate`, never the state itself)
Why vacuous: the guard is false in the only runner that executes these files. Fix: per control, one browser-leg test `el.matches(':state(<name>)')` toggled both ways (the `checkbox/answered-state.browser.test.ts` shape); in the jsdom file replace the silent guard with `it.skipIf(!('states' in ElementInternals.prototype))` so the skip is reported, not a pass.
Proposed ticket: "Real-engine :state() proof for answered, pending, dragging, checked and indeterminate; jsdom state guards report as skipped".

H2. Same jsdom-gated family where a browser leg does exist, so the claim is covered elsewhere but the jsdom test still reports a pass for an assert it never made:
- `packages/agent-ui/components/src/controls/choice-card/choice-card.test.ts:84,95` (`states?.has('selected') ?? true).toBe(true)`: the fallback IS the expected value, an always-true predicate; browser leg `choice-card.browser.test.ts:122`)
- `packages/agent-ui/components/src/controls/file-drop/file-drop.test.ts:104,116`, `multi-select/multi-select.test.ts:422,426` (disabled; browser legs exist)
- `packages/agent-ui/components/src/controls/toggle/toggle.test.ts:132,142`, `switch/switch.test.ts:104`, `playing-card/playing-card.test.ts:253`, `_base/indicator-element.test.ts:151,159`, `packages/agent-ui/app/src/controls/surface-host/surface-host.test.ts:914,919`
Why vacuous: green in jsdom with zero assertions on the named state. Fix: fold into the H1 ticket (`it.skipIf` so the count is honest; drop the `?? true` / `?? false` fallbacks). Ranked High only because H1's fix is the same edit across these files.

## Constraints
Tests only. No em dashes. No paid runs.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
1. The touched jsdom suites pass with the 22 CustomStateSet tests reported as skipped and no silent state guard or `?? true` / `?? false` fallback left: `npx vitest run packages/agent-ui/components/src/controls/multi-select/multi-select.test.ts packages/agent-ui/components/src/controls/combo-box/combo-box.test.ts packages/agent-ui/components/src/controls/radio/radio-group.test.ts packages/agent-ui/components/src/controls/segmented-control/segmented-control.test.ts packages/agent-ui/components/src/controls/select/select.test.ts packages/agent-ui/components/src/controls/switch/switch.test.ts packages/agent-ui/components/src/controls/status-stream/status-stream.test.ts packages/agent-ui/components/src/controls/file-drop/file-drop.test.ts packages/agent-ui/components/src/controls/checkbox/checkbox.test.ts packages/agent-ui/components/src/controls/choice-card/choice-card.test.ts packages/agent-ui/components/src/controls/toggle/toggle.test.ts packages/agent-ui/components/src/controls/playing-card/playing-card.test.ts packages/agent-ui/components/src/controls/_base/indicator-element.test.ts packages/agent-ui/app/src/controls/surface-host/surface-host.test.ts`
2. The new real-engine legs (answered x6, checked, indeterminate, pending, dragging) pass in Chromium and WebKit: `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.39.0/scripts/gate_lock.py run --need compute_units=2 --nice -- npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/answered-state.browser.test.ts packages/agent-ui/components/src/controls/checkbox/checked-state.browser.test.ts packages/agent-ui/components/src/controls/file-drop/file-drop.browser.test.ts packages/agent-ui/components/src/controls/status-stream/status-stream.browser.test.ts`
3. Each new browser assertion reds when its state's add is swapped for delete (mutation evidence in the solo report; source reverted after).
4. The standing gate: `npm run check`

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 0008a066a97d
- Changed: Real-engine :state() proof for answered, pending, dragging, checked and indeterminate; jsdom state guards report as skipped
- Commits: none
- Check: 1 The 14 touched jsdom suites pass with 22 CustomStateSet tests skipped and no silent state guard o...: pass
- Check: 2 New real-engine legs (answered x6, checked, indeterminate, pending, dragging) pass in Chromium an...: pass
- Check: 3 Each new browser assertion reds when its state's add is swapped for delete: pass
- Check: 4 `npm run check`: pass
- Follow-up: note: packages/agent-ui/components/src/controls/_base/indicator-element.t... -> notes.md
- Follow-up: note: packages/agent-ui/components/src/controls/status-stream/status-stre... -> notes.md
- Follow-up: note: no red-checkpoint process deviation was printed by redck.py; no... -> notes.md
