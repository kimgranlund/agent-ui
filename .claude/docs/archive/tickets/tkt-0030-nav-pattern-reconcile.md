---
doc-type: ticket
id: tkt-0030
status: done
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

### 2026-07-12 — design intake complete: `ui-nav-rail` family frozen for build, `ADR-0130` proposed

Ran the design intake per `agent-ui-component-design` — precedent sweep over both embryos
(`ui-settings`/`settings.{ts,css}`, `site/pages/_page.{ts,css}` + `sitemap.json`), the composition
substrate (`ui-master-detail`, `ui-menu`/`ui-popover` ADR-0043/0045, `ui-app-shell`'s `collapse`-enum
grammar ADR-0084), and the naming/geometry/anatomy law.

**Family + scope (settled by this ticket's own acceptance criterion):** ONE element,
`ui-nav-rail` + `ui-nav-rail-group` + `ui-nav-rail-item`, in `@agent-ui/app` (the same PRD-D2 chrome
posture as `ui-app-shell`/`ui-master-detail`/`ui-settings` — `EXCLUSION_ALLOWLIST`, never a catalog row).
A single closed-enum `collapse: 'menu'|'drill-in'|'icon-popover'` selects the narrow-width disposition —
the prop NAME is deliberately reused from ADR-0084 (same concept: a component's own narrow-reflow
disposition), not a naming collision.

**Six forks recorded in `ADR-0130` (proposed — awaiting Kim's ruling, none self-ratified), each with a
firm recommendation:** (1) one element (settled); (2) reuse `collapse` as the prop name; (3) content
model = authored `ChildList`, both consumers derive children programmatically from their own data
(unchanged from both embryos' existing pattern); (4) a11y role derives from item SHAPE — `href` present
⇒ real `<a>` + `navigation` landmark; absent ⇒ `role=tab`/`tablist` + `aria-selected` — a named
CORRECTION to `ui-settings`' current `aria-current="page"` misuse of page-nav semantics for an in-page
selection commit; (5) `collapse="drill-in"` — nav-rail owns anatomy only, `ui-master-detail`'s shipped
drill-in stays the mechanism, never re-derived; (6) `collapse="icon-popover"` composes `ui-menu` per
group (roving-focus + commit + dismissal inherited wholesale) with nav-rail self-coordinating one-group-
open-at-a-time; (7) `anatomy.md`'s RESERVED `data-role="tag"` role realizes here for TKT-0029's wide
name|tag row (narrow degrade = truncate, never wrap); the per-component page-type sub-links stay on the
existing tab strip (confirmed non-goal, not reopened).

**Deliverables:** `spec/nav-rail-family.spec.md` (SPEC-R1..R10) · `lld/nav-rail-family.lld.md`
(LLD-C1..C12, a 3-phase build: the family → the two consumer migrations in parallel → barrel/budget) ·
`decompositions/nav-rail-family.decomp.json` (coverage-clean `--strict`) · `adr/0130-nav-rail-family-
unification.md` (proposed) + its `adr/README.md` index row. Independent doc review (`scribe:doc-reviewer`)
run against both SPEC and LLD; verdict + any fixes recorded in that review's own pass (see the doc-review
log below this Findings entry once posted).

**ADR numbering race (per the dispatch brief's caution):** the concurrent TKT-0028 (M2 app surfaces)
intake minted `ADR-0129` the same day. This intake took `0130` as the next free number at
`.claude/docs/adr/` write time (highest existing = 0129); if another concurrent wave also claimed 0130
before this lands, the collision is the host's to reconcile at commit (renumber whichever lands second) —
flagged, not resolved here.

Next: Kim's ruling on `ADR-0130`'s six clauses; on ratification, the build fans out per the LLD's 3-phase
sequence (component-builder for the family, then the two migration slices in parallel, gated by
`component-reviewer` before each commit).

### 2026-07-13 — Phase 2 shipped: both consumers migrated, the duplication DELETED

The reconciliation is proven by consumption, closing this ticket's acceptance: **settings** (mode 2)
— `ui-settings`' bespoke rail replaced by a composed `ui-nav-rail collapse="drill-in"`; the
hand-rolled `[data-part=rail]`/`[data-part=rail-item]` anatomy + its CSS/tokens deleted; the
ADR-0130 cl.4 a11y correction landed (in-page selection = `role=tab`/`aria-selected`, the old
`aria-current="page"` gone — asserted jsdom + both engines). **Site nav** (mode 1) — `buildNav()`
derives a `ui-nav-rail collapse="menu"` from `sitemap.json` grouped by `section`; the hand-rolled
`<nav>/<details>` markup + rail CSS deleted; name|tag rows via `slot="trailing" data-role="tag"`;
the hand `NAV` array survives only as the page-header tab-strip source (SPEC-R10 AC3 non-goal).
Drift gates re-derive (site-nav count from `SITE_NAV_ENTRIES`; site-canon FAMILY_ROOTS gains
app/src/controls). Follow-ups minted: TKT-0035 (the collapse-threshold container coupling — the
site works via a CSS re-point workaround) · the group taxonomy is the sitemap's literal
Components/Guides/Records axis (coarser than this ticket's context assumed; splitting A2UI/A2A out
= a site-manifest curation follow-up, Kim's call). Gates: check green · jsdom 6015 · browser 64/64
both engines. Phase 3 (LLD-C12 barrel/budget) remains.
