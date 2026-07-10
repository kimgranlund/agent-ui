---
doc-type: ticket
id: tkt-0015
status: open
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
