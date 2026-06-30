# Geometry & Sizing Spec — the centering law + the size ramp

**Status:** design-of-record — **LANDED (v4, 2026-06-18).** **Authority:** the **§1 master table below** —
the hand-tuned **XS→2XL ramp** and the **centering law** it encodes. (`component-sizes.md` was the
working-name precursor for this ramp; it was never materialized as a file — its hand-tuned values are §1
here. Kim 2026-06-18: this file is the *reference/law*; the shipped `scale × size(sm/md/lg) × density`
model **maps onto** it — there is no size-ramp migration. The job *was* to make the implementation obey
the law; **it now does.**)

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

Master table — the six reference sizes (`component-sizes.md`). `lead/trail-pad` are **derived** by
the law (§2); `%` = glyph ÷ height (the *fraction of the box* the glyph occupies):

| size | height | icon | caret | font | lead-pad | spacer | trail-pad | icon% | caret% | font% |
|---|---|---|---|---|---|---|---|---|---|---|
| **XS** | 20 | 14 | 12 | 12 | 3 | 4 | 4 | 70% | 60% | 60% |
| **SM** | 24 | 16 | 14 | 13 | 4 | 4 | 5 | 67% | 58% | 54% |
| **MD** | 28 | 18 | 14 | 14 | 5 | 4 | 7 | 64% | 50% | 50% |
| **LG** | 36 | 20 | 16 | 16 | 8 | 8 | 10 | 56% | 44% | 44% |
| **XL** | 48 | 24 | 16 | 18 | 12 | 8 | 16 | 50% | 33% | 38% |
| **2XL** | 64 | 28 | 18 | 20 | 18 | 8 | 23 | 44% | 28% | 31% |

The full button anatomy: `| lead-pad | icon | spacer | label fills | spacer | caret | trail-pad |`.
(Caret = the even-rounded power law — Kim 2026-06-18, §1.3; `component-sizes.md` floor-rounds SM·LG to
`12·14`, this rounds to `14·16`.)

### 1.1 · The non-linearity, codified — glyphs scale **sublinearly** (the optical correction)

A glyph does **not** grow in proportion to the box. As height grows, each glyph occupies a *shrinking
fraction* of it (icon 70%→44% · font 60%→31% · caret 60%→28% — the `%` columns). This is the
"not purely linear across the scales" Kim flagged, and it is a **power law of height with exponent <
1**:

```
icon  = 2.49 · height^0.58          font  = 3.16 · height^0.45   (≈ 2.65·√height)
caret = 4.08 · height^0.35   (≈ √[3]{height}; tracks font a touch under)
```

These reproduce every tabled value to **±1px** — so the table is not six hand-picked points, it is
**one rule sampled six times**. The practical payoff: the same rule gives the glyphs for *any* height,
which is exactly the bridge that lets a shipped `scale × size` height **map onto the law** (§3) — feed
the mapped height to the formula, get its tabled icon/caret/font.

> **REALIZED UNDER `[scale]` (ADR-0033, 2026-06-30).** This sublinear law was honored across `[size]`
> (the tabled sm/md/lg) but **not** under `[scale]`, which scaled font **linearly** (`× --ui-scale`) —
> so `content-lg` md font was 24.5px (50% of a 49px box) instead of §1.1's ~18px (~37%). Now, under
> `[scale]`, **height stays linear** (the frame lever) but **glyphs re-derive sublinearly from the scaled
> height**: `--ui-font = base × pow(--ui-scale, 0.45)` and `--ui-icon = base × pow(--ui-scale, 0.58)`
> (anchored on `--ui-scale`, so the hand-tuned base is exact at `scale = 1`); `caret = font` and
> `gap = font/2` follow. So `[size]` and `[scale]` now agree — **any** final height gets this law's glyphs.
> (Display type `--ui-type-*` stays **linear** — it has no box, so the in-box optical correction does not
> apply; ADR-0033 / ADR-0025.)

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
integer.** That makes the table self-consistent and the derived pads monotonic in *both* value and
acceleration (lead Δ `+1,+1,+3,+4,+6`; trail Δ `+1,+2,+3,+6,+7`). The icon tail stays capped at 28
(1px under the formula's 29 — a deliberate max-icon).

The one place this departs from the raw `component-sizes.md` ink: that file **floor**-rounds the caret
to flat-pairs (`12,12…14,14`), which dips the trail-pad acceleration (Δ `+2,+1,…`). Even-rounding
gives caret `12,14,14,16,16,18`. *(Superseded for the caret by §1.4 — `caret = font`; this even-round
column remains the historical reference.)*

### 1.4 · The two families + the slot-container model (Kim ruled 2026-06-18)

The tabled values are *used* through **two families of relationships** plus a single slot mechanism
that removes asymmetric padding entirely. Every derived quantity scales with one of two things:

- **Frame — ∝ height** (the box): icon (`--ui-ind`), the slot, the padding, min-width, the pill radius.
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

*Realized in code per-glyph, not as wrapper DOM:* each glyph is sized by its **type** — icon = `--ui-ind`,
caret / affordance = font (the §4.6 taxonomy) — and centered in the height-cell by its own
`½(h − glyph)` edge pad; the presence-driven `:has()` grid (§1.5) places the cells. This is equivalent to
the icon-sized-slot framing above (the caret lands `½(h − font)` from the edge either way) and needs no
wrapper element — the slotted `<ui-icon>` / mask glyph *is* the slot, sized to its type.

**Supersedes:** the rhythm rules replace the spacer band (§1.2 `4/8` → `gap = font/2`) and the tabled
caret (§1.3 even-round, ≈0.9·font → `caret = font`). The font-relative rules deviate from
`component-sizes.md`'s hand-tuned caret by ≤2px at large sizes — Kim chose the clean rule over the
hand-tuning. The **frame** generators (`icon ≈ 2.49·h^0.58`, `font ≈ 2.65·√h`) are unchanged.
Verified live in `geometry.html` across all 6 `[scale]` contexts × 3 sizes (every cell square,
`caret = font`, `gap = font/2`, pure-CSS off the cascade).

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
Demo: the "Slot-presence model" section of `geometry.html` (5 anatomy permutations × 3 sizes, guides
toggle).

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

For a **label-only / slotless** edge (no glyph there), the law has no glyph to center; the edge takes
**`h/2`** (§1.5 — the text pad `½(h − font)` plus the absent slot's gap `½·font`), not `(height − glyph)/2`.

---

## 3 · How the shipped sizes map onto the law (reference/law-only — Kim's ruling)

> **REALIZED (ADR-0032, 2026-06-30 — closes the #24 scale-framing finding).** The `ui-sm…content-lg`
> two-band `[scale]` tier is now **implemented** in `dimensions.css`, replacing the 3-step
> `compact/comfortable/spacious` placeholder. The **control ramp** scales by a per-tier `--ui-scale`
> **multiplier** (`ui-sm 0.875 · ui-md 1.0 · ui-lg 1.125 · content-sm 1.375 · content-md 1.5 · content-lg 1.75`,
> the ADR-0007 mechanism); the **§5.2 compact-box ramp** is a separate per-tier **re-table** (`--ui-compact-*`).
> **Caveat (the magnitude-consistency design choice):** §5.2 formally tables the **compact box** — a *separate*
> system from the control ramp (§5.1). The control multiplier ladder **deliberately reuses §5.2's per-tier
> magnitudes** (each tier's compact md ÷ ui-md's 16) so **one `[scale]` tier scales the control frame AND the
> compact box by the same per-tier proportion** (ADR-0032) — a ratified design choice, not a spec-mandated
> control table. **Glyph refinement (ADR-0033):** the `--ui-scale` multiplier is **linear on HEIGHT** but
> **sublinear on the GLYPHS** — under `[scale]`, `--ui-font = base × pow(--ui-scale, 0.45)` and
> `--ui-icon = base × pow(--ui-scale, 0.58)` (§1.1), so the glyphs track the law at the *scaled* height,
> not the linear height ratio. So this §3 framing is no longer intended-only — it is the shipped model.

No size-ramp migration. The shipped two-axis model stays:
- `scale` (`ui-sm…content-lg`) × `size` (`sm/md/lg`) → a **height** (the `--ui-height-{size}` table in
  `dimensions.css`, via the linear `--ui-scale` multiplier); **font** → `--ui-font-{size}`, which under
  `[scale]` re-derives **sublinearly** (`base × pow(--ui-scale, 0.45)`, §1.1 / ADR-0033) — not the linear
  height ratio.
- A control resolves its **height** + **font** from those tables, then **obeys §1.4**: icon = `--ui-ind`
  (the frame); the identical `icon`-sized slot; uniform `inline-pad = ½(height − icon)`; and the rhythm
  rules `gap = font/2`, `caret = font`.

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
  `½(h − font)` (`BTN-CARET`). A NON-caret content icon in the same button keeps `--ui-ind`.

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

### 4.5 · `--space-*` is LAYOUT spacing — separate from control geometry
The `--space-*` scale (page gutters, card/stack gaps, section rhythm) is a **different concern** from
control padding (which is the law above). Control padding/spacers come from the ramp + §2; `--space-*`
is for the space *between* components. *(The `--space-*` semantic-naming question is deferred — it is
not part of the control sizing system.)*

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
sized to `--ui-ind`* renders ≈1.2–1.5× the text — visibly oversized. The fix is always the same — size
it `= --ui-{cmp}-glyph` (font), not the indicator ramp. The `GEO` AFFORDANCE set (§6) mechanizes this
for every masked affordance; `BTN-CARET` for the slotted button caret.

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

The `h/2` standard applies to the **comfortable controls** — `ui-button`, `ui-select`, the **fields**
(text/number/currency/percent/unit/search/masked/email/url/tel/password/pin/tags/date/time/file),
date-picker, date-range-picker, dropdown:
- a slotless/text edge → **`h/2`** — *geometric* (NOT density-scaled).
- a slot edge (icon/caret/adornment) → `½(h − icon)`, presence-driven (§1.5) — so `[label · caret]` is
  value `h/2` / caret `½(h − glyph)` (asymmetric by design).

**The compact/dense realm is a SEPARATE size system** (Kim 2026-06-18): `ui-kbd`, `ui-slider`,
`ui-slider-multi`, `ui-radio`, `ui-switch`, `ui-tag`, `ui-badge`, `ui-chip`, `ui-checkbox` and siblings
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
`date-picker`/`date-range-picker` triggers are **icon-only squares** (no value edge to halve — correct
as-is); `dropdown`/`listbox` items keep the **legacy item-pad** (item rows are not "comfortable
controls", §4.6).

### 5.2 · The compact box ramp — the two-band ladder (Kim ruled 2026-06-19)

> **REALIZED (ADR-0032, 2026-06-30).** `--ui-compact-{sm,md,lg}` is now **built** in `dimensions.css` as a
> per-tier re-table across the 6 `[scale]` tiers (the table below), keyed by the same `[scale]` as the
> control ramp. **Forward-ready** — no compact widget consumes it yet (the realm — slider/kbd/tag/radio/
> switch/checkbox/chip/badge — is unbuilt); locked by the `DIM-COMPACT` probe.

The compact/dense realm sizes its box on `--ui-compact-{sm,md,lg}` (`dimensions.css`), a ramp SEPARATE
from `--ui-ind` and from the comfortable height ramp. It is **two bands**, mirroring the comfortable
controls' two-band structure (§1.2): the **`ui-*` band is tight** (compact UI density), the **`content-*`
band is generous** (reading density — the widgets get real presence).

| scale | sm | md | lg | band |
|---|---|---|---|---|
| **ui-sm** | 12 | 14 | 16 | tight — 2px steps |
| **ui-md** (default `:root`) | 14 | 16 | 18 | |
| **ui-lg** | 16 | 18 | 20 | |
| **content-sm** | 18 | 22 | 26 | generous — 4px within-scale |
| **content-md** | 20 | 24 | 28 | |
| **content-lg** | 24 | 28 | 32 | |

The **`ui-*` band** realizes `12·14·16·18·20` (2px steps); the **`content-*` band** realizes
`18·20·22·24·26·28·32` (4px within a scale, +2 then +4 between scales). The box is **density-invariant**
(density rides the pad, not the box, §1.4); the compact pad stays `2px + box·ratio·density` (§5.1).
Mechanized: `DIM-COMPACT` (per-cell exact + the two bands asserted separately) + the smoke `COMPACT_LANES`
(the rendered box in Chromium). Demoed across the `[scale] × [size]` grid in the **"Compact controls"**
section of `geometry.html`.

---

## 6 · Mechanization (the probes that lock the law)

| Law | Probe |
|---|---|
| value edge `= h/2` (comfortable); slot edge `½(h − icon)` | per-field `*-DIM` source probes (the calc) + the smoke `CONTROL_LANES` (`SLOT_PAD` h/2, real Chromium) |
| identical leading/trailing slot = `icon` square; icon-only square | `BTN-*` source + the icon-only-square Chromium measurement |
| **mask affordance `= font`** (caret/chevron/clear/marker) | **`GEO1–3`** over the `AFFORDANCE` set (**17** components): `--ui-{cmp}-glyph = font × --ui-glyph-ratio`, referenced in styles, no eyeballed em |
| **slotted button caret `= font`** (not `--ui-ind`); edge `½(h − font)` | **`BTN-CARET`** — the probe that would have caught the oversized caret |
| compact realm on the `14→24` ramp (`--ui-compact-*`) | `DIM-COMPACT` (the ramp) + per-control `*-DIM` (e.g. **`MTS-DIM`**, which caught the slider-multi miss) |
| `gap = font/2`; density on the gap, **not** the pad | source over the token chain; Chromium: icon-only stays square under `[density]` |
| rendered px responds to size/scale/density | `DIM-R*` + per-control Chromium dim legs |
| `0 < glyph ≤ box` in the real engine | `GEO-LAW` smoke |

Every law is a probe, or it isn't a law — new geometry lands with its probe. **Completeness:** the
source probes only enforce what's *in their lists* — a masked affordance not in the `GEO` `AFFORDANCE`
set, or a control not in a `*-DIM` probe, is unguarded. The **96-component render-aware audit**
(2026-06-18) is the periodic completeness sweep that catches what the lists miss — it found `disclosure`
(affordance sized to `--ui-ind`, now in the set) and `slider-multi` (off the compact ramp, now
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
   multiplies the **rhythm only**. Verified live in `geometry.html`.
2b. **Slot-presence padding** (§1.5): two edge cases — a **slot** edge → `½(h − icon)`, a **slotless**
   edge → **`h/2`** (= text pad `½(h−font)` + the absent slot's gap `½·font`). A control gains the gap's
   breathing room when a slot is absent (Kim 2026-06-18, "h/2 on every slotless edge"). A
   presence-driven `:has()` grid leaves no phantom gap.
3. **min-width = height** — the 1:1 floor; icon-only forced square (shipped: `BTN-CSS`).
4. **pill radius = height/2** — the one size-linked radius; the `none/sm/md/lg/full` ladder is otherwise
   flat (not size-linked).
5. **content-\*** indicators carry their own authored rows (shipped: `DIM4`).
6. **`--space-*`** is layout spacing only (page/card/section), **not** control padding; its
   semantic-naming reconciliation is deferred.

7. **Affordance taxonomy** (§4.6, the catalog-audit lesson): an **inline affordance** (caret / chevron /
   marker / clear) `= font`; a **content icon** `= --ui-ind`; a **nav-icon-in-a-button** matches its
   context (a deliberate opt-out). An inline affordance sized to `--ui-ind` is the oversize bug class —
   `GEO`/`BTN-CARET` mechanize it.

**Landed (v4, 2026-06-18):** the §5 gap is closed — the slot model + `h/2` value edge, `caret = font`
(mask + slotted), `gap = font/2`, density on the gap — each with its §6 probe; the 96-component audit
confirmed it fleet-wide (fixing `disclosure` + `slider-multi`). The two latent low-stakes cleanups the
audit flagged are also landed: the dormant field-frame `[slot=caret]` box now sizes to font (split off
the adornment `--ui-ind`, so an author-slotted field caret obeys §4.6), and the standalone
`--ui-glyph-ratio` fallback is standardized to `1` across all affordance components (was a stale-`0.75` /
no-fallback drift; runtime-tokens.css stays fallback-free per GEO1).
