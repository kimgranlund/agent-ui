---
doc-type: ticket
id: tkt-0003
status: open
date: 2026-07-09
owner:
---
# TKT-0003 — promote `theme-provider` to a shipped library component

## Summary
`<theme-provider>` exists only as docs-site chrome (`site/lib/theme-provider.ts` — a passive
wrapper built for the gallery, ADR-0079 cl.3): a consumer installing the library gets no theming
element at all and must hand-roll the wrapper the theming guide describes. Kim directed
(2026-07-09): add building a real, shipped `theme-provider` to the plan.

## Acceptance
- A design intake resolves the real forks before any build (the house process — decomposition +
  ADR with firm recommendations): the tag under the fleet naming law (`ui-*` tags — likely
  `ui-theme-provider`; the site element's bare `theme-provider` name predates the law's reach into
  site chrome), the package home (components' controls/ tier vs elsewhere — scheme/scale/density
  are token-system axes, which argues components), the contract (the three live axes + the
  reserved `theme` package seam, ADR-0079's next-tier multi-theme scope explicitly NOT pulled in),
  and the migration (the site's local copy is replaced by the shipped element; the theming guide +
  llms.txt updated in the same change — keep-context-live).
- The shipped component meets the full per-control bar: descriptor + contract trip-wire, jsdom +
  cross-engine browser probes (including a real per-subtree `light-dark()` resolution proof — the
  TKT-0002 production-build regression class must be covered against the BUILT output), independent
  review, barrel/exports/size integration.
- The docs site dogfoods the shipped element everywhere the local copy is used today (theming.html,
  component-gallery), with zero site-local `theme-provider` definition remaining.

## Links
- `site/lib/theme-provider.ts` — the current site-local element (the contract to promote).
- `site/pages/theming.ts` — the theming guide (honest today about the site-local status; updates
  when this ships).
- ADR-0079 cl.3 — the original gallery-scoped design + the reserved `theme` seam.
- TKT-0002 — the `light-dark()` production-build regression class the new component's browser legs
  must guard against.
- `.claude/docs/adr/README.md` — the intake ADR lands at the next free number when picked up.
