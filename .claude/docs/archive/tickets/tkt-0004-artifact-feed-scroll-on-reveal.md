---
doc-type: ticket
id: tkt-0004
status: done
date: 2026-07-09
owner:
kind: bug
---
# TKT-0004 — artifact-feed: revealing the next entry should animate the page to the new content

## Summary
Kim's report: on `a2a-artifact-feed.html`, clicking **Next →** reveals the next feed entry (and
mounts its live A2UI artifact), but the page stays where it is — the newly revealed content lands
below the fold and the user must scroll manually. Expected: as the content streams in, the page
animates to the bottom of the new entry.

## Acceptance
- Clicking **Next →** smooth-scrolls the newly revealed bubble's end into view once its content
  (including a lazily-mounted A2UI artifact) has laid out.
- The animation respects `prefers-reduced-motion` (instant jump, no smooth animation, when reduce
  is set — the house motion discipline).
- Locally composed bubbles (the reply composer) get the same scroll-on-append treatment — the same
  "new content arrived below the fold" shape.
- **Prev ←** and **Reset** do NOT auto-scroll (backward navigation isn't new content arriving).
- A browser test pins the behavior (real click → the revealed bubble's rect ends inside the
  viewport), since jsdom has no real scrolling.

## Links
- `site/pages/a2a-artifact-feed.ts` — `renderStep()` (the reveal path: bubbles pre-built, `hidden`
  toggled by cursor; artifacts host on first reveal) and the `nextBtn` click handler; also
  `appendComposedBubble()` for the composer path.
- TKT-0001 — the precedent for "drive the page the way a real user does" browser-test discipline.
- B7 (ADR-0116, in design) — the feed live arm will append real streamed turns through this same
  page; a scroll-on-append helper landed here serves that wave for free.

## Repro
1. Open `/a2a-artifact-feed.html` (dev or built — behavior identical; this is page JS, not a build
   issue).
2. Click **Next →** repeatedly. Each click unhides the next bubble further down the timeline; once
   the timeline outgrows the viewport, new entries appear entirely below the fold with no scroll.

## Expected vs actual
- **Expected:** the page animates so the newly revealed entry's end is visible ("animate to
  bottom"), each Next click.
- **Actual:** no scroll at all — the viewport stays put; the reveal is invisible until the user
  scrolls manually.

## Classification
Axis: **functional/UX (missing behavior)** — nothing renders wrongly; the reveal interaction lacks
its scroll affordance. Plane: `site/pages/a2a-artifact-feed.ts` only (the next handler +
`appendComposedBubble`); no component or renderer involvement. One nuance: the revealed bubble's
A2UI artifact mounts on first reveal and its height settles after the renderer's scheduled effects
flush — the scroll must fire after layout settles (a frame later), not synchronously in the click
handler.

## Severity
**minor** — a real usability gap on a demo page (the feature works, the affordance is missing);
not data-affecting, no workaround needed beyond manual scrolling.

## Findings
### 2026-07-09 — root cause evident from capture; fixed inline (bug-report Phase 5, no dispatch)

- **Fix location:** `site/pages/a2a-artifact-feed.ts` — a new `revealScroll(target)` helper
  (double-rAF deferred so the lazily-mounted A2UI artifact settles layout first, then
  `scrollIntoView({ block: 'end' })`, smooth by default and collapsing to an instant jump under
  `prefers-reduced-motion`), called from exactly two sites: the **Next →** handler (the newly
  revealed bubble) and `appendComposedBubble` (a composed reply is new content at the timeline's
  end — the same shape). Prev/Reset deliberately never scroll (backward navigation is not new
  content).
- **One real subtlety encoded in the helper:** the reveal path mounts the entry's A2UI artifact on
  first visibility and the renderer's kernel flushes effects on microtasks — a synchronous scroll
  in the click handler would target pre-layout geometry; the double-rAF defers to the settled
  frame.
- **Regression test:** `site/pages/a2a-artifact-feed.browser.test.ts` gained a TKT-0004 test that
  steps Next to the last entry and polls until the bubble's end lands inside the scroll region.
  First version failed for an instructive reason: it asserted `document`/`window` scrolling, but
  the site shell's ONE scroll region is `.app-page` (`_page.css:112-116` — the document never
  overflows), which `scrollIntoView` resolves natively while naive window assertions miss. The
  test now targets the real scroller (anti-vacuous `scrollHeight > clientHeight` guard +
  `scrollTop > 0`), passing 16/16 across both engines.
- **B7 note:** the in-design live feed arm (ADR-0116) appends real streamed turns through this
  same page — `revealScroll` serves that wave's scroll-on-arrival for free.
