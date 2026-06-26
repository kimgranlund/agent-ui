# Geometry & sizing — the law

> Canonical normative standard for agent-ui control geometry. Distilled 2026-06-26 from the rce
> provenance ledgers [`geometry-sizing-spec.md`](./geometry-sizing-spec.md) +
> [`dimensional-standard.md`](./dimensional-standard.md) — consult those for rationale and history;
> this doc is the resolved *law*. **Where the two conflict, `geometry-sizing-spec.md` §5 wins** (the
> comfortable-control inline-pad; noted inline below).

## The centering law (the one rule)

Edge padding for a glyph = **(height − glyph) / 2**. Each glyph centers in a square cell of side = the
control height. `padding-block` is `0` — **block-size is the vertical lever, never block-padding**.

## The two families

Every derived quantity scales with one of two things:

- **Frame — ∝ height** (the box): icon, slot, inline-pad, `min-inline-size`, pill radius.
- **Rhythm — ∝ font** (text-adjacent marks & spacing): `gap = font / 2`, `caret = font`.

Density multiplies the **rhythm only** (the gap), never the frame — scaling the frame un-centers the
glyph and breaks the square.

## The slot model (no authored trailing-pad)

Leading and trailing affordances each sit in the **same icon-sized square slot** that centers its
content. The icon fills its slot; the smaller caret (`= font`, and `font < icon` at every scale) centers
in its slot and lands further from the edge — the asymmetric trailing edge is **emergent, never
authored**. Realized per-glyph (the slotted `<ui-icon>` / mask glyph *is* the slot), placed by a
presence-driven `:has()` grid so an absent slot leaves no phantom gap.

## Per-edge inline padding (presence-driven)

- A **slot** edge (icon/caret) → `½(height − icon)`.
- A **slotless** edge (bare label) → `h / 2` (= the text pad `½(h − font)` + the absent slot's gap
  `½·font`) — so a label never jams the edge.
- A `[label · caret]` control is **asymmetric by design**: value at `h/2`, caret at `½(h − glyph)`.
- Both pads are **geometric** (frame family) — density-invariant; density rides the gap only.

Grid by presence: `lead+trail → auto 1fr auto` · `lead-only → auto 1fr` · `trail-only → 1fr auto` ·
`none → 1fr` · `icon-only (no label) → square`.

> **Supersedes:** `dimensional-standard.md`'s comfortable-control inline-pad `2px + height·0.375·density`
> is REPLACED by the slot/slotless model above. The `2px + box·ratio·density` pad survives **only** for
> the compact realm (below).

## Affordance vs content-icon — the sizing taxonomy

A glyph's size is decided by **what KIND it is**, not where it sits:

- **Inline affordance** (caret · dropdown-chevron · disclosure-marker · stepper-arrow · clear `×` ·
  calendar-nav `‹›`) → **`= font`** (`--ui-{cmp}-glyph = font × 1`). Mask glyph or slotted
  `<ui-icon name=caret>` — same size, `½(h − font)` inset.
- **Content icon** (a field's leading icon · status icon · avatar · search magnifier) → **`= --ui-ind`**
  (the indicator/icon ramp).
- **Nav icon in a standalone button** (carousel prev/next; pagination chevron by the numbers) → sized to
  match its context — a deliberate per-case exception, not the font rule.

The bug class: an inline affordance sized to `--ui-ind` renders ≈1.2–1.5× the text (oversized). The fix
is always to size it `= --ui-{cmp}-glyph` (font).

## The size ramp (two bands)

`scale × size(sm/md/lg)` → a **height** (`--ui-height-{size}`) and a **font** (`--ui-font-{size}`); a
control resolves height+font, then obeys the families above. The ramp is two bands that change gear at
the **MD|LG seam**:

- **compact band** (XS·SM·MD = 20·24·28): height `+4` linear; gentle glyph step.
- **expressive band** (LG·XL·2XL = 36·48·64): height `×4/3` geometric; doubled glyph step.

Glyphs scale **sublinearly** (the optical correction): `icon ≈ 2.49·h^0.58`, `font ≈ 3.16·h^0.45 (≈√h)`,
`caret ≈ 4.08·h^0.35`. **Generating rule:** round the power law — glyphs to nearest even, font to nearest
integer.

## The five size-classes

A component's sizing lever is set by its class:

| Class | Examples | Lever |
|---|---|---|
| **Control** (full height) | button · text-field · number-field · select · field | `block-size: var(--ui-{cmp}-height)` off `--ui-height-{size}`; font `--ui-font-{size}`; inline-pad per the slot/slotless model |
| **Indicator** (smaller box) | checkbox · radio · switch · slider · tag | `block/inline-size: var(--ui-{cmp}-size)` off `--ui-ind-{size}` (or the compact ramp) |
| **Pattern** (container + control-height rows) | tabs · segmented-control · toolbar · accordion · menu · dialog | interactive rows take the control height; the shell uses the space scale |
| **Container/layout** | spacer · stack · grid | gaps/margins/padding off `--space-*` × density; no control height |
| **Display** | divider · icon · spinner · progress · alert · badge · tooltip | `font-size: var(--ui-font-{size})` where text-bearing; intrinsic structural sizing |

## The compact realm (a separate size system)

Always-compact widgets (kbd · slider · slider-multi · radio · switch · tag · badge · chip · checkbox) do
**not** use `h/2`:

- keep the **compact pad** `= 2px + box·ratio·density` (`h/2` would over-pad a keycap / count pill / thumb).
- size the box on the dedicated **compact ramp** `--ui-compact-{sm,md,lg}` — a two-band ladder: the `ui-*`
  band tight (`12·14·16·18·20`, 2px steps), the `content-*` band generous (`18→32`, 4px within-scale).
  The box is density-invariant; density rides the pad.

## `--space-*` is layout spacing, not control geometry

The `--space-*` scale (page gutters, card/stack gaps, section rhythm) is the space **between**
components — a different concern from control padding (the law above). They are not interchangeable.

## Mechanization

Every law lands with a probe (the geometry trip-wire, per [`../process.md`](../process.md) §1): edge-pad
`== (height − glyph)/2` within ε; block-size off the ramp with `padding-block == 0`; `0 < glyph ≤ box`;
the per-edge slot/slotless pad; affordance `== font` (not `--ui-ind`). A law without a probe is not
enforced.

> Runtime token tables (`--ui-height/font/ind/compact-{size}`, `--space-*`, `--ui-density`) are authored
> in `@agent-ui/shared` when tokens land (G5); until then this doc is the spec they implement.
