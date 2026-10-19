# Geometry & Sizing Spec: one n, the centering law, the derived foundations

**Status:** design-of-record. **Rewritten 2026-10-13 for ADR-0245**, shipped at the foundations cut (#1932),
and brought to the skill's v2 constants and density by Amendment 3 (T-0120): every size derives from **one
integer n per element**, and container spacing from **m**. This replaces the hand-tuned eight-row ramp
(16 to 64), the sublinear power law, the `(scale × size) → §1-row` lookup (ADR-0038), the compact box ramp
(ADR-0041) and the `[density]` frame/rhythm split; their history lives in those superseded ADRs and in git.
The section numbers (§1 to §7) are kept because ADR bodies cite them.

**The thesis.** Geometry is arithmetic, not taste: a control's box is `4n`, and every glyph it carries sits in
a `2n` slot, centered. Tier, scale and size choose n; everything else is a formula over it, so a height and
its font, icon, padding and radius pair by construction. One config owns the system: the skill's
`scale.mjs` (CFG, `resolve()`, `check()`), vendored to `@agent-ui/shared/src/tokens/scale.mjs`, emitted as
`foundations.gen.css` by `scripts/generate-foundations.mjs` (which refuses to write when `check()` returns a
failure). Changing the system means editing CFG, never a
stylesheet.

---

## 1 · The derivation

`n = n0 + a·s + k·z + g·s·z`, n in 4 to 24. The tier supplies `(n0, a, k, g)`, the region supplies the scale
s, and the control (or `data-size`) supplies the size z; s and z are each -1, 0 or +1. Density d (`data-density`
compact / default / spacious, -1 / 0 / +1) moves only the container unit `m = max(n + a·d, floor((n + c)/2) + 1)`.

| tier | n0 / a / k / g | use |
|---|---|---|
| widget | 6 / 1 / 1 / 0 | tool panels, dense chrome |
| product | 8 / 2 / 2 / 1 | app screens (the library root, at scale md since Amendment 8) |
| content | 10 / 2 / 2 / 1 | reading and document surfaces |
| brand | 14 / 2 / 2 / 1 | hero and marketing |

Reachable heights (`4n`) at sm / md / lg: **widget** 16 / 20 / 24 at scale sm, 20 / 24 / 28 at md (the A2UI
canvas, Amendment 2) and 24 / 28 / 32 at lg; **product** 20 / 24 / 28 at scale sm, 24 / 32 / 40 at md (the root,
Amendment 8) and 28 / 40 / 52 at lg; content and brand step up likewise (`derive.out.md` holds every cell; Amendment 3 moved
the anchors one step down from the 7 / 9 / 11 of the cut). The retired `[scale]` values map by purpose (`ui-sm` to
widget/sm, `ui-md` to product/sm, `ui-lg` to product/md, `content-*` to content/sm, md, lg); the bridge
applies the map for one release.

With `c = ceil(n/4)` the derived quantities, all whole pixels (the emit-time gate `checkEmitted()`, in place of
check M7 since T-0373), are:

| quantity | rule | token |
|---|---|---|
| height | `4n` | `--md-sys-height` |
| inset, gap | `n` | `--md-sys-inset` |
| radius | `n` (`corner-shape: squircle`) for a surface; the pill `2n` (circular) for every single-line control and a textarea, Amendment 5 | `--md-sys-radius`, `--md-sys-control-radius` |
| chip and checkbox radius | chip pill `n + c` (h/2 of the `2n + 2c` chip); checkbox `ceil(n/2)` | `--md-sys-chip-radius`, `--md-sys-checkbox-radius` |
| icon box | `2n` | `--md-sys-icon-box` |
| glyph box | `n + 6` (T-0374; the Amendment 7 floor retired) | `--md-sys-glyph-box` |
| glyph slot | `3n`, the square wrapper the glyph box centres in | `--md-sys-glyph-slot` |
| glyph stroke | `max(1.5px, c/2)` | `--md-sys-glyph-stroke` |
| type | linear `n + 6` for controls, `pow` for display, heading and subhead | `--md-sys-type-*` |
| type | linear roles never below 9px; the section kicker `round(body · 9/8)` and the group kicker `n/2 + 6.5` (the former section and group labels stay aliases until W7) | `--md-sys-type-section-kicker`, `--md-sys-type-group-kicker` |
| container unit | `m` (n at default density) | `--md-sys-m` |
| container levels | group (n) and widget / card / layout (m) margin, gutter, radius | `--md-sys-{level}-{margin,gutter,radius}` |

n depends on three attributes that inherit independently (m on a fourth), so the generated block is live
`calc()` over the inputs `--md-sys-tier-*`, `--md-sys-scale-s`, `--md-sys-size-z`, `--md-sys-density-d`, declared
on `:root, [data-tier], [data-scale], [data-size], [size], [data-density]` (the recompute list that replaced
ADR-0007's `*` ramp), never a literal table per combination.

### 1.1 · Why no multiplier and no power law

ADR-0038 dropped the multiplier because scaling height and font by one factor broke the pairing of each
height with its font and icon row. Here every quantity is a formula of the same n, so the pairing holds by
construction, and the old sublinear glyph law (`icon ≈ 2.49·h^0.58`) is replaced by the linear `2n` icon box
inside a `4n` height.

### 1.2 · What the derivation moved

Against the old ramp the cut kept 24 and 28 at the root and moved lg 36 to 32; Amendment 3's v2 anchors then
moved every root step one n down, to 20 / 24 / 28 (n 5 / 6 / 7); Amendment 8 then moved the root to product / md,
24 / 32 / 40 (n 6 / 8 / 10), and the icon box to 12 / 16 / 20. The field
radius is n, the card radius 3m. The wire, the payloads and the K6 prompt budget move zero bytes (ADR-0245 cl.8).

### 1.3 · The dark launch, and what is transitional

Control stylesheets until the W7 cleanup read `var(<derived>, <today's value>)`; the bridge
(`foundations-bridge.gen.css`) aliases the old `--md-sys-{height,font,icon,gap,compact,space,typescale}-*`
names, `--md-sys-widget-inset`, `--md-sys-shape-corner-base` and `--ui-box-*` onto the derived values, and
`[data-foundations="legacy"]` pins a region to today's literals. All of it retires at W7 (one release after
the cut, no rollback used); the law above does not.

### 1.4 · The families, retired

The old "frame ∝ height, rhythm ∝ font" split retired with the hand-tabled ramp: under one n the frame and
the rhythm move together, and a whole region grows or shrinks with one attribute, `data-scale`. Container air
alone moves with `data-density` (m), never a control (Amendment 3).

### 1.5 · Slot-presence padding

Every inline edge pads `n`, the box margin, whatever sits at it (the control rule, ADR-0245 Amendment 4):
- a **slot** edge (icon or glyph in its `2n` slot): the slot sits flush at the margin, and the mark centers
  inside it (an icon fills it, a glyph leaves `c` clear on each side);
- a **label** edge: the text slot adds its own label inset `n - c`, so the text sits `2n - c` from the edge and
  never jams it. Slot to text is the gutter `c` plus that inset, `n`.

A `[label · caret]` control therefore reads `2n - c` to its text and `n` to its caret slot. The grid is presence-driven (`:has()`), so an absent slot
leaves no phantom gap: `lead+trail → auto 1fr auto` · `lead-only → auto 1fr` · `trail-only → 1fr auto` ·
`none → 1fr` · `icon-only (no label) → square`, `4n` on a side.

---

## 2 · The centering law (the one rule)

> A mark centers in a square slot; **`padding-block` is `0` and `block-size` is the lever.**

- A button or toggle (pill) and an entry control are `4n` tall; `padding-block: 0`; borders sit inside the
  box (padding = rule minus border width).
- The icon-only control is a `4n` square, the ADR-0223 R3(a) floor
  (`min-inline-size: var(--ui-{name}-height)` resolving to `4n`).
- **Single-line control text: `line-height = 1`** (ADR-0036, unchanged): the line centers in the frame with
  no extra leading. `--md-sys-control-line-height: 1` is a `:root` constant in `dimensions.css`. It excludes
  the display class (`ui-text`), which keeps its per-role line height; the skill's 1.2 applies only to control
  text that wraps.
- Concentric corners by construction: a container's radius equals its margin and a control's radius equals its
  inset (§4.9); the pill is the one control that is not concentric.

---

## 3 · How the shipped sizes map onto the law

The old `[scale]` tiers, their literal tables and Kim's `(scale × size)` lookup (ADR-0038) are superseded by
ADR-0245 and retired from `dimensions.css`, which now holds only constants (focus ring, scrollbar, motion,
pending and working states, typefaces, the typescale weight, line-height and tracking legs). A control reads
its size prop as z and inherits tier and scale from its region; nothing in a stylesheet names a height.
The root is product at scale md (Amendment 8); an A2UI surface root carries `data-tier="widget" data-scale="md"`; a reading
column sets `data-tier="content"`. `[scale]` survives one release as a bridge alias of tier and scale,
`[density]` of `data-density`.

---

## 4 · Sub-systems, transposed onto the law

### 4.1 · Marks and carets: the glyph box (ADR-0245 cl.4 and cl.5)

A functional mark (a caret, check, plus, minus, dot, x, ellipsis, warning, info) is a `ui-glyph`, drawn from
one path table in `components` as a stroke path in a fixed viewBox with `vector-effect: non-scaling-stroke`,
so the stroke is the token `--md-sys-glyph-stroke`. Its box is `n + 6` (12 / 14 / 16 at the root's sm /
md / lg; at least 10 on the whole ladder, so the retired 8px floor of ADR-0245 Amendment 7 never binds), centred in its
own square `3n` glyph slot (`--md-sys-glyph-slot`, T-0374, Kim's 2026-10-19 ruling, the skill's glyph wrapper). A host
that gives the glyph a smaller cell (an icon-sized caret cell) sizes that cell `max(icon, glyph box)`, so the mark is
never clipped where `n + 6` outgrows `2n` (n 4 and 5). A caret is no longer drawn at the control font. A control with a child slot renders `<ui-glyph>`; a
control that drew on a pseudo-element either gains a `ui-glyph` child or reads a generated mask token from the
same table, and never re-draws a mark by hand.

### 4.2 · Icon (leading)

A leading icon (a field's `slot=icon`, a button's icon) is pictorial pack art (ADR-0065/0066) in the `2n` icon
box (12 / 16 / 20 at the root). The standalone `<ui-icon>` is the same box.

### 4.3 · Padding

The control rule (ADR-0245 Amendment 4, see `geometry.md`): every control pads `n`, and its text slot adds
the label inset `n - c`, so the text edge is `2n - c` and an icon edge is `n`. `padding-block: 0` always.

### 4.4 · Gap

Mark-to-label distance is `n`: the control gutter `c` plus the label inset `n - c` (it was a gap of `n`, and
`font/2` before that); a field label sits above with gap `ceil(n/2)`; a boxed indicator to its label is `n`.

### 4.5 · `--md-sys-space-*` is LAYOUT spacing, a generated alias layer

`--md-sys-space-{none,xs..2xl}` is a generated alias layer over the container values at the element's n
(`xs` c, `sm` n, `md` n + c, `lg` 2m, `xl` 3m, `2xl` 4m), so the six A2UI `gap` enums keep their names. It is
the space between components. Three registers remain: **control padding** (the n rules above), **layout
spacing** (`--md-sys-space-*`), and **container interior** (the four container levels, ADR-0245 cl.6, which
replaced ADR-0046's fixed 6 / 12 / 8 paddings and the nested 12 to 6 to 6 step-down).

### 4.6 · Affordance vs content-icon, now icon vs glyph

What a mark IS decides its box, not where it sits: an **icon** (a pictorial pack symbol: a field's leading
icon, a status icon, the search magnifier) is the `2n` box; a **glyph** (a caret, chevron, stepper arrow, clear
`x`, disclosure marker, calendar-nav caret) is the `n + 6` box in its `3n` slot. The old bug class, an inline affordance sized
to the icon ramp so it renders about 1.3 times the text, is now closed by construction: a mark is a
`<ui-glyph>` or a glyph-box token, never an icon-sized pack caret. A nav icon in a standalone control button
(a swiper paddle, a pagination chevron) takes the glyph in its `3n` slot.

### 4.7 · Display marks: no ramp row, type-context-derived boxes (2026-07-08)

Not every Display-class member is text. `ui-icon` and the chart family (`ui-sparkline`,
`ui-bar-chart`, ADR-0107) take **no** control height and no control row of the §1 ramp, they
size relative to their own **type context** (em/lh-derived), the same "no control height" law §1's
`geometry.md` five-class table states for Display, extended past text to marks:

- `ui-icon` is the `2n` icon box (`--md-sys-icon-box`, ADR-0245 cl.4) inside a control cell or a `[data-tier]`
  region and follows the surrounding text, `1em`, anywhere else (ADR-0245 Amendment 6); `ui-glyph` is the
  `n + 6` glyph box in its `3n` slot everywhere. Neither is a control row (§4.6).
- `ui-sparkline` defaults to an explicit `8em × 1lh` box (SPEC-R9 AC1), a deterministic floor, not
  a derived one, because a zero-size default would make the whole-shape law (§ below) unenforceable
  on an inline mark with no intrinsic content size.
- `ui-bar-chart` is text-bearing Display: its labels/values read `--md-sys-typescale-*` directly
  (no repoint needed, it's already the fleet's font source), and row rhythm rides `--md-sys-space-*`
  (density-responsive for free, the ADR-0103 radio-group precedent); only the mark geometry itself
  (bar thickness, the zero-baseline stroke) is density-invariant, per its own `--ui-{name}-*` tokens
  in the standard `:where()` block.

None of the three consumes `--md-sys-height` (the control height), and the charts read type and
space only, they are a register beside the control frame: **type-context**, governed by
`references/geometry.md`'s Display row, not this document's §1 derivation.

### 4.8 · The width-floor law family (test-the-whole-shape, 2026-07-08)

§2's `min-width = height` square floor (now `4n`) is the ORIGINAL width-floor law but not the only one shipped
since, every one exists because a control with real content collapsed to near-nothing under a
flex/grid parent with no intrinsic sizing pressure (the "ui-slider DOT" scar: every part-level px
assertion passed while the whole control rendered as a point). The family, by mechanism:

| Control class | Floor mechanism | Precedent |
|---|---|---|
| icon-only comfortable control | `min-inline-size = height` (§2, §7.3) | `ui-button` |
| text-entry control | a fixed `min-inline-size` floor (native `<input size>` parity) | `ui-text-field`, ADR-0021 (20ch) |
| a draggable range track | an explicit inline-size floor (no intrinsic content to press against) | `ui-slider`, the DOT-scar fix |
| a Display mark with no content size | a deterministic em/lh box default (§4.7) | `ui-sparkline`, SPEC-R9 AC1 |

The generating rule: **any control whose rendered width would otherwise derive from zero-or-near-zero
intrinsic content (an icon-only frame, free-typed text, a track with no label, a mark with no glyph)
needs an explicit floor**, and the floor is proven, never assumed, by measuring the REAL rendered
bounding box in a realistic flex/grid container (a browser leg, jsdom cannot compute layout px). A
control that only ever sits beside guaranteed-wide siblings does not need one; the audit is per-class,
not universal.

### 4.9 · Containers, placement and radius (ADR-0245 cl.6)

Four levels at the container's own n and m (root md, n 8, c 2, m 8): **group** (margin and radius `n + c`,
gutter `c`: segmented-control, table rows, tooltip; listbox panels keep the group padding `c` but take the
concentric radius `2n + c`, their pill rows plus that inset, ADR-0245 Amendment 5), **widget** (`2m`, gutter `m`: popover,
toast, form-popover panel), **card** (`3m`, gutter `2m`: card, modal, drawer, command-modal, the A2UI
artboard) and **layout** (`4m`, gutter `3m`: super-shell frame and bars, the docs page frame). A container pads with its margin; a boxed child
at an edge sits at `margin - its own inset` via a negative margin of `--md-sys-inset` resolved on the child.
ADR-0018's `max(0, r - pad)` chain retired. ADR-0046 keeps `[data-box]`, the flow-root BFC, sticky regions
and the scroll-fade mask; it loses the fixed inset and paddings and density-invariance.

---

## 5 · Implementation status

**LANDED 2026-10-13 (the cut, #1932).** The derived tokens are the default at `:root`; `dimensions.test.ts` is
rewritten against `resolve()`; the per-control geometry pins, the 36-cell browser leg and the census gate
(`scripts/foundations-census.mjs`) ride the gates; `scripts/foundations-probe.mjs` classes every sized control
against its clause 3 rule. **Open:** the W7 cleanup (`var(<derived>, <today>)` collapses to `var(<derived>)`;
the bridge and the `legacy` opt-out retire; the px-literal rule enforces), one release after the cut with no
rollback used. T-0169 already retired the `[scale]` / `[density]` selectors and the `glyph` alias.

### 5.1 · Migration policy

Each family lane rewrote its folders' geometry as `var(<derived>, <today>)`, renamed its `glyph` call sites to
`symbol`, converted its marks to `ui-glyph`, repaired its descriptors' `geometry:` lines and recorded its
goldens; the cut flipped the root with one config field. A consumer opts a region out for one release with
`data-foundations="legacy"`.

### 5.2 · The compact box ramp, retired

ADR-0041's 14 / 16 / 18 widget ramp (`--md-sys-compact-*`, Kim's eight-value `12 to 28` ladder) and the flat
2px `--md-sys-widget-inset` retired. An indicator's box is `2n`, its thumb the icon box - 2c, a progress track `2c`;
`--md-sys-compact-*` and `--md-sys-widget-inset` survive only as bridge aliases (`2n` and `c`) until W7.

---

## 6 · Mechanization (the probes that lock the law)

| Law | Probe |
|---|---|
| the config is coherent | `check()` M1 to M16 (M14: no size that depends on n alone shrinks as n grows): the generator refuses to emit, a vitest leg asserts `[]` and pins the vendored sha |
| the generated sheets are never hand-edited | `--check` on `check:scripts` (`foundations.test.ts`) |
| computed tokens equal `resolve()` | the 36-cell browser leg (every tier, scale and size cell at every density, both engines) |
| each control obeys its clause 3 rule | `scripts/foundations-probe.mjs` (a class table, `--strict`) plus each control's geometry pin at sm, md and lg against `resolve()` |
| no hand-tabled ramp, px geometry literal, old `glyph` prop or `[scale]` / `[density]` use | `scripts/foundations-census.mjs --gate` (empty allowlist after the cut) |
| fill-by-default posture and the width floors | `sizing-gates.test.ts` (ADR-0223), untouched by ADR-0245 |
| `0 < glyph ≤ box` and the glyph set | `glyph.browser.test.ts`, `glyph-usage-coverage.test.ts` |
| rendered gestalt (paint, layering, ellipsis pixels) | the pixel-diff harness (ADR-0110): `*.visual.browser.test.ts`, goldens regenerated at the cut |

Every law is a probe, or it isn't a law; new geometry lands with its probe. The probes only enforce what is in
their lists, so a sized control outside the class table fails `--strict` rather than passing unmeasured.

---

## 7 · Ratified decisions

1. **ADR-0245 (Kim, 2026-10-13)** is the authority: one n per element, root `product` at scale `md` (sizes
   24 / 32 / 40 since Amendment 8; product / sm, 20 / 24 / 28, from Amendment 3), density on m, the A2UI canvas at widget / md (Amendment 2; step 0 had ruled
   product / md), the pill `2n` for button and toggle, the avatar a `4n` circle, the radio dot `glyph - 2`, the glyph stroke
   `max(1.5px, c/2)`, `icon` and `glyph` as separate boxes and elements with the shared `symbol` prop, four
   container levels, type derived behind `ui-text`'s unchanged API.
2. **ADR-0036 stands:** single-line control text is `line-height: 1`.
3. **ADR-0223 is extended, not amended:** fill-by-default, `inline` and R3(a) to (d) stand.
4. **`--md-sys-space-*` is layout spacing only** (a generated alias layer), not control padding.
5. **Superseded:** ADR-0038 (the per-`[scale]` tables), ADR-0041 (the widget ramp), ADR-0150 (the compact-window
   body drop); partially superseded: ADR-0046 cl.1 and cl.3, ADR-0078 cl.2 and cl.2b, ADR-0007, ADR-0015 cl.5,
   ADR-0018.
