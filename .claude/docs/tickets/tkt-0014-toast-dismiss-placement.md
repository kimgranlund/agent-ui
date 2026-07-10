---
doc-type: ticket
id: tkt-0014
status: done
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

### 2026-07-10 — repro pinned with real browser geometry; root cause found (NOT either named candidate as stated)

Mounted a real `ui-toast` in Chromium + WebKit (`getBoundingClientRect`) at three configurations: a
short single-line message (no `action`), a message + `action="Undo"` (3 real children), and a
multi-line message in a narrowed card.

**Candidate 2 (stale squareness) — already fixed, comment is accurate, NOT the bug.** `toast.ts`
already sets `icon-only` on the close button (added in `5700d04` alongside the fifth button
structure — same commit, `toast.ts`/`toast.md`/`toast.test.ts` all touched together). Measured: the
close button renders **28×28, a genuine square**, in every configuration tested. `button-geometry.
browser.test.ts`'s s14 suite independently proves the fifth structure square in isolation. The
toast.ts:186 comment describes the *counterfactual* ("without `icon-only`, …") to justify why the
attribute is set — accurate, not stale, just easy to misread as describing current output; tightened
the wording anyway (see Fix below) so it reads unambiguously.

**Candidate 1 (double inset from button.css's own edge-pad) — WRONG MECHANISM, but the right
symptom.** The close button's own internal glyph-centering (justify-content, no literal padding) is
correct and symmetric in isolation. The real bug is at the **card's grid**, not the button:
`toast.css`'s `:scope` grid is `1fr auto auto` (message | action | close) but `action` is only
appended when non-empty (toast.ts) — so a **non-actionable toast (the common case, no `action`
attribute) has only TWO real children** (message, close). CSS grid auto-placement fills columns in
document order: message → column 1, close → column 2 (the **action** column), leaving column 3 (the
close column) genuinely empty — but the `gap` between the empty column 3 and the padding-inline-end
edge is still reserved. Measured (Chromium, md size, `--ui-space-md`=12px, `--ui-space-sm` gap=8px):
- No-action toast: close button inset from the card's right edge = **21px**; message inset from the
  left edge = **13px** (should be symmetric — this is the reported "off-standard" placement).
- Action-present toast (3 real children, auto-placement lands correctly): close inset = **13px**,
  message inset = **13px** — symmetric, no bug. This is the direct proof the grid, not the button, is
  the fault: the SAME button, in the SAME card, is only miss-inset when its "auto" track loses its
  intended child.
- 21 − 13 = 8px = exactly `--ui-space-sm` (the grid's column gap) — the phantom empty-track gap,
  confirmed.

**The "worth one look" vertical-anchor concern — investigated, judged NOT a defect.** On a
multi-line toast (12em card, long message), the close button's vertical center measured **exactly**
at the card's own vertical center (`align-items: center`, both equal 83px in the sampled geometry) —
centered as designed, no bug. Checked for a fleet counter-precedent: modal/card carry no dismiss
affordance to compare against, but `attachment.css` (an existing icon+text row) also centers
(`align-items: center`), so toast's centering is consistent with the fleet's own icon-beside-text
convention, not an outlier. Left unchanged — no vertical-anchor fix applied.

### 2026-07-10 — fix landed + regression tests

`packages/agent-ui/components/src/controls/toast/toast.css`: added an explicit
`[data-part='close'] { grid-column: 3; }` rule, pinning the close part to the card's third (last)
column regardless of whether the middle (action) column is populated. A no-op for the 3-child
(actionable) case (already auto-placed there); fixes the 2-child (non-actionable, common) case.
Re-measured post-fix: no-action toast close inset = **13px**, matching the message's 13px — symmetric
in both configurations.

`packages/agent-ui/components/src/controls/toast/toast.ts:183-189`: tightened the comment so it
reads unambiguously as a counterfactual (was accurate but easy to misparse as describing current
output), and pointed at the separate card-grid fix in toast.css.

`packages/agent-ui/components/src/controls/toast/toast.md`: the `close` part description now
records the grid-column-3 pin and the alignment guarantee it establishes.

`packages/agent-ui/components/src/controls/toast/toast.browser.test.ts`: added a
`TKT-0014` describe block — 3 new cross-engine tests (both Chromium + WebKit) pinning (1) the
non-actionable close-inset now matches the message inset, (2) the close button stays square post-fix,
(3) the actionable case's symmetry is unchanged (the pin's no-op path). All 26 toast browser tests
pass (both engines); all 59 toast jsdom tests pass; `npm run check` green; descriptor suite (197
tests) green.

**Patterns-map note:** this is NOT the generic "icon-button-in-padded-container needs negative-margin
optical compensation" pattern the ticket anticipated — no negative margin was needed anywhere. The
actual defect class is narrower and worth a name for the patterns map: **a shared multi-column grid
whose column population varies by prop must pin every FIXED-role part to an explicit `grid-column`,
never rely on auto-placement** — auto-placement is only safe when every grid child is always present.
Any other control with an optional-middle / always-present-edges grid (a card action-row, a list-item
with an optional secondary action) is exposed to the same class of bug. Reporting for the patterns
map, not editing it directly (host's call).
