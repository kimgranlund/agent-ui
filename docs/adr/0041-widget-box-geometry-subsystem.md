# ADR-0041 — The widget-box geometry sub-system: Kim's 8-value ramp + the 2px inset law (the Indicator/Range box, mirroring ADR-0038)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-30
>
> | Field | Value |
> |---|---|
> | **Status** | proposed *(the widget table + the inset law are **Kim-ratified 2026-06-30** — all 3 forks resolved; the ADR moves `proposed → accepted` on the token green gate)* |
> | **Date** | 2026-06-30 *(authored)* |
> | **Proposed by** | planning-lead — the design seat, on the team-lead's control-suite brief (#49 B): the widget-size geometry for the Indicator/Range classes |
> | **Ratified by** | Kim ratified the **widget [size]×[scale] table** exactly as proposed (clause 2; as she did the control table, ADR-0038); orchestration-lead ratifies the ADR on the green gate |
> | **Repairs** | `references/geometry-sizing-spec.md §5.2` (the compact-box ramp → Kim's clean 8-value widget ramp; the realm becomes CONSUMED) + `references/geometry.md` (the Indicator size-class lever) · **shipped-token change**: `shared/src/tokens/dimensions.css` (`--ui-compact-{sm,md,lg}` re-tabled per `[scale]` to the widget ramp) + `dimensions.test.ts` · reconciles the **stale `--ui-ind-{size}` name** (geometry.md / goals.md G6) — it does NOT exist; widget GLYPHS ride `--ui-icon-*` (ADR-0035), the widget BOX rides `--ui-compact-*` (this ADR). **Relates ADR-0038** (the control lookup this mirrors), **ADR-0032** (built the `--ui-compact-*` re-table this revises), **ADR-0035** (the glyph ramp). |
> | **Supersedes / Superseded by** | **Revises ADR-0032's §5.2 compact-box ramp** (the two-band `12·14·16·18·20` / `18→32` ladder → Kim's single 8-value ramp; the per-`[scale]` re-table MECHANISM stays — it predates and matches ADR-0038's explicit-table form). No control-ramp change (ADR-0038 stands). |

## Context

The FACE suite's **Indicator** controls (`ui-checkbox`/`ui-switch`/`ui-radio`) and **Range** controls
(`ui-slider`/`ui-slider-multi`) are NOT full-height Control-class — their box is a small **widget box**, not
`--ui-height-*`. geometry-sizing-spec §5.1 calls this the "compact/dense realm — a SEPARATE size system," and
§5.2 already SHIPPED a `--ui-compact-{sm,md,lg}` per-`[scale]` re-table (ADR-0032) — **forward-ready, unconsumed**
(no widget exists yet). But §5.2's ramp is a **two-band** ladder carrying values (`26`, `32`) that are **not** in
Kim's new widget ramp, and the Indicator-class lever is mis-named `--ui-ind-{size}` (geometry.md / goals.md G6) —
a token that **does not exist** (verified): glyphs ride `--ui-icon-*` (ADR-0035), there is no `--ui-ind`.

Kim provided the **widget ramp: `12·14·16·18·20·22·24·28`** (8 box sizes) — the widget analog of the §1
control ramp (`16·18·20·24·28·36·48·64`). This ADR sizes the widget box on it via the **same lookup mechanism
as ADR-0038** (an explicit per-`[scale]` table, no multiplier), adds the **2px inset law** for thumbed widgets
(switch/range), and reconciles §5.2 + the stale `--ui-ind` name.

## Decision

1. **Kim's widget ramp is the Indicator/Range box ramp.** `12·14·16·18·20·22·24·28` (8 widget-box sizes). The
   widget box rides `--ui-compact-{sm,md,lg}`; `[size]` selects sm/md/lg; `[scale]` re-tables — **identical
   mechanism to ADR-0038's control lookup** (explicit `:root` + `[scale]` literals, no `× --ui-scale`).
2. **The widget [size]×[scale] → ramp lookup (CANDIDATE — Kim gates the exact table).** Default `ui-md` =
   `14·16·18` (preserves the shipped §5.2 default); the ui band is unchanged from §5.2; the content band is
   reconciled onto Kim's clean ramp (off the `26`/`32`):

   | `[scale]` ↓ / `[size]` → | **sm** | **md** | **lg** |
   |---|---|---|---|
   | **ui-sm** | 12 | 14 | 16 |
   | **ui-md** *(default)* | 14 | 16 | 18 |
   | **ui-lg** | 16 | 18 | 20 |
   | **content-sm** | 18 | 20 | 22 |
   | **content-md** | 20 | 22 | 24 |
   | **content-lg** | 22 | 24 | 28 |

   Verified: every cell ∈ Kim's ramp; monotonic both axes; default byte-identical; **all 8 values used, all 6
   `[scale]` tiers distinct** (the widget ramp is denser/more-linear than the sparse §1 control ramp, so — unlike
   ADR-0038's `content-sm≡ui-md` overlap — the widget tiers resolve to **distinct** triples). This is consistent
   with ADR-0038's *mechanism* (an explicit per-`[scale]` lookup) while its *shape* differs because the ramp is
   denser. **Kim ratifies this table** (the de-collapse discipline: I propose, Kim rules — see Forks).
3. **The 2px inset law (thumbed widgets — switch/range).** A widget with a **thumb in a track** (switch knob,
   slider handle) insets the thumb **2px** inside the track box on every edge: `thumb = box − 2×2px`,
   `track = the widget box`. The inset is **geometric** (frame family) — **density-invariant** (density rides the
   gap/rhythm, never the inset, per §1.4). For a switch the *track* is a pill (`radius = box/2`), the *thumb* a
   `box − 4px` circle inset 2px; for a slider the *track* is a thin rail and the *thumb* a `box`-scaled handle.
   The 2px is a **fleet constant** (a shared `--ui-widget-inset: 2px`, the `--ui-radius-base`/`--ui-glyph-ratio`
   constant-token pattern), so the law is one greppable source.
4. **Reconcile the stale `--ui-ind` name.** geometry.md's Indicator-class lever "`block/inline-size:
   var(--ui-ind-{size})`" and goals.md G6's "box rides `--ui-ind-{size}`" are **superseded**: the widget BOX
   rides **`--ui-compact-*`** (this ADR), widget GLYPHS (a checkmark, a count) ride **`--ui-icon-*`** (ADR-0035).
   `--ui-ind` never shipped; the docs are repaired to the real tokens.
5. **The realm becomes CONSUMED.** §5.2's "forward-ready, no consumer" note is retired — checkbox/switch/radio/
   slider build on `--ui-compact-*` (the C-primitive designs, #49 C). The compact **pad** law (`2px +
   box·ratio·density`, §5.1) and the **density-on-rhythm-not-box** rule (§1.4) are unchanged.

## Consequences

- **One geometry mechanism, two ramps:** Control class → §1 ramp via ADR-0038; Indicator/Range class → the
  widget ramp via this ADR; **same explicit per-`[scale]` lookup, no multiplier.** A reader learns it once.
- **The widget content band gets 2px-stepped + clean** (`18·20·22` / `20·22·24` / `22·24·28`) vs §5.2's
  4px-generous `26`/`32` — Kim's ramp drops those, so the content widgets are slightly tighter and uniform
  (FORK F2). The ui band is byte-unchanged from §5.2.
- **The `--ui-ind` confusion is closed** — no future control reaches for a token that doesn't exist.
- **Stale → re-verify (on ratify + build):** geometry-sizing-spec §5.2 + geometry.md (Indicator lever) ·
  dimensions.css (`--ui-compact-*` table + `--ui-widget-inset`) + dimensions.test · the widget browser smoke.

## Forks — RESOLVED (Kim ratified 2026-06-30)

- **F1 — the widget [size]×[scale] table — RATIFIED.** Kim ratified the clause-2 table **exactly** as
  proposed (`ui-sm 12·14·16 · ui-md 14·16·18 · ui-lg 16·18·20 · content-sm 18·20·22 · content-md 20·22·24 ·
  content-lg 22·24·28`); default ui-md `14·16·18` byte-identical; 6 distinct tiers.
- **F2 — content-band generosity — 2px-clean (recommended) ADOPTED.** The 2px-stepped content band
  (`18·20·22`→`22·24·28`, all 8 ramp values used) stands; the 4px-generous alternative (with its top collapse)
  is rejected.
- **F3 — the 2px inset — flat `2px` ADOPTED.** A fleet constant `--ui-widget-inset: 2px`, **flat** across the
  ramp (a frame constant like a 1px border, not box-scaled), density-invariant. Thumb = `box − 2×2px`.

## Acceptance criteria (browser-measurable)

- **AC1 — widget box renders the ramp.** Sampled `[size]×[scale]` widgets render the exact clause-2
  `--ui-compact` integer (e.g. `[content-lg][lg]` → 28px box; default `ui-md` → 14·16·18).
- **AC2 — default preserved.** No `[scale]`/`ui-md`: sm/md/lg → 14·16·18 (the §5.2 default, byte-identical).
- **AC3 — the 2px inset.** A switch thumb = `box − 4px` (2px each edge); a slider thumb insets 2px; the inset
  holds under `[density]` (density-invariant) and is a flat 2px across the ramp.
- **AC4 — no multiplier.** The widget box shows no `--ui-scale` dependence (explicit lookup, like ADR-0038).
- **AC5 — `--ui-ind` is gone from the docs** (geometry.md/goals.md repaired to `--ui-compact`/`--ui-icon`).

## Slice plan (folds into the #49 D foundation wave; tok-mono owns dimensions.css)

- **S1 (tok-mono) — `dimensions.css`:** re-table `--ui-compact-{sm,md,lg}` per `[scale]` to Kim's ratified
  widget table (clause 2); add `--ui-widget-inset: 2px` (`:root` constant). `dimensions.test` (the table per
  `[scale]` + the inset).
- **S2 (planning-lead, this ADR) — docs:** geometry-sizing-spec §5.2 (the ramp + consumed note) + geometry.md
  (Indicator lever → `--ui-compact`; the 2px inset law) + the `--ui-ind` repair — at ratify time.
- **S3 (exec) — the widget browser smoke** (AC1–AC4), built with the first Indicator control (checkbox).
- Gate: `npm run check && npm test` + the widget smoke. No app-markup migration.

## Alternatives considered

- **Keep §5.2's two-band ramp (26/32)** — rejected; Kim's 8-value ramp drops them, and a single clean ramp +
  the ADR-0038 mechanism unifies the geometry story.
- **A `--ui-scale` multiplier for the widget box** — rejected; ADR-0038 removed multipliers from the control
  path for consistency + the same-row guarantee. The widget box uses the same explicit lookup.
- **Keep `--ui-ind` as the lever** — rejected; the token doesn't exist (verified). The widget box is
  `--ui-compact-*`; glyphs are `--ui-icon-*` (ADR-0035). The docs are repaired, not the code bent to a ghost.
- **Scale the 2px inset with the box** — rejected (F3); the inset is a frame constant (like a 1px border) —
  a flat 2px reads correctly from the 12-box to the 28-box; scaling it would over-thicken the small widgets.
