---
doc-type: ticket
id: tkt-0035
status: done
date: 2026-07-13
owner:
kind: bug
---
# TKT-0035 — ui-nav-rail `collapse="menu"` hard-codes a 40rem container threshold; narrow-sidebar consumers can't opt out

## Summary
Surfaced by the nav-rail Phase-2 site-nav migration (2026-07-13). `ui-nav-rail collapse="menu"`
self-measures against a **40rem `@container` threshold** to decide when to fold into its dropdown. The
threshold assumes the rail occupies a full-width region. A real sidebar rail (the docs nav column is
~15rem) is ALWAYS below 40rem, so a self-measuring rail would render as a dropdown at *every* width —
there'd be no desktop vertical rail at all. The migration worked around it CSS-only in the consumer
(`_page.css`: `container-type: normal` on the rail + `container-type: inline-size` on `.app-shell`, to
re-point nav-rail's collapse `@container` query up to the shell so it tracks the viewport, not the
15rem rail). It's proven (a browser assertion pins `getComputedStyle(rail).containerType === 'normal'`)
but it relies on nav-rail's collapse being an UNNAMED `@container` that resolves to whichever ancestor
the consumer makes a query container — a fragile implementation-detail coupling, not a supported seam.

## Acceptance
- A narrow-sidebar consumer can use `collapse="menu"` and still get a vertical rail at desktop widths
  WITHOUT the unnamed-`@container` re-pointing hack — i.e. nav-rail exposes a supported seam for
  "collapse relative to the viewport / an ancestor, not my own 15rem box." Candidate forms (the fork):
  a NAMED `@container` on nav-rail's collapse query (so a consumer targets it explicitly), and/or a
  configurable collapse threshold (a prop or custom property), and/or an explicit `collapsed` override.
- The docs site's `_page.css` `container-type` workaround is removed once the seam exists (the coupling
  is deleted, not documented).
- The seam is the primitive's own; every future narrow-rail consumer inherits it (no per-consumer hack).

## Repro
Place `ui-nav-rail collapse="menu"` in a ~15rem sidebar column with default container behavior → it
renders as a collapsed dropdown at all widths (never a vertical rail), because its own inline size is
always below the hard-coded 40rem threshold.

## Expected vs actual
- **Expected:** a supported way to make `collapse="menu"` fold relative to the viewport / an ancestor,
  so a narrow sidebar keeps its desktop vertical rail.
- **Actual:** the 40rem threshold is measured against the rail's OWN box; the only escape is a
  consumer-side unnamed-`@container` re-pointing hack (fragile).

## Classification
Axis: **structural (missing configurability seam / fragile consumer coupling)** — plane:
`packages/agent-ui/app/src/controls/nav-rail/nav-rail.css` (the collapse `@container` query) +
`nav-rail.ts` (if a prop/threshold seam is added) · the consumer workaround in `site/pages/_page.css`.
A PRIMITIVE gap (ADR-0130 nav-rail Phase-1), surfaced by real consumption.

## Severity
**minor** — the site nav works today via the CSS workaround (tested green); the cost is a fragile
coupling and a footgun for the next narrow-rail consumer, who'd have to rediscover the hack.

## Links
- `packages/agent-ui/app/src/controls/nav-rail/nav-rail.css` (the 40rem collapse `@container`) ·
  `site/pages/_page.css` (the `container-type` re-pointing workaround) · `nav-rail.browser.test.ts`
  (the `containerType === 'normal'` assertion pinning the workaround) · ADR-0130 (the collapse enum) ·
  ADR-0084 (the app-shell `collapse` grammar precedent, which faced the same "relative to what" question).

## Findings
### 2026-07-13 — supported seam shipped: NAMED `@container` + `collapse-container` enum (inline, host)

Chose a **NAMED `@container` + a `collapse-container` enum prop**, over the ticket's other two candidates:

- **A configurable threshold custom property was rejected as infeasible, not just non-preferred**:
  `master-detail.css`/`app-shell.css` already document, load-bearing, that "custom properties cannot drive
  an `@container` condition" — a real CSS limitation, not a style choice. Even if it worked, a VALUE knob
  doesn't fix THIS defect anyway: no literal threshold makes a 15rem sidebar ever reach a "wide" reading
  against its OWN box — the axis that needs to change is WHICH box is measured, not what number it's
  compared to.
- **A boolean `collapsed` override was rejected**: it would fight the primitive's own responsive mechanism
  (the consumer manually flipping a mode) rather than fixing the mechanism — exactly the "local deviation
  around a wall" the build-seat contract forbids.
- **Named `@container` won**: `nav-rail.css`'s `:scope` now declares `container-name: ui-nav-rail-collapse`
  alongside its existing `container-type: inline-size` (self-establishing, unchanged default), and the
  `collapse="menu"` query is now `@container ui-nav-rail-collapse (inline-size < 40rem)` (was unnamed). A
  new `collapseContainer` prop (`self` default / `ancestor`, reflects to `collapse-container`, pure CSS via
  `:scope[collapse-container='ancestor'] { container-type: normal }`) lets a consumer relinquish the rail's
  own containment so the NAMED query resolves against whichever ancestor THEY opt in via
  `container-type: inline-size; container-name: ui-nav-rail-collapse` — matching `ADR-0100`'s existing
  fleet idiom (row/column/list/grid establish no `container-type` of their own; an ancestor's job) applied
  to a component that DOES need a sensible self-measuring default. A safe failure mode: if no ancestor
  names the container, the query never matches and the rail simply never collapses (never the opposite,
  more dangerous, always-collapsed failure the old unnamed coupling risked).

Workaround removed (`site/pages/_page.css`): `.app-shell > [data-site-nav] { container-type: normal }` is
DELETED — the rail's own attribute-selector CSS now owns that, driven by `collapse-container="ancestor"`
set on the element itself in `buildNav` (`_page.ts`). `.app-shell`'s `container-type: inline-size` gained a
`container-name: ui-nav-rail-collapse` (the ONE line of consumer CSS inherent to naming a container — not a
re-pointing hack, a declared opt-in).

Tests: `nav-rail.browser.test.ts` gained 3 new cases (a WIDE named ancestor gives a narrow ~15rem column
rail its real vertical rail — the acceptance, WHOLE-SHAPE asserted; the same column correctly collapses
under a NARROW named ancestor; a `collapse-container="self"` negative control proves the default still
self-measures, ignoring a wide ancestor). Non-vacuity verified by reverting the CSS/prop change: the
acceptance test fails in both Chromium and WebKit on the old code. `site-nav.browser.test.ts`'s pinned
`containerType === 'normal'` assertion was rewritten to assert the SEAM (the `collapse-container="ancestor"`
attribute + the NAMED `.app-shell` container) rather than the old bare CSS override. `nav-rail.test.ts` +
`nav-rail.md` updated for the new prop (contract↔props bijection, `static props` list).

Environment note (not a defect in the fix): this worktree's own `node_modules/@agent-ui/*` was missing
(package resolution walked up to the PARENT checkout's `node_modules`, reading STALE `@agent-ui/app`
source for any BARE-specifier import — e.g. `_page.ts`'s `import '@agent-ui/app/nav-rail.css'`). Repaired
by symlinking `node_modules/@agent-ui/{a2a,a2ui,app,code,components,icons,router,shared}` to this
worktree's own `packages/agent-ui/*` (gitignored, no repo files touched) — this also fixed two UNRELATED
pre-existing `npm test` failures (an `a2ui-live` sandbox "Denied ID" on a main-checkout path, and the
`theme-provider-build-fixture` byte-diff, which needed a regenerate anyway per its own banner once `_page.css`
changed).

Gates: `npm run check` exit 0 · `npm test` (jsdom) 328/328 files, 6023/6023 tests · `npm run test:browser`
scoped to nav-rail + site-nav: 4/4 files, 50/50 tests, both Chromium and WebKit.
