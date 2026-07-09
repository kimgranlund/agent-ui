---
# stat.md frontmatter — the attributes-as-API descriptor for ui-stat (ADR-0004; LLD-C9,
# report-family.lld.md §5). The machine-checkable public surface lives HERE (frontmatter); the prose
# below the fence is the /site doc. The `attributes[]` block MUST mirror stat.ts `static props`
# (label/value/delta/caption) — the contract<->props trip-wire (stat-descriptor.test.ts) targets this
# fence. `value`/`delta` classify by BEHAVIOUR (component-descriptor.ts `kindOf`), not by their runtime
# TypeScript type: `value` is `string | number` at the TS layer, but its codec's `from(null)` is `''` and
# it does not snap an unrecognized attribute back to a fixed member the way an enum does — so kindOf
# reads it as "string" (verified against the live probe in stat-descriptor.test.ts, per the LLD-C9
# build-verify note); `delta` is `number | null` and kindOf reads it as "number" (its `from(null)` is
# `null`, and both `from('')` and `from('5')` round-trip through the number branch).
tag: ui-stat
tier: display          # geometry size-class (Display band — NO control frame/height; SPEC-R17/ADR-0111 cl.5)
extends: UIElement     # a non-interactive, non-form-associated display LEAF (SPEC-R7)
# marginal: not yet measured — this folder-only wave (M1-a) ships ahead of the LLD-C10 shared-file
# integration slice (barrel export, component-styles.css import, package.json exports entry); the real
# `npm run size` figure lands with that slice, per report-family.lld.md §5 (measured, never guessed).

attributes:            # attributes-as-API — mirrors stat.ts `static props` (label, value, delta, caption)
  - name: label
    type: string
    default: ''
    reflect: false      # NOT reflected — plain accessible text, no CSS keys on it
  - name: value
    type: string        # kindOf's behavioural verdict (see the header note) — NOT the TS union type
    default: ''         # String('') = '' — the LIVE default; a finite-number attribute (e.g. "48200")
                         # still coerces to the typed number 48200 at the property (SPEC-R7), the codec's
                         # `from` return value, which this descriptor row does not (and cannot) restate
    reflect: false      # NOT reflected — property-only render input
  - name: delta
    type: number        # kindOf's behavioural verdict (see the header note)
    default: null       # String(null) = 'null' — the LIVE default; absent/non-finite ⇒ no delta region
    reflect: false      # NOT reflected — property-only render input
  - name: caption
    type: string
    default: ''
    reflect: false      # NOT reflected — absent/empty ⇒ not rendered (SPEC-R7)

properties: []         # no manual accessors beyond the four typed props

events: []             # display-only — emits nothing (SPEC-R7: no events, no keyboard contract)

slots: []              # no light-DOM content model — render() stays the inherited no-op; every child is
                        # control-built (createElement + replaceChildren), never author-slotted. NO child
                        # seam for a Sparkline (ADR-0111 fork F2, binding) — composition happens in a Row,
                        # outside this component.

parts:                  # data-part nodes the render effect builds (selected by stat.css, not by name from TS)
  - name: label
    description: The `<span data-part="label">` — the tile's label text. Always present (empty string renders an empty, still-boxed span).
  - name: value
    description: The `<span data-part="value">` — formatStatValue(value) (SPEC-R7). Real headline-scale typography with NO heading element (SPEC-R8).
  - name: delta
    description: The `<span data-part="delta" data-dir="up|down|flat">` — present only when `delta` is a finite number (SPEC-R7). `data-dir` drives the CSS glyph orientation only; ink never varies by direction (SPEC-R9 AC2).
  - name: delta-glyph
    description: The `aria-hidden` direction glyph inside `delta` — a component-drawn clip-path mark, OMITTED when `data-dir="flat"` (no arrow for "unchanged").
  - name: delta-word
    description: The visually-hidden-but-announced direction word ("up"/"down"/"unchanged") inside `delta`, preceding the signed number as real text (SPEC-R9 — a bare glyph codepoint is not an announcement).
  - name: caption
    description: The `<span data-part="caption">` — present only when `caption` is non-empty (SPEC-R7).

customStates: []       # NO interaction state and NO motion gate — a display leaf has neither (no :state(); nothing to transition)

face:
  formAssociated: false  # a display leaf — extends UIElement, no value/validity participation

aria:
  role: none             # no internals ARIA is minted (no internals.role assignment in stat.ts)
  roleSource: none
  labelSource: real-text  # the tile's WHOLE meaning is real, selectable DOM text — label/value/caption text
                          # nodes plus the delta's visually-hidden direction WORD (SPEC-R9); no
                          # internals.ariaLabel is ever set, because there is nothing silent to name

keyboard: []           # NOT interactive and NOT focusable — no tabindex, no keyboard contract

geometry:
  sizeClass: display
  minInlineSize: var(--ui-stat-min-inline-size)  # 8em default — the whole-shape floor (SPEC-R10)
  # NO [size] attribute, NO [scale] geometry row, NO --ui-height-* consumption (SPEC-R17 AC2) — the
  # lever is the type matrix (--md-sys-typescale-*) + the space ladder (--ui-stat-gap).

forcedColors: An explicit `@media (forced-colors: active)` block repoints the delta glyph (a `background:currentColor` mask shape) to `CanvasText` (SPEC-R15 — the bar-chart/badge fill lesson: a background-drawn clip-path glyph is otherwise forced to `Canvas` and vanishes). Label/value/caption/delta-word are real text and survive untouched with no dedicated rule.
---

# ui-stat

`ui-stat` is the **Display**-class metric tile (ADR-0111, report family v1) — label + value + optional
delta + optional caption as real, selectable DOM text. It is **not** interactive and **not**
form-associated: no events, no keyboard contract, no `[size]`/`[scale]` control geometry.

```html
<ui-stat label="Revenue" value="48200" delta="12" caption="vs last month"></ui-stat>
<ui-stat label="Uptime" value="99.98%"></ui-stat>
```

## Rendering

The tile is component-built light DOM — four spans in reading order label → value → delta → caption
(`replaceChildren` rebuild on any prop change; there is no interior state worth preserving on a four-span
tile, so the whole-swap is deliberately simple, unlike `ui-table`'s scroll-preserving contract). **No
heading element is ever stamped** (`h1`–`h6`) — a stat's value is not a document heading; it retires the
hand-composed `caption-Text + h3-variant-Text` idiom the corpus taught before this component existed. Tile
typography rides the `--md-sys-typescale-*` matrix via `--ui-stat-*` tokens.

`value` accepts a `string | number`: a finite number formats through the platform default-locale
`Intl.NumberFormat` (`48200` → `48,200`); a non-finite number renders the placeholder `—`; a string passes
through **verbatim** — the author controls formatting for non-numeric values (`"$1.2M"`, `"99.98%"`).

## Delta: direction, never valence

`delta` is a plain signed number. When it is a finite number, the delta region renders a component-drawn
direction glyph (▲/▼, `aria-hidden`, omitted for `delta === 0`) **plus** the signed number as real text
(`Intl.NumberFormat({ signDisplay: 'exceptZero' })` → `+12` / `-3` / `0`). The delta's accessible reading
is `{word} {text}` (e.g. "up +12") — a visually-hidden-but-announced word precedes the number, because a
bare glyph codepoint is not an announcement.

**Direction is not goodness.** v1 encodes direction only, deliberately — "up is good" is false for
churn-class metrics, so there is no automatic green/red valence: the delta's ink never varies by
direction (up/down/flat share one color). A wrong automatic valence is a lying dashboard; a future,
separately-argued valence prop would need to own its own ADR-0057 co-signifier.

## No composition seam

`ui-stat` takes no children and has no slot. Pairing a `ui-sparkline` beside a stat (the "trend" idiom) is
**pure composition** — a `Row` of `Stat` + `Sparkline` in a `Card` — not a feature of this component
(ADR-0111 fork F2). A stat without a sparkline is a complete, correct tile.

## Accessibility

The tile's whole meaning is real, selectable text — no `ElementInternals` ARIA is minted, because there is
nothing silent to name. The delta's direction word is visually hidden (clip-path-inset, the standard
sr-only recipe) but present in the accessibility tree as real text, immediately before the signed number.

## Sizing

The host floors at `--ui-stat-min-inline-size` (`8em` default) in an unstyled flex row (test-the-whole-shape)
— override the token, or set `inline-size` directly, to size the tile to a layout. Interior gap rides
`--ui-stat-gap` off the space ladder (density-responsive for free).
