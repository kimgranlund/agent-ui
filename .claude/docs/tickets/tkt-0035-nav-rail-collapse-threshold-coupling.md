---
doc-type: ticket
id: tkt-0035
status: open
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
