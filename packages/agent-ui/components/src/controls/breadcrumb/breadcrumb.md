---
# breadcrumb.md frontmatter — the attributes-as-API descriptor for ui-breadcrumb (ADR-0004; GH #1515, the
# frozen design intake `.claude/docs/spec/breadcrumb.intake.md` §4/§7 slice S1). The machine-checkable
# public surface lives HERE (frontmatter); the prose below the fence is the /site doc. The `attributes[]`
# block MUST mirror breadcrumb.ts `static props` (label/inline) — the contract↔props trip-wire
# (breadcrumb-descriptor.test.ts) targets this fence. `collapse`/`collapseKeepTrailing` are S2 (GH #1515)
# — NOT documented here; this descriptor covers S1 core anatomy only.
tag: ui-breadcrumb
description: A wayfinding trail of ordered crumb links ending in the current page — tag-agnostic author children, an optional slotted separator template, and an auto-stamped current-page leaf.
tier: pattern          # geometry.md Pattern band — NO control-height row of its own (the intake's Geometry row, citing ADR-0163 cl.6 verbatim: the crumbs carry their own geometry, the novelty is zero)
extends: UIElement     # NOT form-associated (face below) — transient wayfinding view state, not a submittable value

attributes:             # attributes-as-API — mirrors breadcrumb.ts `static props` (label, inline)
  - name: label
    type: string
    default: ''
    reflect: true        # the accessible NAVIGATION-LANDMARK name → internals.ariaLabel; an empty label falls back to the literal 'Breadcrumb' (never null — the deliberate deviation from ui-pagination's null-default posture)
  - name: inline
    type: boolean
    default: false
    reflect: true        # ADR-0223 (Fill by Default) — the ONE sizing opt-out: flips display level (inline-flex) AND sizing posture (hug). Default (absent) = block-level fill.

properties: []          # no manual accessors beyond the typed props

events: []              # NONE of its own — crumb activation is native anchor navigation (S1 has no collapse/relay to wire)

slots:
  - name: separator
    description: ONE optional per-instance separator TEMPLATE child (author-marked `slot="separator"`, the disclosure `slot="summary"` position-slot grammar reused verbatim for a single gap-filler template). The control hides the template itself (`hidden` + `aria-hidden`) and `cloneNode(true)`s it into a fresh `[data-part="separator"]` node before every crumb but the first — SNAPSHOT semantics, never live (a later mutation inside the template's own subtree does not retroactively touch already-rendered clones; only a subsequent host childList change re-clones). Multiple `[slot="separator"]` children → the FIRST wins as the clone source; every extra one is hidden and otherwise inert. Unslotted (no `[slot="separator"]` child at all) ⇒ a control-created `/` glyph span, same furniture shape. Every clone (root + any id-bearing descendant) has its `id` stripped — hygiene, preventing N duplicate ids across N gaps.

parts:
  - name: separator
    description: One `[data-part="separator"] [aria-hidden="true"]` node injected between every adjacent pair of crumbs — either a `cloneNode(true)` of the author's `[slot="separator"]` template (SNAPSHOT semantics, see the `separator` slot above) or, unslotted, a control-created `<span>/</span>`. Real DOM text either way — never a painted-only mark, so it cannot vanish under `forced-colors`. Non-interactive, carries no click handler.

customStates: []        # no interaction/motion state of its own — every author crumb (a real <a>, a ui-router-link, a plain <span>) rides its own interaction states

face:
  formAssociated: false  # transient wayfinding view state, not a submittable value — the ADR-0163 cl.8 F5 ruling / ui-pagination's own reasoning extends here too

aria:
  role: navigation                # via ElementInternals — the host carries NO role/aria-* attribute
  roleSource: internals
  labelSource: internals.ariaLabel (the `label` prop when non-empty; empty falls back to the literal 'Breadcrumb' — the APG-named-pattern default, never null)

keyboard:
  - note: "Every crumb is a real, independently-focusable author element (an `<a>`, a `ui-router-link`, or a plain non-focusable `<span>` leaf) in the NORMAL document tab order — no roving tabindex, no composite-widget keyboard contract (N independent links, not one widget with N states; the ADR-0163 cl.3 'no composite widget' posture; APG's Breadcrumb pattern itself specifies no arrow-key model). Each crumb's own native/component activation is the whole keyboard story — ui-breadcrumb wires nothing of its own."
  - note: "The last crumb is auto-stamped aria-current=\"page\" (re-evaluated on every host childList mutation) UNLESS it, or a descendant of it, already carries [aria-current] — a router-exact-active ui-router-link marking its own stamped <a> is deferred to, never double-marked."

geometry:
  sizeClass: pattern
  posture: fill (block-level flex host, wraps and stretches to the parent's inline space; ADR-0223 cl.1) · `[inline]` = inline-flex + hug
  crumbTypography: the label typescale row (`--md-sys-typescale-label-medium-*`), inherited by every light-DOM child — ui-breadcrumb owns no [size]/[scale] geometry row of its own (the intake's Geometry row, ADR-0163 cl.6 verbatim)
  gap: var(--ui-breadcrumb-gap)   # off --md-sys-space (density-responsive)

forcedColors: No dedicated `@media (forced-colors: active)` block — every visible affordance is REAL TEXT (an author crumb's own content, the auto-stamped current-page span, a slotted-or-default separator glyph), never a background-image / alpha-only wash / color-only `::before` decoration, so nothing here is at risk of vanishing under `forced-colors` (breadcrumb.browser.test.ts proves the separator survives CDP forced-colors emulation on Chromium).
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

## Accessibility

The host is a labelled `navigation` landmark (`role="navigation"` via `ElementInternals`, named by the
`label` prop through `internals.ariaLabel` — an empty label falls back to the literal `'Breadcrumb'`, the
APG-named-pattern default). Every crumb rides the NORMAL tab order — no roving tabindex, no composite-widget
keyboard contract; `ui-breadcrumb` wires no keyboard machinery of its own.

## Sizing

Fill by default (ADR-0223): a bare host is block-level and stretches to its container; the ONE opt-out is
`inline` (hug, inline-flex). Crumb text reads the label typescale row (`--md-sys-typescale-label-medium-*`)
— no `[size]`/`[scale]` attribute and no geometry row of its own; `ui-breadcrumb` contributes only the
inter-crumb `gap` (off the `--md-sys-space` ladder, responding to an ancestor `[density]` for free).

## Not in this slice

`collapse="menu"` (folding the middle crumbs behind a composed `ui-menu` overflow trigger, keeping a
configurable trailing count) ships in a later slice (S2, GH #1515) — not built or documented here.
