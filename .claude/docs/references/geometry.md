# Geometry & sizing: the law

> Canonical normative standard for agent-ui geometry. **Rewritten 2026-10-13 for the derived foundations
> (ADR-0245, shipped at the cut #1932; Amendment 3 adopts the skill's v2 constants and density).** Every size
> derives from one integer **n** per element, and container spacing from **m**; the hand-tabled ramp, the
> `[scale]` tiers, `[density]` and the frame/rhythm split are retired. The
> derivation, the per-control table and the history live in
> [`geometry-sizing-spec.md`](./geometry-sizing-spec.md); this doc is the resolved *law*. The numbers
> come from `@agent-ui/shared`'s `scale.mjs` (CFG, `resolve()`, `check()`) through the generated
> `foundations.gen.css`, never from a stylesheet.

## The one rule: one n per element

`n = n0 + a·s + k·z + g·s·z`, with the **tier** constants `(n0, a, k, g)` and three inheriting axes, n in 4 to 24:

- **Tier** `data-tier` = `widget` 6/1/1/0 · `product` 8/2/2/1 · `content` 11/3/2/1 · `brand` 15/4/2/1 (what a region is for; the skill's rows, T-0374).
- **Scale** `data-scale` = `sm` / `md` / `lg` → s = -1 / 0 / +1 (a whole region: controls, type and spacing together).
- **Size** z = a control's reflected `size` prop (`sm` / `md` / `lg`), or `data-size` on any other element → -1 / 0 / +1.
- **Density** `data-density` = `compact` / `default` / `spacious` → d = -1 / 0 / +1, container spacing only:
  `m = max(n + a·d, floor((n + c) / 2) + 1)`. The widget, card and layout levels read m; the group level and
  every control value keep n.

The nearest ancestor wins on each axis. **The root is `product` at scale `md`** (ADR-0245 Amendment 8): sizes
sm / md / lg are n 6 / 8 / 10, so heights **24 / 32 / 40**, body 13 / 15 / 17 and control type 12 / 14 / 16. A2UI
surfaces sit at `data-tier="widget" data-scale="md"` (the canvas register, n 5 / 6 / 7, heights 20 / 24 / 28;
Amendment 2), one step below the page and deliberately denser (Kim, Amendment 8), so a catalog size means what it says: a composite's `lg` action is 28px. A
page opts a region into another register with `data-tier` / `data-scale` / `data-density`; `[scale]` was
retired into the first two and `[density]` into `data-density` (the bridge maps them for one release, W7
removes it), and `[data-foundations="legacy"]` opts a region out for the same release.

Let `c = ceil(n / 4)`. Every box value is a whole-pixel multiple of n or c (the emit-time whole-px gate,
`checkEmitted()` in `scripts/lib/foundations-model.mjs`, which took over the model's check M7 in T-0373):

| quantity | value | token |
|---|---|---|
| control height | `4n` | `--md-sys-height` |
| inset (a boxed child's own margin) | `n` | `--md-sys-inset` |
| gap between a mark and its label | `n` | |
| radius of a surface (attachment, disclosure, swatch tile) | `n`, `corner-shape: squircle` | `--md-sys-radius` |
| radius of every single-line control (the pill, h/2) | `2n`, circular corners | `--md-sys-control-radius` |
| icon box (pictorial art) | `2n` | `--md-sys-icon-box` |
| glyph box (functional mark) | `n + 6` (T-0374; at least 10, so the Amendment 7 floor retired) | `--md-sys-glyph-box` |
| glyph slot (the glyph's square wrapper) | `3n` | `--md-sys-glyph-slot` |
| glyph stroke | `max(1.5px, c/2)` | `--md-sys-glyph-stroke` |
| control text | `n + 6` px | `--md-sys-type-control` |
| container unit | `m` (n at default density) | `--md-sys-m` |

## The centering law

A glyph or icon sits in a square slot of side `2n` and centers there, so a control's leading and trailing
affordances share the slot box and the centre line. **`padding-block` is `0`; `block-size` is the vertical
lever**, and borders sit inside the box (padding = rule minus border width). **Single-line control text is
`line-height: 1`** (ADR-0036, unchanged): the line centers in the 4n frame with no extra leading.
`--md-sys-control-line-height` stays a fleet constant; display text (`ui-text`) keeps its per-role line
height.

## Inline padding and radius, by control class

- **The control rule** (ADR-0245 Amendment 4), one geometry for every control: box margin `n`
  (`--md-sys-inset`), gutter `c`, and the text slot carries the label inset `n - c` (`--md-sys-label-inset`).
  So an icon sits `n` from the edge and `n` from the text, the **text edge is `2n - c`** (10 / 14 / 17 at the
  root), and a control is never narrower than `4n` (`min-inline-size: var(--ui-{name}-height)`, the ADR-0223
  R3(a) form, on the button, the entry hosts and the tab; a toggle and a segment keep the automatic content
  minimum, and the rule's own `4n - 2c` plus text keeps them at `4n`). Where the label is anonymous host content (toggle, segment, tab, menu and listbox rows) the host
  edge beside it carries margin plus inset. Icons, carets and other boxed items take no inset.
- **Entry and trigger controls** (text-field, textarea, select, combo-box): the control rule, the editor or the
  trigger label being the text slot; a leading icon or caret slot is `2n`; the pill radius `2n` with circular
  corners (Amendment 5; a textarea takes the same `2n`). `ui-otp-field`'s cells hold one centered character,
  take no inset and the same `2n`, so a square cell is a circle. A field label sits above with gap `ceil(n/2)`.
- **Button and toggle**: the **pill**, radius `2n` (equal to h/2, now a formula of n, not a special case), and
  the control rule; an icon-only button is a `4n` square. A button label aligns per the skill's table
  (centered alone or between adornments, start with only trailing content, end with only leading content);
  a toggle label stays centered (`toggle.md`).
- **Tabs, segments, menu and listbox rows**: the control rule; tabs touch with the tight gutter `c`. Menu and
  listbox rows are pills (`2n`), and their panel (menu, select listbox, combo-box panel, multi-select) is the
  row radius plus its own inset, `2n + c`, so the rows nest concentrically (Amendment 5).
- **Indicators**: checkbox box `2n` (radius `ceil(n/2)`, check glyph the glyph box `n + 6`, inset `c`), radio `2n` circle (dot
  the icon box - 2c - 2, which never shrinks as n grows), switch track `2n` tall with padding `c` and
  thumb the icon box - 2c, slider rail `2c` and thumb the icon box - 2c, progress track `2c` (radius `c`).
- **Chips** (badge; the level `--md-sys-chip-{margin,gutter,radius}`): height `2n + 2c`, margin `c`, gutter
  `c`, label margin `c` (text edge `2c`), the chip pill radius `n + c` (h/2, Amendment 5). The checkbox box
  keeps `ceil(n/2)` on its own token, `--md-sys-checkbox-radius`.
- **Avatar** is a `4n` circle, stood beside controls at control height; an avatar inline inside a tag or a
  control row is the skill's `2n`.
- **Derived marks and tiles** (Amendment 3): gauge ring stroke `4c`; swatch a `4n` square with radius `n`
  (the icon tile); column-chart top-segment radius `n + c` (the group radius); the A2UI artboard pads with
  the card margin `3m` and gaps with the card gutter `2m`.
- **Listbox** (menu, select and combo-box panels): options are `4n` controls stacked edge to edge, padding `c`.
- **Segmented-control**: padding `c`, gap `c`, segments `4n` with padding `2n`.
- **Table**: rows at least `4n + 2c`, text cells `n + c`.

The full per-control table is ADR-0245 clause 3 and Appendix B; the geometry probe
(`scripts/foundations-probe.mjs`) classes every sized control against it.

## Icon and glyph: two boxes, two elements

- An **icon** is pictorial pack art (ADR-0065/0066: `eye`, `user`, `calendar-blank`) in a `2n` box inside a
  control cell or a `[data-tier]` region; a standalone `ui-icon` anywhere else follows the text, `1em`
  (ADR-0245 Amendment 6).
- A **glyph** is a functional mark from the closed set of twelve (`check`, `x`, `plus`, `minus`, the four
  carets, `dot`, `more`, `warning`, `info`) in the glyph box `n + 6`, always centred inside its square
  `3n` glyph slot (`(3n - (n + 6)) / 2` clear on each side, T-0374, the skill's glyph wrapper). A host that gives a glyph a
  smaller cell sizes it `max(icon box, glyph box)`. A caret is drawn at the glyph box, not at the control font.
- `<ui-icon symbol>` and `<ui-glyph symbol>` share the `symbol` prop (`ui-icon`'s old `glyph` prop is a
  deprecated alias until W7). One path table in `components` owns mark geometry, so a control never
  re-draws a mark by hand; stroke width is the token above.

## Containers and placement

Four levels, each at the container's own n and m (root md: n 8, c 2, m 8 at default density):

| level | margin | gutter | radius | members |
|---|---|---|---|---|
| group | `n + c` | `c` | `n + c` | listbox panels, segmented-control, table rows, tooltip |
| widget | `2m` | `m` | `2m` | popover, toast, form-popover panel |
| card | `3m` | `2m` | `3m` | card, modal, drawer, command-modal, the A2UI artboard |
| layout | `4m` | `3m` | `4m` | super-shell frame and bars, the docs page frame |

`data-density` moves m one tier step `a` (compact down, spacious up), floored so a widget always
out-margins a group: at the root md, compact m 6 gives card 18 / 12 / 18 and spacious m 10 gives 30 / 20 / 30.

A container pads with its **margin**; a boxed child at an edge sits at `margin - its own inset` through a
negative margin of `--md-sys-inset` that resolves on the child, so its label lines up with the card's text.
A container's radius equals its margin and a control's radius equals its inset, so nested corners are
**concentric by construction** (the pill excepted); ADR-0018's `max(0, r - pad)` chain and ADR-0046
Amendment 2's fixed paddings retired. ADR-0046's `[data-box]` opt-in, flow-root BFC, sticky regions and
scroll-fade mask stand, and the `--ui-box-*` names stay as the per-control consumer tier, repointed to the
level tokens. Padding now moves with n.

## Layout spacing

`--md-sys-space-{xs..2xl}` is a generated alias layer over the same n, so the six A2UI `gap` enums keep
their names and prompt bytes: `xs` c, `sm` n, `md` n + c, `lg` 2m, `xl` 3m, `2xl` 4m (2 / 8 / 10 / 16 / 24 /
32 at the root md, n 8, default density). It is the space *between* components, not control geometry. The
widget, card and layout levels are one margin reference, the skill's section margin 4m, at its spacing role
percentages (page 100, container 75, group 50, control 25; T-0373): each level's gutter is the role one step below
its margin's, so widget 50 / 25, card 75 / 50 and layout 100 / 75 percent of 4m.

## Type

`ui-text`'s API stands (nine variants, `size`, `as`, the ADR-0106/0109/0114 axes); each variant maps to a
derived role (`--md-sys-type-*`) and `size` is z. The `--md-sys-typescale-*` rows are a generated alias
layer until W7. Display is small in a product region by design; a hero takes its own tier (content md
display 53, brand md display 84). ADR-0150's compact-window body drop is superseded: body at the root md is 15.
Linear roles never go below 9px. The two small uppercase roles take the skill's names (T-0373): the **section
kicker** (`--md-sys-type-section-kicker`, round(body · 9/8)) and the **group kicker** (`--md-sys-type-group-kicker`,
n/2 + 6.5, the only half-pixel role); the `kicker` and `overline` variants both read the group kicker. The former
names `--md-sys-type-section-label` and `--md-sys-type-group-label` stay aliases of them in `foundations.gen.css`
until W7, for an outside reader only: no consumer reads them, and the foundations census flags a new read.
The **field label** (`--md-sys-type-field-label`) is the skill's n + 5, 10 at n 5 and 13 at the root, and the
`label` typescale rows alias it. The **small control** role (`--md-sys-type-small-control`) is the skill's n + 4,
9 at n 5 and 12 at the root (T-0374); it is emitted and no control reads it yet.

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
| **Indicator** (smaller box) | checkbox · radio · switch · slider · badge | box `2n` (a badge is a chip, `2n + 2c` tall), a thumb the icon box - 2c; the old 14/16/18 widget ramp and the flat 2px inset retired |
| **Pattern** (container plus control-height rows) | tabs · segmented-control · toolbar · menu · dialog | interactive rows are `4n`; the shell takes its container level |
| **Container/layout** | row · column · grid · card | margin, gutter and radius from the level tokens; no control height |
| **Display** | divider · icon · glyph · spinner · progress · tooltip · **text** | text reads the derived `--md-sys-type-*` roles; icon and glyph take their own boxes; no control height, no `padding-block` law |

## Mechanization

Every law lands with a probe. The skill's `check()` (M1 to M16; M14 is "no size that depends on n alone
shrinks as n grows") gates the config and the generator refuses to emit on a failure; a vitest leg pins the
vendored sha, asserts `check()` is `[]` and the generated file is byte-identical; a browser leg sets each of the 36 tier, scale and size cells, at every density, on a probe and
compares computed tokens to `resolve()` in both engines; each migrated control carries a geometry pin against
`resolve()`. The sibling px-literal rule (no
px literal for control geometry except the hairline, focus ring, scrollbar and the sanctioned whole-shape floors)
is report-shape until the W7 cleanup, then enforcing.

## Rules that replace frozen ADR clauses

The ADR folder is frozen (T-0164), so a stale ADR clause is not amended; the current rule is stated here and
wins over the ADR text.

- **BoardGrid frame (ADR-0046 Amendment 7).** The board paints no frame and has no inset: its first cell
  sits on the text edge around it (T-0146). The cell-to-cell gap is the 4px data-grid gap
  (`--ui-board-grid-gap: var(--md-sys-space-xs)`).
- **ProductCard rating gap (ADR-0046 Amendment 7).** The rating is a composed readonly `ui-rating`; the
  stars-to-number gap is the inset level (`--ui-product-card-rating-gap: var(--md-sys-inset)`), not a fixed
  4px (T-0146).
- **Capped calendar panel (ADR-0105 Amendment 2).** A calendar capped below its container's width is
  start-aligned on the text edge like every other block (`margin-inline-end: auto`), not centred; a consumer
  centres it if it wants (T-0149).
