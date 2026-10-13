# Geometry & sizing: the law

> Canonical normative standard for agent-ui geometry. **Rewritten 2026-10-13 for the derived foundations
> (ADR-0245, shipped at the cut #1932).** Every size derives from one integer **n** per element; the
> hand-tabled ramp, the `[scale]` tiers, `[density]` and the frame/rhythm split are retired. The
> derivation, the per-control table and the history live in
> [`geometry-sizing-spec.md`](./geometry-sizing-spec.md); this doc is the resolved *law*. The numbers
> come from `@agent-ui/shared`'s `scale.mjs` (CFG, `resolve()`, `check()`) through the generated
> `foundations.gen.css`, never from a stylesheet.

## The one rule: one n per element

`n = n0 + a·s + k·z + g·s·z`, with the **tier** constants `(n0, a, k, g)` and two inheriting axes:

- **Tier** `data-tier` = `widget` 7/1/1/0 · `product` 9/2/2/1 · `content` 11/2/2/1 · `brand` 14/2/2/1 (what a region is for).
- **Scale** `data-scale` = `sm` / `md` / `lg` → s = -1 / 0 / +1 (a region's density).
- **Size** z = a control's reflected `size` prop (`sm` / `md` / `lg`), or `data-size` on any other element → -1 / 0 / +1.

The nearest ancestor wins on each axis. **The root is `product` at scale `sm`**: sizes sm / md / lg are
n 6 / 7 / 8, so heights **24 / 28 / 32**. A2UI surfaces sit at `data-tier="widget" data-scale="md"` (the canvas
register, the same 24 / 28 / 32; ADR-0245 Amendment 2), so a catalog size means what it says: a composite's
`lg` action is 32px. A page opts a region into another register with
`data-tier` / `data-scale`; `[scale]` and `[density]` were retired into those two attributes (the bridge maps
them for one release, W7 removes it) and `[data-foundations="legacy"]` opts a region out for the same release.

Let `c = ceil(n / 4)`. Every box value is a whole-pixel multiple of n or c (check M7):

| quantity | value | token |
|---|---|---|
| control height | `4n` | `--md-sys-height` |
| inset (a boxed child's own margin) | `n` | `--md-sys-inset` |
| gap between a mark and its label | `n` | |
| radius | `n`, `corner-shape: squircle` | `--md-sys-radius` |
| icon box (pictorial art) | `2n` | `--md-sys-icon-box` |
| glyph box (functional mark) | `2n - 2c` | `--md-sys-glyph-box` |
| glyph stroke | `max(1.5px, c/2)` | `--md-sys-glyph-stroke` |
| control text | `n + 6` px | `--md-sys-type-control` |

## The centering law

A glyph or icon sits in a square slot of side `2n` and centers there, so a control's leading and trailing
affordances share the slot box and the centre line. **`padding-block` is `0`; `block-size` is the vertical
lever**, and borders sit inside the box (padding = rule minus border width). **Single-line control text is
`line-height: 1`** (ADR-0036, unchanged): the line centers in the 4n frame with no extra leading.
`--md-sys-control-line-height` stays a fleet constant; display text (`ui-text`) keeps its per-role line
height.

## Inline padding and radius, by control class

- **Entry and trigger controls** (text-field, select, combo-box, multi-select, otp-field): padding `n`; a
  leading icon or caret slot is `2n`; radius `n`. A field label sits above with gap `ceil(n/2)`.
- **Button and toggle**: the **pill**, radius `h/2 = 2n`, the one documented exception to radius = n.
  Padding is `2n` beside a label and `n` beside an icon; an icon-only button is a `4n` square (the
  ADR-0223 R3(a) squareness floor, `min-inline-size: var(--ui-{name}-height)`, now resolving to 4n).
- **Indicators**: checkbox box `2n` (radius `n/2`, check glyph `2n - 2c`), radio `2n` circle (dot
  `2n - 4c`), switch track `2n` tall with padding `c` and thumb `2n - 2c`, slider rail `2c` and thumb
  `2n - 2c`, progress track `2c` (radius `c`), badge height `2n` (padding `2c`, radius `n/2`).
- **Avatar** is `4n`, stood beside controls at control height.
- **Listbox** (menu, select and combo-box panels): options are `4n` controls stacked edge to edge, padding `c`.
- **Segmented-control**: padding `c`, gap `c`, segments `4n` with padding `2n`.
- **Table**: rows at least `4n + 2c`, text cells `n + c`.

The full per-control table is ADR-0245 clause 3 and Appendix B; the geometry probe
(`scripts/foundations-probe.mjs`) classes every sized control against it.

## Icon and glyph: two boxes, two elements

- An **icon** is pictorial pack art (ADR-0065/0066: `eye`, `user`, `calendar-blank`) in a `2n` box.
- A **glyph** is a functional mark from the closed set of twelve (`check`, `x`, `plus`, `minus`, the four
  carets, `dot`, `more`, `warning`, `info`) in a `2n - 2c` box, always inside an icon-sized `2n` slot with
  `c` clear on each side. A caret is drawn at the glyph box, not at the control font.
- `<ui-icon symbol>` and `<ui-glyph symbol>` share the `symbol` prop (`ui-icon`'s old `glyph` prop is a
  deprecated alias until W7). One path table in `components` owns mark geometry, so a control never
  re-draws a mark by hand; stroke width is the token above.

## Containers and placement

Four levels, each at the container's own n (root md: n 7, c 2):

| level | margin | gutter | radius | members |
|---|---|---|---|---|
| group | `n + c` | `c` | `n + c` | listbox panels, segmented-control, table rows, tooltip |
| widget | `2n` | `n` | `2n` | popover, toast, form-popover panel |
| card | `3n` | `2n` | `3n` | card, modal, drawer, command-modal |
| layout | `4n` | `3n` | `4n` | super-shell frame and bars, the docs page frame |

A container pads with its **margin**; a boxed child at an edge sits at `margin - its own inset` through a
negative margin of `--md-sys-inset` that resolves on the child, so its label lines up with the card's text.
A container's radius equals its margin and a control's radius equals its inset, so nested corners are
**concentric by construction** (the pill excepted); ADR-0018's `max(0, r - pad)` chain and ADR-0046
Amendment 2's fixed paddings retired. ADR-0046's `[data-box]` opt-in, flow-root BFC, sticky regions and
scroll-fade mask stand, and the `--ui-box-*` names stay as the per-control consumer tier, repointed to the
level tokens. Padding now moves with n.

## Layout spacing

`--md-sys-space-{xs..2xl}` is a generated alias layer over the same n, so the six A2UI `gap` enums keep
their names and prompt bytes: `xs` c, `sm` n, `md` n + c, `lg` 2n, `xl` 3n, `2xl` 4n (2 / 7 / 9 / 14 / 21 /
28 at n 7). It is the space *between* components, not control geometry.

## Type

`ui-text`'s API stands (nine variants, `size`, `as`, the ADR-0106/0109/0114 axes); each variant maps to a
derived role (`--md-sys-type-*`) and `size` is z. The `--md-sys-typescale-*` rows are a generated alias
layer until W7. Display is small in a product region by design; a hero takes its own tier (content md
display 53, brand md display 75). ADR-0150's compact-window body drop is superseded: body at the root is 14.

## Minimum inline size (the bare-control floor)

`min-inline-size` keeps a control from collapsing to an unhittable sliver. ADR-0223 cl.3 ratifies the
complete role taxonomy, unchanged by ADR-0245: **(a)** squareness floors on interactive controls, all
states (a button or toggle is at least `4n` wide); **(b)** hug-state content floors, `[inline]` only (an
entry control's typing-width floor, `--ui-text-field-min-inline-size`, ~`20ch`); **(c)** `min-inline-size: 0`
unclampers on flex and grid items; **(d)** whole-shape floors on track- and data-shaped display leaves.
Fill-by-default means a non-exempt host is block-level and fills its parent; the container is the floor.
Read ADR-0223 for the exemption tables and cite them, never copy them.

## The five size-classes

| Class | Examples | Lever |
|---|---|---|
| **Control** (full height) | button · text-field · select · field | `block-size: var(--ui-{cmp}-height)` off `--md-sys-height` (4n); `line-height: 1`; padding per class above |
| **Indicator** (smaller box) | checkbox · radio · switch · slider · badge | box `2n` (badge height `2n`), a thumb `2n - 2c`; the old 14/16/18 widget ramp and the flat 2px inset retired |
| **Pattern** (container plus control-height rows) | tabs · segmented-control · toolbar · menu · dialog | interactive rows are `4n`; the shell takes its container level |
| **Container/layout** | row · column · grid · card | margin, gutter and radius from the level tokens; no control height |
| **Display** | divider · icon · glyph · spinner · progress · tooltip · **text** | text reads the derived `--md-sys-type-*` roles; icon and glyph take their own boxes; no control height, no `padding-block` law |

## Mechanization

Every law lands with a probe. `check()` (M1 to M10) gates the config and the generator refuses to emit on a
failure; a vitest leg asserts `check()` is `[]` and the generated file is byte-identical; a browser leg sets
each of the 36 tier, scale and size cells on a probe and compares computed tokens to `resolve()` in both
engines; each migrated control carries a geometry pin against `resolve()`. The sibling px-literal rule (no
px literal for control geometry except the hairline, focus ring, scrollbar and ratified whole-shape floors)
is report-shape until the W7 cleanup, then enforcing.
