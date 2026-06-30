# ADR-0037 — Control heights are the explicit §1 SET-height table (snap `--ui-height` to the ramp; supersedes the height-linear leg)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-30
>
> | Field | Value |
> |---|---|
> | **Status** | proposed — **SUPERSEDED by [ADR-0038](./0038-control-sizing-size-scale-row-lookup.md) before build. Never built.** Kim then ruled *"let's not use multipliers"*: ADR-0038 replaces the multiplier-SNAP height table here with a **hand-designed** `(size × scale) → §1-row` lookup (and removes `--ui-scale` from the control path). This ADR's *insight* — height belongs on the §1 ramp, the **same row** as the font/icon — **STANDS**; ADR-0038 realizes it by hand instead of by snapping a multiplier. |
> | **Date** | 2026-06-30 *(authored)* |
> | **Proposed by** | planning-lead — the design seat, on Kim's directive *"why are we still deriving heights when we have a set px scale? revise history if it's in old ADRs."* |
> | **Ratified by** | orchestration-lead (on the browser gate, after Kim ratifies the height table) |
> | **Repairs** | **shipped-token change**: `shared/src/tokens/dimensions.css` (`--ui-height-{sm,md,lg}` `× var(--ui-scale)` → an **explicit per-`[scale]`-tier §1 SET-height table**) + `dimensions.test.ts` · `references/geometry-sizing-spec.md §1/§3` (height is now the **set table**, not a `× scale` derivation) · `references/geometry.md` (the size-ramp section) · `button.css` / `text-field.css` read `--ui-height-*` unchanged (the *value* changes upstream) · **SUPERSEDES the height-linear leg of ADR-0007 / ADR-0033 / ADR-0035** (marker flips — Kim's "revise history") |
> | **Supersedes / Superseded by** | **Supersedes the HEIGHT-LINEAR leg of ADR-0007** (the `--ui-height = base × var(--ui-scale)` value formula), **ADR-0033 clause 1** (*"height stays linear"*), and **ADR-0035's "height-linear leg stands" marker.** What STANDS: ADR-0007's **universal-`*` declaration mechanism** (this ADR still declares per-`[scale]` tables on selectors) and height being **the frame lever**; **ADR-0035's font/icon explicit-table mechanism AND values** (verified **UNCHANGED** — clause 3). **Relates ADR-0032** (the `[scale]` ladder the table is computed against), **ADR-0025** (`--ui-type-*` display type — STAYS linear, untouched, clause 6). |

## Context

ADR-0035 snapped control **font/icon** to the §1 SET integers (an explicit per-`[scale]`-tier table) but, by its
own scope, **kept height LINEAR** — `--ui-height-{sm,md,lg} = calc(base × var(--ui-scale))` — and recorded
*"the height-linear leg stands."* That leaves a real inconsistency: at a given tier the **glyph** comes from a §1
**row** while the **box** is the linear product, slightly **off-row**. Kim's case `[size=lg][scale=content-lg]`:
font = the §1 **64-row** value (**20**), but height = `36 × 1.75 = 63` — **not** the set **64**. The glyph is on
the row; the box misses it.

Kim's directive: *"why are we still deriving heights when we have a set px scale?"* — snap the height to the §1
SET-height table too, **and** *"revise history if it's in old ADRs"* (flip the now-stale "height linear" markers).

**Root:** ADR-0035 fixed only the glyph leg; the height leg was explicitly out of its scope. The same §1
set-snapping the glyphs got should apply to the height — so **height, font, and icon all derive from ONE §1 row**.

## Decision

Replace the linear `--ui-height` mechanism with an **explicit per-`[scale]`-tier §1 SET-height table**, snapped by
the **same rule as ADR-0035** (nearest §1 height row of `16·18·20·24·28·36·48·64`; the one **h=42** tie
**rounds DOWN**). Because the height now snaps to the **same row** the font/icon already snapped from, all three
come from one row.

1. **The snap (identical to ADR-0035).** For a tier's effective height `base_height(size) × scale-multiplier(tier)`
   (ADR-0032 multipliers `0.875/1.0/1.125/1.375/1.5/1.75`), take the nearest §1 row's **height**. Same rule, same
   h=42 round-down — so height + font + icon are **mutually consistent** (one row).
2. **The height table** (python-verified; default `ui-md` = `24·28·36`, **byte-identical** to today). Per `[size]`
   row × `[scale]` column:

   | `[size]` ↓ / `[scale]` → | `ui-sm` | `ui-md` *(default)* | `ui-lg` | `content-sm` | `content-md` | `content-lg` |
   |---|---|---|---|---|---|---|
   | **sm** | 20 | 24 | 28 | 36 | 36 | 36 |
   | **md** | 24 | 28 | 28 | 36 | 36 | 48 |
   | **lg** | 28 | 36 | 36 | 48 | 48 | **64** |

   Realized in `dimensions.css` as the `ui-md` triple `(24,28,36)` on `:root`/`*`, each `[scale=<tier>]`
   repointing `--ui-height-{sm,md,lg}` to its column's triple (the #25 `--ui-compact-*` / ADR-0035 `--ui-font`
   pattern). `content-lg`/lg = **64** (Kim's case).
3. **Font/icon are UNCHANGED (proven).** The ADR-0035 font/icon tables already snapped *from the same computed
   height to the same §1 row*; snapping the height just makes the **box** land on the row the **glyphs** already
   use. Python re-snap: **0 font moves, 0 icon moves** — the height-snap row equals the font-snap row in every
   cell, and the rendered font/icon integers are exactly ADR-0035's. This ADR does **not** touch the `--ui-font` /
   `--ui-icon` tables.
4. **Derived FRAME quantities now use the SET height → cleaner integers.** `value-edge pad = h/2`,
   `slot-edge pad = ½(h − icon)`, `min-inline-size = height`, and the action **pill radius = h/2** all recompute off
   the **set** height — e.g. `content-lg`/lg: value-edge `31.5 → 32`, slot-edge `17.5 → 18`, pill `31.5 → 32`;
   `ui-sm`/md: `12.25 → 12`. The **RHYTHM** quantities (`gap = font/2`, `caret = font`) are **font**-derived →
   **unchanged**. So every derived quantity is now consistent with one §1 row, and the half-pixel pads the linear
   height produced are gone.
5. **`font%` lands exactly on §1.** With the box on the row, `font ÷ height` now equals the §1 row's tabled
   `font%` exactly (before, `font ÷ linear-height` was slightly off-row). More §1.1-faithful, not less.
6. **`--ui-type-*` (display) STAYS derived/linear** — the ADR-0025/0033 fork, **untouched**. Kim's directive is
   **heights / controls**, not display type (which has no box and whose `content-*` presence wants full linear
   growth).

## Consequences

- **Heights render the SET integers** — `content-lg`/lg = **64** (not 63); `ui-sm`/md = **24** (not 24.5); default
  `24·28·36` byte-identical. The derived decimals (24.5 / 49 / 63 …) are **GONE**.
- **Heights STEP** (the accepted parallel of ADR-0035's font stepping) — adjacent `[scale]` tiers can share a
  height; the integer pads are cleaner.
- **⚠ TIER COLLAPSE — `content-sm` ≡ `content-md` (flag for Kim).** With height snapped, `content-sm` and
  `content-md` now render **identically** across all three sizes — `h[36,36,48] · font[16,16,18] · icon[20,20,24]`.
  They **already** shared font + icon under ADR-0035 (differing *only* in linear height: 33/38.5/49.5 vs
  36/42/54); snapping the height **completes the collapse**, so two of the six `[scale]` tiers become
  pixel-indistinguishable. **Accepted** as the honest result of snapping a **sparse** ramp (the expressive rows
  36→48→64 are far apart) with **close** multipliers (`content-sm 1.375` and `content-md 1.5` are 0.125 apart) —
  two near multipliers can't resolve to distinct rows. Surfaced because it means the 6-tier ladder offers **fewer
  than 6 distinct control sizes**. **If 6 distinct tiers are a requirement**, the fix is upstream — the **ADR-0032
  multiplier ladder** (or the ramp granularity), **not** keeping height linear — a separate question, **not**
  bundled here.
- **"Revise history" (Kim-directed) — marker flips.** ADR-0007 / ADR-0033 / ADR-0035's *"height stays linear /
  height-linear leg stands"* markers flip to *"height-linear superseded by ADR-0037."* Old **Decisions** are left
  intact as history (append-only); only the supersession markers update. The chain is now
  `ADR-0007 (linear height) → ADR-0037 (§1 set-height table)`, parallel to
  `ADR-0007 → ADR-0033 → ADR-0035` for the font.
- **Stale → re-verify (on ratify + build gate):** dimensions.css (`--ui-height` table + header) + dimensions.test
  · geometry-sizing-spec §1/§3 · geometry.md (size-ramp) · the browser smoke · ADR-0007/0033/0035 markers.

## Acceptance criteria (browser-measurable — the load-bearing gate; jsdom can't see rendered px)

- **AC1 — SET-integer heights per tier.** At sampled `[size]×[scale]` tiers the rendered `block-size` is the exact
  §1 SET integer from the clause-2 table (`[size=lg][scale=content-lg]` → **64px**, NOT 63; `[size=md][scale=ui-sm]`
  → **24px**, NOT 24.5).
- **AC2 — byte-identical default.** No `[scale]` (or `ui-md`): `[size]` sm/md/lg → **24/28/36** — unchanged.
- **AC3 — negative control (the defect is gone).** `[size=lg][scale=content-lg]` height is **integer 64** (assert
  no decimal) — proving the linear `× scale` is gone, not just that a value is present; the old 24.5 / 49 / 63 are
  absent.
- **AC4 — font/icon UNCHANGED + same-row consistency.** The ADR-0035 font/icon integers still render (no
  regression), and now the box matches the glyph row (`[size=lg][scale=content-lg]` → height **64** AND font **20**
  AND icon **28** — one §1 row).
- **AC5 — derived pads use the set height.** `[size=lg][scale=content-lg]`: value-edge pad = **32** (not 31.5),
  pill radius = **32** — the half-pixels are gone.

## Slice plan (tokens-specialist owns dimensions.css; coordinate into ONE geometry wave — see report)

- **S1 — `dimensions.css` (tok-mono).** `--ui-height-{sm,md,lg}` `× var(--ui-scale)` → the explicit clause-2
  table: the `ui-md` triple `(24,28,36)` on `:root`/`*`, each `[scale=<tier>]` repointing the triple. Header note:
  §1 set-height table, cite §1 + this ADR. The `--ui-gap` (`font/2`), `--ui-font`, `--ui-icon`, `--ui-type-*`
  ledgers are **unchanged**.
- **S2 — `dimensions.test.ts` (source ripple).** The height assertions (`calc(24|28|36px * var(--ui-scale))`) →
  the explicit-table values per `[scale]` selector; **assert `--ui-type-*` stays linear** (the untouched fork) and
  the `--ui-font`/`--ui-icon` tables are unchanged.
- **S3 — consumers.** `button.css` / `text-field.css` need **no edit** (they read `--ui-{cmp}-height: var(--ui-height-*)`;
  the value changes upstream) — verify the smoke.
- **S4 — the browser smoke (the gate, AC1–AC5).** Chromium+WebKit: set-integer heights per tier, byte-identical
  default, the negative control (no decimal), font/icon-unchanged same-row, the set-height pads.
- **S5 — docs (mine, build-time).** geometry-sizing-spec §1/§3 + geometry.md (height set-snapped); flip the
  ADR-0007/0033/0035 height-linear markers (done at authoring — Kim-directed "revise history").
- Gate: `npm run check && npm test` + the browser smoke. No app-markup migration.

## Alternatives considered

- **Keep height linear (status quo)** — rejected (Kim's directive). It leaves the glyph on a §1 row and the box
  off-row — the very inconsistency that prompted this.
- **Snap height but use round-UP at the h=42 tie** (≠ ADR-0035's round-down) — rejected. Height MUST use the
  identical snap rule as the font, or at the tie the height and the font come from **different** rows
  (`sm×content-lg`, `md×content-md`) — re-introducing the glyph-off-box inconsistency this ADR removes.
- **Revisit the ADR-0032 multiplier ladder to avoid the `content-sm ≡ content-md` collapse** — deferred, not
  rejected. It is a separate question (distinct-tiers vs set-values); this consistency fix does not require it, and
  bundling a ladder redesign would over-scope a clean snap. Flagged for Kim as the place to fix it *if* 6 distinct
  tiers are required.
- **Snap `--ui-type-*` (display) too, for "consistency"** — rejected (clause 6 / the ADR-0025/0033 fork). Display
  type has no box and its `content-*` presence wants full linear growth; Kim's directive is heights/controls.
