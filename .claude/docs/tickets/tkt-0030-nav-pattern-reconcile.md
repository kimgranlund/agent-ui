---
doc-type: ticket
id: tkt-0030
status: open
date: 2026-07-12
owner:
kind: bug
---
# TKT-0030 — reconcile the settings rail and the site nav into ONE nav-rail concept (3 collapse modes)

## Summary
Kim's report (2026-07-12, two screenshots): the shipped `ui-settings` sections rail (Profile/
Appearance/Notifications — active-indicator bar, the master-detail drill-in behind it) and the
docs site's `<nav>` rail (the flat hand-rolled list tkt-0029 is re-designing) are TWO independent
implementations of one navigation-rail concept — pattern drift, not a shared primitive. Kim names
the reconciled shape: **one nav concept, three collapse versions**:

1. **Site nav → menu**: the rail collapses into a menu pattern at narrow widths.
2. **Settings → back**: the rail collapses into the drill-in/back system (what `ui-settings`
   already does via `ui-master-detail` — mode 2 exists; it just isn't a shared, named pattern).
3. **Icon rail → icons + popovers**: a nav with icons that collapses to icon-only, group items
   opening anchored popover menus.

## Acceptance
- ONE design intake produces the unified nav-rail concept — a component family (app-tier, per the
  PRD-D2 chrome law: never agent-emittable, EXCLUSION_ALLOWLIST) with the three collapse modes as
  a closed enum (the app-shell `collapse` precedent: hide/stack/toggle — same grammar shape), the
  active-indicator anatomy (the settings rail's bar), grouped items with context labels (the
  tkt-0029 requirements fold in), and the icon-rail variant's anchored-popover group behavior
  (the shipped overlay/popover primitives compose — no new overlay machinery).
- **The reconciliation is proven by consumption**: the settings rail re-expresses on the shared
  primitive (mode 2 — its drill-in keeps riding master-detail; the RAIL styling/anatomy unifies)
  and the site nav v2 (tkt-0029) builds on mode 1 (and optionally 3) instead of hand-rolled CSS —
  the duplication is deleted, not documented.
- The naming law applies at the intake (`references/naming.md` §10/§13 — the family name decision
  derives the full set); the collapse-mode enum joins the closed vocabularies with its ADR.
- Forks to Kim as proposed ADR(s) — at minimum the family's scope call (one element with a
  `collapse`/`variant` axis vs sibling elements) and where the icon metadata lives for mode 3.
- Sequencing: this intake SUBSUMES tkt-0029's design phase (one seat designs the family + the
  site-nav consumption together — two seats designing overlapping navs is the drift recurring);
  the M2 surfaces intake (tkt-0028, in flight) stays separate — no nav in its scope, but the new
  family lands in the same `@agent-ui/app` tier, so the LLDs cross-cite.

## Repro
Compare the shipped surfaces: `ui-settings`' rail (settings.css — the active bar, its own row
styling) vs the docs site rail (`site/pages/_page.css` — its own row styling, no shared anatomy,
no active bar). Same concept, zero shared code or tokens.

## Expected vs actual
- **Expected:** one nav-rail primitive; the settings rail and site nav are two consumers with
  different collapse modes.
- **Actual:** two bespoke implementations; the site nav isn't even a component.

## Classification
Axis: **structural (pattern coherence / duplicated concept)** — planes: `@agent-ui/app` (the new
family's home; `controls/settings/settings.css` re-expresses), `site/pages/_page.{ts,css}` (the
site consumer, with tkt-0029's requirements), the overlay/popover primitives (mode 3 composes).

## Severity
**minor** — nothing functionally broken; the cost is drift compounding with every new nav-shaped
surface (tkt-0029 would have minted a third implementation).

## Links
- `packages/agent-ui/app/src/controls/settings/` (the mode-2 embryo: rail + master-detail
  drill-in) · `site/pages/_page.{ts,css}` (the mode-1 embryo) · `controls/popover/` +
  ADR-0043/0045 (mode 3's overlay substrate) · ADR-0084 (the collapse-enum grammar precedent).
- `.claude/docs/tickets/tkt-0029-nav-v2.md` — SUBSUMED at design time (its sitemap-derivation +
  name|tag rows + context groups become the mode-1 consumer's requirements).
- `.claude/docs/tickets/tkt-0028-m2-app-surfaces.md` (in-flight sibling app-tier intake — cross-
  cite, don't collide).

## Findings
