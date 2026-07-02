# ADR-0032 — The `ui-sm…content-lg` two-band `[scale]` tier system (replacing the 3-step placeholder)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-30
>
> | Field | Value |
> |---|---|
> | **Status** | accepted *(ratified 2026-06-30 — orchestration-lead, on the build gate: `check` clean · jsdom 1060 · browser 176/176 across Chromium+WebKit; the two browser-test `[scale]` consumers migrated same-wave)* |
> | **Date** | 2026-06-30 *(authored)* |
> | **Proposed by** | planning-lead — the design seat, on the #25 user-ratified build-out (the #24 design-intent call resolved: `ui-sm…content-lg` is the goal, the shipped 3-step is the placeholder) |
> | **Ratified by** | orchestration-lead (on the build gate) |
> | **Repairs** | `references/geometry-sizing-spec.md §3 + §5.2` (the `ui-sm…content-lg` two-band tier + the compact-box ramp are **realized**, no longer intended-only — closes the #24 finding) · **shipped-token change**: `shared/src/tokens/dimensions.css` (`[scale]` 3-step `compact/comfortable/spacious` → the **6 tiers** `ui-{sm,md,lg}`/`content-{sm,md,lg}` as a control `--ui-scale` multiplier ladder; **NEW** the `--ui-compact-{sm,md,lg}` per-tier re-table, §5.2) + `dimensions.test.ts` (6-tier + `DIM-COMPACT`) · doc prose (`dimensions.css` header, `button.md`, `column.md`) · **relates ADR-0007** (the numeric `--ui-scale` mechanism — kept for the control ramp; the `[scale]` *vocabulary* widens 3→6) |
> | **Supersedes / Superseded by** | **Extends ADR-0007** — ADR-0007's numeric `--ui-scale`-on-`*` mechanism **stands unchanged**; this widens the `[scale]` attribute vocabulary from the 3-step placeholder to the 6-tier two-band system it always anticipated ("initial 3-step vocabulary; refinable", dimensions.css:138). Not a supersession (the mechanism is unchanged) — a vocabulary realization. **Relates ADR-0025** (the `--ui-type-*` scale, which also rides `--ui-scale` — unchanged). · **Multiplier ladder superseded for CONTROLS by ADR-0038** — Kim ruled *"let's not use multipliers"*; the `0.875…1.75` control `--ui-scale` ladder is replaced by an explicit `(scale × size) → §1-row` lookup (Kim's table). What SURVIVES: the 6 `[scale]` tier **names** (`ui-sm…content-lg`) as the row-selectors, and the `--ui-scale` **values** as the `--ui-type-*` **display** multiplier only. The `--ui-compact-*` re-table (clause 6) is unaffected. |

## Context

Task #24 surfaced an intended-vs-current gap: `geometry-sizing-spec.md §3/§5.2` specifies a **`ui-sm…content-lg` two-band scale tier**, but `dimensions.css` ships a **3-step `[scale=compact|comfortable|spacious]` → `--ui-scale` (0.875/1/1.25)** placeholder (`dimensions.css:138`, explicitly "*initial 3-step vocabulary; refinable*"). The user ratified the design-intent question: **`ui-sm…content-lg` is the goal; build it, replacing the placeholder.** Grounded against the repo at HEAD:

1. **ADR-0007's mechanism is affirmed-correct** — `--ui-scale` is a numeric multiplier declared on `*` (so a subtree `[scale]` re-substitutes per element). The control ramp consumes it: `--ui-height-{sm,md,lg} = calc(base × var(--ui-scale))` (base 24·28·36), `--ui-font-* = calc(base × var(--ui-scale))` (base 13·14·16). This ADR keeps that mechanism; only the `[scale]` *attribute → `--ui-scale` value* mapping changes.
2. **The two bands (geometry-sizing-spec.md §1.2 / §5.2):** the **`ui-*` band is tight** (compact UI density), the **`content-*` band is generous** (reading density — "real presence"). The §5.2 **compact-box** table gives explicit per-cell values across the 6 tiers (e.g. md column: ui-sm 14 · ui-md 16 · ui-lg 18 · content-sm 22 · content-md 24 · content-lg 28).
3. **The vocab overlap:** today `[scale]` AND `[density]` both use `compact/comfortable/spacious` — a genuine collision (`[scale=comfortable]` vs `[density=comfortable]`). Moving `[scale]` to `ui-sm…content-lg` **resolves it** (`[density]` keeps `compact/comfortable/spacious`, a separate axis — user-confirmed).
4. **The 3-step `[scale]`'s consumers are TESTS, not shipped-app markup.** The consumers are `dimensions.test.ts` (the selector assertions) **and two component browser geometry tests** that drive `[scale]` via `setAttribute` and assert rescaling — `controls/text/text.browser.test.ts` (`[scale=spacious]`/`[scale=compact]` on `ui-text`) and `controls/text-field/text-field-geometry.browser.test.ts` (`[scale]` on the field). No shipped-app markup sets `[scale]`. So the rename is **not** markup-breaking, but it **does** ripple to those two browser tests (migrated in the same wave: `compact→ui-sm`, `comfortable→ui-md`, `spacious→content-lg`) — **corrected from an earlier "no live consumer" sweep that missed them.**
5. **The compact-box realm is UNBUILT** — `--ui-compact-*` exists nowhere, and its consumer widgets (slider/kbd/tag/radio/switch/checkbox/chip/badge) are not shipped.

## Decision

Replace the 3-step `[scale]` placeholder with the **6-tier `ui-sm…content-lg` two-band system**, keeping ADR-0007's numeric `--ui-scale`-on-`*` mechanism. **All forks user-resolved 2026-06-30** (the control multiplier ladder confirmed; `--ui-compact-*` built now). The system uses **two mechanisms** — a **multiplier** for the comfortable-control ramp, and a **re-table** for the compact-box ramp — because §5.1 makes them separate size systems.

1. **The 6 `[scale]` tiers (the vocabulary).** `[scale]` accepts the two-band set `ui-sm`/`ui-md`/`ui-lg` (tight — UI density) and `content-sm`/`content-md`/`content-lg` (generous — reading density), replacing `compact`/`comfortable`/`spacious`. `ui-md` is the default (clause 3).
2. **The CONTROL ramp = a per-tier `--ui-scale` MULTIPLIER (ADR-0007 mechanism kept; the ladder is user-confirmed).** Each tier repoints `--ui-scale`; the control ramp stays `base × var(--ui-scale)` (base 24·28·36 / 13·14·16, unchanged):

   | `[scale]` tier | `--ui-scale` | band |
   |---|---|---|
   | `ui-sm`  | **0.875** | tight (UI density) |
   | `ui-md`  | **1.0** *(default at `:root`)* | tight |
   | `ui-lg`  | **1.125** | tight |
   | `content-sm` | **1.375** | generous (reading density) |
   | `content-md` | **1.5** | generous |
   | `content-lg` | **1.75** | generous |

   **The control ladder is a RATIFIED DESIGN CHOICE (magnitude consistency), not a spec-mandated control table.** §5.1 makes §5.2 the *compact realm's separate size system* — "*distinct from the comfortable controls' height ramp*" — so its per-cell values do **not** define a control table. We **deliberately reuse §5.2's per-tier MAGNITUDES** (each tier's compact-box md value ÷ ui-md's 16 = `0.875 … 1.75`, clean eighths) as the control `--ui-scale`, so **one `[scale]` tier scales BOTH the control frame AND the compact box by the SAME per-tier proportion** (`content-lg` → `1.75×` for both) — one coherent magnitude per tier, no second ladder to reason about. The values are **user-confirmed (2026-06-30)**. This resolves the earlier escalation: the spec tables the compact box; the control multiplier *ladder* is our magnitude-consistency choice (citing §5.1's separate-system caveat), and a multiplier — not a re-table — is right for controls because §5.1 scopes the non-uniform two-band step-structure to the compact realm (clause 6), not the control ramp.
3. **Default = `ui-md` at `:root` → `--ui-scale: 1` (visual UNCHANGED).** `:root` keeps `--ui-scale: 1`; `[scale=ui-md]` is the explicit `1.0`. No-attribute rendering is byte-identical to today's comfortable=1 — the default control sizes do not move.
4. **The other ledgers are untouched.** `--ui-height-*`/`--ui-font-*` (base values), `gap = font/2 × density`, `--ui-type-* × scale`, `--ui-space-* × density` — all unchanged. This ADR's control-ramp change is **only** the `[scale]` selector block (3 → 6).
5. **`[density]` stays `compact/comfortable/spacious` (separate axis) — vocab overlap RESOLVED.** No change to `[density]`. `[scale]` (frame size, `ui-sm…content-lg`) and `[density]` (rhythm, `compact/comfortable/spacious`) now have disjoint vocabularies — the two axes read unambiguously.
6. **The COMPACT-box ramp `--ui-compact-{sm,md,lg}` = a per-tier RE-TABLE, BUILT NOW (user override 2026-06-30).** §5.1 makes the compact/dense realm (slider/kbd/tag/radio/switch/checkbox/chip/badge) a **separate** size system, "*distinct from the comfortable controls' height ramp*"; its two bands are **non-uniform** (a multiplier can't express them), so each tier publishes explicit `--ui-compact-{sm,md,lg}` rows (§5.2):

   | `[scale]` tier | sm · md · lg | band |
   |---|---|---|
   | `ui-sm` | 12 · 14 · 16 | tight — 2px steps |
   | `ui-md` | 14 · 16 · 18 | tight |
   | `ui-lg` | 16 · 18 · 20 | tight |
   | `content-sm` | 18 · 22 · 26 | generous — 4px within-scale |
   | `content-md` | 20 · 24 · 28 | generous |
   | `content-lg` | 24 · 28 · 32 | generous |

   The user **overrode the defer-recommendation** — the full §5.2 compact ramp ships **with** the scale tiers (forward-ready: no compact widget consumes `--ui-compact-*` yet; the box is **density-invariant** — the compact pad `2px + box·ratio·density` rides the pad, §5.1). It lands with a presence probe (`DIM-COMPACT`: per-cell exact + the two bands asserted separately). The compact ramp is keyed by the **same `[scale]` tier** as the control multiplier, so one `[scale]` attribute drives both systems consistently.
7. **Migration — hard-replace; the consumers are all tests, migrated same-wave.** The 3-step selectors are removed; `dimensions.test.ts` updates to the 6-tier assertions; **the two browser geometry tests that drive `[scale]` (`text.browser.test.ts`, `text-field-geometry.browser.test.ts`) migrate to the new tier names + expected px** (clause 4); the doc prose naming the 3-step (`dimensions.css` header, `button.md`, `column.md`) updates to `ui-sm…content-lg`. No shipped-app markup to migrate. No back-compat aliases (they would re-introduce the `comfortable`/`spacious` collision with `[density]` — the very overlap this resolves).
8. **geometry-sizing-spec.md §3 reconciled (closes the #24 finding).** With the tier BUILT, the authority's `ui-sm…content-lg` framing is **realized**, not intended-only; the #24-flagged tension (authority tier vs the 3-step placeholder) is resolved in favor of the tier. The dimensions.css header note "initial 3-step vocabulary; refinable" is replaced with the 6-tier model + a pointer to this ADR.

## Consequences

- **The default visual does not move** — `ui-md = 1.0 = :root` is today's comfortable. Existing controls/tests that don't set `[scale]` are byte-identical. Only a control under an explicit `[scale=…]` tier resizes — and the old `[scale=comfortable]` (=1) maps to the new `[scale=ui-md]` (=1), so even an explicit comfortable is visually preserved (under a new name).
- **The `[scale]` vocabulary is breaking by NAME** (3 words → 6 tiers), but **non-breaking for shipped-app markup** (no app sets `[scale]`). The test ripple is `dimensions.test.ts` (the selector assertions: 3 → 6) **+ the two browser geometry tests that drive `[scale]` (`text.browser.test.ts`, `text-field-geometry.browser.test.ts`), migrated same-wave** + the doc prose. The mechanism (ADR-0007), the control ramp base values, and every other ledger are unchanged — so the build is narrow (one CSS selector block + the tests + prose).
- **Two mechanisms, one `[scale]` axis** — the control ramp scales by a **multiplier** (clause 2), the compact-box ramp by a **re-table** (clause 6), both keyed by the same `[scale]` tier. The split is forced by §5.1 (the compact realm is a separate system with non-uniform bands a multiplier cannot express). The control ramp keeps ADR-0007's mechanism + base values; the compact ramp is a new explicit table.
- **`--ui-compact-*` ships now but unconsumed** (user override) — the compact widgets (slider/kbd/tag/…) are unbuilt, so the `--ui-compact-*` tokens are **forward-ready** with a presence probe (`DIM-COMPACT`), not yet driving a rendered box. The risk accepted: a forward-ready table can drift from its eventual consumer's needs; the §5.2 spec + the probe mitigate it.
- **Stale → re-verify (on ratify + build gate):** geometry-sizing-spec.md §3 + §5.2 (intended → realized — closes #24) · dimensions.css (`[scale]` block + header + the `--ui-compact-*` table) · dimensions.test.ts (6-tier `[scale]` + `DIM-COMPACT`) · button.md / column.md (3-step prose) · a browser smoke (a control rescales under each of the 6 tiers).

## Forks resolved (user, 2026-06-30)

- **The control multiplier ladder (clause 2): CONFIRMED** — `0.875 / 1.0 / 1.125 / 1.375 / 1.5 / 1.75` (the §5.2-derived ladder), user-verified faithful to the two-band intent. *(The earlier escalation — "the control-ramp-per-tier is underspecified, §5.2 is a separate compact system" — is resolved: the user confirmed these multiplier values for the control ramp AND directed the compact ramp to its own §5.2 re-table. Both mechanisms, both keyed by `[scale]`.)*
- **`--ui-compact-*` scope (clause 6): BUILD NOW** — the user **overrode** the defer-recommendation; the full §5.2 compact ramp ships with the scale tiers (forward-ready).

## Alternatives considered

- **One mechanism for both ramps (multiplier-only, or re-table-only)** — rejected. §5.1 makes the comfortable-control and compact-box ramps *separate systems*: the control ramp is well-served by a multiplier (uniform within-size scaling, ADR-0007 mechanism kept), but the compact ramp's two bands are *non-uniform* (ui-* 2px / content-* 4px within-size steps) — a multiplier cannot express that, so it needs the explicit re-table. Forcing one mechanism would either mis-size the compact bands (multiplier-only) or needlessly re-table the controls + abandon ADR-0007 (re-table-only).
- **Keep a single numeric `[scale]` (a free multiplier, no named tiers)** — rejected. The user ratified the *named* two-band tier (`ui-sm…content-lg`); named tiers give the agent/author a semantic vocabulary (UI-density vs reading-density) that a raw number does not, and they match the §3/§5.2 authority.
- **Back-compat: keep `compact/comfortable/spacious` as aliases of three of the new tiers** — rejected. It would re-introduce the `comfortable`/`spacious` collision with `[density]` (the overlap this resolves), and the only consumers are tests (migrated same-wave), not shipped-app markup — so aliases buy nothing. Hard-replace is clean.
- **Defer `--ui-compact-*` to the first compact widget** (my original recommendation) — **overridden by the user** (build now). The defer rationale (unconsumed forward-ready tokens) was outweighed by the user's preference to materialize the full §3/§5.2 two-band system in one wave; the `DIM-COMPACT` probe + the §5.2 spec guard against drift.
- **Re-map the default to a non-1.0 tier** — rejected. Keeping `ui-md = 1.0 = :root` preserves the shipped default exactly (no surprise resize of existing controls), and 1.0 is the natural anchor of the ladder.
