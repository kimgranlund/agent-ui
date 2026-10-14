# ADR-0245 — Foundations derive from one n: tier, scale and size choose n per element, controls, containers and type are formulas over it, icon and glyph get separate boxes, and the library root keeps 24 and 28 while lg moves to 32

> Source: agent-ui ADR log (this directory, the numbered files ARE the index; status lives in each ADR's own header). · 2026-10-12
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-10-12 |
> | **Proposed by** | the sdlc-lite solo run `math-foundations-adr` (design spike T-0091), on Kim's 2026-10-12 decisions: a full foundations overhaul from the `mathematical-design-system` skill; `icon` and `glyph` each get their own container and their own size; component geometry moves with the new margin, gutter, inset, padding and gap systems. Number 0245 claimed against the file tree (0243 the highest on `main`), every sibling worktree under `.claude/worktrees/` and the history of every ref (0244 is held in flight by the `widget-patterns-next` lane) |
> | **Ratified by** | kimgranlund (repo owner), 2026-10-13, via the [`ratify ADR-0245` utterance](https://github.com/kimgranlund/agent-ui/pull/1914#issuecomment-6136641838) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | on ratification (owner-side header edits, the bodies stay untouched): [ADR-0046](./0046-container-box-model.md) header gains `Partially superseded by ADR-0245` (Decision cl.1 and cl.3 values) · [ADR-0078](./0078-ui-text-three-axis-variant-size-as.md) header gains `Partially superseded by ADR-0245` (cl.2 and cl.2b px tables) · [ADR-0223](./0223-fill-by-default-fleet-sizing-contract.md) header gains `Extended by ADR-0245` · [ADR-0038](./0038-control-sizing-size-scale-row-lookup.md), [ADR-0041](./0041-widget-box-geometry-subsystem.md) and [ADR-0150](./0150-compact-window-body-typescale-breakpoint.md) Status flip to `superseded` once the last wave lands · [ADR-0007](./0007-universal-selector-ramp-tokens.md), [ADR-0015](./0015-container-surface-space-token-model.md) cl.5 and [ADR-0018](./0018-css-one-level-nested-radius.md) gain `Partially superseded by ADR-0245`. On build, per wave (clauses 10 and 11): `packages/agent-ui/shared/src/tokens/{dimensions.css,dimensions.test.ts}` · `controls/_surface/container-box.css` · every control stylesheet that reads `--md-sys-{height,icon,font,gap,compact}-*` · `controls/icon/{icon.ts,icon.md}` · `icons/src/glyph-usage-coverage.test.ts` · `a2ui/src/catalog/{default,a2ui-basic}/catalog.json` (`mapsTo` only) · [`../references/geometry.md`](../references/geometry.md) · [`../references/geometry-sizing-spec.md`](../references/geometry-sizing-spec.md) · [`../references/naming.md`](../references/naming.md) §12 · [`../references/tokens.md`](../references/tokens.md) · `AGENTS.md` (Never hand-edit) · `CLAUDE.md` (the Inner loop ramp line) |
> | **Supersedes / Superseded by** | none yet · **Partially supersedes** ADR-0046 cl.1 and cl.3 (the fixed inset, region padding and nested step-down; the `[data-box]` opt-in, the flow-root BFC, sticky regions and the scroll-fade mask of Amendments 3 to 6 stand) · ADR-0078 cl.2 and cl.2b (the M3 px tables; the three axes, `as` stamping and the ADR-0106/0109/0114 axes stand) · ADR-0007 (the `*` ramp becomes a recompute list) · ADR-0015 cl.5 (the one fixed container radius) · ADR-0018 (the `max(0, r - pad)` chain) · **Supersedes on completion** ADR-0038 (the per-`[scale]` literal tables) · ADR-0041 (the 14/16/18 widget-box ramp and the 2px inset) · ADR-0150 (the compact-window body drop) · **Extends** ADR-0223 (fill-by-default, `inline` and R3(a) to (d) stand; clause 9 adds a sibling gate) · **Composes** [ADR-0065](./0065-icon-adapter-swappable-pack-architecture.md) and [ADR-0066](./0066-phosphor-default-pack-buildtime-vendoring.md) (icons stay pack art) · [ADR-0140](./0140-system-token-md-sys-consolidation.md) (new tokens live under `--md-sys-*`) · [ADR-0142](./0142-a2ui-text-heading-compact-scale.md) (the wire fan-out is unchanged) · [ADR-0234](./0234-turn-trace-prompt-budget-and-token-usage.md) (zero prompt bytes, clause 8) · [ADR-0110](./0110-visual-regression-pixel-diff-harness.md) (goldens regenerate per wave) · [ADR-0036](./0036-single-line-control-line-height-standard.md) (stands) |

## Context

**Today's foundations are four hand-tabled systems that do not derive from each other.**

- **Controls** (ADR-0038): `--md-sys-height-{sm,md,lg}` 24 / 28 / 36, font 13 / 14 / 16 and icon
  16 / 18 / 20 are literals per `[scale]` tier, six tiers (`dimensions.css:398-487`), with gap =
  font / 2 on the `*` ramp (`dimensions.css:290-292`). Read by 21 package stylesheets (height),
  33 (font), 12 (icon) and 15 (gap).
- **Indicator boxes** (ADR-0041): `--md-sys-compact-*` 14 / 16 / 18 and a flat 2px
  `--md-sys-widget-inset` (`dimensions.css:27-35`). Read by 10 stylesheets.
- **Containers** (ADR-0046 after Amendment 2): child inset 6px, region padding 12 inline / 6
  block, region gap 8, all rem and density-invariant (`container-box.css:36-58`), plus one fixed
  12px container radius (ADR-0015 cl.5, read by 42 stylesheets) and the ADR-0018 nested chain,
  which already floors a root card's inner radius at exactly 0 (ADR-0046 Amendment 2's flagged
  consequence). Layout spacing is a separate 4px ladder `--md-sys-space-{xs..2xl}` 4 to 32
  (`dimensions.css:344-350`, read by 65 package and 25 site stylesheets).
- **Type** (ADR-0078): the 27-cell M3 table times `--md-sys-scale` (`dimensions.css:304-331`),
  read by 27 package and 7 site stylesheets, with a 1px body drop below 52.5rem (ADR-0150).

There is no glyph concept: functional marks (caret, check, plus, minus, dot, x) are drawn five
different ways today: `<ui-icon glyph>` Phosphor art (toast, file-drop, composer, agent-admin),
raw `setIcon()` SVGs (select caret `select.ts:559`, text-field stepper `text-field.ts:928-935`,
calendar `calendar.ts:614`), clip-path polygons (checkbox `checkbox.css:167`, multi-select, menu,
badge `badge.css:132-156`), a border trick (nav-rail chevron `nav-rail.css:279`) and text nodes
(breadcrumb `/`, pagination `…`). Their sizes range from 0.5 to 1 of the control font.

**The skill.** The `mathematical-design-system` skill derives every size from one integer n per
element: `n = n0 + a·s + k·z + g·s·z` with tier constants (widget 7/1/1/0, product 9/2/2/1, content
11/2/2/1, brand 14/2/2/1), s and z in {-1, 0, +1} for scale and size; height 4n, inset n, icon 2n,
radius n, c = ceil(n/4), glyph 2n - 2c; container levels group / widget / card / layout with margin,
gutter and radius as multiples of n; type from linear and Q formulas; a contract `check()` (M1 to
M10). Every number in this record comes from its reference implementation, vendored byte for byte
at [`.claude/docs/references/foundations-derivation/scale.mjs`](../references/foundations-derivation/scale.mjs) (sha256
`eca32879…a3fb8f4d9`, the skill's `scale.mjs`) and run by
[`derive.mjs`](../references/foundations-derivation/derive.mjs) beside it; its output is
[`derive.out.md`](../references/foundations-derivation/derive.out.md). `check()` returns `[]` for the
unmodified CFG, and the skill's §9 check values recompute exactly (product md/md: n 9, h 36, c 3,
glyph 12, display 42 / heading 30 / body 16, card 27 / 18 / 27).

**Three facts bound the adoption.**

1. **Today's 24 / 28 / 36 is not one row of any CFG of the skill's form.** Within one tier and
   scale, `n(z) = (n0 + a·s) + (k + g·s)·z` is affine in z, so the sm to md and md to lg steps are
   equal. 24 to 28 is one n step (6 to 7), 28 to 36 is two (7 to 9). No constants fix that, so
   adoption moves at least one step by at least 4px.
2. **The reachable heights per tier** (all nine scale × size cells): widget 20 / 24 / 28 / 32 / 36,
   product 24 / 28 / 32 / 36 / 44 / 56, content 32 / 36 / 40 / 44 / 52 / 64, brand
   44 / 48 / 52 / 56 / 64 / 76. 40 exists only in content (sm/lg and lg/sm); 48 only in brand;
   there is no XL and nothing above 76. Today's 48 (ui-lg lg, content-md lg) has no product
   equivalent.
3. **`glyph` is taken.** `ui-icon`'s icon-name prop is `glyph` because Kim reserved `name` and
   `value` fleet-wide for form identifiers (TKT-0069, 2026-07-16, commit `d6a93cb4`; `naming.md`
   §12). Going back to `name` is ruled out.

## Decision

**We will derive every foundation size from one integer n per element, chosen by tier, scale and
size, generated from one vendored config that `check()` gates; set the library root to tier
`product` at scale `sm`, so sm and md controls keep 24 and 28 and lg moves from 36 to 32; split
the functional-mark box from the icon box with a new `ui-glyph` element and rename `ui-icon`'s
`glyph` prop to `symbol`; replace ADR-0046's fixed paddings with the four container levels and
the placement rule; derive `ui-text` sizes behind its unchanged nine-variant API; and migrate the
whole foundation by dark launch: derived tokens live only inside opt-in `data-tier` regions while
file-disjoint family lanes rewrite each rule as `var(<derived>, <today's value>)`, then one config
line makes the root opt in, after the step 0 mockup Kim approved on 2026-10-12.** The A2UI wire and the K6 prompt
budget move zero bytes. Eleven clauses.

### 1. One config, one generator, one gate

- **The config** is the skill's `scale.mjs` (CFG, `resolve()`, `check()`), vendored to
  `packages/agent-ui/shared/src/tokens/scale.mjs`. Changing the system means editing CFG there
  (skill §6), never a stylesheet.
- **The generator** `scripts/generate-foundations.mjs` imports it, refuses to write when `check()`
  returns any failure, and emits `packages/agent-ui/shared/src/tokens/foundations.gen.css`.
  `--check` mode rides `check:scripts` (the `generate-agent-assets.mjs --check` precedent), and the
  file joins AGENTS.md's Never hand-edit list.
- **Live calc, not per-rung literals.** n depends on three attributes that inherit independently,
  so a literal table would need a selector per combination of ancestors, which CSS cannot express.
  The generated block is the skill's tokens.css form: inputs on `:root` and the attribute
  selectors, `--md-sys-n` computed per element, every box value an integer multiple of n or c
  (whole pixels by M7), `c` via `round(up, …)`, headings via `pow()`. ADR-0038 dropped the
  multiplier because scaling height and font by one factor broke the pairing of each height with
  its font and icon row; here every quantity is a formula of the same n, so the pairing holds by
  construction.
- **The recompute list replaces ADR-0007's `*` ramp.** From the cut on (clause 10), derived
  tokens are declared on `:root, [data-tier], [data-scale], [data-size], [size]`, the same
  per-element re-substitution ADR-0007 relies on, declared only where an input changes. Until the
  cut the list is scoped to opt-in regions, `[data-tier]` and `[data-tier] :is([data-scale],
  [data-size], [size])`, by one config field.
- **Names** follow ADR-0140: inputs `--md-sys-tier-{n0,a,k,g,ratio}`, `--md-sys-scale-s`,
  `--md-sys-size-z`, `--md-sys-title-bump`; outputs `--md-sys-n`, `--md-sys-c`, `--md-sys-height`,
  `--md-sys-inset`, `--md-sys-radius`, `--md-sys-icon-box`, `--md-sys-glyph-box`,
  `--md-sys-glyph-stroke`, `--md-sys-type-{display,heading,subhead,section-kicker,title,body,control,field-label,group-kicker}`,
  `--md-sys-{group,widget,card,layout}-{margin,gutter,radius}`, `--md-sys-corner-shape`. The
  skill's bare names (`--h`, `--inset`) would collide with consumer pages.

### 2. The axes and the root

- **Tier** `data-tier` = widget | product | content | brand (what a region is for). **Scale**
  `data-scale` = sm | md | lg (a region's density). **Size** z: a control's existing reflected
  `size` prop (sm | md | lg) is z; `data-size` sets z on any other element. Nearest ancestor wins.
  Reflection is setter-driven (`dom/props.ts:227`), so a bare control carries no `size` attribute
  and inherits a region's z; wave 1 proves that with a test.
- **The root is `product` at scale `sm`: sizes sm / md / lg = n 6 / 7 / 8 = 24 / 28 / 32.** It
  becomes the default at the cut (clause 10); until then a region opts in with `data-tier`.

  | root candidate | heights sm / md / lg | per step vs 24 / 28 / 36 | total moved |
  |---|---|---|---|
  | **product/sm (chosen)** | 24 / 28 / 32 | 0 / 0 / -4 | 4px |
  | widget/md | 24 / 28 / 32 | 0 / 0 / -4 | 4px |
  | widget/lg | 28 / 32 / 36 | +4 / +4 / 0 | 8px |
  | product/md (the skill's default) | 28 / 36 / 44 | +4 / +8 / +8 | 20px |

  product/sm and widget/md tie at the root. Product wins by purpose (skill rule 1: a dense app
  screen is product made dense with scale, not a tool panel), and because one attribute,
  `data-scale="md"`, then gives the skill's own default 28 / 36 / 44 for a roomier region.
  product/md was rejected as the root: it grows every default control by 8px.
- **A2UI surfaces sit at `data-scale="md"`** (Kim's step 0 ruling, 2026-10-12): the canvas register
  is product/md, sizes sm / md / lg = 28 / 36 / 44, so a widget action at md stays 36px. The
  renderer's surface root carries the attribute; no catalog row changes.
- **`[scale]` retires.** Its six values map by purpose, with derived heights (deltas against
  today's tables); the bridge of clause 10 applies this mapping to pages that still set it, for one
  release after the cut:

  | today | heights sm/md/lg | body-medium | becomes | heights sm/md/lg (delta) | body at md |
  |---|---|---|---|---|---|
  | `ui-sm` | 20/24/28 | 12.25 | `widget/sm` | 20/24/28 (0/0/0) | 13 |
  | `ui-md` | 24/28/36 | 14 | `product/sm` (root) | 24/28/32 (0/0/-4) | 14 |
  | `ui-lg` | 28/36/48 | 15.75 | `product/md` | 28/36/44 (0/0/-4) | 16 |
  | `content-sm` | 24/28/36 | 19.25 | `content/sm` | 32/36/40 (+8/+8/+4) | 16 |
  | `content-md` | 28/36/48 | 21 | `content/md` | 36/44/52 (+8/+8/+4) | 18 |
  | `content-lg` | 36/48/64 | 24.5 | `content/lg` | 40/52/64 (+4/+4/0) | 20 |

  Only the docs site (11 lines in 5 files) and tests (45 lines in 23 files) set `[scale]` or
  `[density]`; no package source does.
- **`[density]` retires into `data-scale`** (compact one step down, spacious one step up). Today
  it multiplies gaps only (0.5 / 1 / 1.5). Under one n the frame and the rhythm move together, so
  `geometry.md`'s frame/rhythm split ("density multiplies the rhythm only, never the frame")
  retires with it.
- **Catalog-invisible at v1** (the ADR-0223 cl.2 precedent): no A2UI row gains a tier, scale or
  density property. These are page-author axes.

### 3. Controls

Every control applies the skill's §2 rules at its own n. The full delta table is Appendix B; the
rules are:

| class | rule |
|---|---|
| all controls | height 4n · inset n · gap n · radius n with `corner-shape: squircle` (button and toggle excepted, below) · type n + 6 · borders inside the box (padding = rule - border width) |
| button, toggle | radius h/2 = 2n (the pill); padding 2n beside a label, n beside an icon; icon-only is a 4n square (the ADR-0223 R3(a) floor, unchanged form) |
| text-field, select, combo-box, multi-select, otp-field | padding n; a leading icon or caret slot is 2n |
| field | label above, gap ceil(n/2) |
| checkbox | 2n box, radius n/2, check glyph 2n - 2c |
| radio | 2n circle, dot 2n - 4c |
| switch | track 2n tall, padding c, thumb 2n - 2c, width 2·thumb + 2c, fully rounded |
| indicator to label | n |
| badge | height 2n, padding 2c, radius n/2, field-label type |
| listbox (menu, select, combo-box panels) | options are 4n controls stacked edge to edge, padding c |
| segmented-control | padding c, gap c, segments 4n tall with padding 2n |
| table | rows at least 4n + 2c, text cells n + c, a boxed child's cell n + c - its inset, header in group-kicker type, the table extends n + c past its card on each side |
| progress | track 2c, radius c |

Four deviations from the skill. Kim ruled the first two at step 0 (2026-10-12, the approval note
`.sdlc/foundations-mockup/approval.md`):

- **Button and toggle keep the pill**, radius h/2 = 2n: 12 / 14 / 16 at the root, 14 / 18 / 22 in
  the A2UI canvas. It is the one documented exception to radius = n. A pill at a container's
  corner is not concentric with it; Kim accepted that.
- **`ui-avatar` is 4n** (24 / 28 / 32 at the root), the skill's icon-tile rule. The skill's 2n
  avatar is an avatar inside a control row; in the fleet `ui-avatar` stands beside controls at
  control height, and 2n would shrink it by half (Appendix B).
- **`ui-slider` has no skill rule.** It takes the progress rule for its rail (2c) and the switch rule
  for its thumb (2n - 2c).
- **ADR-0036 stands.** A single-line control keeps line-height 1 inside its 4n frame; the skill's
  1.2 applies to control text that wraps.

The pill stays, so a button or toggle keeps radius 14 at md and follows its height at lg (18 to
16). Every other control's radius moves to n (a field at md: 12 to 7). The squareness
floor `min-inline-size: var(--ui-{name}-height)` keeps its form and resolves to 4n.

### 4. Icon and glyph: two boxes, two elements, one renamed prop

- **An icon** is pictorial art from the swappable pack (ADR-0065/0066) in a **2n** box: 12 / 14 /
  16 at the root's sm / md / lg (16 / 18 / 20 today).
- **A glyph** is a functional mark in a **2n - 2c** box: 8 / 10 / 12 at the root (today a caret is
  drawn at the control font, 13 / 14 / 16). A glyph always sits in an icon-sized 2n slot, inset c
  on each side, so an icon and a glyph in neighbouring slots share the slot box and the centre line.
  That is Kim's "own container, own size": the slot is shared, the mark box is distinct.
- **`ui-glyph` is minted**, a display atom like `ui-icon` (ADR-0223 R4 text-flow exemption) that
  renders one mark from the closed set in clause 5.
- **`ui-icon.glyph` is renamed `ui-icon.symbol`, and `ui-glyph` takes the same `symbol` prop.** The
  word glyph then names one thing, the functional-mark element and its box, and the `name`
  reservation (TKT-0069) stands. `glyph` stays a deprecated alias on `ui-icon` for one release.
- **Migration.** The prop appears in 39 `.ts` files under `packages/` and `site/`; repo-wide the
  forms count 51 `glyph=`, 61 `glyph:`, 38 `.glyph` and 33 `setAttribute('glyph', …)` hits, prose
  and tests included. Each lane of clause 10 renames the call sites inside its own folders, so no
  wave-wide codemod crosses lane boundaries. `glyph-usage-coverage.test.ts` follows the rename and closes its three blind
  spots in the same wave (it scans only `site/` and `app/src/`, and misses `setAttribute` and
  `.glyph`). `icon.md`'s prose, which still calls the prop `name` (`icon.md:4,12,54,65-66,76`), is
  repaired in that wave. The other uses of the word (`badge.css`'s `[data-part=glyph]`,
  `button.css`'s `--ui-button-glyph` caret ramp) become real glyph-box consumers.
- **The A2UI wire does not move.** `Icon.name` and `Button.icon` keep their wire names; only their
  `mapsTo` changes from `glyph` to `symbol` (default `catalog.json:20,232`, a2ui-basic
  `catalog.json:42`). `mapsTo` never reaches the prompt (`system-prompt.ts:192` prints `prop: type`
  only) and corpus payloads carry the wire name, so prompt and corpus move zero bytes.

### 5. The mark set, and how marks draw

- **The closed set v1 is twelve marks**, read off what the fleet draws today: `check`, `x`, `plus`,
  `minus` (also the indeterminate dash), `caret-up`, `caret-down`, `caret-left`, `caret-right`,
  `dot`, `more` (three dots), `warning`, `info`. Pictorial names (`eye`, `magnifying-glass`,
  `calendar-blank`, `user`, `list`) stay icons. A new mark joins the set only by amendment.
- **One path table owns mark geometry.** It lives in `components` beside `ui-glyph` (library
  geometry, not swappable pack art; the icon pack keeps its own caret and check for pictorial use).
  Each mark is a stroke path in a fixed square viewBox, drawn `fill="none" stroke="currentColor"`
  with `vector-effect: non-scaling-stroke`, so stroke width is a token:
  `--md-sys-glyph-stroke = max(1.5px, c/2)` (1.5 / 1.5 / 2 / 2.5 for c = 2 / 3 / 4 / 5). `dot` and
  `more` are filled. Kim approved the rule as drawn at step 0 (1.5px at the root's 8, 10 and 12px
  boxes).
- **Two consumption paths, one source.** A control with a child slot renders `<ui-glyph>` (select
  caret, text-field stepper and clear, toast and file-drop dismiss, calendar and swiper carets,
  disclosure caret, tabs and breadcrumb overflow, composer and status-stream marks, timeline status,
  entry-list and agent-admin plus). A control that draws on a pseudo-element today (checkbox tick
  and dash, radio dot, menu and multi-select tick, choice-card tick, badge intent marks, nav-rail
  chevron) either gains a `ui-glyph` child or reads a generated mask token from the same table; the
  control wave picks per control and never re-draws a mark by hand.

### 6. Containers and placement

- **Four levels**, each at the container's own n (root md: n 7, c 2):

  | level | margin | gutter | radius | fleet members |
  |---|---|---|---|---|
  | group | n + c (9) | c (2) | n + c (9) | listbox panels (menu, select, combo-box, multi-select), segmented-control, table rows, tooltip |
  | widget | 2n (14) | n (7) | 2n (14) | popover, toast, form-popover panel |
  | card | 3n (21) | 2n (14) | 3n (21) | card, modal, drawer, command-modal |
  | layout | 4n (28) | 3n (21) | 4n (28) | super-shell frame and bars, the docs page frame |

- **Placement.** A container pads with its margin; a boxed child at an edge sits at offset =
  margin - its own inset, through a negative margin of `--md-sys-inset` that resolves on the child
  (skill rule 9). A button in a card footer sits 21 - 7 = 14px from the card edge, so its label
  lines up with the card's text at 21.
- **Concentric by construction.** A container's radius equals its margin and a control's radius
  equals its inset, so nested corners stay concentric (the button and toggle pill, clause 3, is the
  one control that is not). ADR-0018's `max(0, r - pad)` chain and ADR-0046
  Amendment 2's zero-radius consequence both retire.
- **What ADR-0046 keeps:** `[data-box]` as the opt-in, the flow-root BFC, sticky header and footer,
  `hr` full-bleed, and the scroll-fade mask and card scroll model of Amendments 3 to 6. **What it
  loses:** the fixed `--ui-box-inset` 6, `--ui-box-pad-inline` 12, `--ui-box-pad-block` 6 and
  `--ui-box-gap` 8, the nested 12 to 6 to 6 step-down, and density-invariance (padding now moves
  with n). The `--ui-box-*` names stay as the per-control consumer tier (ADR-0140 cl.2) and
  repoint to the level tokens.
- **Layout spacing.** `--md-sys-space-*` becomes a generated alias layer over the level values at
  the element's n, so the six A2UI `gap` enums keep their names and prompt bytes: `xs` c, `sm` n,
  `md` n + c, `lg` 2n, `xl` 3n, `2xl` 4n (at n 7: 2 / 7 / 9 / 14 / 21 / 28, against 4 / 8 / 12 /
  16 / 24 / 32 today).

### 7. Type

- **`ui-text`'s API stands:** nine variants, `size` sm / md / lg, `as`, and the ADR-0106/0109/0114
  axes. Each variant maps to a skill role, and `size` is z, so it shifts the text's own n:

  | variant | skill role | variant | skill role |
  |---|---|---|---|
  | `display` | display | `label` | field label |
  | `headline` | heading | `kicker` | section kicker |
  | `title` | title (body + 0 / 1 / 2 by size) | `overline` | group kicker |
  | `body` | body | `lead`, `quote` | subhead |

- **Sizes always come from the formula.** Weight and line height come from the skill's role table,
  with three named exceptions: `kicker` keeps Kim's GH #370 ruling (400, 0.2em tracking) over the
  skill's 500 / 0.08em, `overline` keeps its cl.2b 500 / 0.15em identity, and `lead` / `quote` keep
  body's 400 weight at the subhead size. An explicit ruling outranks a skill default.
- **`--md-sys-typescale-*`** (27 rows × 4 legs) becomes a generated alias layer over the derived
  roles for the 27 package and 7 site stylesheets that read it, and retires at the W7 cleanup.
  `--md-sys-scale` retires with it.
- **ADR-0150 is superseded.** Skill rule 8 lowers the scale on narrow screens, but the root is
  already at scale sm, so the 1px body drop has no formula form at the root; a content-tier region
  steps its scale down below 52.5rem instead. Mobile body at the root moves from 13 to 14.
- **Display is small in a product region by design.** `display` at the root reads 27 / 32 / 36
  against 36 / 45 / 57 today. Rule 4 gives a hero its own tier: content md display 53, brand md
  display 75.
- **A2UI:** the wire `Text.variant` enum and ADR-0142's fan-out table do not change; the rendered
  sizes derive.

### 8. A2UI catalog, payloads and the K6 budget

The default turn is 45,454 chars against the K6 bound of 46,430 (the PRD
`response-type-selection` K6 row, 976 spare). **This record moves zero prompt bytes:**

- CSS never reaches the prompt (`loadPrompt` reads only `agent/prompts/*`, `system-prompt.ts:66-67`).
- Every wire enum stays: `Toggle.size` sm|md|lg (`catalog.json:950`), the six `gap` enums
  none..2xl (`catalog.json:131,144,310,451,461,872`), `Text.variant`.
- The `mapsTo` edits (clause 4) are not printed. No row gains tier, scale or density.
- **One byte-pinned risk:** `genui-teaching.md:24-25` names `--md-sys-*` tokens as prose. That block
  is off by default (the ADR-0234 matrix, not K6). If a retired name appears there, the retirement
  wave recaptures through the `a2ui-prompt-authoring` flow.

Payloads and corpus move zero bytes. The rendered look changes, so `eval:catalog` and the
goldens re-run in the release wave.

### 9. Gates

- **New:** the generator refuses a failing `check()`; a vitest leg asserts `check()` is `[]` and
  the generated file is byte-identical; a browser leg sets each of the 36 tier/scale/size cells on
  a probe, reads the tokens back through `getComputedStyle`, and compares them to `resolve()` in
  both engines (skill §6 step 4).
- **`sizing-gates.test.ts` (ADR-0223) is untouched.** It pins no height (`block-size` is never
  scanned), its squareness form reads the per-control `--ui-{name}-height`, which this record
  re-derives as 4n without renaming, and its R4 and whole-shape allowlists are em, rem and ch
  floors this record does not move. ADR-0223 is extended, not amended.
- **A sibling rule** joins that gate family: no px literal for control geometry in a control's
  token block except the 1px hairline, the focus ring, the scrollbar and the ratified whole-shape
  floors. It lands report-shape in W1 and flips enforcing at W7 (the ADR-0223 R5 shape).
- **Re-baselined at the cut, never weakened:** until the cut, `dimensions.test.ts` (544 lines,
  its six-tier table at `:36-46`) and the 66 default visual goldens across 26 suites stay
  byte-identical and serve as the dark-launch leak gate; at the cut the test is rewritten against
  `resolve()` and the goldens regenerate through ADR-0110's deliberate recapture path. 42 test
  files with 162 lines name `--md-sys-{height,icon,font}-*`; each moves with its family lane. The
  full gate table is clause 10c.

### 10. The overhaul: strategy, waves, gates, consumer stability and rollback

#### 10a. Strategy: a dark launch behind `data-tier`

| option | how it lands | verdict |
|---|---|---|
| Big-bang | one change repoints every token and rewrites every control | rejected: 124 package stylesheets, 42 test files and 66 goldens in one review, no partial rollback, no parallel lanes |
| Forward token shim alone | the old `--md-sys-*` and `--ui-box-*` names alias the derived tokens; control CSS untouched | rejected as the plan: heights, type, icons and gaps move, but control-local formulas (input padding h/2, checkbox box/5, the 0.6 check) keep today's shape, so the fleet lands half-derived. Kept as the consumer bridge |
| Per-control waves alone | each family rewrites its stylesheet onto the derived tokens | rejected alone: during the train every default page on `main` mixes two systems |
| **Dark launch (recommended)** | derived tokens exist only inside opt-in `data-tier` regions until the cut; each family lane rewrites every geometry rule as `var(<derived>, <today's expression>)`; a scoped forward shim aliases the old names inside opt-in regions; the cut is one config field that makes the root opt in | adopted |

Why the dark launch wins:

1. Every wave before the cut lands on `main` with zero default visual change, so the 66 default
   goldens and `dimensions.test.ts` double as the leak gate.
2. Lanes are file-disjoint (10b), so each one merges and reverts as its own commit.
3. Kim reviews real controls in opt-in regions (the docs preview pane, an agent-admin flag) beside
   the mockup before anything changes for a consumer.
4. The flip and its rollback are one reviewed line.
5. The same fallbacks give consumers a per-region escape hatch for one release after the cut
   (10e).

How it works:

- **Undefined outside, defined inside.** Until the cut the generator's `rootDefault` field is false
  and the derived block is declared only on `[data-tier]` and `[data-tier] :is([data-scale],
  [data-size], [size])`. Outside an opt-in region every derived token is undefined, so each
  `var(<derived>, <today>)` resolves to today's expression. A migrated text-field reads
  `border-radius: var(--md-sys-radius, var(--md-sys-shape-corner-base))`: 12 outside, n inside.
- **The bridge** (`foundations-bridge.gen.css`, generated with the tokens) aliases the old names
  to derived values inside opt-in regions, and on `:root` from the cut: `--md-sys-height-{sm,md,lg}`
  to the height one size step down, at and up (`calc` over the tier step k + g·s);
  `--md-sys-font-*` to control type; `--md-sys-icon-*` to the icon box; `--md-sys-gap-*` to n;
  `--md-sys-compact-*` to 2n; `--md-sys-widget-inset` to c; `--md-sys-shape-corner-base` to the
  card radius (its ADR-0015 container meaning); `--md-sys-space-*` per clause 6;
  `--md-sys-typescale-*-size` per clause 7; `--ui-box-*` to the level tokens. `[scale="…"]` and
  `[density="…"]` set the tier and scale inputs per clause 2's table and join the recompute list.
  An unmigrated stylesheet therefore picks up derived heights, type, icons and gaps in an opt-in
  region; only its local formulas wait for its lane.
- **The cut** sets `rootDefault: true`: `:root` takes the product/sm inputs and the full recompute
  list of clause 1.

#### 10b. Waves, sized and file-disjoint

Every package control folder sits in exactly one lane; the lane-plan step re-checks the partition
against `ls packages/agent-ui/{components,app}/src/controls` before dispatch. Generated files
(`registry.gen.ts`, `all.gen.css`, `*.props.gen.ts`, `adr-index.json`) are never edited in a lane;
the serial merge path regenerates them (CLAUDE.md Inner loop). Lanes inside a wave run in
parallel up to the seat-map concurrency ceiling.

| wave | lane | files (folders under `controls/` unless a path is given) | size | depends on |
|---|---|---|---|---|
| Step 0 | mockup (done: Kim approved it as drawn, 2026-10-12) | `.sdlc/foundations-mockup/` only | L2 | none |
| W1 tokens, generator, gate | 1 | `packages/agent-ui/shared/src/tokens/**`, `scripts/generate-foundations.mjs`, `package.json` (`check:scripts`), `AGENTS.md` | L3 | Kim's mockup approval |
| W2 icon and glyph containers | 2 | `icon/`, new `glyph/` (the mark path table), `packages/agent-ui/icons/src/glyph-usage-coverage.test.ts`; `ui-icon` gains `symbol` and keeps `glyph`; no call site moves | L3 | W1 |
| W3 controls by family | 3a entry | `text-field`, `textarea`, `select`, `combo-box`, `multi-select`, `otp-field`, `field`, `color-picker`, `form-provider`, `suggestions` | L3 | W1, W2 |
| | 3b action | `button`, `toggle`, `segmented-control`, `segment`, `pagination`, `toolbar`, `rating`, `swiper` | L3 | W1, W2 |
| | 3c indicators | `checkbox`, `radio`, `switch`, `slider`, `slider-multi`, `progress`, `gauge`, `choice-group`, `choice-card` | L2 | W1, W2 |
| | 3d atoms | `badge`, `avatar`, `swatch`, `attachment`, `sparkline`, `stat`, `image`, `audio`, `video` | L2 | W1, W2 |
| | 3e navigation | `menu`, `tabs`, `breadcrumb`, `disclosure`, `drill`, `calendar`, `split`, `source-list`, app `nav-rail` | L3 | W1, W2 |
| | 3f data display | `table`, `list`, `description-list`, `timeline`, `timeline-item`, `status-stream`, `ladder`, `ramp`, `code`, `_chart` and the four chart folders, `_token-surface`, app `entry-list` | L2 | W1, W2 |
| | 3g type | `text` | L2 | W1 |
| W4 containers and widgets | 4a containers | `_surface`, `card`, `modal`, `drawer`, `popover`, `toast`, `tooltip`, `command-modal`, `form-popover`, `row`, `column`, `grid`, `sandbox-frame`, `theme-provider`, app `super-shell`, `chat-shell`, `workspace-shell`, `master-detail`, `surface-host`, `settings` | L3 | W3 |
| | 4b preset widgets | `product-card`, `board-grid`, `game-hud`, `service-card`, `playing-card`, `packages/agent-ui/a2ui/src/catalog/personas/**`; the persona action row stops stamping `size="lg"` and reads the derived md height with today's lg as its fallback, so actions stay 36px on both sides of the cut | L2 | W3 |
| W5 A2UI, site, docs | 5a A2UI catalog | `packages/agent-ui/a2ui/src/catalog/{default,a2ui-basic}/**` (`mapsTo` glyph to symbol, the Button icon child), `packages/agent-ui/a2ui/src/renderer/**` (the surface root carries `data-scale="md"`, the canvas register; no `data-tier`, so it stays dark until the cut), renderer tests, `eval:catalog` under opt-in | L2 | W2 |
| | 5b site | `site/**`: preview knobs from `[scale]`/`[density]` to the data axes, site call sites, reading columns at `data-tier="content"` | L2 | W3, W4 |
| | 5c app surfaces | app `agent-admin`, `conversation` (the remaining `setAttribute('glyph', …)` call sites) | L2 | W2 |
| | 5d records | `.claude/docs/**`, `.claude/skills/**` (clause 11's law records) | L2 | W3, W4 |
| W6 the cut | 1 | the generator's `rootDefault`, its regenerated CSS, `dimensions.test.ts` against `resolve()`, the 66 default goldens, `CLAUDE.md`'s ramp line; Kim's sign-off on the docs site and agent-admin; one breaking release | L3 | W1 to W5 |
| W7 cleanup | 1 | every control folder: `var(<derived>, <today>)` collapses to `var(<derived>)`; the bridge, `[scale]`, `[density]`, the `glyph` alias and the legacy opt-out retire; the px-literal rule enforces; a major release | L3 | one release after W6 with no rollback used |

Each W3 and W4 lane, inside its own folders, converts its marks to `ui-glyph`, renames its
`glyph` call sites to `symbol`, repairs its descriptors' `geometry:` lines, adds its per-control
geometry pin and records its opt-in goldens.

#### 10c. Gates that guard it

| gate | guards | from |
|---|---|---|
| `check()` M1 to M10 | the config: the generator refuses to emit, a vitest leg asserts `[]` | W1 |
| generated-file drift (`--check` on `check:scripts`) | `foundations.gen.css` and the bridge are never hand-edited | W1 |
| the 36-cell browser leg | computed tokens equal `resolve()` in Chromium and WebKit | W1 |
| the leak gate | until W6, no change touches a default golden or `dimensions.test.ts`; both stay byte-identical | W1 to W5 |
| `sizing-gates.test.ts` | fill-by-default posture and floors (ADR-0223); untouched and green every wave | all |
| per-control geometry pin | each migrated control's browser test asserts height, padding, radius, icon box and glyph box at sm, md and lg under `data-tier="product" data-scale="sm"` against `resolve()`, and the same control outside opt-in still at today's values | W3, W4 |
| screenshot beside the mockup | each family change carries the real control under opt-in next to its approved step-0 mockup (CLAUDE.md Inner loop); opt-in goldens recorded per family | W3 to W5 |
| the px-literal rule | report-shape, then enforcing | W1, W7 |
| prompt and corpus bytes | the default turn stays 45,454 chars, the prompt-equivalence baseline and corpus files unchanged | W5a |

#### 10d. What stays stable for consumers

| surface | promise |
|---|---|
| tags, props, events, `size` sm/md/lg, `inline` | unchanged |
| `--ui-{cmp}-*` knob names (ADR-0140 cl.2) | unchanged; their values derive |
| `--md-sys-{height,font,icon,gap,compact,space,typescale}-*`, `--md-sys-shape-corner-base`, `--md-sys-widget-inset`, `--ui-box-*` | kept as bridge aliases of derived values for one release after the cut; removed in the W7 major |
| `[scale]`, `[density]` | mapped onto tier and scale by the bridge for one release; removed at W7 |
| `ui-icon`'s `glyph` attribute | accepted as an alias of `symbol` until W7 |
| A2UI wire, payloads, corpus, catalog enums, K6 | byte-identical throughout |
| DOM | one change: a control that drew a mark on a pseudo-element may gain a `ui-glyph` child (clause 5), which breaks consumer selectors aimed at that pseudo-element |
| rendered px | change at the cut, by design (Appendix B) |

#### 10e. Shipping incrementally, and rolling back

- **Before the cut** a page or region opts in with `data-tier` (the root reading is `data-tier="product"
  data-scale="sm"`); removing the attribute is the rollback. The docs preview pane and an
  agent-admin flag opt in for review.
- **A lane** reverts as its own commit and touches no other lane's files.
- **The cut** is one config field plus its regenerated output and goldens. Reverting that change
  restores the default look while the family work stays live behind opt-in.
- **For one release after the cut** `data-foundations="legacy"` on any region sets every derived
  token to `initial` (guaranteed-invalid) and pins the old names to today's literals, so the
  `var(<derived>, <today>)` fallbacks render today's geometry there. A consumer who is not ready
  opts out per region, without holding back the release.
- **W7 is the one irreversible step,** and it runs only after a release in which no rollback was
  used.

Step 0's mockup, a static page reviewed as an artifact (the PNGs and Kim's approval note sit in
`.sdlc/foundations-mockup/`), drew one control row per root step (sm, md, lg) and per
`data-scale="md"`, each control with its icon slot (2n) and glyph box (2n - 2c) outlined; a
listbox, popover, card and page frame at each level; the `ui-text` ladder; the radius and avatar
choices beside today's look. Kim approved it as drawn on 2026-10-12; the rulings follow clause
11.

### 11. Records this invalidates (stale, re-verified per wave)

171 files outside the ADR log name a replaced law or token (`git grep -l -E
'md-sys-height-|md-sys-icon-|md-sys-compact-|ADR-0038|ADR-0041|geometry\.md|ui-box-pad|md-sys-typescale|ADR-0046|ADR-0078'`),
each repaired by the wave that changes what it describes. The ones that state a law and not a
value: `references/geometry.md` (frame/rhythm split, h/2 padding; its pill radius survives for button
and toggle only),
`references/geometry-sizing-spec.md` (the hand-tabled ramp), `references/tokens.md`,
`references/naming.md` §12 (the `glyph` entry), `references/dimensional-standard.md` (already
superseded; its stale tier note goes), `rubrics/component.md`, the `component-standards`,
`component-design`, `component-patterns` and `fleet-review` skills, every control descriptor's
`geometry:` line, `AGENTS.md` (Never hand-edit gains `foundations.gen.css`) and `CLAUDE.md`'s
Inner loop line "Controls take the library ramp (sm 24 / md 28 / lg 36 px)", which becomes 24 /
28 / 32.

## Step 0 rulings (Kim, 2026-10-12)

The items this record left open for the mockup are closed (`.sdlc/foundations-mockup/approval.md`):

1. **The mockup is approved as drawn:** icon 18 to 14 at md, caret 14 to 10, card radius 21,
   listbox padding 2, container growth as in Appendix B.
2. **The A2UI canvas register is `data-scale="md"`:** A2UI surfaces read 28 / 36 / 44, and widget
   actions stay 36px (clause 2; lanes 4b and 5a).
3. **Button and toggle keep the pill** (h/2), the one documented exception to radius = n (clause 3).
4. **The avatar is 4n** (24 / 28 / 32 at the root), not the skill's 2n (clause 3).
5. **The glyph stroke stays as drawn,** `max(1.5px, c/2)` (clause 5).

## Consequences

- **One derivation instead of four tables.** A new control computes its geometry from its n; a
  density or scale change is one attribute; nested corners are concentric without a chain.
- **Visible, fleet-wide look change.** The biggest moves at the default md, in order: icons 18 to
  14; input inline padding 14 to 7; field radius 12 to 7 (buttons and toggles keep the pill);
  card block inset 12 to 21 and radius 12 to 21; listbox padding 7 to 2 with option rows 22 to
  28; `display` type 45 to 32; `kicker` 12 to 16. Appendix B has every row.
- **lg controls shrink 36 to 32 at the root,** and the tabs strip goes from 36 to 28 at the
  default md. A2UI surfaces sit at `data-scale="md"` (28 / 36 / 44), so T-0083's widget actions
  stay 36px as md actions there.
- **No 40, no 48 and no XL in product.** A request for one is answered with the nearest steps
  (32 or 36, 44), never a one-off.
- **Density changes meaning:** a region's density now moves heights too, not only gaps.
- **The A2UI wire, the corpus and the K6 budget do not move;** rendered goldens and `eval:catalog`
  verdicts do.
- **Vocabulary:** the skill's "widget" (a tier and a container level) is not the A2UI "preset
  widget" of ADR-0243. The token names keep the skill's word; `references/agent-model.md` gains one
  disambiguating glossary line in W1. `--md-sys-widget-inset` (ADR-0041's 2px) becomes a bridge
  alias of c in W1 and is removed at W7, so it never outlives the deprecation release beside
  `--md-sys-widget-{margin,gutter,radius}`.
- **Two systems coexist in the source until W7.** Every migrated rule carries its today fallback
  for one release after the cut; that is the price of a one-line rollback, and W7 removes it.

### Risks

| risk | likelihood | mitigation |
|---|---|---|
| The overhaul reads as a different product (radius, icon size, container air) | high, by design | the step 0 mockup, approved as drawn on 2026-10-12; Kim's sign-off before the release cut |
| `round()` / `pow()` / `corner-shape` engine gaps | low for the first two, high for `corner-shape` outside Chromium | the 36-cell browser leg in both engines; `corner-shape` is paint-only and falls back to circular corners |
| A region's `data-size` never reaches a control that reflects its default | low (reflection is setter-driven) | W1 test on a bare control under `data-size="sm"` |
| The dark launch leaks: a derived token resolves outside an opt-in region before the cut | medium | the 10c leak gate (default goldens and `dimensions.test.ts` byte-identical through W5) and the outside-opt-in leg of every per-control pin |
| A missed rule keeps today's geometry behind its fallback after the cut | medium | the per-control pins assert the derived box under opt-in; W7's fallback removal reds any rule a lane missed |
| A lane edits a folder another lane owns | low | the 10b partition is re-checked before dispatch; generated files are regenerated only on the serial merge path |
| 171 records go stale mid-train | high | clause 11: each wave repairs the records it invalidates in the same change |
| Mobile hit targets: no scale below the root | medium | the root is already the densest product step; rule 8 applies only to content regions |
| Golden churn hides a real regression | medium | goldens regenerate per family with eye review (the ADR-0223 slice 2 practice) |

## Acceptance

This record ships no production code. This change: the ADR passes the ADR grammar
(`site/lib/adr.test.ts`) and the docs grammar sweep (`site/lib/docs-grammar.test.ts`; 0244 has
landed, so S8 needs no known gap), the regenerated indexes pass `site/lib/sitemap.test.ts`, and
`npm run check` stays green. Each wave carries the gates of clause 10c plus `npm run check`, the
touched folders' tests and `test:browser` for CSS waves.

## Alternatives considered

- **Reject the skill and keep the four tables.** Rejected: Kim ruled a full overhaul, and
  `check()` passes on the unmodified CFG, so nothing in the numbers makes adoption impossible.
- **Root product/md, the skill's default (28 / 36 / 44).** Rejected as the root: every default
  control grows 8px (20px moved across the three steps against 4px). It survives as the one-attribute
  roomy register (`data-scale="md"`).
- **A custom tier that reproduces 24 / 28 / 36.** Impossible: steps within a row are equal
  (Context fact 1). A tier with n0 7 and k 2 gives 20 / 28 / 36, which moves sm instead and adds a
  tier to CFG for one step.
- **Map library sizes to mixed rungs** (sm and md from widget, lg from product). Rejected: it sets n
  per size by hand, which the skill forbids (rule 2), and breaks scale/size commutation.
- **Radius n for button and toggle too (the skill's rule).** Rejected by Kim at step 0: buttons
  and toggles keep the pill, at the cost of concentric corners for a pill at a container corner.
- **Rename `ui-icon.glyph` back to `name`.** Rejected: `name` is reserved fleet-wide for form
  identifiers (TKT-0069).
- **Keep `glyph` on `ui-icon` and call the mark element something else (`ui-mark`).** Rejected: Kim
  named the mark container glyph, and the word would keep two meanings.
- **One element with a `kind="icon|glyph"` switch.** Rejected: an icon and a glyph differ in source
  (swappable pack art against library geometry) and in box, so one element would carry two
  contracts.
- **Generated per-rung literals (the ADR-0038 style).** Rejected: n depends on three independently
  inherited attributes, so the literal table has no selector form (clause 1).
- **Migrate big-bang, by forward shim alone, or by per-control waves alone.** Rejected for the
  reasons in clause 10a's table; the dark launch keeps the shim as the consumer bridge and the
  per-family waves as the unit of work, and adds the opt-in scope and the fallbacks that make each
  step reversible.
- **Keep ADR-0046's fixed paddings and adopt n for controls only.** Rejected: the placement rule
  (offset = margin - inset) needs the container margin and the child inset in the same system;
  mixing fixed rem regions with n-derived controls breaks text alignment at every step but one.

## Appendix A: check() and the derivation

`node .claude/docs/references/foundations-derivation/derive.mjs` prints every table below; `check()` returns `[]`.
Constants (the skill's CFG, unmodified): ladder 5 to 24; tiers widget [7,1,1,0], product [9,2,2,1],
content [11,2,2,1], brand [14,2,2,1]; linear body [12,1], control [11,1], field label [9,1], group
kicker [9,0.5]; Q 1.25 + (n - 5)/32; kicker ratio 9/8; title bump 0 / 1 / 2; floor 9; levels widget
[2,1,2], card [3,2,3], layout [4,3,4], group n + c / c / n + c.

## Appendix B: the delta table

Controls at the root product/sm, size sm / md / lg = n 6 / 7 / 8. Today values from the shipped
stylesheets at the default (no `[scale]`, no `[density]`).

| quantity | rule | today → derived (delta), sm · md · lg |
|---|---|---|
| height | 4n | 24 → 24 (0) · 28 → 28 (0) · 36 → 32 (-4) |
| icon box | 2n | 16 → 12 (-4) · 18 → 14 (-4) · 20 → 16 (-4) |
| glyph box (caret today = font) | 2n - 2c | 13 → 8 (-5) · 14 → 10 (-4) · 16 → 12 (-4) |
| control type | n + 6 | 13 → 12 (-1) · 14 → 13 (-1) · 16 → 14 (-2) |
| control gap (font/2 today) | n | 6.5 → 6 (-0.5) · 7 → 7 (0) · 8 → 8 (0) |
| button label padding (h/2 today) | 2n | 12 → 12 (0) · 14 → 14 (0) · 18 → 16 (-2) |
| button icon-side padding ((h - icon)/2 today) | n | 4 → 6 (+2) · 5 → 7 (+2) · 8 → 8 (0) |
| input inline padding (h/2 today) | n | 12 → 6 (-6) · 14 → 7 (-7) · 18 → 8 (-10) |
| button / toggle radius (the pill, kept at step 0) | h/2 = 2n | 12 → 12 (0) · 14 → 14 (0) · 18 → 16 (-2) |
| field radius (corner-base today) | n | 12 → 6 (-6) · 12 → 7 (-5) · 12 → 8 (-4) |
| checkbox / radio / switch / slider box (compact today) | 2n | 14 → 12 (-2) · 16 → 14 (-2) · 18 → 16 (-2) |
| checkbox radius (box/5 today) | n/2 | 2.8 → 3 (+0.2) · 3.2 → 3.5 (+0.3) · 3.6 → 4 (+0.4) |
| checkbox check (0.6 box today) | 2n - 2c | 8.4 → 8 (-0.4) · 9.6 → 10 (+0.4) · 10.8 → 12 (+1.2) |
| radio dot (0.56 box today) | 2n - 4c | 7.84 → 4 (-3.84) · 8.96 → 6 (-2.96) · 10.08 → 8 (-2.08) |
| switch thumb (box - 4 today) | 2n - 2c | 10 → 8 (-2) · 12 → 10 (-2) · 14 → 12 (-2) |
| switch track width (1.8 box today) | 2 thumb + 2c | 25.2 → 20 (-5.2) · 28.8 → 24 (-4.8) · 32.4 → 28 (-4.4) |
| switch track padding (widget-inset today) | c | 2 → 2 (0) · 2 → 2 (0) · 2 → 2 (0) |
| field label gap (space-xs today) | ceil(n/2) | 4 → 3 (-1) · 4 → 4 (0) · 4 → 4 (0) |
| avatar, the skill's 2n (not adopted) | 2n | 24 → 12 (-12) · 28 → 14 (-14) · 36 → 16 (-20) |
| avatar, 4n (ruled at step 0) | 4n | 24 → 24 (0) · 28 → 28 (0) · 36 → 32 (-4) |
| menu item row (font + 8 today) | 4n | 22 → 24 (+2) · 22 → 28 (+6) · 22 → 32 (+10) |
| table row (about 28 + 1px today) | 4n + 2c | 29 → 28 (-1) · 29 → 32 (+3) · 29 → 36 (+7) |
| table text cell inline padding (space-sm today) | n + c | 8 → 8 (0) · 8 → 9 (+1) · 8 → 10 (+2) |
| segmented-control padding (0 today) | c | 0 → 2 (+2) · 0 → 2 (+2) · 0 → 2 (+2) |
| segment inline padding (h/2 today) | 2n | 14 → 12 (-2) · 14 → 14 (0) · 14 → 16 (+2) |
| progress track (4 today) | 2c | 4 → 4 (0) · 4 → 4 (0) · 4 → 4 (0) |
| tabs tab height (height-lg today) | 4n | 36 → 24 (-12) · 36 → 28 (-8) · 36 → 32 (-4) |

Badge (no size axis, at its context n, md): height 18 → 14 (-4) by 2n; inline padding 8.75 → 4
(-4.75) by 2c; radius 9 → 3.5 (-5.5) by n/2; type 13 → 11 (-2), field label.

Who moves at the default md, read off the rows above and below (lg adds the -4 height row
wherever a control has a size axis), and the clause 10b lane that moves it. Every row moves at
the W6 cut for default pages, and earlier inside opt-in regions as its lane lands:

| control | moves at md (px) | lane |
|---|---|---|
| button, toggle | radius 0 (the pill) · icon -4 · icon-side padding +2 · type -1 | 3b |
| text-field, select, combo-box, multi-select, otp-field | inline padding -7 · radius -5 · icon or caret box -4 (caret becomes a 10px glyph) · type -1 | 3a |
| checkbox | box -2 · check +0.4 | 3c |
| radio | box -2 · dot -2.96 | 3c |
| switch | box -2 · thumb -2 · track width -4.8 | 3c |
| slider | box -2 | 3c |
| badge | height -4 · padding -4.75 · radius -5.5 · type -2 | 3d |
| avatar | 0 (4n, ruled at step 0; -14 under the skill's 2n) | 3d |
| menu | item rows +6 · panel padding 6 → 2 · panel radius -3 | 3e |
| select listbox | padding -5 · option radius +2 · panel radius -3 | 3a |
| segmented-control | padding +2 | 3b |
| table | row +3 · cell padding +1 | 3f |
| tabs | tab -8 (36 → 28) | 3e |
| nav-rail items, calendar cells, pagination stops | height 0 · icon -4 where an icon sits | 3e, 3b |
| card, modal, drawer | text inset +3 inline, +9 block · region gap +8 · radius +9 | 4a |
| popover | padding +2 · radius +2 | 4a |
| toast | padding +2 inline, +6 block · gap -1 · radius +2 | 4a |
| tooltip | padding +1 · radius -3 | 4a |
| progress | 0 | 3c |

Containers at the root md (n 7, c 2):

| quantity | rule | today → derived (delta) |
|---|---|---|
| card / modal text inset, inline (region margin 6 + pad 12) | card margin 3n | 18 → 21 (+3) |
| card / modal text inset, block (6 + 6) | card margin 3n | 12 → 21 (+9) |
| card region gap (6) | card gutter 2n | 6 → 14 (+8) |
| card content child rhythm (`--ui-box-gap` 8) | card gutter 2n | 8 → 14 (+6) |
| card / modal radius (corner-base 12) | card radius 3n | 12 → 21 (+9) |
| popover padding (space-md 12) | widget margin 2n | 12 → 14 (+2) |
| popover radius (12) | widget radius 2n | 12 → 14 (+2) |
| toast padding inline (12) | widget margin 2n | 12 → 14 (+2) |
| toast padding block (8) | widget margin 2n | 8 → 14 (+6) |
| toast gap (8) | widget gutter n | 8 → 7 (-1) |
| tooltip padding (space-sm 8) | group margin n + c | 8 → 9 (+1) |
| tooltip radius (12) | group radius n + c | 12 → 9 (-3) |
| listbox padding (menu 6, select h/4 7) | c | 7 → 2 (-5) |
| listbox panel radius (12) | group radius n + c | 12 → 9 (-3) |
| listbox option radius (select 12 - h/4 = 5) | n | 5 → 7 (+2) |
| bar inline inset (`--ui-bar-inline-inset` 24) | layout margin 4n | 24 → 28 (+4) |

`--md-sys-space-*` alias at n 7: `xs` 4 → 2 (-2) · `sm` 8 → 7 (-1) · `md` 12 → 9 (-3) · `lg` 16 → 14
(-2) · `xl` 24 → 21 (-3) · `2xl` 32 → 28 (-4).

`ui-text`, today (ADR-0078 cl.2 and cl.2b at scale 1) against derived at n 6 / 7 / 8:

| variant | skill role | today → derived (delta), sm · md · lg |
|---|---|---|
| `display` | display | 36 → 27 (-9) · 45 → 32 (-13) · 57 → 36 (-21) |
| `headline` | heading | 24 → 21 (-3) · 28 → 24 (-4) · 32 → 27 (-5) |
| `title` | title | 14 → 13 (-1) · 16 → 15 (-1) · 22 → 17 (-5) |
| `body` | body | 12 → 13 (+1) · 14 → 14 (0) · 16 → 15 (-1) |
| `label` | field label | 11 → 10 (-1) · 12 → 11 (-1) · 14 → 12 (-2) |
| `kicker` | section kicker | 11 → 15 (+4) · 12 → 16 (+4) · 14 → 17 (+3) |
| `overline` | group kicker | 11 → 9.5 (-1.5) · 12 → 10 (-2) · 14 → 10.5 (-3.5) |
| `lead` | subhead | 16 → 17 (+1) · 18 → 18 (0) · 22 → 20 (-2) |
| `quote` | subhead | 16 → 17 (+1) · 18 → 18 (0) · 22 → 20 (-2) |

The rejected root product/md, the same quantities at md: height 28 → 36 (+8) · icon box 18 → 18
(0) · glyph box 14 → 12 (-2) · control type 14 → 15 (+1) · body 14 → 16 (+2) · button radius (pill) 14 → 18
(+4) · card margin 18 → 27 (+9) · card radius 12 → 27 (+15).

The A2UI canvas register product/md (ruled at step 0), size sm / md / lg: height 28 / 36 / 44 ·
icon box 14 / 18 / 22 · glyph box 10 / 12 / 16 · control type 13 / 15 / 17 · button radius (pill)
14 / 18 / 22.

## Amendment 1 (2026-10-13, T-0117): the `kicker` variant reads the field-label role

Kim's screenshot of the docs nav after the cut showed the group labels (Feed & status, Typography & media
primitives) shouting and wrapping. Cause: clause 7 mapped `kicker` to the section-kicker role, so the
variant and every `--md-sys-typescale-kicker-*` consumer (nav-rail group labels, gauge and select
captions, status-stream and card-header labels) went from 11 / 12 / 14px to 15 / 16 / 17px. Those readers
are small uppercase labels over a group, not eyebrows above a heading.

Ruling: the `kicker` variant and the bridge's `--md-sys-typescale-kicker-*-size` rows derive from the
field-label role (n + 4 at n; 10 / 11 / 12px at n 6 / 7 / 8). Weight (400) and tracking (0.2em) stay as
Kim's GH #370 ruling. The section-kicker role (`--md-sys-type-section-kicker`) stays derived and named
for a future eyebrow consumer; no stylesheet reads it today. The `kicker` row of Appendix B now reads
`11 → 10 (-1) · 12 → 11 (-1) · 14 → 12 (-2)`, the same as `label`; the original row above is left as
written. The lg step lands 2px under today's 14px, the same delta `label` already carries.

## Amendment 2 (2026-10-13, T-0119): the A2UI canvas register is widget at scale md

Kim, 2026-10-13: the A2UI surface root uses `data-tier="widget" data-scale="md"`, not product/md with
hand-shifted stamps. "The scale shifts down one whole step so 32 will be 28, which is fine for widget cards."

Cause: step 0 ruling 2 put the canvas at product/md (28 / 36 / 44) so a widget action at md stayed 36px. To
hold the rendered px, the cut then stamped every A2UI size one step down (the persona action rows `lg` to
`md`, BookingForm's Reserve, inputs and select `md` to `sm`, and an unsized catalog Button created at `sm`),
so a factory's size no longer meant what it said on a canvas.

Ruling: the renderer's surface root carries `data-tier="widget"` and `data-scale="md"` (each only when the root
does not already name it). Widget/md is the same n as the page root (n 6 / 7 / 8), so on a canvas sm / md / lg
read height 24 / 28 / 32 · icon box 12 / 14 / 16 · glyph box 8 / 10 / 12 · control type 12 / 13 / 14 · button
radius (pill) 12 / 14 / 16, and the card levels at md are margin 21, gutter 14, radius 21 with body type 14.
The cut's step-down stamps revert: the persona action rows and CardTable's chips, stake and Clear are `lg`
(32px), BookingForm's Reserve is `md` and its fields take the default `md` (28px), the date picker buttons stay
`sm`, and an unsized catalog Button is created with no size, so it reads `md` (28px). This supersedes the
clause 2 bullet "A2UI surfaces sit at `data-scale="md"`", step 0 ruling 2, the clause 10b W5 row's
parenthetical and Appendix B's closing canvas paragraph, all left above as written. Clause 2's
catalog-invisible rule and clause 8's zero prompt bytes stand: no catalog row or payload names the register.

## Amendment 3 (2026-10-13, T-0120): the skill's v2 constants, density on m, M14, the section and group labels, and the derived exceptions

The skill owner published a v2 of `mathematical-design-system` on 2026-10-13 and took in agent-ui's peer review
the same day: `scale.mjs` now carries `data-density` and the container unit m, a 9px type floor, one ladder of
levels (chip, control, group, widget, card, page), the component sizes under `parts`, the control rule, and the
contract M11 to M16. Kim's rulings, 2026-10-13: take the new `scale.mjs` byte for byte, tier anchors included,
and accept the one-step shrink of every control; rename the kicker roles to section label and group label, with
`ui-text`'s `kicker` kept as an alias; add the monotonic contract and make the radio dot the glyph minus 2;
derive the hand-set exceptions; keep separate scaling laws for controls, content and type (no change); accept
the half-pixel group label. This amendment supersedes the parts of the body named below; the body and its
appendices stay as written.

1. **The v2 constants, byte for byte.** `packages/agent-ui/shared/src/tokens/scale.mjs` and
   `../references/foundations-derivation/scale.mjs` are the skill's v2 copy (sha256 `3c319761…6057ba5b`, its
   07:51 revision, the one that answers the peer review). The cut's copy (sha256 `eca32879…a3fb8f4d9`) stays
   beside it as `scale-v1.mjs`, so `derive.mjs` still prints the body's tables (its sections 1 to 10) and
   prints this amendment's from v2 (sections 11 to 17 of `derive.out.md`). The anchors moved one n down: widget
   6/1/1/0, product 8/2/2/1, content 10/2/2/1, brand 14/2/2/1, ladder n 4 to 24. Linear type never goes below
   9px (field label and group label are held there at n 4), and the generator's `lin()` carries the same
   `max(9px, …)`. `resolve()` renamed its keys (`inset` and `radius` are `control.margin` and
   `control.radius`, `layout` is `page`); the tokens keep their ADR-0140 names, `--md-sys-inset`,
   `--md-sys-radius` and `--md-sys-layout-*`.
2. **The root shrinks one step.** The root stays product at scale sm, now n 5 / 6 / 7: heights 24 / 28 / 32
   become **20 / 24 / 28**. The title's "the library root keeps 24 and 28 while lg moves to 32" and clause 2's
   root table describe v1. The A2UI canvas (widget at scale md, Amendment 2) keeps the root's n, so Amendment
   2's numbers re-derive with it: on a canvas sm / md / lg read height 20 / 24 / 28 (was 24 / 28 / 32) · icon
   box 10 / 12 / 14 · glyph box 6 / 8 / 10 · control type 11 / 12 / 13 · button radius (pill) 10 / 12 / 14, and
   the card levels at md are margin 18, gutter 12, radius 18 with body type 13. The stamps Amendment 2 restored
   keep their sizes: the persona action rows and CardTable's chips, stake and Clear are `lg` (28px),
   BookingForm's Reserve and fields are `md` (24px), its date picker buttons `sm` (20px), and an unsized
   catalog Button reads `md` (24px). Product/md now reads 24 / 32 / 40. Every default golden and every literal
   pin moves with the root.
3. **`[density]` maps to `data-density`, not `data-scale`** (supersedes clause 2's "`[density]` retires into
   `data-scale`" bullet and the clause 10a bridge line). Density moves container spacing only:
   `m = max(n + a·d, floor((n + c)/2) + 1)` with d = -1 / 0 / +1 for compact / default / spacious. The
   widget, card and layout levels read m; the group level and every control value keep n. The generator emits
   the input `--md-sys-density-d` on `[data-density]`, the token `--md-sys-m`, and adds `[data-density]` to the
   recompute list; the bridge maps `[density="compact"]` and `[density="spacious"]` onto the same input. At the
   root md (n 6): compact m 5 (card 15 / 10 / 15), default m 6 (18 / 12 / 18), spacious m 8 (24 / 16 / 24).
4. **M14: no size that depends on n alone shrinks as n grows.** Kim's rule (asked for as "M11") is the skill's
   own M14 since the peer review, beside its M11 (gutter plus label margin equals the control margin), M12 (a
   label-only control is at least 4n wide), M13 (margins nest at every density), M15 and M16. It runs inside
   `check()` on every n in the ladder, over every size `resolve()` returns and its `parts`. agent-ui keeps no
   contract of its own: `scripts/generate-foundations.mjs` refuses to emit when `check()` returns any failure,
   and `foundations.test.ts` pins the vendored sha, so a re-vendor is a deliberate one-line change. **The radio
   dot becomes `glyph - 2` (2n - 2c - 2, `parts.radioDot`)**: the old 2n - 4c stepped down each time c stepped
   up (4 to 2 at n 4 to 5, 8 to 6 at n 8 to 9, 12 to 10 at n 12 to 13), which M14 forbids.
5. **Section label and group label.** `--md-sys-type-section-kicker` is renamed `--md-sys-type-section-label`
   and `--md-sys-type-group-kicker` is renamed `--md-sys-type-group-label`, the skill's own names since the peer
   review (`type.sectionLabel`, `type.groupLabel`). `ui-text`'s `kicker` variant becomes an alias that reads the group label,
   like `overline` (supersedes Amendment 1's field-label mapping); the bridge's `--md-sys-typescale-kicker-*-size`
   rows follow. At the root the kicker reads 9 / 9.5 / 10 (was 10 / 11 / 12 under Amendment 1 at v1).
6. **The exceptions derive** (supersedes clause 3's deviations list and the Step 0 rulings 3 and 4 as
   exceptions; their pixels stand or move only with n):

   | quantity | was | now | root md, v1 → v2 |
   |---|---|---|---|
   | button and toggle radius | the pill as the h/2 special case | `2n` (`--ui-{button,toggle}-radius`) | 14 → 12 |
   | `ui-avatar` | the 4n deviation | a `4n` circle; `2n` when seated inline in a tag or a control row (no fleet consumer yet) | 28 → 24 |
   | gauge ring stroke | `0.5rem` | `4c` | 8 → 8 |
   | swatch box | `2rem` | the icon tile, a `4n` square with radius `n` | 32 → 24 |
   | A2UI artboard padding and gap | `--md-sys-space-lg` / `-md` (16 / 12 before the cut) | the card level, `3m` / `2m` | 14 / 9 → 18 / 12 |
   | column-chart top segment radius | `0.75rem`, pinned | the group radius `n + c` | 12 → 8 |

   Each keeps its `var(<derived>, <today>)` fallback, so `data-foundations="legacy"` still renders today's value.
   ADR-0036 and the slider rule stand.
7. **Not adopted here** (each a separate decision; `derive.out.md` section 17 has the px):
   - **The skill's control rule** (margin n, gutter c, label margin n - c, text edge 2n - c). It would move
     every control's text edge: entry and trigger controls, menu and listbox rows and tabs from n to 2n - c
     (5 / 6 / 7 to 8 / 10 / 12 at the root, +3 / +4 / +5), and button, toggle and segment labels from 2n to
     2n - c (10 / 12 / 14 to 8 / 10 / 12, -2).
   - **Badge height 2n + 2c** (the fleet keeps 2n: 12 against 16 at the root md) and **checkbox and badge radius
     ceil(n/2)** (the fleet keeps n/2: 2.5 against 3 at sm, 3.5 against 4 at lg).
   - **The chip level** (tag, badge, kbd) and the reserved levels (tray, lane, shell): no token is generated.

The root controls, v1 → v2 at sm · md · lg (`derive.out.md` section 13):

| quantity | rule | v1 → v2 (delta), sm · md · lg |
|---|---|---|
| height, avatar, swatch tile (4n) | 4n | 24 → 20 (-4) · 28 → 24 (-4) · 32 → 28 (-4) |
| inset, gap, field radius (n) | n | 6 → 5 (-1) · 7 → 6 (-1) · 8 → 7 (-1) |
| c | ceil(n/4) | 2 → 2 (0) · 2 → 2 (0) · 2 → 2 (0) |
| icon box, indicator box, badge height (2n) | 2n | 12 → 10 (-2) · 14 → 12 (-2) · 16 → 14 (-2) |
| glyph box, checkbox check, switch thumb | 2n - 2c | 8 → 6 (-2) · 10 → 8 (-2) · 12 → 10 (-2) |
| button / toggle pill radius | h/2 → 2n | 12 → 10 (-2) · 14 → 12 (-2) · 16 → 14 (-2) |
| button label padding | 2n | 12 → 10 (-2) · 14 → 12 (-2) · 16 → 14 (-2) |
| checkbox radius | n/2 | 3 → 2.5 (-0.5) · 3.5 → 3 (-0.5) · 4 → 3.5 (-0.5) |
| switch track width | 2 thumb + 2c | 20 → 16 (-4) · 24 → 20 (-4) · 28 → 24 (-4) |
| field label gap | ceil(n/2) | 3 → 3 (0) · 4 → 3 (-1) · 4 → 4 (0) |
| table row | 4n + 2c | 28 → 24 (-4) · 32 → 28 (-4) · 36 → 32 (-4) |
| table text cell padding, tooltip padding (group margin) | n + c | 8 → 7 (-1) · 9 → 8 (-1) · 10 → 9 (-1) |
| glyph stroke | max(1.5, c/2) | 1.5 → 1.5 (0) · 1.5 → 1.5 (0) · 1.5 → 1.5 (0) |
| control type | n + 6 | 12 → 11 (-1) · 13 → 12 (-1) · 14 → 13 (-1) |
| body | n + 7 | 13 → 12 (-1) · 14 → 13 (-1) · 15 → 14 (-1) |
| title | body + 0/1/2 | 13 → 12 (-1) · 15 → 14 (-1) · 17 → 16 (-1) |
| field label (`label`) | n + 4 | 10 → 9 (-1) · 11 → 10 (-1) · 12 → 11 (-1) |
| group label (`overline`, table header) | n/2 + 6.5 | 9.5 → 9 (-0.5) · 10 → 9.5 (-0.5) · 10.5 → 10 (-0.5) |
| section label | round(body · 9/8) | 15 → 14 (-1) · 16 → 15 (-1) · 17 → 16 (-1) |
| subhead (`lead`, `quote`) | round(body · Q) | 17 → 15 (-2) · 18 → 17 (-1) · 20 → 18 (-2) |
| heading (`headline`) | round(body · Q²) | 21 → 19 (-2) · 24 → 21 (-3) · 27 → 24 (-3) |
| display | round(body · Q³) | 27 → 23 (-4) · 32 → 27 (-5) · 36 → 32 (-4) |
| radio dot | 2n - 4c → glyph - 2 | 4 → 4 (0) · 6 → 6 (0) · 8 → 8 (0) |
| `kicker` variant | field label (Amendment 1) → group label | 10 → 9 (-1) · 11 → 9.5 (-1.5) · 12 → 10 (-2) |

The containers and the space alias at the root md, v1 (n 7) → v2 (n 6, m 6) (`derive.out.md` section 14):

| quantity | rule | v1 → v2 (delta) |
|---|---|---|
| group margin | n + c | 9 → 8 (-1) |
| group gutter | c | 2 → 2 (0) |
| group radius | n + c | 9 → 8 (-1) |
| widget margin | 2n → 2m | 14 → 12 (-2) |
| widget gutter | n → m | 7 → 6 (-1) |
| widget radius | 2n → 2m | 14 → 12 (-2) |
| card margin | 3n → 3m | 21 → 18 (-3) |
| card gutter | 2n → 2m | 14 → 12 (-2) |
| card radius | 3n → 3m | 21 → 18 (-3) |
| layout margin | 4n → 4m | 28 → 24 (-4) |
| layout gutter | 3n → 3m | 21 → 18 (-3) |
| layout radius | 4n → 4m | 28 → 24 (-4) |
| `--md-sys-space-xs` | c | 2 → 2 (0) |
| `--md-sys-space-sm` | n | 7 → 6 (-1) |
| `--md-sys-space-md` | n + c | 9 → 8 (-1) |
| `--md-sys-space-lg` | 2n → 2m | 14 → 12 (-2) |
| `--md-sys-space-xl` | 3n → 3m | 21 → 18 (-3) |
| `--md-sys-space-2xl` | 4n → 4m | 28 → 24 (-4) |

Repairs in the same change: `geometry.md`, `geometry-sizing-spec.md`, `tokens.md`, `naming.md` §12,
`dimensional-standard.md`, the `component-standards` skill, `CLAUDE.md`'s ramp line, the `avatar`, `radio`,
`swatch` and `text` descriptors, the sizing page lead and the canvas comment in `action-row.ts`. Every test that
pins a v1 pixel is re-pinned by its census lane.

## Amendment 4 (2026-10-13, T-0122): the skill's control rule, the chip level, the badge height and the rounded-up radii

Kim's ruling, 2026-10-13: adopt next what Amendment 3 point 7 left out, after T-0120 moved the anchors. `scale.mjs`
is unchanged (sha256 `3c319761…6057ba5b`, still the skill's copy): it already carries `control.margin`,
`control.gutter`, `labelMargin`, the `chip` level and `parts.*`, and this amendment changes what the fleet reads
from them. It supersedes Amendment 3 point 7's first three bullets, clause 3's `button, toggle`, `badge` and
`checkbox` rows, the `2n` segment padding of its `segmented-control` row and the "gap n" of its `all controls`
row; the body and its appendices stay as written.

1. **The control rule: one geometry for every control, whatever it holds.** The box margin is `n`
   (`--md-sys-inset`) on every inline edge, the gutter is `c` (`--md-sys-c`), and the text slot (label, value or
   editor) carries the **label inset** `n - c` on each inline side, the new token `--md-sys-label-inset`.
   Gutter plus inset equals the margin, so an icon sits `n` from the edge and `n` from the text, and the text edge
   is `n + (n - c) = 2n - c`: **8 / 10 / 12 at the root sm / md / lg** (12 at n 7), where it was `2n` on a button,
   toggle and segment and `n` on a field. An icon, caret, tick cell or any other boxed item carries no inset and
   stays pinned to its edge. A control is never narrower than `4n`: a label-only control is `4n - 2c` plus its
   text, so the floor binds only under `2c` of text. The explicit floor (`min-inline-size`, the ADR-0223 R3(a)
   form) sits on `ui-button` (as before), the `ui-text-field`, `ui-select` and `ui-combo-box` hosts and
   `ui-tab` (with `flex-shrink: 0`, so the strip still scrolls whole labels, GH #221). **`ui-toggle` and
   `ui-segment` take no explicit floor**: it would replace the automatic content minimum of a flex or grid
   item, and their anonymous nowrap labels cannot clip, so a tight row would push the text out of the box.
2. **Where the inset sits.** On the text slot where the control has one; where the label is anonymous host
   content the host edge beside it carries margin plus inset and the icon to text gap is written `n` (`c` plus
   the inset), the same pixels. No wrapper is added: that is a parts contract change (`toggle.md` rules
   `parts: []`).

   | control | the text slot | how it is written |
   |---|---|---|
   | `ui-button` | `[data-part="label"]` | host padding `n`, column-gap `c`, label padding `n - c` |
   | `ui-text-field`, `ui-textarea` | `[data-part="editor"]` | host padding `n`, column-gap `c`, editor padding `n - c` |
   | `ui-select` trigger | `[data-part="label"]` | trigger padding `n`, column-gap `c`, label padding `n - c` |
   | `ui-combo-box` | the editor, frame and slot in one | editor padding `n + (n - c)` |
   | `ui-toggle`, `ui-segment`, `ui-tab` | anonymous label | the label edge of the host is `n + (n - c)`; icon to text `n` |
   | menu rows, select and combo-box option rows | anonymous label | row padding `n + (n - c)`; a menu check box sits at `n`, then `n` to the text |
   | `ui-multi-select` rows | anonymous label | tick cell at `n`, `n` to the text, trailing edge `n + (n - c)` |

   A toolbar item is the button inside the bar: `ui-toolbar` itself does not change. `ui-otp-field`'s cells hold
   one centered character and take no inset.
3. **Action labels align per the skill's table**, with its three selectors on the label and no `:has()`:
   centered alone or between leading and trailing content, start with only trailing content
   (`:first-child:not(:only-child)`), end with only leading content (`:last-child:not(:only-child)`). `ui-button`
   reads them on its label part (the same pixels as ADR-0171's spread, written without `:has()`; the grid template
   keeps its `:has()` rules, which only choose the tracks). A value or row label is start-aligned. A tab, segment
   and badge label has nothing beside it and stays centered. **`ui-toggle` keeps its centered label**: its label
   is anonymous content, `toggle.md` rules no wrapper and no edge spread, and without a label element there is
   nothing for the three selectors to match. That is a recorded deviation from the table's "only leading content:
   end" row, not an oversight.
4. **Rulings this supersedes.**
   - **GH #536, zero inline padding on a tab.** A tab is a control: it carries `2n - c` on each inline side and
     the `4n` floor, and the tabs then touch with the tight gutter: `--ui-tabs-strip-gap` is `c` (it was
     `xs + md`, the spacing #536 moved onto the gap). Label to label is `4n - c`: 10 to 22 at the root md.
     The agent-admin settings strip shortens its two long labels to `System` and `Dialog` for it (the full
     `Context: …` names stay the segment names, the accessible names and the tooltips).
   - **"Option text lines up under the trigger text"** (`select.css`, `combo-box.css`) holds, by the
     placement rule (Kim, 2026-10-13): a row is a control with its own margin and inset, and the listbox is
     a group, so the panel sits at offset = group margin - control margin = `c` outside the trigger on each
     side (`--ui-select-listbox-outset`, `--ui-combo-box-panel-outset`; a `translate`, since the overlay
     controller owns the insets and the margin). `c + (2n - c) - c = 2n - c`: the two text edges share one
     x. A select panel's floor is the trigger width plus `2c`.
   - **`menu.css`'s own item-pad register.** A menu row reads the control rule like every other row.
5. **The chip level.** The generator emits `--md-sys-chip-margin` (`c`), `--md-sys-chip-gutter` (`c`) and
   `--md-sys-chip-radius` (`ceil(n/2)`). `ui-badge` is a chip: height **`2n + 2c`** (`parts.badge`, 12 to 16 at
   the root md), the 2n icon size plus a c ring; host margin `c` and label margin `c`, so the text edge stays
   `2c`; the glyph `2n - 2c` sits `c` inside its 2n mark box, with the gutter `c` and the label margin after it;
   radius `ceil(n/2)`. The fleet has no tag or kbd control yet; the reserved levels (tray, lane, shell) still
   have no token.
6. **Checkbox and badge radius are `ceil(n/2)`** (`parts.checkboxRadius`, the chip radius token): 2.5 to 3 at the
   root sm, 3.5 to 4 at lg, 3 at md unchanged. A half pixel never reaches a corner.
7. **The legacy opt-out holds.** Every new read keeps the `var(<derived>, <today>)` form: under
   `data-foundations="legacy"` the label inset is 0, a label edge is h/2, a tab has no padding and the #536 gap,
   and the badge is the 18px compact box with the pill radius.
8. **Gates.** `foundations.test.ts` pins the new names and their `initial` lines in the bridge, and
   `foundations.browser.test.ts` reads `label-inset` and the chip level in all 36 cells against `resolve()`.
   `scripts/foundations-probe.mjs` rules a text slot's inset beside the host margin (`pill`, `frame`, `trigger`,
   `multiline`), splits the toggle into `barePill` (margin plus inset on the host), moves `segment` to `2n - c`
   and the checkbox radius to `ceil(n/2)`. `controls/control-rule.browser.test.ts` measures every control above,
   outside any region and inside one, in both engines: the text edge, the icon edge, icon to text, the `4n`
   floor where one is set, the alignment table and the legacy opt-out. The census counts the new tokens as derived.
9. **Not adopted here.** The skill subtracts a border from the margin; the fleet still writes padding equal to the
   rule and draws its 1px border outside it, so a text edge measured from the outer edge is `2n - c + 1`
   (unchanged practice, clause 3 notwithstanding). The toggle's alignment is item 3 above.

The px that move, at the root sm · md · lg (`derive.out.md` section 18 has every row):

| control | quantity | rule, before → after | sm · md · lg |
|---|---|---|---|
| button, toggle, segment | label text edge | 2n → 2n - c | 10 → 8 (-2) · 12 → 10 (-2) · 14 → 12 (-2) |
| text-field, textarea, select trigger, combo-box | value edge | n → 2n - c | 5 → 8 (+3) · 6 → 10 (+4) · 7 → 12 (+5) |
| select and combo-box option rows | text edge, from the row edge | n - c → 2n - c | 3 → 8 (+5) · 4 → 10 (+6) · 5 → 12 (+7) |
| multi-select row | tick cell edge | n - c → n | 3 → 5 (+2) · 4 → 6 (+2) · 5 → 7 (+2) |
| menu row | text edge | n + c → 2n - c | 7 → 8 (+1) · 8 → 10 (+2) · 9 → 12 (+3) |
| menu check row | check box edge · box to text | n + c → n · c → n | 7 → 5 (-2) · 8 → 6 (-2) · 9 → 7 (-2), then 2 → 5 (+3) · 2 → 6 (+4) · 2 → 7 (+5) |
| tab | text edge | 0 → 2n - c | 0 → 8 (+8) · 0 → 10 (+10) · 0 → 12 (+12) |
| tab strip | label to label | n + 2c → 4n - c | 9 → 18 (+9) · 10 → 22 (+12) · 11 → 26 (+15) |
| every control with an icon | icon edge, icon to text | n → n | 5 → 5 (0) · 6 → 6 (0) · 7 → 7 (0) |
| badge | height | 2n → 2n + 2c | 10 → 14 (+4) · 12 → 16 (+4) · 14 → 18 (+4) |
| badge | text edge · glyph to text | 2c → 2c · n → 3c | 4 → 4 (0) throughout, then 5 → 6 (+1) · 6 → 6 (0) · 7 → 6 (-1) |
| badge, checkbox | radius | n/2 → ceil(n/2) | 2.5 → 3 (+0.5) · 3 → 3 (0) · 3.5 → 4 (+0.5) |

Repairs in the same change: `geometry.md`, `geometry-sizing-spec.md` §4.3 and §4.4, `tokens.md`, `derive.mjs`
section 18, and the `button`, `toggle`, `text-field`, `textarea`, `select`, `combo-box`, `multi-select`, `tabs`,
`menu`, `segmented-control`, `badge` and `checkbox` descriptors. Every test that pins an old edge is listed by
census lane in `.sdlc/control-rule-adoption/repin-list.md` and re-pinned by its lane.

## Amendment 5 (2026-10-13, T-0134): everything pill, and panels nest concentrically

Kim's ruling, 2026-10-13, after dogfooding the A2UI sheets: badges, tags, select and menu read too sharp at the
n 6 root (a 3px badge corner on a 16px chip, a 6px field corner on a 24px field). **Everything pill**: every
single-line control and every chip takes radius h/2, the way button and toggle already did (Amendment 3). The
reason is one shape language across a form: a field, a select, a menu row and a badge beside a pill button
otherwise read as two families. `scale.mjs` is unchanged (sha256 `3c319761…6057ba5b`); the pill is a derived
exception the generator emits beside it, like the button pill. It supersedes clause 3's "radius n" for the
entry and trigger controls and the listbox rows, clause 6's group radius for listbox panels, and Amendment 4
items 5 and 6 where they give the badge `ceil(n/2)`; the body and its appendices stay as written.

1. **The control pill.** The generator emits `--md-sys-control-radius`, `h/2 = 2n` (10 / 12 / 14 at the root
   sm / md / lg). `ui-text-field` (every type, so the date and number fields too), the `ui-select` trigger,
   `ui-combo-box`, the `ui-otp-field` cells (a square 4n cell becomes a circle), and the menu, select,
   combo-box and multi-select rows read it. These pills take circular corners (`corner-shape: round`, the
   button and toggle exception of clause 3): a squircle at h/2 reads as a soft rectangle, not a pill. The
   squircle stays with the radius-n surfaces (attachment, disclosure, the swatch tile).
2. **The chip pill.** `--md-sys-chip-radius` becomes `n + c`, h/2 of the `2n + 2c` chip (7 / 8 / 9). `ui-badge`
   reads it (the tag reading of the one component included). Under the legacy opt-out the badge keeps `box/2`.
3. **Multi-line and container surfaces follow the concentric rule, not h/2.** A `ui-textarea` takes the
   single-line control radius `2n`, so its corners match the field beside it; `ui-code-editor` keeps its
   textarea parity (TKT-0059) and follows. A menu, a select listbox, a combo-box panel and a multi-select take
   their row radius plus the panel's own inset `c`: `2n + c` (12 / 14 / 16), so the pill rows nest
   concentrically. Each control writes it as row radius plus inset, so the legacy opt-out still resolves the
   panel to `--md-sys-shape-corner-base` and the row to corner-base minus the inset, as before. A card and the
   other roomy containers keep their level radius; segmented-control keeps the group radius.
4. **The checkbox stays a rounded square.** It moves off the chip token to its own, `--md-sys-checkbox-radius`,
   `ceil(n/2)` (the skill's `parts.checkboxRadius`, unchanged). Radio and switch are unchanged.
5. **Gates.** `foundations.test.ts` and the census's derived list carry the two new names (and their `initial`
   lines under the legacy opt-out); `foundations.browser.test.ts` reads `control-radius` as `h/2`,
   `chip-radius` as `n + c` and `checkbox-radius` as `parts.checkboxRadius` in all 36 cells.
   `scripts/foundations-probe.mjs` rules `frame`, `trigger`, `cell` and `multiline` at `2n` and `listbox` at
   `2n + c`; its negative controls moved off md, where `2n` equals the legacy 12px corner. The per-control
   foundations browser tests, `control-rule.browser.test.ts` and the three `ui-otp-field` goldens follow.

The px that move, at the root sm · md · lg (`derive.out.md` section 19):

| control | quantity | rule, before → after | sm · md · lg |
|---|---|---|---|
| text-field, select trigger, combo-box, otp-field cell | radius | n → 2n | 5 → 10 (+5) · 6 → 12 (+6) · 7 → 14 (+7) |
| textarea, ui-code-editor | radius | n → 2n | 5 → 10 (+5) · 6 → 12 (+6) · 7 → 14 (+7) |
| menu, select, combo-box and multi-select rows | radius | n → 2n | 5 → 10 (+5) · 6 → 12 (+6) · 7 → 14 (+7) |
| menu, select listbox, combo-box panel, multi-select | radius | n + c → 2n + c | 7 → 12 (+5) · 8 → 14 (+6) · 9 → 16 (+7) |
| badge | radius | ceil(n/2) → n + c | 3 → 7 (+4) · 3 → 8 (+5) · 4 → 9 (+5) |
| checkbox | radius | ceil(n/2), unchanged | 3 · 3 · 4 |

Repairs in the same change: `geometry.md`, `geometry-sizing-spec.md` (the token table and §4.9), `tokens.md`,
`derive.mjs` section 19, and the `text-field`, `textarea`, `select`, `combo-box`, `multi-select`, `otp-field`,
`menu`, `badge`, `checkbox` and `code-editor` descriptors. The skill proposal is P13 in
`.sdlc/mathematical-design-system-review.md`.

## Amendment 6 (2026-10-13, T-0138): OTP round squares, the pill segmented control, and icon versus glyph sizing

Kim's rulings, 2026-10-13, from the T-0137 dogfood design review (sharp badges and a rectangular icon button
caught by eye). Square entry cells are not pills, a segmented control is one more single-line control, and an
icon and a glyph are two different things that the system must keep apart. `scale.mjs` and the generator are
unchanged (sha256 `3c319761…6057ba5b`). It supersedes Amendment 5 item 1 for the `ui-otp-field` cell and the
"segmented-control keeps the group radius" sentence of Amendment 5 item 3; clause 4's 2n icon box now holds
inside a control cell and an explicit `[data-tier]` region only. The body and its appendices stay as written.

1. **OTP cells are round squares.** A `ui-otp-field` cell is a square 4n entry box, and at h/2 it read as a
   circle (a stepper dot or a password bullet, not a box to type into). The cell takes the radius-n round
   square, `--md-sys-radius`, with the squircle corner (`--md-sys-corner-shape`), the shape of an icon-only
   square. The fixed entry corner stays the legacy opt-out fallback.
2. **The segmented control is a pill track with a concentric thumb.** The track is the segment height 4n plus
   the track padding c on each side, so its pill is `2n + c` (`--md-sys-control-radius` plus `--md-sys-c`), and
   the moving thumb, inset c, takes `2n`, the same pill as a button. Circular corners, like every pill. Under the
   legacy opt-out the track keeps the corner base and the thumb the corner base minus its 1px inset.
3. **An icon and a glyph are two things.**
   - A **glyph** is a functional mark: `+`, minus, the carets, the ticks, the game HUD and result card stat
     marks, the board corner marks. It always sits in its own glyph box `2n - 2c` (6 / 8 / 10 at the root sm /
     md / lg), anywhere it appears, and `--md-sys-glyph-box` stays declared on `:root`. A mark beside a label is
     separated from it by the chip gap n, never by c.
   - An **icon** is pictorial pack art. Inside a control cell (a button, toggle, field, select or row slot) it
     is the 2n icon box, which the control sizes through its own slot rule. Anywhere else a standalone
     `ui-icon` follows the surrounding text, `1em`, so an explicit `font-size` or `inline-size` on it or its
     parent is honoured. Inside an explicit `[data-tier]` region (an A2UI surface, a demo region) a standalone
     icon keeps the 2n box of that region's n.
   - The mechanism lives in `icon.css`, not the generator: `--md-sys-icon-box` stays on `:root`, because about
     25 control sheets size their own boxes from it (checkbox, radio, switch, slider, badge, rating and the
     button, toggle, field and select icon cells). `ui-icon` defaults to `1em` and reads `--md-sys-icon-box`
     only under a `[data-tier]` ancestor; a control cell still wins by its slot rule's specificity.
4. **Kept as is.** The full-width toggle's centred label (Amendment 4 item 3) stays.
5. **Gates.** `scripts/foundations-probe.mjs` rules the `cell` class at radius n; the `ui-otp-field`
   foundations test and goldens, the segmented-control foundations test (track `2n + c`, thumb `2n`), the
   icon foundations test (a standalone icon outside a region is `1em`), and the game HUD, result card and board
   grid tests follow.

The px that move, at the root sm · md · lg:

| control | quantity | rule, before → after | sm · md · lg |
|---|---|---|---|
| otp-field cell | radius | 2n → n | 10 → 5 · 12 → 6 · 14 → 7 |
| segmented-control track | radius | n + c → 2n + c | 7 → 12 · 8 → 14 · 9 → 16 |
| segmented-control thumb | radius | n → 2n | 5 → 10 · 6 → 12 · 7 → 14 |
| standalone ui-icon, no region | size | 2n → 1em | 10 · 12 · 14 → the text size |
| game-hud and result-card stat glyph | size | 0.6em → 2n - 2c | → 6 · 8 · 10 |
| game-hud and result-card stat glyph | gap to label | c → n | 2 → 5 · 2 → 6 · 2 → 7 |
| board-grid corner glyph | box, inset | label type, 3px / 1px → 2n - 2c, c | → 6 · 8 · 10, inset 2 |

Repairs in the same change: `geometry.md` and `geometry-sizing-spec.md` (the icon box rows), and the
`otp-field`, `segmented-control`, `icon`, `glyph`, `game-hud`, `result-card` and `board-grid` descriptors. The
skill proposal is P14 in `.sdlc/mathematical-design-system-review.md`.

## Amendment 7 (2026-10-13, T-0143): a 3:1 field outline, the 8px glyph floor, and what stays

Kim's rulings, 2026-10-13, after the T-0137 dogfood review. Entry fields read as faint stripes on the page,
and at the n 5 root the 6px glyph box made `dot`, `more` and `info` illegible. It supersedes Amendment 6 item
3's "6 / 8 / 10" glyph sizes at sm; the body, its appendices and Amendments 1 to 6 stay as written.

1. **One 3:1 field-boundary outline.** `--md-sys-color-neutral-field-outline` is a new opaque role,
   `light-dark(neutral-550, neutral-500)`, the lightest neutral steps that hold at least 3:1 against every
   surface plane in both schemes (3.15:1 light, 3.11:1 dark at the worst plane; SC 1.4.11). The generated
   `--md-sys-color-neutral-outline` is a translucent scrim that composites to about 1.7 to 2.5:1, so no alpha can
   pass. It is the resting and hover border of `ui-text-field`, the `ui-select` trigger and `ui-combo-box`, and
   now also of every `ui-otp-field` cell (empty and filled) and `ui-textarea`, which had no idle border. Focus
   keeps the transparent border under the ring, and disabled keeps no border. Popup panels and listboxes keep
   `outline-variant`: they are containers, not entry boundaries.
2. **The glyph box floors at 8px.** `--md-sys-glyph-box` is `max(8px, 2n - 2c)`. `scale.mjs` carries the floor
   as `CFG.glyphFloor` (the vendored file now differs from the revision it vendored, `3c319761…`, by this one constant; its sha moves to
   `19355c7a…9222b37`, and P15 asks the skill to adopt it), so `resolve().glyph` and every test pinned against
   it follow. `ui-glyph` centres the glyph box in its 2n slot (inset `(2n - glyph box) / 2`), so the inset is
   1px instead of c where the floor binds. md and lg are unchanged. The radio dot stays `2n - 2c - 2`, the
   switch thumb and the slider thumb keep their own sizes.
3. **Kept as is.** The slider thumb and rail. An icon inside a `[data-tier]` region stays 2n (Amendment 6
   item 3). agent-admin's uppercase provider headings stay: GH #727, which asked to drop them, is superseded by
   this ruling (recorded here; the issue itself is not commented on).
4. **Gates.** `tokens.test.ts` pins the field outline at 3:1 on all seven planes in both schemes, with the
   generated `-outline` as the failing negative control; `field-outline.browser.test.ts` measures the idle frame
   of all five fields in both schemes; `foundations.test.ts` pins `max(glyphFloor, 2n - 2c)` across every rung;
   the glyph-box consumers re-pin from `resolve()`.

The px that move, at the root sm · md · lg (`derive.out.md` section 20):

| control | quantity | rule, before → after | sm · md · lg |
|---|---|---|---|
| glyph box (ui-glyph mark, the carets of button, select and disclosure, the checkbox check and dash, the badge, choice-card, board-grid, game-hud and result-card marks, and the multi-select, form-popover, status-stream and timeline-item marks) | size | 2n - 2c → max(8, 2n - 2c) | 6 → 8 · 8 · 10 |
| ui-glyph | inset | c → (2n - glyph box) / 2 | 2 → 1 · 2 · 2 |
| text-field, select trigger, combo-box | idle and hover border | neutral-outline (scrim 60%) → field-outline | about 2:1 → at least 3:1 |
| otp-field cell, textarea | idle border | transparent (otp filled: outline-variant) → field-outline | none → at least 3:1 |

Repairs in the same change: `tokens.md` (the role vocabulary), `geometry.md` and `geometry-sizing-spec.md` (the
glyph box rows), `derive.mjs` (section 20; sections 13 and 16 keep the unfloored glyph they recorded), and the
`glyph`, `text-field`, `textarea` and `otp-field` descriptors. The skill proposals are P15 (the glyph floor) and
P16 (the 3:1 field outline) in `.sdlc/mathematical-design-system-review.md`.
