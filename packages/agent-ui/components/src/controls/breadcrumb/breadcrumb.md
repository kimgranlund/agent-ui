---
# breadcrumb.md frontmatter — the attributes-as-API descriptor for ui-breadcrumb (ADR-0004; GH #1515, the
# frozen design intake `.claude/docs/spec/breadcrumb.intake.md` §4/§7 slices S1+S2). The machine-checkable
# public surface lives HERE (frontmatter); the prose below the fence is the /site doc. The `attributes[]`
# block MUST mirror breadcrumb.ts `static props` (label/inline/collapse/collapseKeepTrailing) — the
# contract↔props trip-wire (breadcrumb-descriptor.test.ts) targets this fence.
tag: ui-breadcrumb
description: A wayfinding trail of ordered crumb links ending in the current page — tag-agnostic author children, an optional slotted separator template, an auto-stamped current-page leaf, and an optional `collapse="menu"` fold of the middle behind a composed overflow menu.
tier: pattern          # geometry.md Pattern band — NO control-height row of its own (the intake's Geometry row, citing ADR-0163 cl.6 verbatim: the crumbs carry their own geometry, the novelty is zero)
extends: UIElement     # NOT form-associated (face below) — transient wayfinding view state, not a submittable value

attributes:             # attributes-as-API — mirrors breadcrumb.ts `static props` (label, inline, collapse, collapseKeepTrailing)
  - name: label
    type: string
    default: ''
    reflect: true        # the accessible NAVIGATION-LANDMARK name → internals.ariaLabel; an empty label falls back to the literal 'Breadcrumb' (never null — the deliberate deviation from ui-pagination's null-default posture)
  - name: inline
    type: boolean
    default: false
    reflect: true        # ADR-0223 (Fill by Default) — the ONE sizing opt-out: flips display level (inline-flex) AND sizing posture (hug). Default (absent) = block-level fill.
  - name: collapse
    type: enum
    values: [none, menu]
    default: none
    reflect: true        # GH #1515 S2 — the fold STRATEGY (nav-rail.ts's `collapse` enum canon reused verbatim; never a verb boolean). 'none' (default) renders bare, byte-identical to S1. 'menu' pins the first crumb + the last collapseKeepTrailing crumbs and folds a non-empty middle behind a composed ui-menu.
  - name: collapseKeepTrailing
    type: number
    default: 2
    reflect: true        # GH #1515 S2 — how many TRAILING crumbs stay pinned (inclusive of the current/last crumb). HTML attribute is collapse-keep-trailing (TKT-0035 compound-template naming, an explicit `attribute:` override in breadcrumb.ts — same shape as nav-rail.ts's collapseContainer/collapse-container). Clamped ≥1 at read time; non-finite/null snaps to the default (2).

properties: []          # no manual accessors beyond the typed props

events: []              # NONE of its own — crumb activation is native anchor navigation; the composed ui-menu's own select/toggle/close are stopPropagation-contained at the [data-part=overflow] boundary, never re-emitted

slots:
  - name: separator
    description: ONE optional per-instance separator TEMPLATE child (author-marked `slot="separator"`, the disclosure `slot="summary"` position-slot grammar reused verbatim for a single gap-filler template). The control hides the template itself (`hidden` + `aria-hidden`) and `cloneNode(true)`s it into a fresh `[data-part="separator"]` node before every crumb but the first — SNAPSHOT semantics, never live (a later mutation inside the template's own subtree does not retroactively touch already-rendered clones; only a subsequent host childList change re-clones). Multiple `[slot="separator"]` children → the FIRST wins as the clone source; every extra one is hidden and otherwise inert. Unslotted (no `[slot="separator"]` child at all) ⇒ a control-created `/` glyph span, same furniture shape. Every clone (root + any id-bearing descendant) has its `id` stripped — hygiene, preventing N duplicate ids across N gaps.

parts:
  - name: separator
    description: One `[data-part="separator"] [aria-hidden="true"]` node injected between every adjacent pair of crumbs — either a `cloneNode(true)` of the author's `[slot="separator"]` template (SNAPSHOT semantics, see the `separator` slot above) or, unslotted, a control-created `<span>/</span>`. Real DOM text either way — never a painted-only mark, so it cannot vanish under `forced-colors`. Non-interactive, carries no click handler. `collapse="menu"`: a separator sitting between two FOLDED crumbs is stamped `data-collapsed` (display:none) — except the one immediately before the first folded crumb, which stays visible as "the first gap" the overflow menu occupies.
  - name: overflow
    description: GH #1515 S2 — a composed `<ui-menu data-part="overflow">`, built fresh on every fold-relevant rebuild pass (never persisted — the tabs.ts `#ensureOverflowMenu` mechanism minus fit-measurement), inserted where the first folded crumb used to render. Its own first child is a control-created `<button aria-label="Show hidden breadcrumbs">` carrying the `dots-three` glyph (GH #168, the fleet's one horizontal overflow icon); every other child is one proxy `[role="menuitem"]` row per folded crumb, labeled from that crumb's `aria-label` (falling back to its trimmed textContent). Selecting a proxy row relays activation to the REAL folded crumb (`crumb.matches('a') ? crumb : (crumb.querySelector('a') ?? crumb)`, then `.click()` — dispatches even on a `display:none` node) rather than reparenting it; the menu's own `select`/`toggle`/`close` are `stopPropagation`-contained at this part's boundary, never surfacing as a `ui-breadcrumb` event. Present in the DOM only when a non-empty middle actually folds; absent entirely when `collapse="none"` (default) or when there aren't enough crumbs to fold.

customStates: []        # no interaction/motion state of its own — every author crumb (a real <a>, a ui-router-link, a plain <span>) rides its own interaction states; the composed overflow menu rides ui-menu's own states

face:
  formAssociated: false  # transient wayfinding view state, not a submittable value — the ADR-0163 cl.8 F5 ruling / ui-pagination's own reasoning extends here too

aria:
  role: navigation                # via ElementInternals — the host carries NO role/aria-* attribute
  roleSource: internals
  labelSource: internals.ariaLabel (the `label` prop when non-empty; empty falls back to the literal 'Breadcrumb' — the APG-named-pattern default, never null)

keyboard:
  - note: "Every crumb is a real, independently-focusable author element (an `<a>`, a `ui-router-link`, or a plain non-focusable `<span>` leaf) in the NORMAL document tab order — no roving tabindex, no composite-widget keyboard contract (N independent links, not one widget with N states; the ADR-0163 cl.3 'no composite widget' posture; APG's Breadcrumb pattern itself specifies no arrow-key model). Each crumb's own native/component activation is the whole keyboard story — ui-breadcrumb wires nothing of its own."
  - note: "The last crumb is auto-stamped aria-current=\"page\" (re-evaluated on every host childList mutation) UNLESS it, or a descendant of it, already carries [aria-current] — a router-exact-active ui-router-link marking its own stamped <a> is deferred to, never double-marked."
  - note: "`collapse=\"menu\"`: the overflow trigger sits in NORMAL tab order at its DOM position (the fold's gap). Enter/Space/click opens it; once open, focus/rove/type-ahead/Escape/commit-close are entirely `ui-menu`'s own shipped contract (ADR-0043) — ui-breadcrumb wires no keyboard machinery of its own, only the commit RELAY (a `select` listener that clicks the real hidden crumb)."

geometry:
  sizeClass: pattern
  posture: fill (block-level flex host, wraps and stretches to the parent's inline space; ADR-0223 cl.1) · `[inline]` = inline-flex + hug
  crumbTypography: the label typescale row (`--md-sys-typescale-label-medium-*`), inherited by every light-DOM child — ui-breadcrumb owns no [size]/[scale] geometry row of its own (the intake's Geometry row, ADR-0163 cl.6 verbatim)
  gap: var(--ui-breadcrumb-gap)   # off --md-sys-space (density-responsive)
  overflowTrigger: a compact square keyed to `1lh` (the crumb's own rendered line box) — no new control-height token, the tabs.css tab-height-trigger shape minus the grid dance (the composed `<ui-menu>` wrapper is `display:contents`, so the trigger is simply the next flex item at the fold's DOM position)

forcedColors: S1's own anatomy has NO dedicated `@media (forced-colors: active)` block — every visible affordance is REAL TEXT (an author crumb's own content, the auto-stamped current-page span, a slotted-or-default separator glyph), never a background-image / alpha-only wash / color-only `::before` decoration, so nothing there is at risk of vanishing under `forced-colors` (breadcrumb.browser.test.ts proves the separator survives CDP forced-colors emulation on Chromium). S2 (GH #1515) pins one explicit rule for the overflow trigger's SVG glyph (an author `color` read via `currentColor`, not itself a real text node) — belt-and-braces certainty over the UA's automatic remap, browser-probed the same way.
---

# ui-breadcrumb

`ui-breadcrumb` is a **Pattern**-class wayfinding trail (the intake's classification, citing ADR-0163 cl.6
verbatim) — an ordered set of crumb links ending in the current page, with an optional slotted separator
template between adjacent crumbs.

```html
<ui-breadcrumb label="Breadcrumb">
  <a href="/">Home</a>
  <a href="/docs">Docs</a>
  <span>Getting started</span>
</ui-breadcrumb>
```

## Crumbs are tag-agnostic author children

Every element child that is not the separator template and not control furniture is a CRUMB — a real
`<a>`, a `<ui-router-link>`, or a plain non-interactive element for the leaf (the reference shape above).
`ui-breadcrumb` never imports or sniffs `@agent-ui/router` — a `<ui-router-link>` crumb composes for free
because its own stamped inner `<a>` is what actually carries navigation (ADR-0115-blind by construction).

## The current page

The LAST crumb (in rendered DOM order) is auto-stamped `aria-current="page"` — UNLESS it, or a descendant
of it, already carries `[aria-current]` (a router-exact-active `ui-router-link` marks its own stamped `<a>`
first; `ui-breadcrumb` defers to that, never double-marking). The recommended authored shape for the leaf
is a plain, non-interactive element (the reference DOM's `<span>`) — APG allows link-or-text with
`aria-current` on the current page.

## The separator

An optional single `[slot="separator"]` child is the per-instance separator TEMPLATE — the control hides it
(`hidden` + `aria-hidden`) and clones it (`cloneNode(true)`) into a fresh, non-interactive node before every
crumb but the first:

```html
<ui-breadcrumb label="Breadcrumb">
  <a href="/">Home</a>
  <a href="/docs">Docs</a>
  <span>Getting started</span>
  <span slot="separator">→</span>
</ui-breadcrumb>
```

Clone semantics are **snapshot, not live**: the template is cloned once per gap at rebuild time (driven
only by a host childList mutation — adding/removing a crumb) — a later mutation made *inside* an
already-slotted template's own subtree never retroactively touches already-rendered clones. Multiple
`[slot="separator"]` children → the first wins; the rest are hidden and otherwise inert. Unslotted
(the common case) renders a control-created `/` glyph instead. Per-gap customization (a different separator
between different crumb pairs) is not supported — a consumer needing that authors their own composition.

## Collapsing a long trail (`collapse="menu"`)

```html
<ui-breadcrumb label="Breadcrumb" collapse="menu" collapse-keep-trailing="2">
  <a href="/">Home</a>
  <a href="/a">Section A</a>
  <a href="/a/b">Subsection B</a>
  <a href="/a/b/c">Subsection C</a>
  <span>Current page</span>
</ui-breadcrumb>
```

`collapse="menu"` pins the FIRST crumb and the LAST `collapse-keep-trailing` crumbs (default 2, clamped ≥1
— inclusive of the auto-stamped current/last crumb); a non-empty middle folds behind a composed overflow
`ui-menu`, a `dots-three`-glyph trigger placed at the fold's position. The folded crumbs never leave the
DOM (`display:none` only) — selecting a proxy row in the opened menu relays activation to the real hidden
crumb (a real `<a>`, or a composed `<ui-router-link>`'s own inner anchor once upgraded) rather than
reparenting it. The overflow menu's own `select`/`toggle`/`close` never surface as `ui-breadcrumb` events —
`ui-breadcrumb` emits none of its own, same as `collapse="none"`.

The fold is COUNT-driven, not fit-measured (no `ResizeObserver`) — author-driven and viewport-independent;
a narrow-viewport layout is simply a matter of the author choosing `collapse="menu"` up front. `collapse`
absent (or `"none"`) renders every crumb, byte-identical to the base anatomy.

## Accessibility

The host is a labelled `navigation` landmark (`role="navigation"` via `ElementInternals`, named by the
`label` prop through `internals.ariaLabel` — an empty label falls back to the literal `'Breadcrumb'`, the
APG-named-pattern default). Every crumb rides the NORMAL tab order — no roving tabindex, no composite-widget
keyboard contract; `ui-breadcrumb` wires no keyboard machinery of its own beyond the overflow menu's commit
relay.

## Sizing

Fill by default (ADR-0223): a bare host is block-level and stretches to its container; the ONE opt-out is
`inline` (hug, inline-flex). Crumb text reads the label typescale row (`--md-sys-typescale-label-medium-*`)
— no `[size]`/`[scale]` attribute and no geometry row of its own; `ui-breadcrumb` contributes only the
inter-crumb `gap` (off the `--md-sys-space` ladder, responding to an ancestor `[density]` for free).
