# SPEC — the unified nav-rail family (`ui-nav-rail`)

> Status: shipped · v1.0 · 2026-07-13 · Layer: SPEC (execution contract)
> Traces: TKT-0030 (nav-pattern reconcile — the design ruling) · TKT-0029 (site-nav v2 — SUBSUMED, its
> requirements are this SPEC's mode-1 consumer acceptance) · [`../adr/0130-nav-rail-family-unification.md`](../adr/0130-nav-rail-family-unification.md) (proposed — the six ratifying clauses this SPEC realizes).
> Refined by: [`../lld/nav-rail-family.lld.md`](../lld/nav-rail-family.lld.md) (implementation). Decomposition:
> [`../decompositions/nav-rail-family.decomp.json`](../decompositions/nav-rail-family.decomp.json) (coverage-clean).
> Relates: [`../adr/0084-app-shell-narrow-reflow-collapse.md`](../adr/0084-app-shell-narrow-reflow-collapse.md) (the `collapse`-enum grammar precedent this family extends) · [`../adr/0043-overlay-selection-primitives.md`](../adr/0043-overlay-selection-primitives.md)/[`../adr/0045-overlay-dismissal-semantics.md`](../adr/0045-overlay-dismissal-semantics.md) (mode 3's composed `ui-menu`) · [`../adr/0120-app-surfaces-m4-panes-settings.md`](../adr/0120-app-surfaces-m4-panes-settings.md) (the `ui-settings`/`ui-master-detail` embryo mode 2 unifies onto).
> Altitude: owns the **behavior contract** for `ui-nav-rail` + its two sub-elements and the two consumer
> migrations (the docs site, `ui-settings`). Internal file map + concrete interfaces are the LLD's.
> Requirement IDs file-scoped (`SPEC-R1…`).

---

## 1. Purpose

Ship ONE navigation-rail primitive, `ui-nav-rail` (+ `ui-nav-rail-group` + `ui-nav-rail-item`), in
`@agent-ui/app`, that the docs site's primary nav and `ui-settings`' sections rail both compose instead of
each hand-rolling its own rail markup/CSS/active-indicator/narrow-collapse behavior. A single closed-enum
`collapse` prop (`'menu' | 'drill-in' | 'icon-popover'`) selects which of the three narrow-width
dispositions Kim's reconcile ruling names applies; the family's anatomy, active indication, and a11y
derivation are shared across all three. This SPEC realizes the seven ratifying clauses of
[ADR-0130](../adr/0130-nav-rail-family-unification.md) (proposed).

## 2. Definitions

- **Rail** — `ui-nav-rail`, the container: an authored `ChildList` of groups/items, one `collapse` mode.
- **Group** — `ui-nav-rail-group`: an optional cluster with a context-label; in `collapse="icon-popover"`
  mode, a group with 2+ items composes an anchored popover flyout over its items.
- **Item** — `ui-nav-rail-item`: one row. Carries an `href` (real navigation, renders `<a>`) OR none (an
  in-page selection commit, renders `<button>`, emits `select`/`change` on the rail).
- **Collapse mode** — the rail's own narrow-width reflow disposition: `menu` (collapses into a dropdown
  disclosure), `drill-in` (no self-collapse; the composing `ui-master-detail` owns the narrow view), or
  `icon-popover` (items render icon-only; a group's items disclose via an anchored popover).
- **Mode-1 / mode-2 / mode-3 consumer** — the docs site (`collapse="menu"`), `ui-settings`
  (`collapse="drill-in"`), and any future icon-rail consumer (`collapse="icon-popover"`), per TKT-0030's
  naming.

---

## 3. Requirements

### 3.1 Family shape, tier, catalog posture

**SPEC-R1 — `ui-nav-rail` ships in `@agent-ui/app`, one element, a closed `collapse` enum.**
`ui-nav-rail` MUST be a single custom element (not three sibling elements) with a reflected, closed-enum
`collapse` prop, values EXACTLY `'menu' | 'drill-in' | 'icon-popover'`, no out-of-set growth without an
ADR admission. The family (`ui-nav-rail`, `ui-nav-rail-group`, `ui-nav-rail-item`) MUST live in
`@agent-ui/app` and MUST NOT be a catalog row (an `EXCLUSION_ALLOWLIST` entry is required at the catalog
gate, matching `ui-app-shell`/`ui-master-detail`/`ui-settings`'s posture — app-tier chrome, PRD-D2). *(→ ADR-0130 cl.1, cl.2)*
- **AC1** *Given* the shipped descriptors, *when* the a2ui whole-fleet catalog gate runs, *then* all three
  tags resolve via `EXCLUSION_ALLOWLIST` with a cited reason, never an unresolved-row failure.
- **AC2** *Given* an out-of-set `collapse` value (attribute typo or unset), *when* read back, *then* the
  prop coerces to the enum's declared index-0 member (never throws) — the same `values[0]`-fallback
  contract `ui-app-shell-region`'s `region`/`collapse` props already use.

### 3.2 Content model

**SPEC-R2 — Authored `ChildList`, consumer-derived.** `ui-nav-rail`'s content model MUST be an authored
light-DOM `ChildList` of `ui-nav-rail-group` and/or `ui-nav-rail-item` children — no `schema`/`store`
data-prop pair. Both shipped consumers (the docs site, `ui-settings`) construct these children
programmatically from their own data source (`sitemap.json`; `SettingsSchema.sections`) — this is a
continuation of both embryos' existing imperative-construction pattern, not new machinery. *(→ ADR-0130 cl.3)*
- **AC1** *Given* `ui-nav-rail` with no children, *when* rendered, *then* it shows an empty rail (never
  throws) — the `ui-app-shell`/`ui-settings` "no schema/no children yet" precedent.
- **AC2** *Given* children appended after connect, *when* the DOM updates, *then* the rail reflects them —
  static-at-connect is NOT acceptable here (both consumers rebuild their rail's children on real data
  changes, the `ui-settings` `#build()` precedent).

### 3.3 Item shape, active indication, a11y

**SPEC-R3 — Item shape derives real navigation vs. selection-commit.** `ui-nav-rail-item` MUST render an
`<a href="…">` when its `href` prop is non-empty (real navigation to a distinct resource) and a `<button
type="button">` when `href` is empty (an in-page selection commit). The rail's ARIA role MUST derive from
the SHAPE of its items, not from `collapse`: a rail whose items are all link-shaped exposes
`role="navigation"`; a rail whose items are all button-shaped exposes `role="tablist"` with
`role="tab"` + `aria-selected` on each item (the `ui-tabs` precedent) — replacing `ui-settings`' CURRENT
`aria-current="page"` on a button, a named correction (a settings section-select is not page navigation).
A mixed rail (unusual, not a shipped consumer's shape) is undefined behavior at v1 — not gated. *(→ ADR-0130 cl.4)*
- **AC1** *Given* a `collapse="menu"` rail (all items `href`-bearing), *when* the AX tree is read, *then*
  the rail exposes `role="navigation"` and the current-page item carries `aria-current="page"`.
- **AC2** *Given* a `collapse="drill-in"` rail (all items button-shaped, the `ui-settings` shape), *when*
  the AX tree is read, *then* the rail exposes `role="tablist"`, each item `role="tab"`, and the active
  item `aria-selected="true"` (others `"false"`) — NOT `aria-current`.
- **AC3** *Given* an item's `selected` state changes, *when* read via `internals.states`, *then* it carries
  the `selected` custom state (naming.md §6's closed vocabulary; no new state minted) alongside a
  non-color-alone visual indicator (a real `border-inline-start`, the `ui-settings` precedent) — proven by
  a computed-style check that does NOT rely on color alone (rubric C8).

**SPEC-R4 — The active indicator survives `forced-colors: active`.** The active-item border indicator MUST
repaint to a system color under forced-colors (the `ui-app-shell` divider precedent), never vanishing. *(→
ADR-0130 cl.4's non-color-alone indication requirement)*
- **AC1** *Given* `forced-colors: active`, *when* an item is active, *then* its indicator border remains
  visible (non-transparent, system-color-backed).

### 3.4 `collapse="menu"` — the site-nav mode-1 disposition

**SPEC-R5 — Wide: a flat/grouped list; narrow: a disclosure dropdown.** At or above a defined container-
width threshold, `collapse="menu"` renders the full list (`ui-nav-rail-group` context-labels visible).
Below the threshold, the rail collapses into a single trigger (naming the current item) that discloses the
list as a dropdown panel on activation — the site's existing `<details>`-based zero-JS mechanism is the
realized precedent, ported into the component (not left as page-level markup). *(→ TKT-0029's site-nav-v2
folded requirements; ADR-0130 cl.1)*
- **AC1** *Given* a `collapse="menu"` rail inside a resizable wrapper, *when* narrowed below the threshold,
  *then* the list is not directly visible and a single trigger control is, proven in **Chromium AND
  WebKit**; the assertion bites on a non-collapsing fixed layout (negative control).
- **AC2** *Given* the narrow trigger activated (click or Enter/Space), *when* observed, *then* the dropdown
  panel opens overlaying the page (not reflowing it) and is keyboard-dismissable (Escape or outside-click).

*(Extended, TKT-0035: the container-width threshold is measured against a NAMED `@container
ui-nav-rail-collapse` query. `collapseContainer="self"` [default] is this AC's own box, unchanged; `="ancestor"`
relinquishes the rail's own containment so a narrow-sidebar consumer opts an ancestor into the same named
container instead — see nav-rail.md.)*

**SPEC-R6 — Group context labels + the wide name|tag row.** A `ui-nav-rail-group` with a `label` MUST
render it as a context heading above its items (replacing the site's current bare-tag group headers, the
TKT-0029 requirement). A `ui-nav-rail-item` MAY carry `slot="trailing" data-role="tag"` content (realizing
`anatomy.md`'s RESERVED `tag` role) rendering the item's tag right-justified against its name at wide
widths; at narrow widths the tag truncates (ellipsis), never wraps. *(→ TKT-0029; ADR-0130 cl.3, cl.7)*
- **AC1** *Given* a wide rail with a tag-bearing item, *when* rendered, *then* the name sits at the
  leading edge and the tag at the trailing edge, space-between (never overlapping, never wrapped onto a
  second line).
- **AC2** *Given* the item narrowed below its content width, *when* rendered, *then* the tag truncates with
  an ellipsis and the row height is unchanged (single-line, the Pattern size-class law).

### 3.5 `collapse="drill-in"` — the settings mode-2 disposition

**SPEC-R7 — No self-collapse; the composing `ui-master-detail` owns narrow behavior.**
`collapse="drill-in"` MUST NOT implement its own narrow-width mechanism — the rail renders identically at
every width; the CONSUMER composes it as the `list`-pane content inside its own `ui-master-detail`, whose
shipped drill-in/back mechanism (`master-detail.ts`) is unchanged and untouched by this family. *(→
ADR-0130 cl.5)*
- **AC1** *Given* a `collapse="drill-in"` rail composed inside a `ui-master-detail` list pane, *when* the
  container narrows below `ui-master-detail`'s own threshold, *then* the rail's own DOM is unaffected —
  the drill-in/back view-swap is `ui-master-detail`'s, proven by the ALREADY-shipped
  `master-detail.browser.test.ts` suite staying green with no edit.
- **AC2** *Given* `ui-settings` migrated onto this family, *when* its existing browser suite re-runs, *then*
  the narrow drill-in/back behavior is unchanged from pre-migration (a regression bar, not a new
  capability).

### 3.6 `collapse="icon-popover"` — the icon-rail mode-3 disposition

**SPEC-R8 — Icon-only items; group flyouts compose `ui-menu`; one group open at a time.**
`collapse="icon-popover"` items MUST render icon-only (their text label becomes the accessible name via
`internals`/`aria-label`, never removed from the AX tree). A `ui-nav-rail-group` with 2+ items MUST
disclose them via an internally-composed `ui-menu` (the group's icon = the menu's trigger; the group's
items relocate into the menu's panel at connect) — inheriting `ui-menu`'s roving-focus, commit-and-close,
and dismissal contract wholesale (ADR-0043/0045), never re-derived. `ui-nav-rail` MUST ensure at most ONE
group's menu is open at a time (opening one closes any other open sibling). *(→ ADR-0130 cl.6)*
- **AC1** *Given* a `collapse="icon-popover"` rail, *when* rendered, *then* every item shows only its icon
  (no visible text label) and each carries a correct accessible name (AX tree, not text content).
- **AC2** *Given* a group's icon trigger activated, *when* observed, *then* its item list opens as an
  anchored popover with roving keyboard focus (Arrow keys) and commits-and-closes on item activation —
  proven in **Chromium AND WebKit**, the `ui-menu` cross-engine suite's own assertions ported.
- **AC3** *Given* group A's popover open, *when* group B's trigger is activated, *then* group A's popover
  closes (never two group popovers open simultaneously) — a biting negative control (drop the
  coordination listener → both stay open).
- **AC4** *(ADR-0101)* *Given* any group popover's real open-state transition (commit, Escape, outside-
  click, or a programmatic close), *then* the transition announces via the SAME `toggle`+`close` pair
  `ui-menu` already emits — no new event name.

### 3.7 Consumer migrations

**SPEC-R9 — `ui-settings` adopts the shared rail (mode 2).** `ui-settings`' hand-rolled
`<nav data-part="rail">` + `[data-part=rail-item]` markup (`settings.ts`/`settings.css`) MUST be replaced
by composing `ui-nav-rail collapse="drill-in"` inside its existing `ui-master-detail` list pane — its
active-indicator bar, section-generation loop, and click-to-select wiring re-express on the shared
component; `ui-master-detail`'s composition and narrow behavior are UNCHANGED (SPEC-R7). *(→ ADR-0130 cl.5,
"the reconciliation is proven by consumption")*
- **AC1** *Given* the migrated `ui-settings`, *when* its existing jsdom + browser test suites re-run
  (adjusted for the new internals, not the observable behavior), *then* section selection, active
  indication, and narrow drill-in all behave identically to pre-migration — a regression bar.
- **AC2** *Given* the migrated `ui-settings`, *when* the AX tree is read, *then* the section rail exposes
  `role="tablist"`/`role="tab"`/`aria-selected` (SPEC-R3 AC2) — a `git diff`-visible, deliberate a11y
  correction, not a silent behavior change.

**SPEC-R10 — The docs site adopts the shared rail, sitemap-derived (mode 1).** `site/pages/_page.ts`'s
hand-rolled `buildNav()` + the `NAV` array MUST be replaced by composing `ui-nav-rail collapse="menu"`,
its groups/items constructed from `sitemap.json` (TKT-0018's derived index) rather than the hand-maintained
array — the hand array retires to whatever ordering/curation residue genuinely cannot derive (per TKT-0029's
own acceptance). The site-nav cross-engine smoke (`site-nav.browser.test.ts`) re-derives its expected
counts from the new source. *(→ TKT-0029, folded; ADR-0130 cl.1, cl.3, cl.7)*
- **AC1** *Given* the migrated site nav, *when* `site-nav.browser.test.ts` runs, *then* the rendered entry
  count matches `sitemap.json`'s derived group/item count exactly (no drift, no magic constant).
- **AC2** *Given* the migrated site nav, *when* a wide viewport renders a tag-bearing entry, *then* the
  name|tag two-column row (SPEC-R6) is visible; *given* a page added to `sitemap.json` with no rail
  entry, *then* the existing site-coverage/site-toc drift gates still catch it (the inversion does not
  weaken those gates).
- **AC3** *Given* the migration, *when* the per-component Permutations/States/API sub-links are checked,
  *then* they remain on the page-header tab strip (`buildTabs()`), unchanged — confirmed non-goal, not
  folded into the rail.

---

## 4. Typed contracts (behavioral — signatures illustrative; internals are the LLD's)

```ts
// ui-nav-rail — UIElement (formAssociated: false), light-DOM, host-as-list.
interface UINavRailElement {
  collapse: 'menu' | 'drill-in' | 'icon-popover'   // reflected, closed enum, index-0 = 'menu'
}
// ui-nav-rail-group — a generic sub-element (the ui-app-shell-region precedent): a context-label wrapper.
interface UINavRailGroupElement {
  label: string   // '' ⇒ no context-label rendered (an ungrouped-equivalent cluster)
}
// ui-nav-rail-item — href present ⇒ real navigation; absent ⇒ a selection commit.
interface UINavRailItemElement {
  href: string       // '' (default) ⇒ renders <button>, commits selection; non-empty ⇒ renders <a href>
  selected: boolean  // reflected; the active/current item (drives the non-color-alone indicator + AX state)
}
```

- **Events (drawn from the closed fleet vocabulary — `change · input · select · open · close · toggle`):**
  `ui-nav-rail` emits `select`/`change` (item id/href) on a genuine user
  commit of a button-shaped item — never on a link-shaped item (native navigation is the event), never on
  the first-run registration (the `ui-master-detail`/`ui-app-shell` toggle-warn precedent: first run is
  resolution, not a choice). `toggle`/`close` on the `collapse="menu"` narrow disclosure and on each
  `collapse="icon-popover"` group popover — no new event names (SPEC-R8 AC4).
- **No native form elements; ARIA via `ElementInternals` only** (CLAUDE.md invariants).

## 5. Non-functionals

- **Cross-engine truth (gate):** SPEC-R5/R8/R9/R10 browser assertions pass in **Chromium AND WebKit**.
- **Forced-colors (gate):** SPEC-R4.
- **Naming (gate):** `collapse`'s three-member enum is the closed set this SPEC ratifies (no ad hoc
  growth without a follow-up ADR, naming.md §10 rubric).
- **No regression (gate):** SPEC-R7 AC1, SPEC-R9 AC1 — the shipped `ui-master-detail`/`ui-settings` browser
  suites stay green through the migration.
- **Layering (gate):** the family (`ui-nav-rail`/`ui-nav-rail-group`/`ui-nav-rail-item`) imports only
  `@agent-ui/components` (incl. `ui-menu`, its `collapse="icon-popover"` composed dependency) — it never
  imports `ui-master-detail` or any other `@agent-ui/app` sibling (SPEC-R7: the rail contributes anatomy
  only for `collapse="drill-in"`; the CONSUMER, not the rail, composes `ui-master-detail`) — and never
  `@agent-ui/router` (the standing `app/src/layering.test.ts` trip-wire, ADR-0115).

## 6. Traceability (this SPEC → ADR-0130)

| SPEC-R | Requirement | Traces to |
|---|---|---|
| SPEC-R1 | one element, `@agent-ui/app`, `EXCLUSION_ALLOWLIST` | ADR-0130 cl.1, cl.2 |
| SPEC-R2 | authored `ChildList`, consumer-derived | ADR-0130 cl.3 |
| SPEC-R3 | item-shape-driven a11y role derivation | ADR-0130 cl.4 |
| SPEC-R4 | forced-colors indicator | ADR-0130 cl.4 |
| SPEC-R5 | `collapse="menu"` narrow disclosure | ADR-0130 cl.1; TKT-0029 |
| SPEC-R6 | group context labels + name|tag row | TKT-0029; ADR-0130 cl.3, cl.7 |
| SPEC-R7 | `collapse="drill-in"` composes, never re-derives | ADR-0130 cl.5 |
| SPEC-R8 | `collapse="icon-popover"` composes `ui-menu` + coordination | ADR-0130 cl.6 |
| SPEC-R9 | `ui-settings` migration | ADR-0130 cl.5 |
| SPEC-R10 | site-nav migration | TKT-0029; ADR-0130 cl.1, cl.3, cl.7 |

## 7. Non-goals (this SPEC)

- Folding the per-component Permutations/States/API sub-links into the rail (SPEC-R10 AC3 — stays on the
  existing tab strip).
- A `size`/density prop for the rail (v1 ships at one size; a future wave may add it — not gated here).
- Real-time sitemap re-fetch/live-reload of the site nav (`sitemap.json` is a build artifact; the migration
  reads it the same way the palette/search already do).
- Mixed-shape rails (some items `href`-bearing, some not, in one rail) — undefined behavior, not a shipped
  consumer's shape.
