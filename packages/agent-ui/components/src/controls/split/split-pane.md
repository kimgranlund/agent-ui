---
# split-pane.md frontmatter — the attributes-as-API descriptor for ui-split-pane (ADR-0004; app-surfaces-m4
# .lld.md LLD-C6). One folder (`split/`), TWO real components (the `radio`/`radio-group` precedent,
# ADR-0080's radio-group special case) — `ui-split-pane` is independently fleet-discoverable
# (family-coherence.test.ts keys discovery off `{name}.md`), not a side-effect sub-element of split.ts. The
# `attributes[]` block MUST mirror split-pane.ts `static props` (initial, min, max, collapsible) — the
# contract↔props trip-wire (split-descriptor.test.ts) targets this fence.
tag: ui-split-pane
description: One resizable pane inside a ui-split container, with optional initial ratio, min, and max bounds.
tier: layout             # geometry size-class (Container/layout band — NO control height; a pure flex-distribution box, geometry.md "five size-classes"). Also folds this descriptor into the site's bundled 'Layout primitives' TOC group (site-toc.test.ts's editorial rule) rather than demanding its own standalone showcase page — the ui-toast-region precedent (a structural, non-multi-child layout host)
extends: UIContainerElement   # structural surface container, NOT form-associated (face below)
# marginal: measured at build (npm run size, LLD-C9) — within the per-control ≤ ~2 kB tier budget (plan §10)

attributes:              # attributes-as-API — mirrors split-pane.ts `static props` (initial, min, max, collapsible)
  - name: initial
    type: number
    default: null         # String(null) = 'null' — the LIVE default; an UNREFLECTED ratio seed read ONCE by the parent ui-split at connect / pane-count growth (constrain.ts's seedRatios/rederiveRatios); unset/non-positive/non-finite ⇒ equal-fill. RENAMED from the LLD's literal `size` — family-coherence.test.ts's A2 invariant treats ANY attribute named `size` fleet-wide as the [sm,md,lg] widget-box enum (ADR-0081); this is an unrelated ratio seed, so it earns its own name (a build-mechanics fix, not a design deviation)
    reflect: false        # property-only seed, not a live authored dimension (the progress.md/stat.md optional-number precedent)
  - name: min
    type: string
    default: ''           # '' ⇒ the parent applies the --ui-split-pane-min floor (split-pane.css)
    reflect: true          # → the parent's --_pane-min JS geometry seam (split.ts #render); a CSS length string (px/%/rem)
  - name: max
    type: string
    default: ''           # '' ⇒ unbounded (parent-applied)
    reflect: true          # → the parent's --_pane-max JS geometry seam; a CSS length string
  - name: collapsible
    type: boolean
    default: false        # String(false) = 'false'
    reflect: true          # gates the PARENT's Enter-key collapse-to-last affordance when this pane is a separator's leading pane (SPEC-R4); this element does nothing with it itself

properties: []           # no manual accessors beyond the attributes-as-API

events: []                # structural — a pane carries no value and emits nothing of its own (the ui-card-header precedent)

slots: []                 # the author's light-DOM children ARE the pane's content (render() stays the inherited void) — no NAMED slots

parts: []                 # light-DOM, no shadow parts

customStates: []          # no interaction states — a pane has no hover/active/motion gate of its own

face:
  formAssociated: false   # NOT a FACE form control — extends UIContainerElement (a plain UIElement), no value/validity participation

aria:
  role: none              # a generic content region — no host role/aria-* attribute (the ui-row precedent); semantics ride the author's own children
  roleSource: none

keyboard: []               # not itself focusable/interactive — the PARENT's separators carry the keyboard contract (split.md)

geometry:
  sizeClass: layout
  blockSize: auto          # NO control height — content-driven; a pure flex-distribution box
  paddingBlock: 0
  minFloor: var(--ui-split-pane-min)   # the bare-pane floor when `min` is unset (4rem, split-pane.css)
  axisOblique: 'the parent (ui-split) writes --_pane-flex/-min/-max PLUS a [data-axis-vertical] marker per pane (the slider-multi --value-pct-lo/hi JS-geometry-seam precedent); split-pane.css consumes physical width/height (never logical inline-size) — axis selects a PHYSICAL dimension, not a writing-mode-relative one'

forcedColors: No system-colour mapping of its own — a pane paints nothing (overflow:auto over whatever content the author places); forced-colors legibility is the author's own content's concern.
---

# ui-split-pane

`ui-split-pane` is the generic **pane** child of [`ui-split`](./split.md) — a structural, non-interactive
content region (like `ui-card`'s header/content/footer regions: the container renders the interactive
separators, the author authors only the panes). It carries no value and emits no events of its own.

```html
<ui-split-pane initial="0.3" min="12rem">
  <ui-text>A narrower starting pane, floored at 12rem.</ui-text>
</ui-split-pane>
```

- **`initial`** — an optional initial ratio seed (a positive number), consulted once by the parent at
  connect and whenever a pane is added dynamically. Unset panes equally split whatever ratio remains.
- **`min`** / **`max`** — CSS length strings (`px`/`%`/`rem`/…) the parent resolves into a real floor/ceiling
  on this pane's constrained dimension (width for a horizontal split, height for a vertical one). `min`
  unset falls back to a small `--ui-split-pane-min` floor (4rem); `max` unset is unbounded.
- **`collapsible`** — when `true`, the parent's `Enter` key (pressed on the separator to this pane's
  trailing side) toggles this pane between its current extent and its floor, remembering the extent to
  restore to.
