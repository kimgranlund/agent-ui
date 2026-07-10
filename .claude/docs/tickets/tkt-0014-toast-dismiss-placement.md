---
doc-type: ticket
id: tkt-0014
status: open
date: 2026-07-10
owner:
kind: bug
---
# TKT-0014 — ui-toast's dismiss "X" placement doesn't follow the button standards

## Summary
Kim's report (2026-07-10): *"toast 'X' placement seems to not follow button standards."* The
toast's always-appended icon-only ghost `ui-button[data-part=close]` looks wrong against the
fleet's button/geometry standards.

## Acceptance
- The failure is pinned with real browser geometry (getBoundingClientRect/getComputedStyle —
  jsdom computes no layout), against the named candidates.
- The X renders as a genuine square icon-only button, optically aligned per the fleet
  standard (whatever alignment rule the fix establishes is recorded in toast.md and, if it's
  a reusable icon-button-in-padded-container rule, considered for the patterns map).
- The stale toast.ts:186 comment is corrected either way.
- A browser regression test pins the placement (both engines); descriptors stay truthful;
  gates green.

## Repro
Render any `ui-toast` (the toast-region demo or the preview gallery specimen) and look at the
dismiss X — compare against an icon-only ghost `ui-button` placed per the standards (square
frame, glyph centered, optical alignment to its container).

## Expected vs actual
- **Expected:** the X is a square icon-only button per `5700d04`'s fifth anatomy structure
  (geometry.md "icon-only (no label) → square"), optically aligned with the toast's content
  edge and message text.
- **Actual (per the report):** placement reads off-standard. Exact failure to be pinned.

## Classification
Axis: **visual/geometry** — plane `controls/toast/` (+ possibly `controls/button/`'s icon-only
structure if the gap survives). Two candidate causes named at capture, NOT yet confirmed:
1. **Double inset:** the toast's `padding-inline: var(--ui-space-md)` PLUS the ghost button's
   own internal edge-pad `(h−icon)/2` pushes the X's glyph far from the card edge — the classic
   missing negative-margin optical-alignment compensation for icon buttons inside padded
   containers (toast.css:43-53 grid; no compensation rule exists for `[data-part=close]`).
2. **Stale squareness state:** toast.ts:186's comment still claims the icon-only-via-slot
   button "renders wider than tall" — Kim's own `5700d04` (2026-07-09) added the fifth square
   structure NAMING the toast close as the motivating case; either the toast build predates
   the benefit and something (e.g. the `slot=leading` + `icon-only` combination) still misses
   the square rule, or the comment is stale prose over a fixed reality.
Also worth one look: `align-items: center` floats the X to the vertical middle of a
multi-line-message toast — top-anchored dismissal is the platform norm for cards.

## Severity
**minor** — visual placement on a shipped control; no functional impact (the X works).

## Links
- `packages/agent-ui/components/src/controls/toast/toast.{ts,css,md}` — the close-part
  construction (:186-196) + the grid (:43-53).
- `packages/agent-ui/components/src/controls/button/button.css` — the fifth icon-only
  structure (`5700d04`).
- `geometry.md` "icon-only (no label) → square" · ADR-0012 (position × role adornments).

## Findings
