---
# progress.md frontmatter — the GENERATION SOURCE for ui-progress's `static props` block (ADR-0173,
# converting ADR-0004's mirror to a source; LLD-C10, feed-family.lld.md §6). The machine-checkable public
# surface lives HERE (frontmatter); the prose below the fence is the /site doc. `progress.props.gen.ts` is
# GENERATED from `attributes[]` below (`node scripts/generate-props.mjs progress`) — the plain bare-
# `prop.*()` majority case, no enum at all. progress.ts imports the generated module — never hand-edit it.
# The fleet drift gate (descriptor/props-gen-driftwire.test.ts) keeps the two byte-identical.
tag: ui-progress
tier: display          # geometry size-class (Display band — a bar is a rail, not a widget box; SPEC-R20)
extends: UIElement     # a non-interactive, non-form-associated display LEAF (SPEC-R1)
# marginal: not yet measured — this folder-only wave (M1-a) ships ahead of the LLD-C11 shared-file
# integration slice (barrel export, component-styles.css import, package.json exports entry); the real
# `npm run size` figure lands with that slice, per feed-family.lld.md §6 (measured, never guessed).

attributes:            # attributes-as-API — the GENERATION SOURCE for progress.ts `static props` (ADR-0173)
  - name: current
    type: number        # kindOf's behavioural verdict — the TS type is number|null
    default: null        # String(null) = 'null' — the LIVE default; null/absent/non-finite ⇒ indeterminate
    reflect: false        # NOT reflected — property-only render input
    description: null (default) ⇒ indeterminate — the native progress semantic, no separate boolean to desync.
  - name: max
    type: number
    default: 100          # the ARIA progressbar default (SPEC-R1); non-finite/≤0/malformed ⇒ floors to 100
    reflect: false
    description: The ARIA progressbar default (100) — percent-natural for {current:42} with zero extra props.
  - name: label
    type: string
    default: ''
    reflect: true       # TKT-0069 item 2 ruling: label reflects fleet-wide
    description: The accessible name (SPEC-R3); empty ⇒ no internals.ariaLabel.
  - name: segments
    type: number        # kindOf's behavioural verdict — the TS type is number|null
    default: null        # null (default) ⇒ continuous mode, unchanged (SPEC-R1 Amendment v1)
    reflect: false        # NOT reflected — the current/max posture
    description: SPEC-R1 Amendment v1 (GH #614) — null/non-finite/<2/fractional/malformed ⇒ continuous mode, unchanged. A finite integer ≥2 activates discrete "step N of M" mode — effectiveMax=segments (max ignored), effectiveValue floors to an integer.

properties: []         # no manual accessors beyond the four typed props

events: []             # display-only — emits nothing (SPEC-R1: no events, no keyboard contract)

slots: []              # no light-DOM content model — render() stays the inherited no-op; the track/fill
                        # pair is component-built (createElement + append), never author-slotted.

parts:                  # data-part nodes built once in connected() (selected by progress.css)
  - name: track
    description: The `<span data-part="track">` — the full-width rail. Always present.
  - name: fill
    description: The `<span data-part="fill">` — inline-size = effectiveValue/effectiveMax (SPEC-R2) when determinate; `data-indeterminate` present and CSS-animated (sweep, or a stationary opacity pulse under prefers-reduced-motion) when `value` is absent/non-finite. Present whenever discrete-determinate mode is NOT active (continuous, or any indeterminate state — SPEC-R1 Amendment v1).
  - name: cells
    description: The `<span data-part="cells">` — the discrete-mode cell strip, replacing `fill` as the track's sole child. Built lazily on first discrete-determinate activation; swapped in/out of the track as the mode changes (SPEC-R1 Amendment v1).
  - name: cell
    description: One `<span data-part="cell">` per `segments` — `segments` equal cells always present when `cells` renders. `data-filled` present on the first `effectiveValue` cells, absent on the rest — no partial cell ever paints (SPEC-R1 Amendment v1).

customStates: []       # NO interaction state and NO motion gate — a display leaf has neither (no :state(); nothing to transition)

face:
  formAssociated: false  # a display leaf — extends UIElement, no value/validity participation

aria:
  role: progressbar      # ALWAYS set via internals — never aria-hidden, never silent (SPEC-R3; the chart inversion)
  roleSource: internals
  valueMin: internals.ariaValueMin    # always "0"
  valueMax: internals.ariaValueMax    # String(effectiveMax) — always present, even when indeterminate
  valueNow: internals.ariaValueNow    # String(effectiveValue) when determinate; null (absent) when indeterminate
  valueText: internals.ariaValueText  # the Intl percent reading when determinate (continuous) or "Step N of M" when determinate+discrete (SPEC-R1 Amendment v1); null when indeterminate
  labelSource: label prop             # internals.ariaLabel = label || null — empty label ⇒ no accessible name is minted

keyboard: []           # NOT interactive and NOT focusable — no tabindex, no keyboard contract

geometry:
  sizeClass: display
  minInlineSize: var(--ui-progress-min-inline-size)  # 8em default — the whole-shape floor (SPEC-R18 AC1)
  # NO [size] attribute, NO [scale] geometry row, NO --md-sys-height-* consumption (SPEC-R20 AC2) — the rail
  # thickness (--ui-progress-track-size) is a fixed, density-invariant px constant.

forcedColors: An explicit `@media (forced-colors: active)` block repoints the fill (a `background`-drawn rectangle, including the indeterminate sweep) to `CanvasText`, and gives the track a `Canvas` background + `CanvasText` border (SPEC-R19 — the bar-chart fill lesson: a background-drawn shape is otherwise forced to `Canvas` and vanishes against the page). Discrete mode (SPEC-R1 Amendment v1): filled cells repoint to `CanvasText` and unfilled cells to `Canvas`, and every cell gets an explicit `CanvasText` inter-cell border — the separation is never left to ride an unstyled background alone.
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

## Discrete mode: `segments` (SPEC-R1 Amendment v1, GH #614)

`segments` (`number | null`, default `null`) is an additive, backward-compatible widening — absent, `null`,
or any hardening-fail input (non-finite, `< 2`, fractional, or a malformed attribute) leaves the continuous
contract above byte-identical. A finite integer `≥ 2` activates **discrete "step N of M" mode**: `max` is
IGNORED (`effectiveMax := segments`), and `effectiveValue` additionally floors to an integer after clamping —
a step counts only when fully reached, so the painted fill count and the announced value are the same number
by construction.

```html
<ui-progress current="2" segments="4" label="Onboarding"></ui-progress>  <!-- 4 cells, first 2 filled -->
```

Rendering replaces the single fill with `segments` equal cells split along the rail, separated by a visible
gap: the first `effectiveValue` cells paint fill, the rest paint track — no partial cell ever paints.
Indeterminate (`current === null`) still renders today's sweep unchanged; `segments` never changes the
determinate/indeterminate switch, and cells exist only when determinate (an indeterminate stepper has
nothing to count). Accessibility: `ariaValueMax = String(segments)`, `ariaValueNow` = the snapped integer,
and `ariaValueText = "Step N of M"` — never the percent reading (announcing "50%" for a stepper misrepresents
the control's state).

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
