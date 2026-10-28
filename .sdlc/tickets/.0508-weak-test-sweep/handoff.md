---
id: T-0508
title: "Weak-test sweep: find tests and gates that pass without checking what they claim"
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
A ranked list of tests and gates in this repo that can pass without checking what they claim, each with file:line, the weakness and a one-line fix, so the real ones become tickets.

## Intent
- Do: read-only sweep using the checks-that-bite bestiary: asserts behind a guard that skips them (`if (x !== null) expect(...)`), always-true predicates (typeof checks, computed styles that always resolve), exit-code-only asserts on commands that print failures, `grep -q` on paths that may not exist, `.skip`/`.todo` left in, loops that may run zero times, snapshot tests of empty output. Cover the components, a2ui, app and site tests and the `check:scripts` gates. Write findings to the handoff `## Findings` grouped High / Medium / Low, with a proposed ticket title per group of related findings.
- Non-goals: fixing anything; flaky-gate triage.
- Done when: `## Findings` lists each finding with file:line, why it can pass vacuously, and the fix; High findings were confirmed by reading the code (a mutation run where cheap); `git status --short -- . ':!.sdlc'` prints nothing.

## Context
Two recent instances: T-0495's `if (value !== null)` guard in text-field-geometry.browser.test.ts and the T-0501 repair sites with no test. AGENTS.md: judge by exit code, never by grepping output.

## Constraints
Read-only outside `.sdlc`. No em dashes. No paid runs.
- Lane: solo because size L2 (steps.py lane)

## Findings

Sweep at base 97e49c89b over 1242 `*.test.ts` / `*.test.mjs` files plus the `check:scripts` gates. Method: scripted greps for each checks-that-bite shape (asserts behind an `if`, `if (...) return` bail-outs, `?? <expected>` fallbacks, zero-iteration loops over `querySelectorAll`, `try/catch` asserts with no throw pinned, always-true literals, exit-code-only asserts, `.skip/.todo/.only`, snapshots), then each hit read in context. A guard counted as safe when the lines above already assert its discriminant (the `expect(r.ok).toBe(true); if (r.ok) ...` narrowing idiom, about 115 sites, all fine).

Clean classes (no finding): no `.skip`, `.todo`, `.only` or `xit` left in; every `skipIf` is the documented `server.browser !== 'chromium'` visual split or an `armed` writer; no snapshot tests; no `querySelector(...)).toBeDefined()`; the 26 exit-code asserts all pair with an output assert or a script that exits non-zero on failure; every `check:scripts` gate script has an exit-1 path (grep-checked for all 24; read in full: reap-branches, dev-server, hook_selftests, claude_wiring_check, eval-judge's `check` arm) and none uses `grep -q` or `|| true`; CI workflows carry no `continue-on-error`. The 98 `expect(typeof x).toBe(...)` hits are 44 tests whose only runtime assert is a typeof: 40 are compile-time negative controls whose bite is an `@ts-expect-error` checked by `tsc` (root `include` covers `packages/agent-ui/*/src`), two are barrel-export smokes, one is the DecompressionStream capability canary, and the one real always-true case is M4. The 13 `it` bodies with no `expect` all assert through a helper that throws (`waitUntil`, `near`, `completeThenClose`, `until`) or are `armed` writers.

### High

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

### Medium

M1. Guard drops the whole assert when the part is absent (the T-0495 shape):
- `packages/agent-ui/components/src/controls/text-field/text-field-geometry.browser.test.ts:871` `if (value !== null)`: today ui-swatch builds `[data-part="value"]` synchronously in its `connected()` effect (`swatch.ts:57-63`), so it runs; a rename or a lazy build turns the T-0495 regression test into a pass. Fix: `expect(value, 'anti-vacuous').not.toBeNull()` before the block, drop the `if`.
- `packages/agent-ui/components/src/controls/timeline-item/timeline-item.browser.test.ts:285` `if (details)`: same shape; selector matches today via ui-disclosure's `[data-part="details"]`. Fix: assert non-null, drop the `if`.
- `packages/agent-ui/components/src/controls/otp-field/otp-field.browser.test.ts:300` `if (describedBy !== null)`: if the editor loses `aria-describedby` entirely the "never the echo" test still passes (the no-id check above keeps half the claim). Fix: assert `describedBy` equals `message.id` unconditionally, or assert the null case explicitly.
- `packages/agent-ui/components/src/controls/form-popover/form-popover.browser.test.ts:338` `if (lgHeight > 0)`: the ramp check vanishes if `--md-sys-height-lg` stops resolving. Fix: `expect(lgHeight).toBeGreaterThan(0)` first.
- `packages/agent-ui/app/src/controls/conversation/conversation.browser.test.ts:1832` `if (after.display !== 'none')`: if every step's rail pseudo goes `display: none`, the "rail runs through the marker centre" check never runs. Fix: count the steps that measured a rail and expect at least one.
Proposed ticket: "Turn null and zero guards in five browser tests into anti-vacuous asserts".

M2. Zero-iteration loops: the whole claim sits inside a loop over `querySelectorAll` with no count asserted, so an empty render passes.
- `packages/agent-ui/components/src/controls/command-modal/command-modal.test.ts:219` (ids on options)
- `packages/agent-ui/components/src/controls/playing-card/playing-card.test.ts:208` (index text)
- `packages/agent-ui/components/src/controls/select/select.test.ts:306` (group aria-labelledby)
- `packages/agent-ui/components/src/controls/select/select.test.ts:778`, `combo-box/combo-box.test.ts:1289,1312` (aria-selected all false)
- `packages/agent-ui/app/src/controls/agent-admin/agent-admin.test.ts:201` (absence of `data-availability` on rows: empty list or broken render both pass)
- `packages/agent-ui/app/src/controls/super-shell/super-shell-bar-seam.browser.test.ts:340` (corner radii)
- `packages/agent-ui/components/src/controls/amount-picker/amount-picker.browser.test.ts:168` (preset chip height)
- `packages/agent-ui/components/src/controls/suggestions/suggestions.browser.test.ts:92-98` (gap only checked for same-row pairs; a fully wrapped layout checks nothing)
- `site/pages/table-doc.browser.test.ts:53` (no width cap on specimen tables)
Why vacuous: `for (x of [])` asserts nothing. Fix: `expect(list.length, 'anti-vacuous').toBe(<n>)` (or `toBeGreaterThan(0)`) before each loop; for suggestions count the same-row pairs measured.
Proposed ticket: "Anti-vacuous counts before ten assert-in-loop tests".

M3. Assert in `catch` with no throw pinned, or bail-out before the assert:
- `packages/agent-ui/devtools/src/capture/format.test.ts:128-136`: if `parseCapture` stops throwing on `backend: 'nope'`, the message test passes with no assert. Fix: `expect(() => ...).toThrow(/backend/)` and `/replay \| proxy \| a2a/`, or `expect.assertions(2)`.
- `packages/agent-ui/app/src/controls/agent-admin/skill-pack-opt-in.test.ts:204` `if (!minted.ok) return`, then only `.not.toContain` asserts: a failed mint or an empty composer both pass. Fix: `expect(minted.ok).toBe(true)` before the return, and one positive `toContain` with the copy enabled.
- `site/pages/agent-admin-persona-file.test.ts:621` `if (!result.ok) return` with no `expect(result.ok)` above. Fix: assert `result.ok` first.
Proposed ticket: "Pin the throw or the ok before three early-exit tests".

M4. `packages/agent-ui/components/src/controls/drill/drill.browser.test.ts:179` `expect(typeof transition).toBe('string')`: `getComputedStyle(...).transitionDuration` is always a string, so the test titled "a transition declaration that is neutralized under prefers-reduced-motion" checks neither the declaration nor the neutralization (`reduced` is computed and discarded). Fix: assert `transitionDuration` is not `0s` normally and is `0s` under CDP reduced-motion emulation (the `status-stream.browser.test.ts:353` Chromium-only leg shape).
Proposed ticket: "drill reduced-motion test asserts the real transition duration"

### Low

L1. `packages/agent-ui/components/src/controls/calendar/calendar.browser.test.ts:1601` `if (outside)`: July 2026 always has outside days, so it runs; a non-null assert makes that explicit.
L2. `packages/agent-ui/app/src/controls/agent-admin/genui-pack-library.test.ts:32` `if (library.length < 2) return`: three packs ship today, so it runs; the guard would silently retire it if packs shrank. Fix: `expect(library.length).toBeGreaterThanOrEqual(2)`.
L3. `site/lib/docs-grammar.test.ts:279` `expect(true).toBe(true)` in a "reported, non-failing" hygiene test: a warning dressed as a passing test. Fix: move to a script or `it.todo` with the note.
L4. `site/pages/dogfood-render.browser.test.ts:1139`: the per-rule anti-vacuous check runs only when `visited.size` equals the full subject count, so any filtered or partially failing run silently skips it (the failing subject still reds the file). Fix: log when skipped.
L5. `packages/agent-ui/a2ui/src/live-agent/model-capabilities.test.ts:67-71`: the effort and thinking checks are guarded per combination; nothing pins that at least one combination sends `thinking` or `output_config.effort`. Fix: count the guarded hits and expect each to be non-zero.
L6. `packages/agent-ui/a2ui/src/agent/asset-source.test.ts:29-33`, `devtools/src/capture/format.test.ts:101-105`: catch-block asserts already preceded by a `toThrow` on the same call, so safe; style only.
L7. Deliberate empty-state passes in gates: `scripts/hook_selftests.py:76-86` (no hooks dir and nothing registered), `scripts/claude_wiring_check.py:66-69` (no `.claude/agents` dir) and `:117` (the anchor sweep is advisory and always returns 0). Fine today, listed for completeness.
L8. `packages/agent-ui/components/src/controls/css-order.browser.test.ts:238` `getPropertyValue('--ui-container-bg').trim()).not.toBe('')` is a resolves-to-anything assert; the next line's `backgroundColor` not transparent carries the claim. Fix: compare the value to the seed token.
Proposed ticket: none on its own; fold L1, L2, L5 and L8 into the M1 ticket if it runs.

Out of scope here: the T-0501 repair sites with no test are ticket 0504 (`0504-pin-untested-repair-paths`).

## Acceptance criteria
- `## Findings` groups findings High / Medium / Low, each with file:line, why it can pass vacuously, and a fix, plus a proposed ticket title per group.
- Each High finding is confirmed by reading the code; H1 also carries a mutation run (state add swapped for delete, jsdom suites stay green, reverted).
- `git status --short -- . ':!.sdlc'` prints nothing.

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 97e49c89b1b1
- Changed: Weak-test sweep: ranked findings of tests that can pass without checking what they claim
- Commits: none
- Check: 1 `## Findings` groups findings High / Medium / Low, each with file:line, why it can pass vacuously...: pass
- Check: 2 Each High finding confirmed by reading the code; H1 carries a mutation run (state add swapped for...: pass
- Check: 3 `git status --short -- . ':!.sdlc'` prints nothing: pass
- Follow-up: note: .sdlc/tickets/0508-weak-test-sweep/handoff.md Findings: M4... -> notes.md
- Follow-up: note: no em dashes in handoff.md grep count 0. -> notes.md
