# Design intake — `ui-card` structured-container formatting (GH #807, component arm; sibling GH #808, catalog arm)

> Status: proposed · v0.1 · 2026-08-13 · Layer: intake record (fork sheet, `component-design`
> procedure)
> Refines: GH #807 (owner ruling, intake round 2026-08-12: "direction, not spec" — the Figma
> `dialog-bubble` frame sets direction; final geometry/type resolve through this process).
> Consumed by: GH #808 (the catalog + taught-idiom arm — the header-anatomy ruling here is the ONE
> place that question is decided; #808 builds its catalog vocabulary on this record's answer,
> not a second ruling).
> Refined by: `.claude/docs/adr/0186-ui-card-header-structured-format.md` (the one contract-changing
> fork this intake finds) → a future SPEC/LLD once the ADR ratifies and a build is scheduled (not
> authored here — this record is design-only, per #807's own scope fence).

## 1 · The job (one sentence)

Give `ui-card` a **structured-container** look and composition path — a formal header (leading
icon · letterspaced-uppercase-mono title · trailing status) over a divider, with label/value-chip
body rows — matching the Figma `dialog-bubble` frame's "DATE SELECTION" card, using only shipped
region/token mechanics wherever they already reach.

## 2 · Precedent sweep (patterns-table rows reused — nothing redesigned)

| Mechanism needed | Reused row / precedent | Owner |
|---|---|---|
| Header host-as-grid (leading · label · trailing) | `ui-card-header`'s existing `:has()`-driven `auto 1fr` / `1fr auto` / `auto 1fr auto` column template | `card.css:292-327` (family leading/label/trailing anatomy, ADR-0006) |
| Zero-padding shell + region inset | Container box-model — regions carry the shared 6px margin + 12/6 padding; a card holds NO padding of its own | `card.css` banner (ADR-0046/0056) |
| Nested radius / concentric corners | The one-level `--ui-card-child-radius` publish chain | `card.css:17-29,94-107` (ADR-0018) |
| A neutral pill/tag for a value or a status glyph | `ui-badge` — `intent` ∈ `neutral·info·success·warning·danger`, a pairwise-distinct non-color glyph per intent, `neutral` renders label-only (no glyph) | `badge.md` (ADR-0173/0111 F3) — the mock's green check IS `intent="success"`; a plain "Aug 14" chip IS `intent="neutral"` |
| A label ↔ value row, distributed | `ui-row[justify='between']` (main-axis distribution, no control height, `gap` off the layout-space ladder) | `row.md` (ADR-0016) |
| An uppercase, wide-tracked, label-metrics "eyebrow" treatment | The `kicker` typescale role — ALREADY letterspaced-uppercase (`0.2em` tracking, weight 400, label-class metrics) | `dimensions.css:180-189`, `text.css:86-91,259-263` (ADR-0078 cl.2b, GH #370) |
| A monospace typeface, independent of any type role | `--md-sys-typeface-mono` — an existing, orthogonal, opt-in constant ("code/figure surfaces opt into `--md-sys-typeface-mono` themselves") | `dimensions.css:96-98` |
| Hairline card border/divider color | `--ui-card-border` → `--md-sys-color-neutral-outline-variant` | `card.css:91` |

Every mechanism the mock needs already exists as a named row. **No new base class, no new
size-class, no new event, no new color role.** The intake's job is composing these, plus deciding
the one place composition genuinely runs out (§5c).

## 3 · Classification

Not a new component — this intake modifies ONE shipped control's optional formatting
(`ui-card-header`) and documents a composition idiom; it mints nothing.

- **Base class** — unchanged (`ui-card`/`ui-card-header`/`ui-card-content` all stay `UIElement`
  region members; no new tag).
- **Size-class / tier** — unchanged (`container`, per the existing descriptors).
- **Catalog posture** — unchanged for the component arm; #808 (the sibling record) is the one that
  decides the CATALOG-side binding surface for whatever this intake freezes.

## 4 · Fork sheet — the three named open questions

### (a) Header anatomy — new `ui-card` structure, a new sub-control, or a composition idiom?

**Recommendation: composition idiom, with ONE narrow, additive prop widening on the existing
`ui-card-header` (not a new sub-control, not new anatomy).**

Mint-vs-compose test applied — `references/mint-vs-compose.md`'s bar is written for a *bindable
aggregate VALUE* (does a case need to be read/written/round-tripped as one keyed value through
`ui-form-provider.values()` or an A2UI value mark?). A card header carries no value at all
(`ui-card-header` is `formAssociated: false`, a pure layout region) — the aggregate-value bar does
not apply here; it is checked and named not to gate this decision, per the reference's own scope
note. The operative test is instead ADR-0102's three-lane chooser (compose shipped controls /
widen an existing control / mint a new one):

- **Compose shipped controls (leading icon · trailing status)** — YES, already sufficient.
  `ui-card-header`'s existing `[slot='leading']`/`[slot='trailing']` grid *is* "icon · title ·
  status" structurally (`card.css:316-327`) — an author drops `<ui-icon slot="leading">` and
  `<ui-badge slot="trailing" intent="success">` today, zero component change. **No new anatomy is
  needed for the leading/trailing cells.**
- **Widen an existing control** — needed for exactly ONE thing: the title's letterspaced-mono
  treatment (§4c) is a REAL typographic switch a catalog row (#808) must be able to bind as a
  typed prop, not an author `style=` escape hatch (ADR-0102's CSS-less-consumer law: a catalog
  payload cannot express raw CSS). That forces `ui-card-header` to gain one new reflected enum
  attribute, `format` (`'default' | 'structured'`, default `'default'`) — see the ADR (§6).
  `structured` repoints the label column's typography to the `kicker` metrics + the mono typeface
  and adds a header/body divider (`border-block-end`). This is the ONE genuinely contract-changing
  fork the intake finds — filed as ADR-0186 (proposed), not self-ratified.
- **Mint a new sub-control** (a `ui-card-header-title` or similar) — REJECTED. There is no new
  interaction, no new value, no new a11y role, no new geometry class needed — the mono/letterspace
  switch is a pure CSS repoint on an EXISTING region's EXISTING label slot. Minting a control for a
  CSS-only concern fails KISS (the region already is the anatomy) and would duplicate
  `ui-card-header`'s own grid instead of widening it.

**What #808 consumes:** the anatomy is "leading slot (icon) · label slot (title text, any child —
`ui-text` or plain text) · trailing slot (status, typically `ui-badge`)" — UNCHANGED from today's
`ui-card-header`, plus the new `format="structured"` attribute as the ONE additional bindable
surface for the mono-header look. #808's catalog row for `CardHeader` needs at most one new
attribute mark (`format`, a static/one-way enum — it is a structural choice, not live status data,
so it does NOT need two-way binding); the trailing status affordance rides the EXISTING `Badge`
catalog row (already bindable `intent`), not a new "status" concept.

### (b) The label/value-chip row — existing controls composed, or a new row idiom?

**Recommendation: composition idiom, no new control.**

`<ui-row justify="between"><ui-text variant="label">Arrive</ui-text><ui-badge intent="neutral"
label="Aug 14"></ui-badge></ui-row>` reproduces the mock's Arrive/Depart rows exactly:
`ui-row[justify='between']` distributes label-start/value-end on the main axis with no control
height of its own (a pure layout primitive, `row.md`); `ui-text[variant='label']` is the fleet's
existing label-metrics role; `ui-badge[intent='neutral']` is ALREADY documented as "a plain
tag" (`badge.md`'s own `<ui-badge label="beta">` example) — precisely a value chip, zero glyph,
zero new component. Stacking N such rows inside `ui-card-content` (its existing 8px
adjacent-sibling rhythm, `card.css:379-381`) reproduces the mock's body exactly, region-padding and
all, with **zero fork** — every mechanism is already shipped and already composable today.

No new row-idiom control is recommended. The one thing this intake asks a later build to do is
non-code: add this recipe as a named row to `composition-patterns`'s table (a Repairs
item on the ADR, §6) so it is taught once instead of re-derived per consumer — documentation debt,
not a design fork.

### (c) The letterspaced-mono header type — token-ladder proposal

**Recommendation: NO new `--md-sys-typescale-*` role is minted.** The treatment is a
**composition of two already-orthogonal, already-shipped primitives** — exactly the axis
independence ADR-0078 cl.1 already established (`variant` × `size` × `as`, each free to vary
without touching the others):

1. **Metrics** — the `kicker` typescale role, unchanged (`--md-sys-typescale-kicker-medium-*`:
   uppercase-cased at the consumer, `0.2em` tracking, weight 400, label-class line-height —
   `dimensions.css:180-189`). This is not new; GH #370's 2026-07-30 ruling already shaped `kicker`
   into exactly "eyebrow" register the mock's title reads as.
2. **Typeface** — `--md-sys-typeface-mono` (`dimensions.css:98`), an EXISTING fleet constant
   ADR-0078 cl.2 deliberately fenced OUT of the typescale schema itself: *"`-font` (font-family) is
   deliberately NOT minted — the fleet has no font-family tokenization yet; a future decision."*
   That fence stands unamended here — typeface stays a SEPARATE, orthogonal axis from
   role/size/tracking, exactly as `base.css`'s own comment already models ("code/figure surfaces
   opt into `--md-sys-typeface-mono` themselves"). This intake is a second, structurally identical
   opt-in consumer, not a reason to reopen the fence.

**Where it slots in the ADR-0078 grammar:** nowhere new. `ui-text` gains NO new prop, NO new
`variant` value, NO new typescale row — verified against `text.css`, which never sets
`font-family` at all (it only ever repoints `--ui-text-{size,weight,line-height,tracking}`); a
`<ui-text variant="kicker">` already inherits whatever `font-family` its ancestor cascades in,
with zero contract change. **The realization lives entirely in `ui-card-header`'s own CSS**, under
the new `[format='structured']` attribute (§4a, ADR-0186): a `--ui-card-header-title-font` token
(default `inherit`, repointed to `var(--md-sys-typeface-mono)` under `[format='structured']`),
`text-transform: uppercase`, and the label column's font-size/weight/line-height/tracking repointed
to the `--md-sys-typescale-kicker-medium-*` row directly (mirroring `ui-text[variant='kicker']`'s
own repoint, so a bare slotted string title — no `<ui-text>` wrapper required — still gets the
correct metrics; a `<ui-text>` child, if used, additionally inherits the mono font-family for
free via cascade, no double-declaration conflict since `text.css` never opinion the family).

**Alternative considered and rejected:** widen `ui-text`'s own `variant` enum with a tenth
`"kicker-mono"` (or similar) role. Rejected — `variant` is a FLEET-WIDE contract (ADR-0078's own
27-cell matrix, consumed everywhere `ui-text` renders, not just inside a card header); minting a
role for one container's title treatment would leak a card-specific concern into the general text
primitive, and any OTHER consumer wanting the same look already can (compose `kicker` + inherited
mono font-family) without the new enum value at all. The `ui-card-header`-scoped attribute keeps
the fork's blast radius at the one control that actually needs it (KISS).

## 5 · Geometry / token realization direction

Composing with the zero-padding shell law (`card.css`'s banner: a card holds no padding of its
own; every region carries the SAME uniform 6px inset margin + 12/6 region padding) — nothing here
touches that law; `[format='structured']` only ever repoints EXISTING region-internal typography
and border tokens, never the shell's padding/margin chain.

| Token | Carries | Source (existing, reused) |
|---|---|---|
| `--ui-card-region-margin` / `--ui-card-region-pad-inline` / `--ui-card-region-pad-block` | The header row's own box (UNCHANGED — `format='structured'` never touches inset) | `card.css:83-85` |
| `--ui-card-header-title-font` (NEW, `ui-card-header`-owned) | The label column's font-family — `inherit` (default) → `var(--md-sys-typeface-mono)` under `[format='structured']` | `dimensions.css:98` |
| *(direct repoint, no new token — matches `ui-text[variant='kicker']`'s own shape)* `font-size`/`font-weight`/`line-height`/`letter-spacing` on `[format='structured']`'s label column | The kicker metrics | `--md-sys-typescale-kicker-medium-{size,weight,line-height,tracking}` (`dimensions.css:180-189`) |
| `text-transform: uppercase` on `[format='structured']`'s label column | The all-caps treatment | Mirrors `text.css:259-263`'s existing `[variant='kicker']` uppercase leg |
| `--ui-card-border` (existing, reused) | The header/body divider (`border-block-end` on `[format='structured']`) | `card.css:91` → `--md-sys-color-neutral-outline-variant` |
| `--ui-card-region-gap` (existing, reused) | leading-icon ↔ title gap (unchanged) | `card.css:301` → `--md-sys-space-sm` |
| *(no new token)* value chips | `ui-badge`'s own `--ui-badge-*` chain, `intent='neutral'` for a plain value / `intent='success'` (etc.) for a status | `badge.css`/`badge.md`, unchanged |
| *(no new token)* label/value row gap | `ui-row`'s `gap` prop (`md` reproduces the mock's rhythm) | `row.css`, unchanged |

No `--md-sys-*` system-role additions of any kind. Every new declaration lives in `ui-card-header`'s
OWN `--ui-card-header-*` chain, role-pure per the file's own banner law (STYLES blocks consume only
the control's own chain).

## 6 · What the change earns

**ONE contract-changing fork → ADR-0186 (proposed, never self-ratified):** `ui-card-header` gains
`format: 'default' | 'structured'` (default `'default'`, reflected enum attribute) — see
`.claude/docs/adr/0186-ui-card-header-structured-format.md`. Everything else in this intake (§4a's
leading/trailing composition, §4b's row idiom, §4c's typeface/metrics composition) needs no ADR —
zero new mechanism, zero fleet-contract change, pure recombination of shipped rows (matching the
`ui-form-popover` intake's own "NO ADR" precedent for the parts that stay compositional).

No SPEC/LLD is authored in this intake — #807's own acceptance scopes this record to "direction,
not spec... final geometry/type resolve through the repo's own token + design-intake process,"
satisfied here; a SPEC/LLD is the NEXT artifact once ADR-0186 ratifies and a build is scheduled.

## 7 · Decomposition + test plan (build-gating, once ADR-0186 ratifies)

Not run in this intake (design-only, per #807's scope fence — "you may NOT touch component
source"). Named here so the eventual build brief has a starting shape, not authored as a frozen
decomposition:

- Leaf 1 — `ui-card-header` gains `format` (attributes-as-API in `card-header.md` + `card-header.ts`
  `static props`), default `'default'`, hardened against an out-of-enum bound value.
- Leaf 2 — `card.css`'s `[format='structured']` STYLES leg: title typography repoint + divider
  border. A built-output test asserts the resolved `font-family` computes to the mono stack under
  `[format='structured']` and to the ambient inherited family otherwise (the TKT-0002 class — a
  cascade-dependent claim needs a real-DOM assertion, not a source-text grep).
- Leaf 3 — `card-header.md` descriptor + doc/demo page gain the `format` row and a structured
  specimen (the mock's "DATE SELECTION" card, using ONLY shipped children — `ui-icon` /
  `ui-badge` / `ui-row` / `ui-text` — proving §4's whole composition end to end).
- Leaf 4 — `composition-patterns` table gains the label/value-chip row recipe (§4b) as a
  named row — doc debt, not code, but part of the same DoD.
- Leaf 5 (once #808 is unblocked by this record) — the catalog `CardHeader` row gains the `format`
  mark; `Badge`'s existing `intent` mark is what the status affordance rides.

## 8 · Open questions (for Kim — none blocking this record's freeze)

- None blocking. One naming-taste note: `format` was chosen over `variant` (ADR-0078 already owns
  `variant` as a `ui-text`-specific vocabulary word; reusing it on `ui-card-header` for an unrelated
  enum risked reading as a type-role rather than a structural-mode switch) and over `structured`
  as a bare boolean (an enum leaves room for a future THIRD header mode without a second boolean
  prop colliding). Flag if a different name is preferred before the ADR ratifies.
