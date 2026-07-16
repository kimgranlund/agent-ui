---
# badge.md frontmatter — the attributes-as-API descriptor for ui-badge (ADR-0004; report-family.lld.md
# LLD-C9; SPEC-R11…R13/R17). The machine-checkable public surface lives HERE (frontmatter); the prose
# below the fence is the /site doc. The `attributes[]` block MUST mirror UIBadgeElement.props
# (label/intent) — the contract↔props trip-wire in badge.test.ts targets this fence.
tag: ui-badge
description: A non-interactive status tag with an intent-keyed color and a matching non-color glyph.
tier: display           # SPEC-R11 AC3 + LLD-C9: a non-interactive display leaf (site-tier classification,
                        # not the geometry MECHANISM) — the LLD-C10 display-tier roster explicitly includes
                        # `badge`. The box still rides the compact-realm ramp (--ui-compact-lg, ADR-0041,
                        # geometry: sizeClass below) — `tier` here is the descriptor/site classification
                        # field, orthogonal to the geometry mechanism, and must match the fleet-wide
                        # display-tier membership list (site-coverage.test.ts) landing at LLD-C10.
extends: UIElement      # a non-interactive, non-form-associated display LEAF (SPEC-R11) — no UIIndicatorElement
                        # base: no checked/value/disabled, no tabbable/pressActivation (chips are fenced, F3)
# marginal: NOT measured in this M1-a slice — ui-badge is not yet wired into controls/index.ts /
# component-styles.css / package.json exports (the LLD-C10 serial-integration wave, a shared-file slice
# explicitly out of this folder-only build's fence). `npm run size` through the family barrel is owed at
# LLD-C10 alongside ui-table/ui-stat, per the family's ≤ ~2 KB gz per-control budget (plan §10).

attributes:             # attributes-as-API — mirrors UIBadgeElement.props (label, intent)
  - name: label
    type: string
    default: ''
    reflect: true       # TKT-0069 item 2 ruling: label reflects fleet-wide
  - name: intent
    type: enum
    values: [neutral, info, success, warning, danger]
    default: neutral
    reflect: true       # reflects so the [intent] CSS colour/glyph repoint applies to JS-set/bound values
                         # too (the ui-text `variant` precedent) — bindable STATUS DATA (ADR-0111 cl.2,
                         # fork F3), unlike Sparkline's structural `variant`. An out-of-enum runtime write
                         # (a bound-garbage simulation) is hardened back to 'neutral' by a connected()
                         # effect (SPEC-R11 AC2) — the enum codec's own snap covers only the ATTRIBUTE path.

properties: []          # no manual accessors beyond the two typed props

events: []              # display-only — emits nothing (SPEC-R11: no events, no keyboard contract)

slots: []               # no author-slotted content model — `label` is a PROP (plain text), not a slot;
                         # the inherited render() no-op path is unused: connected() builds two
                         # component-owned spans once (`replaceChildren`), never author-slotted children

parts:
  - name: glyph
    description: The `<span data-part="glyph" aria-hidden="true">` — a CONSTANT node whose clip-path shape differs per `[intent]` (pairwise-distinct; ADR-0057). Hidden entirely (`display:none`) for `intent="neutral"` — absence is neutral's own non-color signifier. Decorative only; never carries the announced message.
  - name: label
    description: The `<span data-part="label">` — real text mirroring the `label` prop; the host's accessible name (no internals ARIA is minted — SPEC-R12 AC3).

customStates: []        # NO interaction state and NO motion gate — non-interactive, nothing to transition
                         # (no :state() in badge.css, no internals.states call in badge.ts)

face:
  formAssociated: false  # a display leaf — extends UIElement, no value/validity participation

aria:
  role: none             # NO internals role is ever set — a generic host; its own text content IS the
                          # accessible name via the platform accname algorithm (no ARIA needed to carry it)
  roleSource: none        # never internals, never a host role/aria-* attribute (FACE — FACE controls that
                          # need no ARIA mint none, rather than a placebo role)
  labelSource: the rendered label span's text content  # `label` prop → `[data-part=label]` textContent;
                          # the glyph is aria-hidden and text-free (SPEC-R12 AC3) — colour/shape carry
                          # visual-only redundancy, never assistive-tech meaning

keyboard: []             # NOT interactive and NOT focusable — no tabindex, no keyboard contract (SPEC-R11)

geometry:
  sizeClass: indicator
  blockSize: var(--ui-badge-box)         # the compact-realm widget-box ramp (ADR-0041) — fixed, NEVER content-driven
  minInlineSize: var(--ui-badge-box)     # empty-label floor → a filled pill/dot, never a sliver (SPEC-R13 AC2)
  boxRamp: --ui-compact-lg               # 18px @ default ui-md scale; an ancestor [scale] re-tables it for free
  padFormula: 2px + box * 0.375 * density  # the compact-realm pad law (NOT h/2 — geometry.md's compact-realm exception)
  radius: calc(--ui-badge-box / 2)       # the pill = box/2, the realm's "count pill" case
  noSizeAttribute: true                   # v1 ships no [size] axis (SPEC-R13 AC3) — a foreseen extension only

forcedColors: A `@media (forced-colors: active)` block maps the host to a `Canvas` fill / `CanvasText` ink+border (the boxed identity survives), and the glyph to a `CanvasText` background (a background-drawn clip-path glyph is otherwise flattened to `Canvas` and vanishes — the bar-chart fill lesson, SPEC-R15 AC1).
---

# ui-badge

`ui-badge` is a **compact-realm**, **non-interactive** display leaf (`extends UIElement`) — a status or
neutral "tag" token with an intent-keyed colour + a component-drawn, non-color glyph. It carries no
focus, no keyboard contract, no events, and no form participation (chips — dismissible/selectable tokens —
are a fenced separate component class; ADR-0111 fork F3).

```html
<ui-badge label="3 failing" intent="danger"></ui-badge>
<ui-badge label="11 passing" intent="success"></ui-badge>
<ui-badge label="beta"></ui-badge> <!-- intent defaults to "neutral" — a plain tag, no glyph -->
```

## Intent

`intent` is **bindable status data** (`neutral` default, `info` / `success` / `warning` / `danger`) —
unlike a structural `variant`, it is expected to change live as the status it reports changes. Every
non-neutral intent renders a **pairwise-distinct**, component-drawn glyph (a CSS `clip-path` — tick /
cross / triangle / disc) alongside its colour repoint, so hue is never the only channel carrying the
status (ADR-0057). `neutral` renders no glyph at all — absence is its own signifier. An out-of-enum
runtime value (e.g. a data-model bind resolving to something unexpected) is hardened back to `neutral`
by the component itself; the shared catalog validator only checks literal membership at parse time, not a
bound value at runtime.

## Anatomy

The host is an `inline-flex` pill: a constant `[data-part=glyph]` node (shape/visibility keyed on
`[intent]`) followed by a `[data-part=label]` text node mirroring the `label` prop. Neither node is ever
replaced — an intent change is a zero-DOM-churn attribute flip; a label change updates only the label
span's text.

## Geometry

The box rides the **compact-realm** widget-box ramp (`--ui-compact-lg`, ADR-0041) — fixed regardless of
label length or an ancestor `[density]`; the pad follows the compact-realm law (`2px + box·ratio·density`,
never `h/2`); the radius is `box/2` (a pill). There is no `[size]` attribute in v1. The label text itself
rides the fleet font ramp (`--ui-font-sm`) at `line-height: 1`, centering like a glyph. An empty label
still floors at `min-inline-size = box` — a filled dot/pill, never a collapsed sliver.

## Accessibility

No `ElementInternals` ARIA is minted at all — the host is a generic element whose own text content (the
label span) is its accessible name via the platform accname algorithm. The glyph is `aria-hidden` and
carries no text; it is pure visual redundancy, never assistive-tech meaning.

## Forced colors

Under `forced-colors: active` the host repaints to `Canvas` fill / `CanvasText` ink and border (the boxed
identity survives), and the glyph repaints to `CanvasText` (a `currentColor`/background-drawn clip-path
glyph would otherwise vanish under WHCM's flattening).
