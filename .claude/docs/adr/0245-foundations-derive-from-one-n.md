# ADR-0245 — Foundations derive from one n: tier, scale and size choose n per element, controls, containers and type are formulas over it, icon and glyph get separate boxes, and the library root keeps 24 and 28 while lg moves to 32

> Source: agent-ui ADR log (this directory, the numbered files ARE the index; status lives in each ADR's own header). · 2026-10-12
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-10-12 |
> | **Proposed by** | the sdlc-lite solo run `math-foundations-adr` (design spike T-0091), on Kim's 2026-10-12 decisions: a full foundations overhaul from the `mathematical-design-system` skill; `icon` and `glyph` each get their own container and their own size; component geometry moves with the new margin, gutter, inset, padding and gap systems. Number 0245 claimed against the file tree (0243 the highest on `main`), every sibling worktree under `.claude/worktrees/` and the history of every ref (0244 is held in flight by the `widget-patterns-next` lane) |
> | **Ratified by** | pending (Kim comments `ratify ADR-0245` on the PR; `scripts/adr_ratify.py` flips it, ADR-0149) |
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
the placement rule; derive `ui-text` sizes behind its unchanged nine-variant API; and ship it as
one ratified release train whose step 0 is a mockup Kim approves.** The A2UI wire and the K6
prompt budget move zero bytes. Eleven clauses.

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
- **The recompute list replaces ADR-0007's `*` ramp.** Derived tokens are declared on
  `:root, [data-tier], [data-scale], [data-size], [size]`, the same per-element re-substitution
  ADR-0007 relies on, declared only where an input changes.
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
- **The root is `product` at scale `sm`: sizes sm / md / lg = n 6 / 7 / 8 = 24 / 28 / 32.**

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
- **`[scale]` retires.** Its six values map by purpose, with derived heights (deltas against
  today's tables):

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
| all controls | height 4n · inset n · gap n · radius n with `corner-shape: squircle` · type n + 6 · borders inside the box (padding = rule - border width) |
| button, toggle | padding 2n beside a label, n beside an icon; icon-only is a 4n square (the ADR-0223 R3(a) floor, unchanged form) |
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

Three deviations, each named so the mockup can confirm or reverse them:

- **`ui-avatar` stays 4n**, the skill's icon-tile rule. The skill's 2n avatar is an avatar inside a
  control row; in the fleet `ui-avatar` stands beside controls at control height (24 / 28 / 36
  today), and 2n would shrink it by half (Appendix B).
- **`ui-slider` has no skill rule.** It takes the progress rule for its rail (2c) and the switch rule
  for its thumb (2n - 2c).
- **ADR-0036 stands.** A single-line control keeps line-height 1 inside its 4n frame; the skill's
  1.2 applies to control text that wraps.

The pill radius retires: a button or toggle at md goes from 14 (h/2) to 7 (n). The squareness
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
  and tests included. One codemod wave renames them. `glyph-usage-coverage.test.ts` follows the rename and closes its three blind
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
  `more` are filled. The stroke rule is this record's proposal; the step 0 mockup confirms it.
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
  equals its inset, so nested corners stay concentric. ADR-0018's `max(0, r - pad)` chain and ADR-0046
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
  roles for the 27 package and 7 site stylesheets that read it, and retires in the last wave.
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
  floors. It lands report-shape in wave 1 and flips enforcing in wave 6 (the ADR-0223 R5 shape).
- **Re-baselined, never weakened:** `dimensions.test.ts` (544 lines, its six-tier table at
  `:36-46`) is rewritten against `resolve()`; 42 test files with 162 lines name
  `--md-sys-{height,icon,font}-*`; 66 visual goldens across 26 suites regenerate through ADR-0110's
  deliberate recapture path, family by family.

### 10. The wave plan (one ratified release train)

No wave ships a visual change to a release before wave 6; `main` carries the train behind the
generator's additive tokens, the ADR-0223 cl.7 shape.

- **Step 0: the mockup, reviewed and approved by Kim before wave 1.** A static page in the step-0
  ticket folder (`.sdlc/foundations-mockup/mockup.html`, published as an artifact for review): one
  control row per root step (sm, md, lg) and per `data-scale="md"`, each control drawn with its
  icon slot (2n) and glyph box (2n - 2c) outlined; a listbox, popover, card and page frame at each
  level; the `ui-text` ladder; the button pill-to-n radius change and the avatar deviation side by
  side with today. It settles the open items below.
- **Wave 1, foundations (additive):** vendored `scale.mjs`, the generator, `foundations.gen.css`
  loaded beside `dimensions.css`, the gates of clause 9 (px-literal rule report-shape). Zero
  visual change.
- **Wave 2, icon and glyph:** `ui-glyph` mint (descriptor, registry regeneration), the path table,
  the `symbol` rename with its alias, the codemod, the coverage test, the `mapsTo` edits.
- **Wave 3, controls by family:** entry (text-field, textarea, select, combo-box, multi-select,
  otp-field), action (button, toggle, segmented-control, pagination), indicators (checkbox, radio,
  switch, slider, progress), atoms (badge, avatar), listbox family (menu and the panels), then
  tabs, nav-rail, calendar and table. Goldens regenerate per family.
- **Wave 4, containers:** `container-box.css`, card, modal, drawer, popover, toast, tooltip and the
  super-shell bars onto the level tokens.
- **Wave 5, type:** `text.css` onto the derived roles, the typescale alias layer, ADR-0150's media
  block out.
- **Wave 6, release:** `[scale]`, `[density]` and the old ramp tokens retire; the space and
  typescale aliases are kept or retired by Kim's call; the px-literal rule flips enforcing; fleet
  golden regeneration, `eval:catalog`, and Kim's reference-consumer sign-off on the docs site and
  agent-admin; one breaking release.

### 11. Records this invalidates (stale, re-verified per wave)

171 files outside the ADR log name a replaced law or token (`git grep -l -E
'md-sys-height-|md-sys-icon-|md-sys-compact-|ADR-0038|ADR-0041|geometry\.md|ui-box-pad|md-sys-typescale|ADR-0046|ADR-0078'`),
each repaired by the wave that changes what it describes. The ones that state a law and not a
value: `references/geometry.md` (frame/rhythm split, h/2 padding, pill radius),
`references/geometry-sizing-spec.md` (the hand-tabled ramp), `references/tokens.md`,
`references/naming.md` §12 (the `glyph` entry), `references/dimensional-standard.md` (already
superseded; its stale tier note goes), `rubrics/component.md`, the `component-standards`,
`component-design`, `component-patterns` and `fleet-review` skills, every control descriptor's
`geometry:` line, `AGENTS.md` (Never hand-edit gains `foundations.gen.css`) and `CLAUDE.md`'s
Inner loop line "Controls take the library ramp (sm 24 / md 28 / lg 36 px)", which becomes 24 /
28 / 32.

## Open for the step 0 mockup

1. **The A2UI canvas register.** T-0083 put widget actions at 36px (size lg). At the root they
   become 32. A canvas root carrying `data-scale="md"` would make md actions 36 and every other md
   control 36 too. The mockup shows both.
2. **The icon shrink** (Appendix B row 2), which is the largest visible change after the radius.
3. **The glyph stroke** `max(1.5px, c/2)` at 8, 10 and 12px boxes.
4. **The avatar deviation** (clause 3).
5. **Container growth** in cards (block inset 12 to 21, region gap 6 to 14, radius 12 to 21).

## Consequences

- **One derivation instead of four tables.** A new control computes its geometry from its n; a
  density or scale change is one attribute; nested corners are concentric without a chain.
- **Visible, fleet-wide look change.** The biggest moves at the default md, in order: control
  radius 14 to 7 (pills become squircle rectangles); icons 18 to 14; input inline padding 14 to 7;
  card block inset 12 to 21 and radius 12 to 21; listbox padding 7 to 2 with option rows 22 to
  28; `display` type 45 to 32; `kicker` 12 to 16. Appendix B has every row.
- **lg controls shrink 36 to 32,** including the tabs strip (36 today, 28 at the default md) and
  T-0083's widget actions, unless the mockup picks the md canvas register.
- **No 40, no 48 and no XL in product.** A request for one is answered with the nearest steps
  (32 or 36, 44), never a one-off.
- **Density changes meaning:** a region's density now moves heights too, not only gaps.
- **The A2UI wire, the corpus and the K6 budget do not move;** rendered goldens and `eval:catalog`
  verdicts do.
- **Vocabulary:** the skill's "widget" (a tier and a container level) is not the A2UI "preset
  widget" of ADR-0243. The token names keep the skill's word; `references/agent-model.md` gains one
  disambiguating glossary line in wave 1. `--md-sys-widget-inset` (ADR-0041's 2px) retires into c in
  wave 3 so it never sits beside `--md-sys-widget-{margin,gutter,radius}`.

### Risks

| risk | likelihood | mitigation |
|---|---|---|
| The overhaul reads as a different product (radius, icon size, container air) | high, by design | step 0 mockup before any build; Kim's sign-off before the release cut |
| `round()` / `pow()` / `corner-shape` engine gaps | low for the first two, high for `corner-shape` outside Chromium | the 36-cell browser leg in both engines; `corner-shape` is paint-only and falls back to circular corners |
| A region's `data-size` never reaches a control that reflects its default | low (reflection is setter-driven) | wave 1 test on a bare control under `data-size="sm"` |
| 171 records go stale mid-train | high | clause 11: each wave repairs the records it invalidates in the same change |
| Mobile hit targets: no scale below the root | medium | the root is already the densest product step; rule 8 applies only to content regions |
| Golden churn hides a real regression | medium | goldens regenerate per family with eye review (the ADR-0223 slice 2 practice) |

## Acceptance

This record ships no production code. This change: the ADR passes the ADR grammar
(`site/lib/adr.test.ts`) and the docs grammar sweep (`site/lib/docs-grammar.test.ts`, whose S8
`KNOWN_GAPS` gains 244, reserved in flight by the `widget-patterns-next` lane, inert once it
lands), the regenerated indexes pass `site/lib/sitemap.test.ts`, and `npm run check` stays green.
Each wave carries its own gates: `npm run check`, the touched folders' tests, `test:browser` for
CSS waves, and the ADR-0110 recapture for its goldens.

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
- **Rename `ui-icon.glyph` back to `name`.** Rejected: `name` is reserved fleet-wide for form
  identifiers (TKT-0069).
- **Keep `glyph` on `ui-icon` and call the mark element something else (`ui-mark`).** Rejected: Kim
  named the mark container glyph, and the word would keep two meanings.
- **One element with a `kind="icon|glyph"` switch.** Rejected: an icon and a glyph differ in source
  (swappable pack art against library geometry) and in box, so one element would carry two
  contracts.
- **Generated per-rung literals (the ADR-0038 style).** Rejected: n depends on three independently
  inherited attributes, so the literal table has no selector form (clause 1).
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
| button / toggle radius (pill h/2 today) | n | 12 → 6 (-6) · 14 → 7 (-7) · 18 → 8 (-10) |
| field radius (corner-base today) | n | 12 → 6 (-6) · 12 → 7 (-5) · 12 → 8 (-4) |
| checkbox / radio / switch / slider box (compact today) | 2n | 14 → 12 (-2) · 16 → 14 (-2) · 18 → 16 (-2) |
| checkbox radius (box/5 today) | n/2 | 2.8 → 3 (+0.2) · 3.2 → 3.5 (+0.3) · 3.6 → 4 (+0.4) |
| checkbox check (0.6 box today) | 2n - 2c | 8.4 → 8 (-0.4) · 9.6 → 10 (+0.4) · 10.8 → 12 (+1.2) |
| radio dot (0.56 box today) | 2n - 4c | 7.84 → 4 (-3.84) · 8.96 → 6 (-2.96) · 10.08 → 8 (-2.08) |
| switch thumb (box - 4 today) | 2n - 2c | 10 → 8 (-2) · 12 → 10 (-2) · 14 → 12 (-2) |
| switch track width (1.8 box today) | 2 thumb + 2c | 25.2 → 20 (-5.2) · 28.8 → 24 (-4.8) · 32.4 → 28 (-4.4) |
| switch track padding (widget-inset today) | c | 2 → 2 (0) · 2 → 2 (0) · 2 → 2 (0) |
| field label gap (space-xs today) | ceil(n/2) | 4 → 3 (-1) · 4 → 4 (0) · 4 → 4 (0) |
| avatar, the skill's 2n | 2n | 24 → 12 (-12) · 28 → 14 (-14) · 36 → 16 (-20) |
| avatar, the recommended icon-tile reading | 4n | 24 → 24 (0) · 28 → 28 (0) · 36 → 32 (-4) |
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
wherever a control has a size axis):

| control | moves at md (px) |
|---|---|
| button, toggle | radius -7 · icon -4 · icon-side padding +2 · type -1 |
| text-field, select, combo-box, multi-select, otp-field | inline padding -7 · radius -5 · icon or caret box -4 (caret becomes a 10px glyph) · type -1 |
| checkbox | box -2 · check +0.4 |
| radio | box -2 · dot -2.96 |
| switch | box -2 · thumb -2 · track width -4.8 |
| slider | box -2 |
| badge | height -4 · padding -4.75 · radius -5.5 · type -2 |
| avatar | 0 with the 4n deviation (-14 under the skill's 2n) |
| menu | item rows +6 · panel padding 6 → 2 · panel radius -3 |
| select listbox | padding -5 · option radius +2 · panel radius -3 |
| segmented-control | padding +2 |
| table | row +3 · cell padding +1 |
| tabs | tab -8 (36 → 28) |
| nav-rail items, calendar cells, pagination stops | height 0 · icon -4 where an icon sits |
| card, modal, drawer | text inset +3 inline, +9 block · region gap +8 · radius +9 |
| popover | padding +2 · radius +2 |
| toast | padding +2 inline, +6 block · gap -1 · radius +2 |
| tooltip | padding +1 · radius -3 |
| progress | 0 |

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
(0) · glyph box 14 → 12 (-2) · control type 14 → 15 (+1) · body 14 → 16 (+2) · button radius 14 → 9
(-5) · card margin 18 → 27 (+9) · card radius 12 → 27 (+15).
