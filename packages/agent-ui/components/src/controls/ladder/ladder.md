---
# ladder.md frontmatter — the attributes-as-API descriptor for ui-ladder (ADR-0004; LLD-C8,
# token-surfaces.lld.md §4). The machine-checkable public surface lives HERE (frontmatter); the prose below
# the fence is the /site doc. The `attributes[]` block MUST mirror ladder.ts `static props` (tiers/label) —
# the contract↔props trip-wire (ladder-descriptor.test.ts) targets this fence.
tag: ui-ladder
tier: display          # Display band — no control frame/height/[size]/[scale] (SPEC-R16/ADR-0118 cl.5)
extends: UIElement     # a non-interactive display LEAF — NOT form-associated (SPEC-R9)
# marginal: 282 B gz — within the 2048 B gz per-control budget (ADR-0080 clause 3); solo 5062 B gz
# (foundation-inclusive, informational). Measured 2026-07-10 (wave M1-c, LLD-C9) via `npm run size` through
# the public `./controls/ladder` entry, after the barrel + component-styles.css wiring landed. Family total
# (`components` barrel): 30593 B gz — within the 30720 B gz ceiling (127 B headroom), no re-base needed.

attributes:            # attributes-as-API — mirrors ladder.ts `static props` (tiers, label)
  - name: tiers
    type: json          # closest ATTR_TYPES member to "array of {label,value} objects, JSON-string attribute form" (SPEC-R9)
    default: ''         # the LIVE default is `[]` — `String([])===''` is what the contract↔props trip-wire
                         # (compareDescriptorToProps) actually compares against (`String(config.default)`)
    reflect: false       # NOT reflected — a JSON-string attribute round-trips through the shared LLD-C1 codec
                         # `from(null) = []` (never `null`), so a malformed/removed attribute never reaches render
  - name: label
    type: string
    default: ''         # the list's accessible name (SPEC-R12: unlabeled is legal, never a silent state)
    reflect: false

properties: []          # no manual accessors beyond the two typed props

events: []              # display-only — emits nothing (SPEC-R9: no events, no keyboard contract)

slots: []               # no light-DOM content model — render() stays the inherited no-op; every row is
                         # component-built (replaceChildren), never author-slotted

parts:
  - name: label
    description: The `<span data-part="label">` — the tier's label text (real DOM text, selectable, wraps — SPEC-R10 AC3). Part of the listitem's accessible text content.
  - name: track
    description: The `<span data-part="track" aria-hidden="true">` — the transparent sizing box the bar renders inside (no fill of its own). `aria-hidden` and text-free; the magnitude bar lives inside it.
  - name: bar
    description: The `<span data-part="bar">` inside `track` — the LITERAL-length magnitude bar, capped to the track (`min(100%, …)`, SPEC-R10). Its length rides the row-scoped `--_mag` custom property (set imperatively by ladder.ts via the shared LLD-C1 `cssValue`/`isRenderableLength` routing); ladder.css owns the paint.
  - name: value
    description: The `<span data-part="value">` — the tier's printed value as real DOM text. The accessible datum (SPEC-R12) that ALWAYS survives, whether the bar rendered a real length or degraded to zero (SPEC-R11).

customStates: []        # NO interaction state and NO motion gate — a display leaf has neither

face:
  formAssociated: false  # a display leaf — extends UIElement, no value/validity participation

aria:
  role: list              # role=list via ElementInternals — CONSTANT, set once in connected() (the ui-bar-chart/ui-ramp precedent)
  roleSource: internals    # `this.internals.role = 'list'` — NEVER a host role attribute (the FACE pattern)
  labelSource: label prop  # `internals.ariaLabel = label || null` — an unlabeled list is legal (SPEC-R12); never aria-hidden
  childRole: listitem      # each rendered row is a real `role="listitem"` element (a light-DOM attribute — the anatomy.md sanction for interior nodes; only HOST aria rides internals)

keyboard: []            # NOT interactive and NOT focusable — no tabindex, no keyboard contract

geometry:
  sizeClass: display
  minInlineSize: var(--ui-ladder-min-inline-size)  # 16em default — the whole-shape floor; NO [size] ramp, NO --ui-height-* (SPEC-R16 AC2)
  rowGap: var(--ui-ladder-row-gap)                  # the density-RESPONSIVE row rhythm (rides [density] for free — ADR-0103)
  barSize: var(--ui-ladder-bar-size)                # bar THICKNESS — density-invariant mark geometry (SPEC-R16)

forcedColors: An explicit `@media (forced-colors: active)` block (SPEC-R14) — the bar paints `CanvasText` (a system ink is never forced away, so magnitude still carries by length); the label/value text is real text and survives untouched.
---

# ui-ladder

`ui-ladder` is the **Display**-class labeled-dimensional-tiers leaf (ADR-0118, token-surfaces v1) — a
magnitude-bar list whose whole contract is "show these dimensional tiers at their real length, the printed
value as the datum." It is **not** interactive and **not** form-associated: no events, no keyboard
contract, no scheme prop (dimensions are scheme-invariant).

```html
<ui-ladder
  label="Control heights"
  tiers='[{"label":"sm","value":"24px"},{"label":"md","value":"28px"},{"label":"lg","value":"36px"}]'
></ui-ladder>
```

## Rendering — magnitude as literal length

One row per valid tier, in `tiers` order: **label · magnitude bar · printed value** on a shared grid so
labels/values stay real DOM text. The bar's inline-size is the tier's **literal length value** (a `--var`
value routes through the shared `--var` lane to `var(--…)` first — never a bare dashed-ident), capped to
the track width — `min(100%, <value>)` — so a `28px` tier draws a 28px bar and a `36px` tier a 36px bar:
**the magnitude is literally true, with no component normalization math** (ADR-0118 cl.2/3 — the deliberate
departure from `ui-bar-chart`, which DOES normalize numeric magnitudes 0..100). Setting `tiers` re-renders
the whole list (a whole-array swap, no incremental API).

> **The literal-length limitation (an accepted, documented property).** Because magnitudes are literal and
> unnormalized, a small-scale ladder (e.g. radii `2/4/8/12px`) shows visually near-identical short bars —
> its rhythm reads from the **printed values**, not from bar-length contrast — and a tier wider than the
> track saturates at 100%, so several large tiers can read as equal-length full bars. This is the accepted
> cost of the no-math law; cross-tier normalization is a *foreseen extension*, out of v1.

## Degenerate tiers

Every case still paints the host box and still announces (never throws — SPEC-R11): `[]`/absent/malformed
input renders zero rows (the host stays `role=list` with zero items); a tier missing a string `label` or
`value` is dropped, the remainder renders in order (the only drop case — the entry is not a well-formed
tier). A tier whose `value` is **not a resolvable length** (e.g. `"red"`) is **kept** — a zero-length bar,
the printed value carries the reading, the reader sees exactly what malformed value was supplied rather
than a silently vanished row (the unified no-silent-state rule, matching `ui-swatch`'s invalid-color-keeps-
the-datum). A `0`-length tier (`0`, `0px`) renders one row with a zero-length bar, the printed `0` carrying
the reading. An undefined `--var` length also zero-bars (the `min(100%, var(--_mag, 0px))` fallback
genuinely fires), the value text still printed. Duplicate labels render as separate rows (positional, not
keyed).

## Accessibility

A ladder is data, not decoration: the host carries `role="list"` via `ElementInternals` (never a host
attribute), named by `label` when non-empty — an unlabeled ladder is legal. Each rendered tier is a real
`role="listitem"` element whose text content is its label plus its printed value — the two real text spans
(`[data-part='label']` / `[data-part='value']`). The magnitude bar (`[data-part='track']` +
`[data-part='bar']`) is `aria-hidden` and text-free: magnitude travels by length + the printed value, never
a color-only signifier.

## Sizing

The host defaults to a `16em` `min-inline-size` floor (`--ui-ladder-min-inline-size`) — a bare, unstyled
ladder in a flex row still paints a visible, non-collapsed list with zero consumer CSS (ADR-0102 Lane A).
Bar thickness (`--ui-ladder-bar-size`) is density-**invariant**; row/column gap
(`--ui-ladder-row-gap`/`-col-gap`) rides the `--ui-space` ladder and responds to an ancestor `[density]` for
free. There is no `[size]`/`[scale]` attribute and no `--ui-height-*` lever (SPEC-R16 AC2).

## RTL

Rows follow the writing direction — labels at inline-start, values at inline-end, the bar's inline-size
mirrors — via logical CSS throughout (subgrid columns, `inline-size`); no physical-direction assumption
anywhere in ladder.css, so a `dir="rtl"` context mirrors the whole row for free.

## Forced colors (WHCM)

The bar paints `CanvasText` — an explicit override, because a system ink is never forced away and the
magnitude must still carry by length under `forced-colors: active`. The label/value text is real text and
needs no override.
