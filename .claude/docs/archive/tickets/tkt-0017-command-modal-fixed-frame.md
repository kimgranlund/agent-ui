---
doc-type: ticket
id: tkt-0017
status: done
date: 2026-07-11
owner:
kind: bug
---
# TKT-0017 — ui-command-modal needs a fixed size and position

## Summary
Kim's report (2026-07-11, against the still-uncommitted command-modal build): the palette
should have a FIXED size and position. Confirmed at capture: the nested `ui-modal`'s dialog
part centers in the top layer (`margin: auto`, modal.css:55) with `max-inline-size:
min(92vw, 32rem)` — a shrink-fit MAX, not a fixed width — and the list caps at 50vh with no
block reservation (command-modal.css:33,94). Net effect: the panel's width tracks its widest
option, its height tracks the filtered result count, and because it's vertically CENTERED,
every keystroke that changes the result count moves BOTH edges — the search field itself
jumps as you type. The CMD-K platform convention is the opposite: a fixed-width panel
anchored near the viewport TOP (~15-20vh), the search field never moving, only the list
region below it growing/shrinking (or scrolling) within a fixed frame.

## Acceptance
- The palette renders at a FIXED inline-size (a set width, not a max — small-viewport-floored)
  and a FIXED anchor position near the viewport top; the search field's box does not move as
  filtering changes results (browser-asserted: type → result count changes → the search
  rect is identical).
- The list region alone absorbs result-count changes (scrolling within its cap); judge
  fixed-total-height vs fixed-top-anchor-with-growing-list against the platform norm and
  state the call.
- The mechanism respects the composition boundary: if sizing/position needs to reach the
  nested ui-modal's dialog part, do it through a sanctioned seam (ui-modal's own tokens if
  they exist, or a documented composition rule) — never a fragile cross-control selector
  reach; if no seam exists, that's a small ui-modal token addition (its own descriptor
  updated).
- Cross-engine regression tests; descriptors/docs truthful; rides the SAME pre-commit cycle
  as the uncommitted wave (this is pre-ship polish, not a shipped regression).

## Repro
Open the command-modal demo (site/pages/command-modal-demo.ts, dev build), type to filter —
the panel resizes and re-centers per keystroke.

## Expected vs actual
- **Expected:** fixed width, top-anchored, stationary search field; only the list changes.
- **Actual:** shrink-fit width, vertical centering, the whole panel (search included) moves
  with every result-count change.

## Classification
Axis: **visual/interaction (frame stability)** — plane `controls/command-modal/` (+ possibly
a `--ui-modal-*` sizing-token seam in `controls/modal/`). The LLD specified the composition
but not a fixed frame; the SPEC has no frame-stability requirement — the fix adds one
(annotated review-driven).

## Severity
**minor** (pre-ship — the wave is uncommitted; caught in Kim's dev QA before any release).

## Links
- `packages/agent-ui/components/src/controls/command-modal/command-modal.{ts,css,md}` (the
  uncommitted wave) · `controls/modal/modal.css:55-56` (the centering + max-width).
- `.claude/docs/spec/command-modal.spec.md` + `lld/command-modal.lld.md` — gain the
  frame-stability clause with the fix.
- TKT-0014/0015 — the sibling same-day QA-catch precedent.

## Findings

### 2026-07-11 — fixed inline (the host, spawns limit-blocked; the wave is uncommitted and pre-review)

- **The call:** top-anchored + growing-down (the VS Code palette convention) over fixed-total-height.
- **The seam:** ui-modal gained three PUBLIC frame dials in its OWN token prefix
  (`--ui-modal-{inline-size,max-inline-size,margin-block-start}`, defaults byte-behavior-identical —
  modal.css tokenized its hardcoded frame); command-modal declares its own two dials
  (`--ui-command-modal-{inline-size,block-anchor}` = `min(92vw, 36rem)` / `15svh`) and forwards them
  onto the nested modal element it owns via inline `style.setProperty` — the slider `--value-pct`
  JS-seam exemption, so family-coherence's cross-control token law is untouched.
- **Tests (both engines, +4):** the frame-stability proof (dialog left/width/top + the search rect
  identical ±1px across a filter that empties the list; the top anchor anti-vacuously < 30% viewport)
  and the ui-modal IDENTITY check (a bare modal stays centered shrink-fit — the dials default clean).
- SPEC-R15 added (annotated); modal.md + command-modal.md document the dials. Rides the wave's
  pending pre-commit component review like everything else in it.
