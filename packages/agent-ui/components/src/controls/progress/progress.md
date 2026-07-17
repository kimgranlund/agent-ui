---
# progress.md frontmatter — the attributes-as-API descriptor for ui-progress (ADR-0004; LLD-C10,
# feed-family.lld.md §6). The machine-checkable public surface lives HERE (frontmatter); the prose below
# the fence is the /site doc. `attributes[]` MUST mirror progress.ts `static props` (value/max/label) —
# the contract<->props trip-wire (progress-descriptor.test.ts) targets this fence. `value` and `max` both
# ride the fleet's `prop.number` codec, so `kindOf` (component-descriptor.ts) classifies BOTH as "number"
# regardless of their differing defaults (null vs 100) — the codec's `type.from` behaviour is what kindOf
# probes, never the schema default (verified in progress-descriptor.test.ts, the stat.md kindOf
# build-verify precedent).
tag: ui-progress
tier: display          # geometry size-class (Display band — a bar is a rail, not a widget box; SPEC-R20)
extends: UIElement     # a non-interactive, non-form-associated display LEAF (SPEC-R1)
# marginal: not yet measured — this folder-only wave (M1-a) ships ahead of the LLD-C11 shared-file
# integration slice (barrel export, component-styles.css import, package.json exports entry); the real
# `npm run size` figure lands with that slice, per feed-family.lld.md §6 (measured, never guessed).

attributes:            # attributes-as-API — mirrors progress.ts `static props` (value, max, label)
  - name: current
    type: number        # kindOf's behavioural verdict (see the header note) — the TS type is number|null
    default: null        # String(null) = 'null' — the LIVE default; null/absent/non-finite ⇒ indeterminate
    reflect: false        # NOT reflected — property-only render input
  - name: max
    type: number
    default: 100          # the ARIA progressbar default (SPEC-R1); non-finite/≤0/malformed ⇒ floors to 100
    reflect: false
  - name: label
    type: string
    default: ''
    reflect: true       # TKT-0069 item 2 ruling: label reflects fleet-wide

properties: []         # no manual accessors beyond the three typed props

events: []             # display-only — emits nothing (SPEC-R1: no events, no keyboard contract)

slots: []              # no light-DOM content model — render() stays the inherited no-op; the track/fill
                        # pair is component-built (createElement + append), never author-slotted.

parts:                  # data-part nodes built once in connected() (selected by progress.css)
  - name: track
    description: The `<span data-part="track">` — the full-width rail. Always present.
  - name: fill
    description: The `<span data-part="fill">` — inline-size = effectiveValue/effectiveMax (SPEC-R2) when determinate; `data-indeterminate` present and CSS-animated (sweep, or a stationary opacity pulse under prefers-reduced-motion) when `value` is absent/non-finite.

customStates: []       # NO interaction state and NO motion gate — a display leaf has neither (no :state(); nothing to transition)

face:
  formAssociated: false  # a display leaf — extends UIElement, no value/validity participation

aria:
  role: progressbar      # ALWAYS set via internals — never aria-hidden, never silent (SPEC-R3; the chart inversion)
  roleSource: internals
  valueMin: internals.ariaValueMin    # always "0"
  valueMax: internals.ariaValueMax    # String(effectiveMax) — always present, even when indeterminate
  valueNow: internals.ariaValueNow    # String(effectiveValue) when determinate; null (absent) when indeterminate
  valueText: internals.ariaValueText  # the Intl percent reading when determinate; null when indeterminate
  labelSource: label prop             # internals.ariaLabel = label || null — empty label ⇒ no accessible name is minted

keyboard: []           # NOT interactive and NOT focusable — no tabindex, no keyboard contract

geometry:
  sizeClass: display
  minInlineSize: var(--ui-progress-min-inline-size)  # 8em default — the whole-shape floor (SPEC-R18 AC1)
  # NO [size] attribute, NO [scale] geometry row, NO --md-sys-height-* consumption (SPEC-R20 AC2) — the rail
  # thickness (--ui-progress-track-size) is a fixed, density-invariant px constant.

forcedColors: An explicit `@media (forced-colors: active)` block repoints the fill (a `background`-drawn rectangle, including the indeterminate sweep) to `CanvasText`, and gives the track a `Canvas` background + `CanvasText` border (SPEC-R19 — the bar-chart fill lesson: a background-drawn shape is otherwise forced to `Canvas` and vanishes against the page).
---

# ui-progress

`ui-progress` is the **Display**-class thin-rail progress bar (feed family v1, ADR-0112) — bar-only task
progress with a native-`<progress>`-shaped value model. It is **not** interactive and **not**
form-associated: no events, no keyboard contract, no `[size]`/`[scale]` control geometry.

```html
<ui-progress current="42" label="Indexing"></ui-progress>
<ui-progress label="Working"></ui-progress>  <!-- no value ⇒ indeterminate -->
```

## Value model: determinate vs. indeterminate

`value` (`number | null`, default `null`) is the ONLY switch between determinate and indeterminate — there
is no separate boolean to desync (the native `<progress>` semantic, carried over). `value === null` (or
absent, non-finite, or a malformed attribute) is **indeterminate**: "working", not "0%". `max` defaults to
`100` — the ARIA progressbar default — so `{"component":"Progress","value":42}` is percent-natural with
zero extra props.

Hardening never throws (SPEC-R1's table): a negative `value` clamps to `0`; a `value` over `max` clamps to
`max`; a non-finite/≤0/malformed `max` floors back to `100` (the default), and `value` still clamps against
that floored max. Every input — however malformed — resolves to a paintable, announced state.

## Rendering

A thin horizontal rail: a full-width **track** and a **fill**. Determinate: the fill's inline-size is
`effectiveValue / effectiveMax` of the track's, growing from the inline-start edge (logical CSS — RTL
mirrors for free). Indeterminate: the fill renders a **visibly-animated sweep** — a partial-width fill
translating along the track — so "working" is distinguishable from both `0%` and `100%` at a glance. Under
`prefers-reduced-motion: reduce` the sweep is replaced by a stationary partial fill with a slow opacity
pulse (no translation, no scaling) that stays visually distinct from any determinate state.

## Accessibility

Progress is status data, never decoration — the chart inversion holds here, not the icon/avatar decorative
default: via `ElementInternals` the host is **always** `role=progressbar`, never `aria-hidden`. Determinate:
`ariaValueMin="0"`, `ariaValueMax=String(effectiveMax)`, `ariaValueNow=String(effectiveValue)`, and
`ariaValueText` is the `Intl.NumberFormat` percent reading (default locale). Indeterminate: `ariaValueNow`
and `ariaValueText` are **absent** (`null`) — the ARIA-native indeterminate signal — while role/min/max
persist. The accessible name comes from `label` when non-empty; a label-less indeterminate bar still
announces as "progressbar, busy" via the platform's own indeterminate handling.

## Sizing

The host floors at `--ui-progress-min-inline-size` (`8em` default) in an unstyled flex row
(test-the-whole-shape) — override the token, or set `inline-size` directly, to size the bar to a layout.
The rail thickness (`--ui-progress-track-size`, `4px` default) is a fixed, density-invariant constant — a
bar is a rail, not a `[size]`/`[scale]` widget box (the slider-rail precedent).
