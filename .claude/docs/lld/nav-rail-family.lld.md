# LLD — the unified nav-rail family (`ui-nav-rail`)

> Status: shipped · v1.0 · 2026-07-13 · Layer: LLD (implementation plan)
> Refines: [`../spec/nav-rail-family.spec.md`](../spec/nav-rail-family.spec.md) (`SPEC-R1…R10`) +
> [`../adr/0130-nav-rail-family-unification.md`](../adr/0130-nav-rail-family-unification.md) (proposed — the
> seven ratifying clauses this LLD builds to).
> Decomposition: [`../decompositions/nav-rail-family.decomp.json`](../decompositions/nav-rail-family.decomp.json)
> (coverage-clean; nodes ≈ the components below). Build-order edges are the decomposition's.
> Composes on: `app/src/controls/app-shell/app-shell.ts` (the generic sub-element + `collapse`-enum grammar,
> ADR-0083/0084) · `app/src/controls/master-detail/master-detail.ts` (the child-relocation-at-connect
> composition pattern; the drill-in/back mechanism this family composes, never re-derives) ·
> `app/src/controls/settings/{settings.ts,settings.css}` (the rail-item anatomy + active-bar CSS being
> promoted here, and the mode-2 migration target) · `components/src/controls/menu/menu.ts` (the
> `overlay()`+`rovingFocus()` composition mode 3 reuses wholesale) · `site/pages/_page.{ts,css}` (the
> `<details>`-disclosure narrow-collapse mechanism being promoted for mode 1, and the mode-1 migration
> target) · `components/src/controls/tabs/` (the `role=tab`/`aria-selected` precedent SPEC-R3 AC2 mirrors).
> Altitude: owns **how** the family is built — file map, concrete interfaces, per-component failure/edge
> handling, build sequence, and the two consumer migrations. Behavior is the SPEC's; this doc never
> re-derives it. Open forks needing Kim are recorded in [ADR-0130](../adr/0130-nav-rail-family-unification.md)
> (this LLD does not re-litigate them — §8 below only flags LLD-level mechanics the ADR left to the build).

## 1. Component map (LLD-C# → SPEC-R#, → decomp node)

| LLD-C | Component | Files | Implements | Decomp |
|---|---|---|---|---|
| **LLD-C1** | `ui-nav-rail` element (container, `collapse` enum, active-item coordination) | `packages/agent-ui/app/src/controls/nav-rail/nav-rail.ts` | SPEC-R1, R2, R3 | n1a |
| **LLD-C2** | `ui-nav-rail-group` element | `.../nav-rail/nav-rail-group.ts` | SPEC-R2, R6, R8 | n1b |
| **LLD-C3** | `ui-nav-rail-item` element | `.../nav-rail/nav-rail-item.ts` | SPEC-R2, R3, R6 | n1c |
| **LLD-C4** | `collapse="menu"` narrow disclosure | `nav-rail.ts` (menu-mode path) + `nav-rail.css` | SPEC-R5 | n2a |
| **LLD-C5** | `collapse="icon-popover"` group-menu composition + one-open coordination | `nav-rail.ts`/`nav-rail-group.ts` (icon-popover path) | SPEC-R8 | n2b |
| **LLD-C6** | `nav-rail.css` (shared anatomy, active indicator, tag trailing slot, forced-colors) | `.../nav-rail/nav-rail.css` | SPEC-R3, R4, R6 | n2c |
| **LLD-C7** | descriptors + contract↔props | `.../nav-rail/{nav-rail.md, nav-rail-group.md, nav-rail-item.md}` | SPEC-R1 | n2d |
| **LLD-C8** | gates (jsdom + cross-engine browser, all three `collapse` modes) | `.../nav-rail/{nav-rail.test.ts, nav-rail.browser.test.ts}` | SPEC-R1..R8 | n2e |
| **LLD-C9** | catalog `EXCLUSION_ALLOWLIST` entries | `a2ui/src/catalog/default/index.test.ts` | SPEC-R1 AC1 | n2f |
| **LLD-C10** | `ui-settings` migration (mode 2) | `app/src/controls/settings/{settings.ts,settings.css,settings.md}` | SPEC-R9, R7 | n3a |
| **LLD-C11** | site-nav migration (mode 1) | `site/pages/_page.{ts,css}`, `site-nav.browser.test.ts` | SPEC-R10 | n3b |
| **LLD-C12** | app barrel + size re-base | `app/src/index.ts`, `package.json`, `scripts/measure-size.mjs` | — | n4a |

No orphan components (each traces to a SPEC-R); no SPEC-R without a hosting component. **SPEC-R7 is a
no-build constraint** ("the rail deliberately has no narrow branch for `collapse="drill-in"`") — it is
proven by LLD-C10's unedited composition of the shipped `ui-master-detail` (its own browser suite staying
green with no edit) rather than by any new code, so it is listed against LLD-C10 above alongside SPEC-R9.
**LLD-C12** (barrel + size re-base) traces to no single SPEC-R — it is standing integration infra, not a
behavior requirement.

---

## 2. Phase 1 — the family (`@agent-ui/app`)

### 2.1 LLD-C1 — `ui-nav-rail` (→ SPEC-R1, R2, R3)

```ts
const COLLAPSE_VALUES = ['menu', 'drill-in', 'icon-popover'] as const  // 'menu' leads = the enum-fallback default (ADR-0130 cl.2)

const navRailProps = {
  collapse: { ...prop.enum(COLLAPSE_VALUES, 'menu'), reflect: true },
} satisfies PropsSchema

export class UINavRailElement extends UIElement {
  static props = navRailProps
  // ...
}
```

`UIElement` base (structural — NOT `UIFormElement`; the rail itself carries no value, only its items
commit selections upward as events). Host-as-list: `render()` stays the inherited void; children (`ui-nav-
rail-group`/`ui-nav-rail-item`) render themselves, the rail only derives the shared role/coordination
state from them.

**Role derivation (SPEC-R3).** A `connected()` effect scans direct + grouped `ui-nav-rail-item` descendants
once per mutation (a lightweight `MutationObserver` on the rail's subtree, the `ui-app-shell`
"children present at any given moment" precedent generalized to react to LATER additions — both shipped
consumers rebuild children on data change, SPEC-R2 AC2): if every item has a non-empty `href`, `internals
.role = 'navigation'`; if every item has an empty `href`, `internals.role = 'tablist'` and each item's OWN
internals role is stamped `'tab'` (LLD-C3) with `aria-selected` tracking its `selected` prop. A mixed set
is undefined (SPEC §7 non-goal) — the implementation picks `navigation` as the safe default and does not
throw.

**Selection commit (button-shaped items only).** `ui-nav-rail` listens (delegated, one listener) for a
custom `nav-rail-item-activate` internal signal — realized as a plain `click` listener on the host that
checks `event.target.closest('ui-nav-rail-item')` and whether that item's `href` is empty; a link-shaped
item's native navigation is NOT intercepted (no `preventDefault`). On a button-shaped item's activation:
set that item's `selected = true`, clear siblings' `selected`, and emit `select`/`change` `{value: item.id
|| item.textContent}` on the rail itself — mirroring `ui-master-detail`/`ui-settings`'s own first-run-is-
registration discipline (a `selected`-prop WRITE from the consumer, e.g. deep-linking, does not itself
re-emit; only a genuine user activation does).

**`collapse="icon-popover"` coordination (SPEC-R8 AC3).** `ui-nav-rail` listens for `toggle` bubbling up
from any child `ui-menu` it finds inside a `ui-nav-rail-group` (LLD-C5) and, on a `toggle` to `open=true`,
closes every OTHER child menu (`otherMenu.open = false`) — the `ui-radio-group` sibling-clearing precedent
applied to overlay state instead of a form value.

**Failure/edge handling.** No children ⇒ empty rail, no throw (SPEC-R2 AC1). `collapse` unset/garbage ⇒
`'menu'` (index-0 fallback). A `collapse="drill-in"` or `"menu"` rail with a `ui-nav-rail-group` that (in
icon-popover-only anatomy) would need a popover — LLD-C2 gates that construction to icon-popover mode only,
so a `drill-in`/`menu` rail's groups never attempt to build a `ui-menu` they do not need.

### 2.2 LLD-C2 — `ui-nav-rail-group` (→ SPEC-R2, R6, R8)

```ts
const navRailGroupProps = {
  label: { ...prop.string(''), reflect: false },  // '' ⇒ no context-label rendered
} satisfies PropsSchema
```

Anatomy: `label` non-empty renders a `<span data-part="context-label">` heading above the group's items
(SPEC-R6 — the mode-1 context-label requirement). Children are `ui-nav-rail-item` elements, relocated
into either (a) a plain wrapper `<div data-part="items">` (menu/drill-in modes — items render inline,
unchanged) or (b) an internally-composed `ui-menu` (icon-popover mode ONLY, and only when the group has
**2 or more** items — a lone item renders as a plain icon button, no popover needed, SPEC §7 non-goal
avoided for the degenerate 1-item case).

**`collapse`-mode awareness.** `ui-nav-rail-group` reads its PARENT `ui-nav-rail`'s `collapse` prop
(`this.closest('ui-nav-rail')?.collapse`) reactively (an effect watching the ancestor's prop directly — a
DIRECT cross-element signal read, the SAME general kernel mechanism `ui-field`'s form-provider catch-up
scan relies on, though this is the fleet's FIRST consumer of a sub-element reading an ancestor's prop this
way — verify at build per §8's note, which names the fallback if it does not hold cleanly) to decide (a)
vs (b) above. Switching a live rail's `collapse` value post-connect is NOT a supported reactive transition
at v1 (documented limitation, the `ui-app-shell` `isolated`-is-connect-time-only precedent) — it takes
effect on next reconnect.

**The icon-popover composition (LLD-C5 detail lives here structurally).** At connect, when in
icon-popover mode with 2+ items: create one `ui-menu`, move the group's `ui-nav-rail-item` children
(re-tagged internally as plain menu-item content, NOT nested custom elements — `ui-menu`'s content model
is `[role=menuitem]` divs/buttons, so each item's label+href/selected state is read ONCE at composition
time and re-expressed as the menu's own item markup, forwarding activation back to the ORIGINAL semantics:
a link-shaped source item becomes an `<a role="menuitem">` inside the menu panel — real navigation, the
menu's own commit-and-close still fires on click; a button-shaped source item becomes a
`<button role="menuitem">` that, on commit, re-derives the SAME selection-commit path LLD-C1 drives for a
top-level item (dispatches the equivalent activation so `ui-nav-rail`'s one listener handles both shapes
uniformly). The group's own icon button (its `label`, or an authored leading icon slot) becomes the
`ui-menu` trigger (first child, per `ui-menu`'s own contract, LLD precedent verbatim).

**Failure/edge handling.** A group with 0 items renders its context-label (or nothing) and no popover/no
items wrapper — never throws. A group's `label` used as BOTH the context heading (menu/drill-in) and the
icon-popover trigger's accessible name (icon-popover) — one prop, two renderings, no divergence risk since
both read the same signal.

### 2.3 LLD-C3 — `ui-nav-rail-item` (→ SPEC-R2, R3, R6)

```ts
const navRailItemProps = {
  href: { ...prop.string(''), reflect: true },
  selected: { ...prop.boolean(false), reflect: true },
} satisfies PropsSchema
```

Anatomy (the anatomy.md slot/role axes, ADR-0130 cl.7): `[slot="leading" data-role="icon"]` (optional,
mode-3's icon; also usable in menu/drill-in for a leading glyph), the default/label slot (the item's
text — the accessible name when `href` is set; the AX label source when button-shaped per SPEC-R3), and
`[slot="trailing" data-role="tag"]` (optional — REALIZES anatomy.md's reserved `tag` role, SPEC-R6).

Render: `href` non-empty ⇒ an `<a href="{href}">` wrapping the slotted content, with `aria-current="page"`
set reactively when `selected` (SPEC-R3 AC1). `href` empty ⇒ a `<button type="button">`, with
`internals.role = 'tab'` + `internals.ariaSelected` tracking `selected` (SPEC-R3 AC2) — set via
`ElementInternals`, never a host attribute, the FACE law. The non-color-alone active indicator
(`border-inline-start`, `nav-rail.css`, ported from `settings.css` verbatim) applies to BOTH shapes,
keyed off the shared `selected` prop/`:state(selected)`.

**Failure/edge handling.** `href` toggled after connect (empty→non-empty or reverse) reactively re-renders
the `<a>`/`<button>` swap — an effect, not a one-shot (the settings schema-reassignment precedent: a real
prop change re-derives). `selected` on a link-shaped item sets `aria-current`, NOT `aria-selected` (SPEC-R3
AC1 vs AC2 — the two ARIA vocabularies never mix on one item).

---

## 3. Phase 1 — CSS, descriptors, gates

### 3.1 LLD-C6 — `nav-rail.css` (→ SPEC-R3, R4, R6)

Single sectioned file (ADR-0003): `:where(ui-nav-rail)` declares ONLY `--ui-nav-rail-*` (ink, ink-active,
surface-hover, indicator — ported from `settings.css`'s `--ui-settings-rail-*` verbatim, renamed); `@scope
(ui-nav-rail)` consumes only those + allow-listed shared tokens. **Geometry = Pattern size-class**
(`geometry.md`'s table: "Pattern — interactive rows take the control height"): each `ui-nav-rail-item`
row takes `--ui-height-{size}` (a fixed default size at v1, per SPEC §7 non-goal — no `[size]` prop yet).
The tag trailing-slot cell truncates via `text-overflow: ellipsis` (never `white-space: normal` — SPEC-R6
AC2, the single-line-row law). `forced-colors: active` repoints the active-item border to a system color
(SPEC-R4, the `ui-app-shell` divider precedent). The `collapse="menu"` narrow dropdown panel and the
`collapse="icon-popover"` icon-only item sizing are `[collapse=…]` attribute-selector branches in the SAME
file (the `ui-app-shell-region` `[collapse=…]` selector precedent) — never a second stylesheet.

### 3.2 LLD-C4 — `collapse="menu"` narrow disclosure (→ SPEC-R5)

Ported from `_page.css`'s zero-JS `<details>`/`<summary>` mechanism (SPEC-R5's own AC — "the site's existing
mechanism is the realized precedent"), now owned by `ui-nav-rail` itself: at connect, when `collapse="menu"`,
the element wraps its rendered group/item tree in a `<details data-part="disclosure">` + `<summary
data-part="trigger">` (the current item's label, a CSS chevron) — the SAME structure `buildNav()` builds
today, promoted into the component. The narrow `@container` query (the rail establishes its OWN query
container, the `ui-app-shell` SPEC-R5 precedent — width, not viewport) hides the `<ul>`-equivalent list and
reveals the `<summary>` trigger below the threshold; at/above it, the disclosure is inert chrome (summary
hidden, list always shown) — byte-for-byte the existing `_page.css` rule set, relocated.

**Failure/edge handling.** The trigger's label ("current item" name) is derived the same way
`currentNavLabel()` derives it today (`_page.ts`) — ported into `nav-rail.ts` as a private helper reading
the SAME "which item/group am I in" derivation, now over authored children instead of the `NAV` array.

### 3.3 LLD-C5 — icon-popover mode-3 mechanics (→ SPEC-R8)

Structural detail lives in LLD-C2 (the group's `ui-menu` composition); this entry covers the CROSS-group
coordination (LLD-C1's `toggle`-listener) and the item-icon-only CSS (LLD-C6's `[collapse=icon-popover]`
branch hides the label slot visually while keeping it in the AX tree as the accessible name — `ui-icon`'s
own `label`-prop pattern, `visually-hidden` clip, not `display:none`/`aria-hidden` on the label text).

### 3.4 LLD-C7 — descriptors (→ SPEC-R1)

Three `.md` descriptors (ADR-0004 frontmatter): `nav-rail.md` (`tier: pattern`, `extends: UIElement`,
`attributes: [collapse]`, `parts: [disclosure, trigger, context-label, items]`, `customStates: []` — the
rail itself carries no interaction state of its own, mirroring `ui-app-shell.md`'s "shared-file, states
live on the child" precedent), `nav-rail-group.md` (`attributes: [label]`), `nav-rail-item.md`
(`attributes: [href, selected]`, `customStates: [selected]`, `aria.role: tab | none` — conditional per
SPEC-R3, documented as such). Contract↔props trip-wires target all three.

### 3.5 LLD-C8 — gates (→ SPEC-R1..R8)

jsdom (`nav-rail.test.ts`): prop→DOM mapping for all three elements; `collapse` enum coercion + index-0
fallback; role derivation (all-`href` ⇒ navigation, all-bare ⇒ tablist/tab/aria-selected); selection-commit
emits `select`/`change` once per genuine activation, never on first-run/deep-link `selected` writes; the
`tag` trailing-slot renders + truncates (a jsdom style-computed check, guarded by the CSS-comment-`*/`-
pitfall lesson — verify against the REAL built CSS, not just the source rule, per the `text-truncate`
ADR-0106 precedent).

Browser (`nav-rail.browser.test.ts`, **Chromium AND WebKit**): whole-shape per mode (non-zero rows, correct
grid); `collapse="menu"` narrow collapse + dropdown open/dismiss (SPEC-R5); `collapse="icon-popover"` group
popover open/roving-focus/commit-close + the one-open-at-a-time coordination (SPEC-R8 AC2/AC3, a biting NC
dropping the coordination listener); forced-colors active-indicator (SPEC-R4); the name|tag row layout +
narrow truncate (SPEC-R6).

### 3.6 LLD-C9 — catalog disposition (→ SPEC-R1 AC1)

Three `EXCLUSION_ALLOWLIST` entries (`a2ui/src/catalog/default/index.test.ts`), citing "app-tier nav chrome,
PRD-D2, never agent-emittable" — the `ui-app-shell`/`ui-master-detail`/`ui-settings` precedent verbatim, no
new reasoning needed.

---

## 4. Phase 2 — consumer migrations

### 4.1 LLD-C10 — `ui-settings` migration (→ SPEC-R9)

Edit `settings.ts`: replace `#build()`'s `document.createElement('button')` rail-item construction
(currently building `<button data-part="rail-item">` directly into the plain `<nav data-part="rail">`) with
constructing `<ui-nav-rail collapse="drill-in">` once (idempotent, the existing `#compose()`-adjacent
guard) and, per section, a `<ui-nav-rail-item href="" selected="…">` (button-shaped — settings sections are
never real navigation) appended to it — replacing `#armRailListeners()`'s manual click-wiring with
`ui-nav-rail`'s own `select`/`change` listener (settings listens for the rail's `select` event instead of
per-button clicks). `#markActiveRailItem()` becomes "set `selected` on the matching `ui-nav-rail-item`" —
`ui-nav-rail-item`/`ui-nav-rail` own the AX-role + indicator entirely; `settings.css`'s `[data-part=rail-
item]` rules are DELETED (the anatomy moves to `nav-rail.css`), leaving `settings.css` with only its
`[data-part=panel]`/`[data-part=notice]` rules (an explicit "0 bespoke rail CSS" outcome, mirroring
SPEC-R9's own wording).

**Failure/edge handling.** The existing "reconnect re-arms listeners, does not rebuild on same schema/store
reference" discipline (`settings.ts`'s `#builtSchema`/`#builtStore` guard) is UNCHANGED — only the rail
ANATOMY changes, not the reactive rebuild contract. `generateSection`/validation/`resubscribe` wiring is
untouched (out of this family's scope).

### 4.2 LLD-C11 — site-nav migration (→ SPEC-R10)

Edit `_page.ts`: `buildNav()` is rewritten to construct `<ui-nav-rail collapse="menu">` from
`sitemap.json`'s `L1`/`L2` entries grouped by `section` (Components/Guides/A2UI/A2A/Records — the sitemap's
own `section` field, TKT-0029's "exactly the sitemap's sections" default taxonomy choice, no curated
re-grouping at v1) instead of the hand `NAV` array; each entry becomes a `<ui-nav-rail-item href="…">`
carrying `slot="trailing" data-role="tag"` = the entry's `tag` field (SPEC-R6's name|tag row). The
`currentNavLabel()`/`activeGroup()`/`isCurrent()` helpers are ported into `ui-nav-rail`'s own
`collapse="menu"` disclosure-trigger derivation (LLD-C4) rather than duplicated in `_page.ts`. `_page.css`'s
`nav[data-site-nav]` rule block (the rail anatomy, the disclosure chrome, the narrow media query) is
DELETED — that CSS now lives in `nav-rail.css`. The hand `NAV` array's ordering residue (if any survives
after the sitemap-derivation inversion) stays a small, separately-owned curation list `_page.ts` still
holds and passes through to the sitemap-driven build — TKT-0029's own acceptance criterion, not reopened
here.

**Failure/edge handling.** `site-nav.browser.test.ts`'s expected-count derivation switches from `NAV.length`
to a `sitemap.json`-derived count (SPEC-R10 AC1) — a real test-source edit, not a magic-constant patch.
`site-coverage`/`site-toc` gates (which independently re-derive from `components/src` descriptors) are
UNCHANGED and continue to catch an un-navved page (SPEC-R10 AC2) — this migration does not touch their
derivation, only the RENDERING consumer.

---

## 5. Phase 3 — barrel + budget

### 5.1 LLD-C12 — app barrel + size re-base

`app/src/index.ts` exports `UINavRailElement`/`UINavRailGroupElement`/`UINavRailItemElement`;
`package.json` gains `./nav-rail` (+ `.css`) — the bare `./{name}` shape (naming.md §8, the app/router
rule). `scripts/measure-size.mjs` gets a `@agent-ui/app` re-measured line-item (current budget context:
the M2/M4 waves already re-base this repeatedly — measured at build, never guessed here).

---

## 6. Build sequence (decomposition edges, summary)

Phase 1 (LLD-C1..C9) ships and gates FIRST — the family must exist, pass its own DoD, and hold catalog
disposition before either consumer migrates (a migration against an unfrozen rail contract would double
the rework). Phase 2 (LLD-C10, LLD-C11) can run IN PARALLEL once Phase 1 lands (independent files,
independent test suites — `ui-settings` and the site nav share no file). Phase 3 (LLD-C12) is the final,
serial integration step (barrel export + budget), after both migrations land so the size line-item reflects
the real, fully-adopted tree.

## 7. Independent review gate

Each of the three new elements (`ui-nav-rail`, `ui-nav-rail-group`, `ui-nav-rail-item`) gets an independent
`component-reviewer` pass (COMPOSE ≥4 AND REALIZE ≥4, zero blockers) before Phase 1 commits; the two
migrations (LLD-C10, LLD-C11) each get their own regression-focused review (their existing browser suites
staying green is the primary evidence, per SPEC-R7 AC1/SPEC-R9 AC1) before their respective commits.

## 8. LLD-level notes (mechanics only — no open Kim-facing forks; ADR-0130 carries those)

- **Cross-element reactive read** (LLD-C2's `this.closest('ui-nav-rail')?.collapse`) is a NEW pattern for
  this fleet at the sub-element level — verify at build against a live kernel test that a parent prop
  change re-triggers the child's effect (the `ui-field`/`ui-form-provider` catch-up-scan precedent proves
  the MECHANISM works; this is the first sub-element-reads-ancestor-prop-directly consumer of it. If it
  does not hold cleanly, the fallback is an explicit `collapse` mirror prop set by `ui-nav-rail` onto each
  child at build time — a documented LLD escalation, not a silent workaround, if hit.
- **`ui-menu` composition inside `ui-nav-rail-group` (icon-popover mode)** relocates ORIGINAL
  `ui-nav-rail-item` elements' CONTENT (not the elements themselves) into `ui-menu`-native item markup —
  confirm at build that this loses no state a shipped consumer needs (v1 consumers are static per SPEC-R2,
  so no live two-way binding is at risk; flag if a future consumer needs live item mutation inside an open
  popover).
