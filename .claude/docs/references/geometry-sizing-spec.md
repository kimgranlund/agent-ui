# Geometry & Sizing Spec — the centering law + the size ramp

**Status:** design-of-record — **LANDED (v4, 2026-06-18; §1 ramp extended to 8 rows, Kim-ratified
2026-06-30).** **Authority:** the **§1 master table below** — the hand-tuned **eight-row height ramp
(16→64)** and the **centering law** it encodes. (`component-sizes.md` was the working-name precursor for
this ramp; it was never materialized as a file — its hand-tuned values are §1 here. Kim 2026-06-18: this
file is the *reference/law*; the shipped `scale × size(sm/md/lg) × density` model **maps onto** it — there
is no size-ramp migration. The job *was* to make the implementation obey the law; **it now does.** Kim
2026-06-30: the ramp gained two rows below XS, 16·18 — forward-ready, unconsumed by the current grid.)

**What landed (the §5 gap is closed):** `caret = font` globally (`--ui-glyph-ratio: 1`), for **both** mask
glyphs **and** slotted `<ui-icon name=caret>` carets (§4.1/§4.6); the **comfortable controls** (button,
select, all the input fields) on the **slot model + `h/2`** value edge (§1.5); the **compact/dense realm**
(kbd/slider/slider-multi/radio/switch/tag/badge/chip/checkbox) on its own **two-band compact box ramp**
(§5.2 — `ui-*` tight 12→20, `content-*` generous 18→32); density on the **gap, not the pad**. A **96-component geometry audit** (§6, 2026-06-18) then
confirmed the law fleet-wide and caught the two stragglers (disclosure, slider-multi).

**The thesis.** A control's box is `height` (the lever); every glyph it carries (icon, caret) sits in
a **square cell of side = height** and is therefore centered by **edge padding = (height − glyph)/2**.
The glyph sizes (icon, caret, font) are **not** a constant ratio of height — they scale *sublinearly*
(a power law, exponent < 1; §1.1), so a glyph occupies a shrinking fraction of the box as it grows.
That single rule generates the whole tabled ramp. *Geometry is arithmetic, not taste.*

---

## 1 · The ramp + the codified scaling law

Master table — the **eight-row height ramp** (Kim-ratified 2026-06-30). The ramp is keyed by **height**
(the lever); every derived quantity comes from the §1.4 families + the §1.5 slot-presence pad model, so
the table carries them directly: `caret = font` and `gap = font/2` (rhythm); the **value-edge pad** is
`h/2`, the **slot-edge pad** `½(h − icon)`, the **slot** `= icon` (frame). `%` = glyph ÷ height (the
*fraction of the box* the glyph occupies — the sublinear optical correction, §1.1):

| height | font | caret `= font` | icon | gap `= f/2` | value-edge pad `= h/2` | slot-edge pad `= ½(h−icon)` | slot `= icon` | icon% | font% |
|---|---|---|---|---|---|---|---|---|---|
| **16** † | 11 | 11 | 12 | 5.5 | 8 | 2 | 12 | 75% | 69% |
| **18** † | 11 | 11 | 14 | 5.5 | 9 | 2 | 14 | 78% | 61% |
| 20 | 12 | 12 | 14 | 6 | 10 | 3 | 14 | 70% | 60% |
| 24 | 13 | 13 | 16 | 6.5 | 12 | 4 | 16 | 67% | 54% |
| 28 | 14 | 14 | 18 | 7 | 14 | 5 | 18 | 64% | 50% |
| 36 | 16 | 16 | 20 | 8 | 18 | 8 | 20 | 56% | 44% |
| 48 | 18 | 18 | 24 | 9 | 24 | 12 | 24 | 50% | 38% |
| 64 | 20 | 20 | 28 | 10 | 32 | 18 | 28 | 44% | 31% |

**† = the two new rows** (heights 16·18) extend the ramp **below** the legacy XS (20). They are
**forward-ready / unconsumed**: the shipped `scale × size` grid's minimum effective height is **21**
(snaps to row 20), so no current `[size]×[scale]` tier reaches 16/18 (ADR-0035; re-grounding the per-tier
realization against this 8-row ramp changes **no** consumed value — proven byte-identical to the prior
6-row grounding). Legacy enum, for traceability: 20 = XS · 24 = SM · 28 = MD · 36 = LG · 48 = XL · 64 = 2XL.

**Live anatomy = the §1.5 presence-driven grid** (no authored trailing-pad): `| value-edge pad | [slot] |
1fr | [slot] | value-edge pad |`, each edge taking `½(h − icon)` when a slot is present and `h/2` when it
is slotless. The historical authored-anatomy columns (`lead-pad / spacer / trail-pad`) and the
even-rounded **power-law caret column** are **retired** — superseded by §1.4 (`caret = font`, `gap = f/2`)
and the §1.5 pad model above; see §1.3 for the retired caret's historical note.

### 1.1 · The non-linearity, codified — glyphs scale **sublinearly** (the optical correction)

A glyph does **not** grow in proportion to the box. As height grows, each glyph occupies a *shrinking
fraction* of it (across the consumed 20→64 range: icon 70%→44% · font 60%→31%; `caret% ≡ font%` now,
§1.4). This is the "not purely linear across the scales" Kim flagged, and it is a **power law of height
with exponent < 1**:

```
icon  = 2.49 · height^0.58          font  = 3.16 · height^0.45   (≈ 2.65·√height)
caret = 4.08 · height^0.35   (≈ √[3]{height}; tracks font a touch under)
```

These reproduce every tabled value to **±1px** — so the table is not eight hand-picked points, it is
**one rule sampled eight times**. The practical payoff: the same rule gives the glyphs for *any* height,
which is exactly the bridge that lets a shipped `scale × size` height **map onto the law** (§3) — feed
the mapped height to the formula, get its tabled icon/caret/font. *(The two forward-ready sub-XS rows
16·18 floor higher — icon ~75–78%, font ~61–69% — because a tiny box can't shrink its glyph below
legibility; they sit below the consumed 20→64 range. The `caret = 4.08·h^0.35` formula is historical:
`caret = font` now, §1.4.)*

> **REALIZED UNDER `[scale]` (ADR-0033, 2026-06-30).** This sublinear law was honored across `[size]`
> (the tabled sm/md/lg) but **not** under `[scale]`, which scaled font **linearly** (`× --md-sys-scale`) —
> so `content-lg` md font was 24.5px (50% of a 49px box) instead of §1.1's ~18px (~37%). Now, under
> `[scale]`, **height stays linear** (the frame lever) but **glyphs re-derive sublinearly from the scaled
> height**: `--md-sys-font = base × pow(--md-sys-scale, 0.45)` and `--md-sys-icon = base × pow(--md-sys-scale, 0.58)`
> (anchored on `--md-sys-scale`, so the hand-tuned base is exact at `scale = 1`); `caret = font` and
> `gap = font/2` follow. So `[size]` and `[scale]` now agree — **any** final height gets this law's glyphs.
> (Display type `--ui-type-*` stays **linear** — it has no box, so the in-box optical correction does not
> apply; ADR-0033 / ADR-0025.)
>
> **Update — superseded by ADR-0038 (Kim, 2026-06-30, "no multipliers").** The `pow` realization is gone:
> glyphs now come **directly from the `(scale × size)`-selected §1 row** (§3) — no `pow`, no `× --md-sys-scale`.
> The **sublinear OUTCOME stands** (the §1 ramp is sublinear *by construction*, and the lookup picks §1
> rows, so a larger box still gets a proportionally smaller glyph). `caret = font` / `gap = font/2` follow
> the selected row.
>
> **Update 2026-07-08 — `--ui-type-*` retired (ADR-0078).** The Display type-scale family this section
> named as `--md-sys-scale`'s one surviving consumer no longer exists: ADR-0078 replaced `--ui-type-*` with
> the M3-verbatim `--md-sys-typescale-*` matrix (`dimensions.css:100+`), which does NOT scale with
> `--md-sys-scale` — it is a fixed, spec-pinned table (Kim ratified both "fully M3-canonical" open knobs at
> ADR-0078's ratification, declining the linear-scale-with-height fork). `--md-sys-scale`'s surviving
> consumer is now `--md-sys-typescale-*-size` (`dimensions.css:224`), and it is linear for the same
> reason stated above: Display has no box, so the in-box optical correction never applied to it.

### 1.2 · The same law, read structurally — **two bands**

The sublinearity reads structurally as two bands that change gear together at the **MD|LG seam**:

| band | sizes | height | spacer | glyph step |
|---|---|---|---|---|
| **compact** | XS · SM · MD = 20 · 24 · 28 | `+4` linear | 4 | gentle (font +1, icon +2) |
| **expressive** | LG · XL · 2XL = 36 · 48 · 64 | `×4/3` geometric | 8 | doubled (font +2, icon +4) |

Height accelerates (geometric) while glyphs stay near-linear → the fraction shrinks. The spacer's
`4→8` jump and the glyph-step doubling land on the **same seam** — that coincidence *is* the symmetry.

### 1.3 · The generating rule (one rule — Kim ruled 2026-06-18)

**The ramp is generated by one rule: round the power law — glyphs to nearest even, font to nearest
integer.** That is exactly what the ratified 8-row ramp obeys: every **icon** is even
(`12·14·14·16·18·20·24·28`) and every **font** is an integer (`11·11·12·13·14·16·18·20`). The icon tail
stays capped at 28 (1px under the formula's 29 — a deliberate max-icon). The derived **§1.5 pads** then
fall out monotonic in height — value-edge `h/2` (`8,9,10,12,14,18,24,32`) and slot-edge `½(h − icon)`
(`2,2,3,4,5,8,12,18`). *(The new row 18 takes icon **14** by this even-rounding — the raw law gives 13.3,
nearest-even 14, which also keeps the icon column all-even and shares row 18's icon with row 20; Kim
ratified 2026-06-30, §1 fork 2.)*

**Retired — the historical caret column.** The earlier ramp carried an even-rounded **power-law caret**
column (`12·14·14·16·16·18` over the 6-row 20→64 ramp; `component-sizes.md` floor-rounded SM·LG to
`12·14`). It is **retired**: `caret = font` now (§1.4 / §4.1, landed), so the master table's `caret`
column simply restates `font`. The even-round figures are kept here only as the historical reference.

### 1.4 · The two families + the slot-container model (Kim ruled 2026-06-18)

The tabled values are *used* through **two families of relationships** plus a single slot mechanism
that removes asymmetric padding entirely. Every derived quantity scales with one of two things:

- **Frame — ∝ height** (the box): icon (`--md-sys-icon-*`), the slot, the padding, min-width, the pill radius.
- **Rhythm — ∝ font** (the text-adjacent marks & spacing): the gap, the caret.

| quantity | family | rule |
|---|---|---|
| slot (leading **and** trailing) | frame | `= icon` — **identical** squares that center their content |
| inline-pad | frame | `= block-pad = ½(height − icon)` → every affordance sits in a **height² square** |
| min-inline-size | frame | `= height` (icon-only = a square) |
| pill radius | frame | `= height / 2` (else the flat `none/sm/md/lg` ladder) |
| **gap** | rhythm | **`= font / 2`** (0.5em) |
| **caret** | rhythm | **`= font`** (1:1 — the dropdown mark = text height) |
| density | — | multiplies the **rhythm only**, never the frame (the frame is geometric; scaling it un-centers the icon and breaks the square) |

**The slot mechanism — no trailing-pad.** Leading and trailing affordances each sit in the *same*
`icon`-sized square slot that centers its content. The icon fills its slot; the smaller caret
(`= font`, and `font < icon` across every scale row) centers in its slot and so lands further from the
edge — reproducing the asymmetric trailing edge **for free**, with one uniform `inline-pad` and **no
authored trailing-pad**. Because `inline-pad = block-pad`, the slot's cell is `height × height`; the
icon-only control *is* that square.

*Realized in code per-glyph, not as wrapper DOM:* each glyph is sized by its **type** — icon = `--md-sys-icon-*`,
caret / affordance = font (the §4.6 taxonomy) — and centered in the height-cell by its own
`½(h − glyph)` edge pad; the presence-driven `:has()` grid (§1.5) places the cells. This is equivalent to
the icon-sized-slot framing above (the caret lands `½(h − font)` from the edge either way) and needs no
wrapper element — the slotted `<ui-icon>` / mask glyph *is* the slot, sized to its type.

**Supersedes:** the rhythm rules replace the spacer band (§1.2 `4/8` → `gap = font/2`) and the tabled
caret (§1.3 even-round, ≈0.9·font → `caret = font`). The font-relative rules deviate from
`component-sizes.md`'s hand-tuned caret by ≤2px at large sizes — Kim chose the clean rule over the
hand-tuning. The **frame** generators (`icon ≈ 2.49·h^0.58`, `font ≈ 2.65·√h`) are unchanged.
*(`geometry.html` was the RCE-precursor live demo page for this law and was never ported into
agent-ui — the claim it verified now lives as source-level `*-DIM`/`GEO*` probes + per-control
`*-geometry.browser.test.ts` legs across all 6 `[scale]` contexts × 3 sizes, e.g.
`button-geometry.browser.test.ts`; see §6.)*

### 1.5 · Slot-presence padding — two cases (Kim ruled 2026-06-18, refined: slotless = h/2)

Each inline edge pads by **what's at it**, and there are exactly two cases:
- a **slot** edge (icon / caret) → `½(height − icon)` — centers the icon-sized slot.
- a **slotless** edge (bare label, no slot) → **`h / 2`** — the text pad `½(h − font)` **plus the absent
  slot's gap** `½·font`; the two sum to `h/2`. So the content keeps the gap's worth of breathing room
  whether or not a slot is there (Kim "we need a solution for adding gap when a slot is absent").

So a control **provides leading padding when the leading slot is absent** — the label never jams the
edge. The earlier `½(h − font)` (a label jammed to ≈10px at md) is superseded: a slotless edge is now
`h/2` (≈16px at md). A `[label · caret]` control is therefore asymmetric by design — value at `h/2`
(slotless), caret at `½(h − glyph)` (slot).

**Implementation — presence-driven grid (`:has()`)** so an absent slot leaves **no phantom gap**:

| leading | trailing | lead pad | trail pad | `grid-template-columns` |
|---|---|---|---|---|
| icon | caret | frame | frame | `auto 1fr auto` |
| icon | — | frame | **h/2** | `auto 1fr` |
| — | caret | **h/2** | frame | `1fr auto` |
| — | — | h/2 | h/2 | `1fr` |
| icon | — (no label) | frame both → **square** | | `auto` |

```css
.ctl { --pad-frame: calc((var(--h) - var(--icon))/2); --pad-slotless: calc(var(--h) / 2);
       display: inline-grid; grid-template-columns: 1fr; padding-inline: var(--pad-slotless); }
.ctl:has(.slot--lead)  { padding-inline-start: var(--pad-frame); }
.ctl:has(.slot--trail) { padding-inline-end:   var(--pad-frame); }
.ctl:has(.slot--lead):has(.slot--trail) { grid-template-columns: auto 1fr auto; }
/* lead-only → auto 1fr · trail-only → 1fr auto · icon-only(no label) → auto + square */
```

Both pads are **geometric** (frame family) — not density-scaled; density rides the gap only (§1.4).
*(The precursor `geometry.html`'s "Slot-presence model" demo was never ported; the 5 anatomy
permutations × 3 sizes now live as the `button.css`/`text-field.css` slot-presence CSS + their
`*.browser.test.ts` geometry legs.)*

---

## 2 · The centering law (the one rule)

> **Edge padding for a glyph = (height − glyph) / 2** — each glyph centers in a square cell of side =
> the control height.

- **inline-pad = (height − icon) / 2** — one uniform pad; the icon centers in a `height²` cell. *(ui-md/sm: (28−18)/2 = 5)*
- **No separate trail-pad** — the caret centers in the **identical `icon`-sized slot** (§1.4), so it lands
  at `pad + ½(icon − caret)` on its own; the asymmetric trailing edge is emergent, never authored.
- **gap = font / 2** · **caret = font** — the *rhythm* family (§1.4); the pad/slot are the *frame* family.
- **min-width = height** (the 1:1 floor): a glyph-only control is at least square; padding lives
  *inside* the square, never widening it. Contents centered.
- **density** multiplies the **rhythm** (gap) only — never the frame (pad/slot/icon), or the icon
  un-centers and the square breaks.
- **single-line Control text: `line-height = 1`** (the vertical-text companion — ADR-0036): the single line
  centers in the fixed frame (`align-items: center`) with no extra leading, exactly as a glyph centers in its
  square cell; `line-height 1` tightens the line box, never the box. A fleet `:root` constant
  `--md-sys-control-line-height: 1`. **EXCLUDES** the Display class (`ui-text`), which keeps its multi-line
  `--md-sys-typescale-*-line-height` (ADR-0078, superseding ADR-0025's retired `--ui-type-{level}-leading`).

For a **label-only / slotless** edge (no glyph there), the law has no glyph to center; the edge takes
**`h/2`** (§1.5 — the text pad `½(h − font)` plus the absent slot's gap `½·font`), not `(height − glyph)/2`.

---

## 3 · How the shipped sizes map onto the law (reference/law-only — Kim's ruling)

> **REALIZED — Kim's `(scale × size) → §1-row` lookup (ADR-0038, 2026-06-30; NO multipliers).** Kim ruled
> *"let's not use multipliers."* The control ramp is an **explicit per-`[scale]` table**: each
> `(scale × size)` cell names **one §1 row**, and `--ui-{height,font,icon}` (plus caret/gap/pad) **all come
> from that one row** — height and glyphs are mutually consistent. `[scale]` re-tables the tokens (the
> `--md-sys-compact` re-table mechanism, extended to height/font/icon); `[size]` selects sm/md/lg; descendants
> inherit (no `--md-sys-scale` in the control path). The **default (`ui-md`) is byte-identical** (24·28·36 /
> font 13·14·16 / icon 16·18·20). Kim's design is a **shift-by-one-row ladder**: the `content-*` band is the
> `ui-*` band shifted up one §1 row, so `content-sm ≡ ui-md` and `content-md ≡ ui-lg` (the 6 `[scale]` names
> render 4 distinct registers — deliberate). Kim's authoritative table is in **ADR-0038 clause 1**.
>
> *(History — superseded by ADR-0038: the control ramp was a per-tier `--md-sys-scale` **multiplier**
> (ADR-0032 `0.875…1.75`) with **sublinear `pow` glyphs** (ADR-0033), then **snapped to §1**
> (ADR-0035/0037). Kim replaced the whole multiplier with the explicit lookup. `--md-sys-scale` survives for
> Display's `--md-sys-typescale-*-size` only (formerly `--ui-type-*`, retired by ADR-0078) — the
> ruled-linear fork, ADR-0025/0033. The §5.2 `--md-sys-compact-*` box ramp is a **separate** re-table,
> unaffected.)*

No size-ramp migration. The two-axis model:
- `scale` (`ui-sm…content-lg`) × `size` (`sm/md/lg`) **selects a §1 row** (Kim's table, ADR-0038);
  `--ui-{height,font,icon}-{size}` are that row's values, re-tabled per `[scale]` in `dimensions.css` (no
  multiplier, no `pow`).
- A control resolves its **height + font + icon** from the **one** selected row, then **obeys §1.4**:
  the icon-sized slot; uniform `inline-pad = ½(height − icon)`; the rhythm rules `gap = font/2`,
  `caret = font` — all from the same row.

The ramp in §1 is the **reference** for choosing the tabled icon/caret/font at a given height (e.g. a
28px control → MD row → icon 18 · caret 14 · font 14). The point is the *relationships*, not a forced
6-step `size` enum.

---

## 4 · Sub-systems, transposed onto the law

### 4.1 · Caret / chevron — **`= font`** (rhythm family, §1.4) — LANDED
The dropdown/disclosure caret is sized `= font` (1:1), not the old `font × 0.75` (ui-md/md 9.75 vs
`font = 13` — too small). **Landed** via `--ui-glyph-ratio: 1`, so every `--ui-{cmp}-glyph = font × 1`.
Two embodiments, **same size and same `½(h − font)` inset**:
- a **mask** glyph (a registry SVG mask in `--ui-glyph-ink` → `CanvasText` in forced-colors) — `select`'s
  ▾, the field stepper arrows, the clears, `disclosure`'s rotation chevron;
- a **slotted** `<ui-icon name=caret>` — a button's caret: sized `var(--ui-{cmp}-font)`, edge pad
  `½(h − font)` (`BTN-CARET`). A NON-caret content icon in the same button keeps `--md-sys-icon-*`.

(The `½(h − icon)` slot edge with the caret centering *within* the icon-sized slot, and the direct
`½(h − font)` pad, give the **same** result — the caret lands `½(h − font)` from the edge either way.)
The full sizing taxonomy — affordance vs content-icon vs nav-button — is **§4.6**.

### 4.2 · Icon (leading) — **tabled** from the ramp's icon column
A leading icon (a field's `slot=icon`, a button's icon) is sized from the **icon** column
(14/16/18/20/24/28); the icon-side inline padding = `(height − icon)/2`. The standalone `<ui-icon>`
display element is the same box.

### 4.3 · Padding — per-edge, by slot presence (§1.4 / §1.5)
- a **slot** edge → `½(height − icon)`; a **slotless** edge → `h/2` (= text pad + the absent slot's gap,
  §1.5). When both edges are slots the pad is uniform `½(height − icon)`; the trailing caret's deeper
  inset comes from centering in the icon-sized slot, not a separate pad. The presence-driven grid leaves
  no phantom gap on an absent slot.
- `padding-block: 0` — **block-size is the lever** (§0 invariant), never block-padding; the glyph's
  *effective* vertical margin (`½(height − glyph)`, from centering) equals the inline-pad → the
  affordance occupies a `height²` square cell.

### 4.4 · Gap — `= font / 2` (rhythm family, §1.4)
Icon↔label and label↔caret gaps = `font / 2` (0.5em) × density — smooth across the ramp, and it tracks
the text it spaces (superseding the earlier `4/8` spacer band).

### 4.5 · `--space-*` is LAYOUT spacing — separate from control geometry (RESOLVED)
The `--space-*` scale (page gutters, card/stack gaps, section rhythm) is a **different concern** from
control padding (which is the law above). Control padding/spacers come from the ramp + §2; `--space-*`
is for the space *between* components. The naming question this section once deferred is resolved:
the fleet ships `--md-sys-space-{none,xs,sm,md,lg,xl}` (`dimensions.css`, density-scaled via
`× --md-sys-density`), consumed fleet-wide (radio-group's inter-item gap, bar-chart's row rhythm,
container regions). It sits alongside a THIRD spacing concern this law doesn't cover: a container's
own interior rhythm (`--surface/container-box.css`, ADR-0046 — nested content padding 12→8→4 by
descendant level). Three registers, not two: **control padding** (this document, the centering law)
· **layout spacing** (`--md-sys-space-*`, between components) · **container interior** (ADR-0046, inside
a region). None of the three derives from either of the others.

### 4.6 · Affordance vs content-icon — the sizing taxonomy (the catalog audit, 2026-06-18)
A glyph's size is decided by **what kind of glyph it is**, not where it sits:

- **Inline affordance** — a caret · dropdown-chevron · disclosure-marker · stepper-arrow · clear `×` ·
  calendar-nav `‹›`. Rides next to / within text → **`= font`** (`--ui-{cmp}-glyph = font × ratio`,
  ratio 1). Mask glyph **or** slotted `<ui-icon name=caret>` — same size, `½(h − font)` inset (§4.1).
- **Content icon** — a field's leading icon, a status icon (alert/callout/toast), an avatar, the search
  magnifier. It is *content*, not an affordance → **`= --ui-ind`** (the indicator/icon ramp).
- **Nav icon in a standalone control button** — a carousel prev/next; a pagination chevron next to the
  page *numbers*. An icon-button, not an inline affordance → sized to **match its context** (pagination
  `1em` next to the numbers; carousel a box-scaled glyph filling its round button). A deliberate
  exception (recorded in the GEO opt-out notes), not the font rule.

**The bug class** (Kim caught the button caret; the audit caught `disclosure`): an *inline affordance
sized to `--md-sys-icon-*`* renders ≈1.2–1.5× the text — visibly oversized. The fix is always the same — size
it `= --ui-{cmp}-glyph` (font), not the indicator ramp. The `GEO` AFFORDANCE set (§6) mechanizes this
for every masked affordance; `BTN-CARET` for the slotted button caret.

### 4.7 · Display marks — no ramp row, type-context-derived boxes (2026-07-08)

Not every Display-class member is text. `ui-icon` and the chart family (`ui-sparkline`,
`ui-bar-chart`, ADR-0107) take **no** `[size]`/`[scale]` ramp row and **no** control height — they
size relative to their own **type context** (em/lh-derived), the same "no control height" law §1's
`geometry.md` five-class table states for Display, extended past text to marks:

- `ui-icon` sizes `1em` (the type-context posture; ADR-0035).
- `ui-sparkline` defaults to an explicit `8em × 1lh` box (SPEC-R9 AC1) — a deterministic floor, not
  a derived one, because a zero-size default would make the whole-shape law (§ below) unenforceable
  on an inline mark with no intrinsic content size.
- `ui-bar-chart` is text-bearing Display: its labels/values read `--md-sys-typescale-*` directly
  (no repoint needed — it's already the fleet's font source), and row rhythm rides `--md-sys-space-*`
  (density-responsive for free, the ADR-0103 radio-group precedent); only the mark geometry itself
  (bar thickness, the zero-baseline stroke) is density-invariant, per its own `--ui-{name}-*` tokens
  in the standard `:where()` block.

None of the three consumes `--md-sys-height-*`, `--md-sys-font-*`, or `--md-sys-icon-*` (the CONTROL ramp) —
they are a fourth register beside frame/rhythm/compact-box: **type-context**, governed by
`references/geometry.md`'s Display row, not this document's §1 table.

### 4.8 · The width-floor law family (test-the-whole-shape, 2026-07-08)

§2's `min-width = height` square floor is the ORIGINAL width-floor law but not the only one shipped
since — every one exists because a control with real content collapsed to near-nothing under a
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
needs an explicit floor** — and the floor is proven, never assumed, by measuring the REAL rendered
bounding box in a realistic flex/grid container (a browser leg, jsdom cannot compute layout px). A
control that only ever sits beside guaranteed-wide siblings does not need one; the audit is per-class,
not universal.

---

## 5 · Implementation status — LANDED (the §5 gap is closed, 2026-06-18)

The three gaps the shipped code once had are **all closed**:

1. **Caret = font** (was `font × 0.75`). Done globally — `--ui-glyph-ratio: 0.75 → 1`, so
   `--ui-{cmp}-glyph = font`; both mask glyphs and the slotted button caret (§4.1/§4.6).
2. **The slot model** — a presence-driven `:has()` grid, identical `icon`-sized leading/trailing slots,
   `inline-pad = ½(h − icon)` on a slot edge / **`h/2`** on a slotless edge (§1.5). Shipped on button,
   select, and (via the border-on-host field frame) every input field.
3. **Inline padding = `h/2`** on the comfortable controls' value/text edge (was `2px + h·0.375·density`),
   and **density moved off the pad onto the gap** — the `h/2` pad is density-invariant (§1.4).

The min-width = height 1:1 floor + the icon-only square were already shipped on the button. Every facet
is probe-locked (§6), and the migration is **complete for the comfortable controls + the compact realm**
(§5.1) — verified fleet-wide by the 96-component audit.

### 5.1 · Migration policy (Kim ruled 2026-06-18, refined to slotless = h/2) — the global standard

**Two edge cases, fleet-wide:** a **slot** edge → `½(h − icon)`; a **slotless** edge → **`h/2`** (§1.5).
The earlier `½(h − font)` (≈ 9.5px at md) read tight on a slotless edge — adding the absent slot's gap
gives `h/2` (≈ 16px), Kim's ruling "h/2 on every slotless edge" (2026-06-18).

> **Scope note (2026-07-08):** this §5 migration narrative (v3→v4, 2026-06-18) predates `agent-ui` and
> describes the **RCE-precursor fleet's** control roster — the law transferred to agent-ui in full;
> some precursor NAMES did not. Mapping: `date-picker`/`date-range-picker` → `ui-text-field
> type="date"` (which opens `ui-calendar` on first focus, ADR-0048) + `ui-calendar mode="range"`
> (ADR-0093); `dropdown`/`listbox` → `ui-select` (native-select-parity) / `ui-combo-box` +
> `ui-menu`/`ui-option`; `masked`/`pin`/`tags` → `ui-text-field`'s type union (the 12-type codec
> family, ADR-0044/0047) does not (yet) carry a dedicated `pin`/`tags` type — read those two names as
> historical, not shipped. The `h/2` law itself is unaffected; only the roster's proper nouns drifted.

The `h/2` standard applies to the **comfortable controls** — `ui-button`, `ui-select`, the **fields**
(text/number/currency/percent/unit/search/masked/email/url/tel/password/date/time/file),
`ui-combo-box`, `ui-text-field type="date"` (opens `ui-calendar` — the date-picker/date-range-picker
precursor names), `ui-menu`:
- a slotless/text edge → **`h/2`** — *geometric* (NOT density-scaled).
- a slot edge (icon/caret/adornment) → `½(h − icon)`, presence-driven (§1.5) — so `[label · caret]` is
  value `h/2` / caret `½(h − glyph)` (asymmetric by design).

**The compact/dense realm is a SEPARATE size system** (Kim 2026-06-18): `ui-slider`,
`ui-slider-multi`, `ui-radio`, `ui-switch`, `ui-checkbox`, `ui-segmented-control`/`ui-segment`
(shipped), plus `ui-kbd`/`ui-badge`/`ui-tag`/`ui-chip` (the precursor-fleet roster this realm was
designed against — `ui-badge` is the report-family intake, ADR-0111; `kbd`/`tag`/`chip` stay
unshipped) and siblings
are *always compact and dense*. Two rules:
- **keep the compact pad — NOT h/2** (`h/2` would over-pad a keycap / count pill / thumb): they keep
  `2px + box·ratio·density`.
- **size on the dedicated compact box ramp (§5.2)** — a **TWO-BAND ladder** (Kim 2026-06-19, no longer
  the uniform 14→24): the `ui-*` scales are tight (`12·14·16·18·20`, 2px steps), the `content-*` scales
  generous (`18→32`, 4px within-scale). Distinct from the comfortable controls' height ramp (18→64).

Global everywhere: **`caret = font`** (done — `--ui-glyph-ratio: 1`; the `×`/chevron on the compact
chips too), **`gap = font/2`**, **density on the gap, not the pad** (the `h/2` pad is density-invariant).

A fleet-wide visual change to released v3 → **v4 — LANDED (2026-06-18).** The global mark = font (mask +
slotted); `ui-button` (full per-edge slot model + `BTN-CARET`); `ui-select` (value `h/2`, caret slot);
**all 15 input fields** (value edge `h/2` + the border-on-host frame so a slotted adornment sits inside
the box); the **compact realm** on its two-band box ramp (§5.2; incl. `ui-slider-multi`, repointed in the audit).
`ui-text-field type="date"`'s calendar trigger is an **icon-only square** (no value edge to halve —
correct as-is); `ui-select`/`ui-menu` items keep the **legacy item-pad** (item rows are not
"comfortable controls", §4.6).

### 5.2 · The compact box ramp — the two-band ladder (Kim ruled 2026-06-19)

> **REVISED — Kim's 8-value widget ramp (ADR-0041, Kim-ratified 2026-06-30).** The two-band §5.2 ladder is
> replaced by Kim's **single 8-value widget ramp** `12·14·16·18·20·22·24·28` — the widget analog of the §1
> control ramp — sized via the **same explicit per-`[scale]` lookup as ADR-0038** (no multiplier). The table
> below is updated to it (the off-ramp `26`/`32` are dropped; the content band is now 2px-stepped, all 6
> tiers DISTINCT). Default `ui-md` `14·16·18` byte-identical. **The realm becomes CONSUMED** — the Indicator
> (checkbox/switch/radio) + Range (slider) controls build on `--md-sys-compact-*` (#49). Adds the **2px inset law**
> (clause below) via `--md-sys-widget-inset: 2px`. *(Prior — ADR-0032 built the `--md-sys-compact-*` per-`[scale]`
> re-table mechanism, forward-ready/unconsumed; that mechanism stays, the VALUES are revised here.)*

The widget realm sizes its box on `--md-sys-compact-{sm,md,lg}` (`dimensions.css`) — Kim's 8-value ramp, distinct
from the **glyph** ramp `--md-sys-icon-*` (ADR-0035 — the live name; earlier drafts of this ramp used the
now-retired `--ui-ind` token name, both mean the same icon-size ramp) and from the
comfortable **control-height** ramp (§1, ADR-0038). All 6 `[scale]` tiers resolve to **distinct** widget
triples (the widget ramp is denser/more-linear than the sparse §1 control ramp, so — unlike ADR-0038's
`content-sm≡ui-md` overlap — the widget tiers do not collapse):

| scale | sm | md | lg |
|---|---|---|---|
| **ui-sm** | 12 | 14 | 16 |
| **ui-md** (default `:root`) | 14 | 16 | 18 |
| **ui-lg** | 16 | 18 | 20 |
| **content-sm** | 18 | 20 | 22 |
| **content-md** | 20 | 22 | 24 |
| **content-lg** | 22 | 24 | 28 |

Every cell ∈ Kim's ramp `12·14·16·18·20·22·24·28`; monotonic both axes; all 8 values used. The box is
**density-invariant** (density rides the pad, not the box, §1.4); the compact pad stays `2px +
box·ratio·density` (§5.1). **The 2px inset law (thumbed widgets — switch/range):** a thumb in a track insets
`2px` on every edge → `thumb = box − 2×2px`, `track = the widget box`; **flat 2px** (a frame constant, like a
1px border — not box-scaled), density-invariant (`--md-sys-widget-inset: 2px`). Mechanized: `DIM-COMPACT`
(per-cell exact + **all-6-tiers-distinct** asserted — the widget box does NOT step) + the smoke
`COMPACT_LANES` (the rendered box + the 2px inset in Chromium).

---

## 6 · Mechanization (the probes that lock the law)

| Law | Probe |
|---|---|
| value edge `= h/2` (comfortable); slot edge `½(h − icon)` | per-field `*-DIM` source probes (the calc) + the smoke `CONTROL_LANES` (`SLOT_PAD` h/2, real Chromium) |
| identical leading/trailing slot = `icon` square; icon-only square | `BTN-*` source + the icon-only-square Chromium measurement |
| **mask affordance `= font`** (caret/chevron/clear/marker) | **`GEO1–3`** over the `AFFORDANCE` set (**17** components): `--ui-{cmp}-glyph = font × --ui-glyph-ratio`, referenced in styles, no eyeballed em |
| **slotted button caret `= font`** (not `--md-sys-icon-*`); edge `½(h − font)` | **`BTN-CARET`** — the probe that would have caught the oversized caret |
| compact realm on the `14→24` ramp (`--md-sys-compact-*`) | `DIM-COMPACT` (the ramp) + per-control `*-DIM` (e.g. **`MTS-DIM`**, which caught the slider-multi miss) |
| `gap = font/2`; density on the gap, **not** the pad | source over the token chain; Chromium: icon-only stays square under `[density]` |
| rendered px responds to size/scale/density | `DIM-R*` + per-control Chromium dim legs |
| `0 < glyph ≤ box` in the real engine | `GEO-LAW` smoke |
| **rendered gestalt** — paint, layering, wash continuity, ellipsis pixels (what a computed-style/bounding-box assertion structurally cannot see) | the pixel-diff harness (ADR-0110, 2026-07-08): `*.visual.browser.test.ts`, Chromium-only committed baselines under `__baselines__/`; numeric geometry claims stay on the probes above, on both engines — this row is for CLAIMS WORDED IN PIXELS ("matches baseline", "the wash continues across the endpoint") |

Every law is a probe, or it isn't a law — new geometry lands with its probe. **Completeness:** the
source probes only enforce what's *in their lists* — a masked affordance not in the `GEO` `AFFORDANCE`
set, or a control not in a `*-DIM` probe, is unguarded. The **96-component render-aware audit**
(2026-06-18) is the periodic completeness sweep that catches what the lists miss — it found `disclosure`
(affordance sized to `--md-sys-icon-*`, now in the set) and `slider-multi` (off the compact ramp, now
`MTS-DIM`-locked), with the rest of the catalog confirmed conformant.

---

## 7 · Ratified decisions (Kim, 2026-06-18)

1. **The §1 master table (this document) is the authority** for the geometry **law** (the centering
   padding + the tabled icon/caret/font ramp). *(`component-sizes.md` was a working-name precursor for
   the hand-tuned ramp; it was never materialized as a file — its values live in §1 here, even-rounded.
   References to `component-sizes.md` below are to that absorbed precursor, not a live file.)* **Reference/law
   only** — the `scale × size(sm/md/lg)` model maps onto it; **no size-ramp migration**.
1b. **The glyph ramp is codified as a sublinear power law** (§1.1): `icon = 2.49·h^0.58`,
   `font = 3.16·h^0.45 (≈√h)`, `caret = 4.08·h^0.35` — reproduces the table to ±1px and generalizes to
   any mapped height. The fraction-of-box shrinks as the box grows (the optical correction).
   **One generating rule** (§1.3): round the power law — glyphs to even, font to nearest — so the
   canonical caret is `12,14,14,16,16,18` (the even-round; `component-sizes.md` floor-rounds SM·LG).
2. **Two families + the slot-container model** (§1.4): a **frame** that scales with height (icon, slot,
   pad, min-width, pill) and a **rhythm** that scales with font (gap, caret). Leading/trailing slots are
   the **identical `icon`-sized square**; one uniform `inline-pad = block-pad = ½(height − icon)` (the
   `height²` cell) → **no trailing-pad**. **`gap = font/2`** · **`caret = font`** (1:1). Density
   multiplies the **rhythm only**. Verified live per-control (§6's `*-DIM`/`GEO*` probes + browser legs
   — the precursor `geometry.html` demo was never ported into agent-ui).
2b. **Slot-presence padding** (§1.5): two edge cases — a **slot** edge → `½(h − icon)`, a **slotless**
   edge → **`h/2`** (= text pad `½(h−font)` + the absent slot's gap `½·font`). A control gains the gap's
   breathing room when a slot is absent (Kim 2026-06-18, "h/2 on every slotless edge"). A
   presence-driven `:has()` grid leaves no phantom gap.
3. **min-width = height** — the 1:1 floor; icon-only forced square (shipped: `BTN-CSS`).
4. **pill radius = height/2** — the one size-linked radius; the `none/sm/md/lg/full` ladder is otherwise
   flat (not size-linked).
5. **content-\*** indicators carry their own authored rows (shipped: `DIM4`).
6. **`--md-sys-space-*`** is layout spacing only (page/card/section), **not** control padding — shipped
   and density-scaled (§4.5); a third register, container interior rhythm, is ADR-0046's.

7. **Affordance taxonomy** (§4.6, the catalog-audit lesson): an **inline affordance** (caret / chevron /
   marker / clear) `= font`; a **content icon** `= --ui-ind`; a **nav-icon-in-a-button** matches its
   context (a deliberate opt-out). An inline affordance sized to `--md-sys-icon-*` is the oversize bug class —
   `GEO`/`BTN-CARET` mechanize it.

**Landed (v4, 2026-06-18):** the §5 gap is closed — the slot model + `h/2` value edge, `caret = font`
(mask + slotted), `gap = font/2`, density on the gap — each with its §6 probe; the 96-component audit
confirmed it fleet-wide (fixing `disclosure` + `slider-multi`). The two latent low-stakes cleanups the
audit flagged are also landed: the dormant field-frame `[slot=caret]` box now sizes to font (split off
the adornment `--md-sys-icon-*`, so an author-slotted field caret obeys §4.6), and the standalone
`--ui-glyph-ratio` fallback is standardized to `1` across all affordance components (was a stale-`0.75` /
no-fallback drift; runtime-tokens.css stays fallback-free per GEO1).
