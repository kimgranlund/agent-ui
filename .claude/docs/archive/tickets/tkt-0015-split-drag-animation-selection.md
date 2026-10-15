---
doc-type: ticket
id: tkt-0015
status: done
date: 2026-07-10
owner:
kind: bug
---
# TKT-0015 — ui-split: manual drag must not animate, and selection must suspend while dragging

## Summary
Kim's report (2026-07-10, against the just-shipped `ui-split`, commit `cab5e1a`): (1) the
split-pane ANIMATES during a click-and-drag manual resize — it should track the pointer
instantly; (2) text/user selection should SUSPEND while a drag is active (dragging across pane
content currently selects it).

## Acceptance
- The perceived drag animation is pinned with real browser evidence (no CSS transition exists
  in either sheet — verified at capture — so the cause is elsewhere: candidates below) and
  eliminated: pane geometry tracks the pointer with no easing/lag.
- During an active separator drag, user selection is suppressed EVERYWHERE the drag can sweep
  (the panes' content, not just the separator — which already carries `user-select: none`),
  and restored on release/abort (incl. the abortDrag path).
- Browser regression tests pin both behaviors (both engines; INSTRUMENT-BRIDGE for the drag
  mechanics per the split precedent); descriptors/docs stay truthful (split.css:18's "always
  instant" claim must become TRUE, and the build decision that dropped `[data-dragging]` as
  vacuous is revisited — the state has a real consumer now).
- Gates green.

## Repro
Any ui-split demo (split-doc/split-demo pages): click a separator and drag — the panes ease
toward the pointer rather than tracking it; drag across text content — it gets selected.

## Expected vs actual
- **Expected:** instant 1:1 pointer tracking; no selection while dragging.
- **Actual:** eased/laggy pane motion; content selection during the sweep.

## Classification
Axis: **interaction/functional** — plane `controls/split/` + `traits/pane-resize.ts`.
Capture-time facts: NO `transition`/`animation` exists in split.css/split-pane.css (grep-clean
— the build's decision #6 and its review both verified), so candidate causes for (1):
- the drag pipeline's frame lag — pointer event → `input` emit → ratio signal → the batched
  render effect → `--_pane-flex` style write (a scheduler hop that may land a frame behind, or
  an rAF throttle inside pane-resize if one exists);
- an INHERITED transition from outside the split sheets (a container/site rule matching the
  panes — `container.css` has none on the flex properties, but the cascade needs a real
  computed-style check);
- `flex: var(--_pane-flex) 0 0%` distribution semantics reading as eased when neighboring
  ratios renormalize.
For (2): `user-select: none` exists ONLY on the separator (split.css:58-59); no
`[data-dragging]` state exists (dropped as vacuous-for-transitions at build — decision #6);
the standard remedy is a drag-active marker on the host suppressing selection over the whole
split (and possibly `document` — a fast drag sweeps outside the host; judge against the
platform norm and what pane-resize's capture semantics already guarantee).

## Severity
**minor** — interaction polish on a shipped control; resize works, but the feel is wrong and
selection is a real annoyance.

## Links
- `packages/agent-ui/components/src/controls/split/{split.ts,split.css,split-pane.css}` ·
  `traits/pane-resize.ts` — the drag pipeline.
- `.claude/docs/spec/app-surfaces-m4.spec.md` SPEC-R3/R5 — the drag + motion contracts.
- TKT-0014 (the toast X) — the sibling shipped-control polish ticket in flight.

## Findings

### 2026-07-10 — Part 1 root cause PINNED: a drag-math compounding bug, NOT a pipeline/CSS-transition lag

Investigated every candidate the ticket named, in order, with real evidence:

- **CSS transitions/cascade:** re-confirmed zero `transition`/`animation` in split.css/split-pane.css, and
  grepped the whole shared/site CSS surface (`foundation-styles.css`, `site/pages/_page.css`,
  `containers.css`, `split-doc.ts`'s demo wrapper) for any rule that could apply a transition to a pane or
  the host — none exists anywhere in the cascade. Ruled out.
- **Reactive-scheduler frame lag:** the `--_pane-flex` write rides `this.effect(() => this.#render())`,
  which is microtask-scheduled (`reactive/scheduler.ts`'s `queueMicrotask(flush)`) — not synchronous with
  the triggering signal write. BUT: `ui-slider`'s `--value-pct` geometry seam
  (`controls/_base/range-element.ts:109`) uses the IDENTICAL mechanism (`this.effect(...)` writing a
  geometry custom property from a drag-driven signal) and has no reported animation/lag — same pipeline,
  shipped without issue. A microtask queued during a task's synchronous execution always flushes before the
  browser's next paint (the browser never paints between a task and its own queued microtasks), so a REAL
  pointermove's geometry write lands same-frame regardless. Ruled out (the existing tests' `await
  el.updateComplete` requirement is a synthetic-dispatch test-harness artifact, not a production lag — no
  `rAF` throttle exists anywhere in `pane-resize.ts`/`split.ts`, confirmed by grep).
- **Flex distribution semantics:** `flex: var(--_pane-flex) 0 0%` is a plain, single-reflow proportional
  split — no averaging/interpolation over time. Ruled out.
- **ACTUAL root cause — a math compounding bug in `split.ts`'s `#applyPointerDelta`:** `pane-resize.ts`'s
  `deltaRatio` is documented and implemented as measured **SINCE THE PRESS POINT** (an absolute offset from
  drag start, re-derived fresh on every `pointermove` — see its own doc comment, "re-snapshot the rect on
  each move" / "since the press point"). The pre-fix `#applyPointerDelta` resolved this via
  `redistribute(this.#effectiveRatios(panes), sepIndex, deltaRatio, bounds)` — i.e. it applied the
  since-press delta against the **LIVE, already-mutated** ratio vector (which itself already reflects every
  prior move's application, since `#commitRatios` overwrites `#ratios.value` on every live move). This
  double-counts every prior move's contribution on each subsequent move. **Measured proof** (isolated
  `redistribute()` repro, 2-pane 50/50 start, track width 200px, press at x=0): move to x=40 (delta 0.2
  since press) correctly produced ratio `[0.7, 0.3]`; the SECOND move to x=60 (delta 0.3 since press, NOT
  incremental) should have produced `[0.8, 0.2]` (0.5 + 0.3 from the original baseline) but the pre-fix code
  produced `[1.0, 0.0]` — a full 0.2 overshoot, exactly the double-counted move-1 delta. Since a real drag
  fires many `pointermove` events, this compounds every single tick, racing the separator far ahead of the
  actual net pointer travel and reads as "easing"/"animating" toward a resting position that isn't 1:1 with
  the cursor.
- **Fix:** `split.ts` now snapshots the effective ratios ONCE, at the drag's first live move
  (`#dragBaseline`), and resolves every subsequent since-press delta in that SAME drag against that fixed
  baseline (never the live vector). Cleared on commit (drag end) and on the mid-drag `abortDrag()` path
  (SPEC-R2 AC6) so the next drag re-snapshots fresh. The keyboard path (`#applyKeyDelta` /
  `#resolveKeyDelta`) is unaffected — a discrete key press is a genuine increment against the current ratios
  and was already correct.
- **Regression tests** (both engines, `split.browser.test.ts`): three sequential moves resolving to the
  exact expected ratio at each step (the pre-fix math would land the 2nd move at ratio 1.0 instead of 0.8);
  a single large move vs. 8 small moves covering the same net distance landing at the identical final ratio
  (the assertion that bites hardest against compounding, since more ticks ⇒ more overshoot under the bug).

### 2026-07-10 — Part 2: selection suspension shipped via a NEW `:state(dragging)` custom state

`[data-dragging]` was dropped at build as vacuous (no CSS consumed it); it now has a real consumer.
Followed the fleet's existing precedent for internal, non-authorable interaction-state markers
(`ui-button`'s motion-gate state, `ui-combo-box`'s validity-gate state — both `ElementInternals.states`,
never a host attribute) rather than reviving the dropped attribute. `split.ts` arms the state on the
drag's first live move and disarms it on commit (release) AND on the silent `abortDrag()` path (mid-drag
pane-count mutation, SPEC-R2 AC6) and on `disconnected()` — all three release paths verified by browser
tests. `split.css` suppresses `user-select` on `:scope` (the WHOLE host, not just the separator) while the
state holds; host-level scope is sufficient because `setPointerCapture` on the separator keeps every
`pointermove` routed to it regardless of where the cursor sweeps (SPEC-R3 AC2 capture-continuity already
proven), so a `document`-level rule would add nothing. Selection is an inherited CSS property, so pane
CONTENT (not just the host) is covered without a separate rule per pane. Descriptor updated
(`split.md`'s `customStates: [dragging]`) — the `collectUsedStates` contract↔source trip-wire
(`split-descriptor.test.ts`) now mechanically checks this against real `.ts`/`.css` usage (0 drift).

### 2026-07-10 — Gates

`npm run check` (tsc + site + tools) green. jsdom `split.test.ts` (30 tests) / `split-descriptor.test.ts`
(19 tests) / `split-pane.test.ts` / `constrain.test.ts` / `pane-resize.test.ts` all green (115 tests, 1
file). Cross-engine browser suite (`vitest.browser.config.ts`, Chromium + WebKit):
`split.browser.test.ts` 16 tests × 2 engines = 32 passed (10 pre-existing + 6 new TKT-0015 regression
tests); `pane-resize.test.ts`, `slider.browser.test.ts`, `slider-multi.browser.test.ts` re-run alongside as
a shared-mechanism regression check (108 tests total across both engines) — all green, confirming the
`redistribute`/geometry-seam pattern the slider family shares was untouched. SPEC-R3/R5 amended (this repo's
`app-surfaces-m4.spec.md`) with the 1:1-tracking clause + AC5, and the selection-suspension clause + AC4 —
both annotated TKT-0015, review-driven, not self-ratified (the SPEC's `proposed` status is unchanged).
split.css:18's "always instant" claim needed no repair — it was already true; the perceived animation was
JS math, never a CSS transition (documented in the file header alongside the new state's rationale).
