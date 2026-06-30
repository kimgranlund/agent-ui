# ADR-0035 — Control fonts/icons are the explicit §1 SET values (an explicit per-tier table; supersedes ADR-0033's pow mechanism)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-30
>
> | Field | Value |
> |---|---|
> | **Status** | accepted *(ratified 2026-06-30 — orchestration-lead, on the browser gate: `check` clean · jsdom 1074 · browser 178/178 Chromium+WebKit; lg×content-lg renders font 20 / icon 28 EXACT (toBe + Number.isInteger — pow decimals 20.6/27.7 gone), default 13·14·16 / 16·18·20 byte-identical, the §1-set stepping confirmed; h=42 tie built round-down per ratification, Kim's one-cell taste fork still open)* |
> | **Date** | 2026-06-30 *(authored)* |
> | **Proposed by** | planning-lead — the design seat, on Kim's ruling "control fonts must be the §1 SET values, not pow approximations" (#33) |
> | **Ratified by** | orchestration-lead (on the browser gate, after Kim's snap-rule + stepped-vs-smooth call) |
> | **Repairs** | `references/geometry-sizing-spec.md §1/§3` (control fonts/icons render the **exact §1 SET values** at every `[size]×[scale]` tier — the law's tabled integers, not a `pow` approximation) · **shipped-token change**: `shared/src/tokens/dimensions.css` (`--ui-font-{sm,md,lg}` `× pow(scale,0.45)` → an **explicit per-`[scale]`-tier table**; `--ui-gap` follows via font) + `dimensions.test.ts` · `components/controls/button/button.css` **or** a hoisted shared `--ui-icon-*` (the icon — fork 4) · **SUPERSEDES ADR-0033's font/icon `pow` mechanism**; **relates ADR-0032** (the `[scale]` tier ladder the table is computed against) + the **#25 `--ui-compact-*` re-table precedent** |
> | **Supersedes / Superseded by** | **Supersedes ADR-0033 — the font/icon `pow`-derivation MECHANISM only.** ADR-0033's **height-stays-linear** leg STANDS, and its **sublinear / §1-faithful OUTCOME** stands (font grows slower than height, landing on the §1 ramp). What reverses is the *realization*: `--ui-font = base × pow(scale, 0.45)` (a continuous approximation that yields decimals like 20.6) → an **explicit per-tier table of the §1 SET integers** (12·13·14·16·18·20). Mark ADR-0033 *"font/icon pow mechanism superseded by ADR-0035; height-linear leg + sublinear outcome stand."* **Relates ADR-0032/0025.** |

## Context

ADR-0033 realized the sublinear font intent as `--ui-font = base × pow(--ui-scale, 0.45)` — a continuous curve that *approximates* the geometry-sizing-spec §1 master ramp (±~0.3px). Kim ruled: control fonts must be the **EXACT §1 SET values** (the hand-tuned integers — `…12·13·14·16·18·20` for heights `…20·24·28·36·48·64`, the ramp since extended to 8 rows, §1), **not** the pow decimals. Her tell: `content-lg`/`[size=lg]` renders **20.6** (pow) where §1 says **20** — *"derived, not the set scale in the original doc."*

**ADR-0033's OUTCOME is right** (font grows slower than height, lands near §1); the **defect** is that `pow()` produces decimals that *approximate* the §1 set rather than *hit* the hand-tuned integers. The fix keeps the sublinear intent and realizes it as **explicit §1-set values** — the **#25 `--ui-compact-*` re-table precedent** (per-tier literal values on the `[scale]` selectors), not a computed `pow`.

**The grounding challenge.** §1 is now the **Kim-ratified 8-row ramp** (heights `16·18·20·24·28·36·48·64`,
caret = font, row-18 icon = 14; ratified 2026-06-30) — sparse rows **by HEIGHT**; the shipped `scale × size`
model produces **continuous** effective heights that don't all land on §1 rows. So each `[size]×[scale]`
tier's effective height (`base_height(size) × scale-multiplier(tier)`, ADR-0032 multipliers
`0.875/1.0/1.125/1.375/1.5/1.75`) must be **snapped** to a §1 row. I computed + verified the full grid
(python-checked): the default and Kim's case land exactly, and exactly **one** tier is a genuine tie.

**Re-grounding result (the corrected ramp changes no consumed value).** The earlier draft of this ADR
snapped against the prior **6-row** §1 (heights `20→64`). Re-snapping the same `[size]×[scale]` grid
against the ratified **8-row** ramp yields the **byte-identical** per-tier FONT and ICON tables — because
the two new rows (16·18) sit **below** the grid's minimum effective height of **21** (which snaps to row 20),
so no tier reaches them (proven row-by-row, both ramps). The 8-row ramp is the new snap **authority**;
the realized tables (clauses 2/4) are confirmed unchanged.

## Decision

Replace the `pow` font/icon mechanism with an **explicit per-`[scale]`-tier `--ui-font` (and `--ui-icon`) table of §1 SET values**. Height stays linear (ADR-0033 leg, unchanged); `gap = font/2` and `caret = font` follow the table for free.

1. **Snap rule — NEAREST §1 height row → its §1-set font (Kim's own model).** For a tier's effective height `h`, take the §1 row whose height is nearest `h`, and use that row's §1-set integer. This is exactly Kim's reasoning (`content-lg`/lg → effective 63 → §1 **64-row** → font **20**). It cleanly decides **every** tier except one exact midpoint (clause 3). *(Equivalent to rounding the §1.1 law `3.16·h^0.45` to the §1 set, but height-anchored is Kim's mental model and resolves more tiers cleanly.)*
2. **The full font table** (computed + verified; `*` = the one tie, clause 3). The default column (`ui-md`) is `13·14·16` — **byte-identical** to today; `content-lg`/lg = **20** (Kim's case):

   | `[size]` ↓ / `[scale]` → | `ui-sm` | `ui-md` *(default)* | `ui-lg` | `content-sm` | `content-md` | `content-lg` |
   |---|---|---|---|---|---|---|
   | **sm** | 12 | 13 | 14 | 16 | 16 | **16\*** |
   | **md** | 13 | 14 | 14 | 16 | **16\*** | 18 |
   | **lg** | 14 | 16 | 16 | 18 | 18 | **20** |

   Realized in `dimensions.css` as the `ui-md` triple `(13,14,16)` on `:root`/`*`, each `[scale=<tier>]` repointing `--ui-font-{sm,md,lg}` to its column's triple — e.g. `[scale=content-lg]{ --ui-font-sm:16; --ui-font-md:18; --ui-font-lg:20 }` (the #25 `--ui-compact-*` pattern).
3. **The one snap tie — effective height 42 (round-DOWN; team-lead-confirmed, surfaced for Kim).** Effective height **42** (at `[sm,content-lg]` and `[md,content-md]`) is **exactly midway** between §1 rows 36 (→ font 16 / icon 20) and 48 (→ font 18 / icon 24) — the §1.1 law gives font 17.0 / icon 22.5, also ties. **Ruled: round DOWN → font 16 / icon 20** (fail-safe — the original defect was glyphs looking *too big*; the smaller value never over-sizes, and is consistent with the sublinear "shrinking fraction" intent). **The team-lead's cross-check uses round-down**, and my python re-snap confirms it lands on exactly these two cells (`sm×content-lg` + `md×content-md`) — both font and icon. **Surfaced for Kim** at design ratification — she may prefer the larger §1 value (font 18 / icon 24) for these two tiers; it is a one-cell taste call, not a mechanism question, and does not block the build. *(Every other tier is unambiguous — incl. the team-lead-flagged 31.5, which resolves cleanly to §1-28 → font 14 / icon 18.)*
4. **The icon — the parallel §1-set table (fork 4, ruled YES + a placement sub-fork).** The content icon (`--ui-button-icon`, currently `× pow(scale,0.58)`) has the **same** derived-vs-set issue. **Rule: an explicit §1 icon table** (§1 icons `14·16·18·20·24·28`), same snap rule. The icon table (default `ui-md` = `16·18·20`, byte-identical):

   | `[size]` ↓ / `[scale]` → | `ui-sm` | `ui-md` | `ui-lg` | `content-sm` | `content-md` | `content-lg` |
   |---|---|---|---|---|---|---|
   | **sm** | 14 | 16 | 18 | 20 | 20 | **20\*** |
   | **md** | 16 | 18 | 18 | 20 | **20\*** | 24 |
   | **lg** | 18 | 20 | 20 | 24 | 24 | 28 |

   **Placement — (4a) HOIST a shared `--ui-icon-{sm,md,lg}` to `dimensions.css` — ACCEPTED (team-lead 2026-06-30).** One source alongside `--ui-font`; `button.css` reads it, dropping its local `pow`. This also delivers ADR-0033's recommended icon-hoist. *(Rejected alt 4b — keep the icon table in `button.css`: narrower build, but with both font + icon now explicit per-tier tables a single shared source is cleaner and forward-ready for the next icon-bearing controls.)*
5. **Height + the other ledgers unchanged.** `--ui-height-*` stays `base × scale` (ADR-0033 leg); `gap = font/2 × density` and `caret = font` follow the new font table; `--ui-type-*` (display) stays linear (ADR-0033/0025 fork, untouched); `--ui-space-*` unchanged.

## Consequences

- **Fonts/icons render the EXACT §1 integers** at every tier — `content-lg`/lg = **20** (not 20.6); default = **13·14·16** (byte-identical, no regression). The hand-tuned ramp is hit, not approximated.
- **UX implication — §1-set fonts STEP (flag for Kim).** Explicit set values jump at thresholds (`12→13→14→16→18→20`) and **some adjacent `[scale]` tiers share a font** — e.g. `content-sm` and `content-md` both render `16·16·18`; the **height climbs** (linear, continuous) while the **font plateaus** (the sublinear stepping). This is a *real* visual change from `pow`'s smooth curve: a control growing from `content-sm`→`content-md`→`content-lg` gets taller continuously but its font steps `16→16→18`. Kim ruled for the §1 set, so stepping is the **accepted, deliberate** behavior (not a regression) — recorded so it is not "fixed" back to a smooth curve later.
- **A per-tier table replaces a one-line `pow`** — more CSS (6 `[scale]` selectors × 3 font values, + 6×3 icon under 4a), but exact, order-independent, and matching the #25 `--ui-compact-*` precedent (the codebase already tables this way). The `pow()` primitive leaves the font/icon path.
- **ADR-0033's font/icon mechanism is superseded; its height-linear leg + sublinear outcome stand** — the chain `ADR-0007 (linear) → ADR-0033 (pow) → ADR-0035 (explicit §1 table)` each supersedes the prior's font realization; the *intent* (sublinear, §1-faithful) is preserved, only the *how* changes.
- **Stale → re-verify (on ratify + build gate):** geometry-sizing-spec §1/§3 (exact-set note) · dimensions.css (`--ui-font` table + `--ui-icon` if 4a + header) · dimensions.test.ts (the table assertions, replacing the `pow` ones) · button.css (icon) · the browser smoke (§1-set integers per tier) · ADR-0033 (pow-mechanism-superseded marker).

## Forks — resolved (master table ratified by Kim 2026-06-30; build-ready)

- **Master table (caret + row-18 icon) — RATIFIED by Kim.** `caret = font` (§1 fork 1) and row-18 `icon = 14` (§1 fork 2, round-to-even — keeps the icon column all-even, shares row 18's icon with row 20). The ratified 8-row ramp is the snap **authority**; re-grounding the per-tier tables against it changed **no** consumed value (Context).
- **The height-42 tie (clause 3) — round-DOWN** → font 16 / icon 20 at `[sm,content-lg]` + `[md,content-md]` (team-lead cross-check, python-confirmed to land on exactly these two cells). One-cell taste call still **surfaced for Kim** (she may prefer font 18 / icon 24); fail-safe default, does **not** block the build.
- **Stepped-vs-smooth — ACCEPTED.** Kim ruled for the §1 set, so the §1-set stepping (a font plateauing across adjacent `[scale]` tiers while the height climbs continuously) over `pow`'s smooth curve is the intended behavior, not a regression.
- **Icon placement — (4a) shared `--ui-icon-{sm,md,lg}` in `dimensions.css`** (clause 4) — accepted (team-lead); `button.css` reads it, dropping its local `pow`.

## Acceptance criteria (browser-measurable — the load-bearing gate; jsdom can't see rendered px)

- **AC1 — §1-set integers per tier.** At sampled `[size]×[scale]` tiers, the rendered `font-size` is the **exact §1 SET integer** from the clause-2 table (e.g. `[size=lg][scale=content-lg]` → **20px**, NOT 20.6; `[size=md][scale=content-lg]` → 18; `[size=sm][scale=ui-sm]` → 12).
- **AC2 — byte-identical default.** No `[scale]` (or `ui-md`): `[size]` sm/md/lg → **13/14/16** — unchanged.
- **AC3 — negative control (the defect is gone).** `[size=lg][scale=content-lg]` font is **integer 20**, NOT a decimal (assert no `.6`/non-integer) — proving `pow` is gone, not just that a value is present.
- **AC4 — icon §1-set integers** (per the clause-4 table; e.g. `[size=lg][scale=content-lg]` icon → **28**, NOT 27.7; default → 16·18·20). **Negative control (parallel to AC3):** assert the rendered icon is an integer (no `.7`/non-integer) — proving the icon `pow(scale,0.58)` is gone, not just that a value is present.
- **AC5 — gap/caret follow.** `gap = font/2` tracks the new integer fonts (e.g. font 20 → gap 10 × density); `caret = font`.

## Slice plan (tokens-specialist owns dimensions.css; team-lead runs the browser gate + Kim's call BEFORE build)

- **S1 — `dimensions.css` (the font table).** `--ui-font-{sm,md,lg}` `× pow(scale,0.45)` → the explicit clause-2 table: the `ui-md` triple on `:root`/`*`, each `[scale=<tier>]` repointing the triple (the #25 `--ui-compact-*` pattern). `--ui-gap` (`font/2 × density`) unchanged. Header note: §1-set explicit table, cite §1 + this ADR.
- **S2 — the icon table (4a, accepted).** A shared `--ui-icon-{sm,md,lg}` per-`[scale]`-tier table in `dimensions.css` (alongside `--ui-font`); `button.css` reads it and drops its local `pow(scale,0.58)`.
- **S3 — `dimensions.test.ts`** (source ripple): the `--ui-font`/`--ui-icon` assertions → the explicit-table values per `[scale]` selector (replacing the `pow` assertions); assert height stays linear + `--ui-type-*` stays linear.
- **S4 — the browser smoke (the gate, AC1–AC5).** Chromium+WebKit, the §1-set integers per sampled tier + the byte-identical default + the negative control (no decimal).
- **S5 — docs** (mine, build-time): geometry-sizing-spec §1/§3 (exact-set realized); the dimensions.css header; the ADR-0033 pow-mechanism-superseded marker.
- Gate: `npm run check && npm test` + the browser smoke (AC1–AC5). No app-markup migration.

## Alternatives considered

- **Keep `pow` and just round the output to the §1 set in CSS** (`round()` over `pow`) — rejected. CSS `round()` to a non-uniform set (the §1 fonts skip 15/17/19) is not expressible (round() takes a uniform step); and it would still compute, not declare, the hand-tuned values. An explicit table is exact, readable, and matches the #25 precedent.
- **A per-`[scale]`-tier single font multiplier** (one number per tier) — rejected. Like ADR-0033's pow, a single multiplier can't hit the non-uniform §1 set across all three `[size]` rows (the rows snap to different §1 rows per tier). The table is per-`[size]`×`[scale]`.
- **Round the snap UP (larger §1 font) at ties** — rejected as the default tiebreak (round-down is fail-safe against the over-large-font defect that triggered this) — but offered to Kim as the one-cell fork (clause 3).
- **Leave the icon on `pow`** (font-only fix) — rejected (fork 4). The icon has the identical derived-vs-set issue; leaving it on `pow` would render icon decimals against §1-set fonts — inconsistent. Both become explicit §1 tables.
- **Snap by rounding the §1.1 law `3.16·h^0.45` to the set** (instead of nearest §1 height row) — equivalent for all tiers except it leaves more apparent ambiguity (15.0/19.0 law-ties); the nearest-§1-height-row rule (Kim's model) is cleaner and resolves all but the single height-42 tie.
