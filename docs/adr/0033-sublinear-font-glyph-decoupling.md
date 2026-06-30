# ADR-0033 — Sublinear font/glyph decoupling: under `[scale]`, glyphs re-derive from height via the §1.1 power laws (height stays linear)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-30
>
> | Field | Value |
> |---|---|
> | **Status** | accepted *(ratified 2026-06-30 — orchestration-lead, on the browser gate: `check` clean · jsdom 1061 · browser 178/178 Chromium+WebKit; the user's lg×content-lg case verified font 20.6 / icon 27.7, negative-controls confirm the linear 28/35 are gone)* |
> | **Date** | 2026-06-30 *(authored)* |
> | **Proposed by** | planning-lead — the design seat, on Kim's ruling "decouple font from height (sublinear)" (#28) |
> | **Ratified by** | orchestration-lead (on the browser gate) |
> | **Repairs** | `references/geometry-sizing-spec.md §1.1/§3` (the sublinear glyph law is now **realized under `[scale]`**, not just `[size]`) · **shipped-token change**: `shared/src/tokens/dimensions.css` (`--ui-font-{sm,md,lg}` `× var(--ui-scale)` → `× pow(var(--ui-scale), 0.45)`; `--ui-gap` follows via font) + `dimensions.test.ts` · `components/controls/button/button.css` (`--ui-button-icon` `× scale` → `× pow(scale, 0.58)`; the caret already `= font`) · **SUPERSEDES ADR-0007's font/glyph linear leg** (the `× var(--ui-scale)` on `--ui-font`); **relates ADR-0032** (the `[scale]` tier ladder it corrects), **ADR-0025** (`--ui-type-*` display type — stays linear, below) |
> | **Supersedes / Superseded by** | **Supersedes ADR-0007 — the font/glyph linear-derivation leg ONLY.** ADR-0007's headline decision (declare the derived ramp tokens on the universal `*` so subtree `[scale]`/`[density]` re-substitute) **STANDS**, and the **`--ui-height` linear leg** (`base × var(--ui-scale)`) **STANDS**. What is reversed is the *font/glyph value formula*: `--ui-font = base × scale` (linear) → `base × pow(scale, 0.45)` (sublinear). Per the ADR-log rule, reversing a mechanism is a supersession (a new ADR), so this supersedes that sub-decision; mark ADR-0007 *"font/glyph leg superseded by ADR-0033."* **Relates ADR-0032** (corrects how its `[scale]` ladder feeds glyphs) and **ADR-0025** (`--ui-type-*` stays linear). |

## Context

Kim (the design authority) ruled: **"decouple font from height (sublinear)."** Observation: `content-lg` buttons look **short for their text** — the font is too large for the box.

**Root cause.** ADR-0032's `[scale]` applies **one linear** `--ui-scale` to **both** height and font (`--ui-height = base × scale`, `--ui-font = base × scale`). So **font% (font ÷ height) stays at the base ratio (~50% at md) across ALL scales**. But `geometry-sizing-spec.md §1.1` codifies that glyphs scale **SUBLINEARLY** vs height — font% must **drop** as the box grows (§1: md 50% → 2XL 31%), because a glyph that grows in proportion to its box looks oversized (the optical correction). At `content-lg` md the linear font is **24.5px (50%)** in a **49px** box; §1.1 wants **~18px (~37%)**.

The fix is exactly what §1.1/§3 already state ("*feed the mapped height to the formula, get its tabled icon/caret/font*"): under `[scale]`, **height keeps scaling linearly** (the frame lever, unchanged), but **font and glyphs re-derive sublinearly** from the scaled height via the §1.1 power laws. This **unifies `[size]` and `[scale]`** — any control of a given final height gets the §1.1 glyphs for that height, regardless of how `size × scale` produced it.

**§1.1 power laws (grounded):** `font = 3.16·height^0.45` · `icon = 2.49·height^0.58` · `caret = font` (§4.1, landed) · `gap = font/2` (§1.4). These reproduce the hand-tuned §1 ramp to ±1px (`24→13.2, 28→14.2, 36→15.9, 48→18.0, 64→20.5`).

**`pow()` support is safe:** the library already requires CSS `oklch()` (294 uses in `tokens.css` — Chrome 111 / Safari 15.4 / Firefox 113). CSS `pow()` has the same-era support (Chrome 111 / Safari 15.4 / Firefox 118); a lib already gated on `oklch` can use `pow` with no new floor.

## Decision

Under `[scale]`, **height scales linearly** (unchanged) and **every glyph re-derives sublinearly** by its §1.1 exponent. The mechanism is a CSS `pow()` in the token `calc`, **anchored on `--ui-scale`** (not the absolute height — see clause 2).

1. **Height stays linear (ADR-0007 height leg, UNCHANGED).** `--ui-height-{sm,md,lg} = calc(base × var(--ui-scale))` (base 24·28·36). The frame box is the lever; it scales 1:1 with `[scale]`.
2. **Control font = `base × pow(--ui-scale, 0.45)` (sublinear; the ruling).** `dimensions.css`:
   ```css
   --ui-font-sm: calc(13px * pow(var(--ui-scale), 0.45));
   --ui-font-md: calc(14px * pow(var(--ui-scale), 0.45));
   --ui-font-lg: calc(16px * pow(var(--ui-scale), 0.45));
   ```
   **Anchoring on `scale` (not absolute height) is the load-bearing choice.** Because the hand-tuned base font *is* the §1.1 font at the base height (`base_font ≈ 3.16·base_height^0.45`), `base_font × pow(scale, 0.45) ≈ 3.16·(base_height × scale)^0.45` — i.e. it **tracks §1.1 for the final height**, *and* it is **exact at `scale = 1`** (`pow(1, 0.45) = 1`, so md = 14, sm = 13, lg = 16 — byte-identical default + exact `[size]` ramp). Verified across `size × scale` (mine vs §1.1, px): ui-md md `14.0` vs `14.2`; **content-lg md `18.0` (37%) vs `18.2` — the fix (was 24.5/50%)**; content-sm md `16.2` vs `16.3`; ui-sm md `13.2` vs `13.3` — all within rounding.
3. **The rhythm family follows font automatically (no formula change).** `--ui-gap = font/2 × density` and `caret = font` (the button `--ui-button-glyph`) are already font-derived, so they become sublinear **for free** the moment font does. No edit to the gap/caret formulas.
4. **Icon (frame glyph) = `base × pow(--ui-scale, 0.58)` (sublinear).** The content icon is §1.1's `icon = 2.49·height^0.58` (a *steeper* sublinear than font). Today `button.css` declares `--ui-button-icon: calc(18px * var(--ui-scale))` (linear) — change to `calc(18px * pow(var(--ui-scale), 0.58))` (md 18 · sm 16 · lg 20 bases). **The inline-pad `½(height − icon)` then self-corrects** — height is linear, icon sublinear, so the slot centering stays §1.1-correct as `[scale]` grows. *(The icon ramp is per-control today; **recommend hoisting a shared `--ui-icon-{sm,md,lg}` sublinear ramp** to `dimensions.css` for one source of truth as more icon-bearing controls ship — for now, decouple it where it lives, which in the shipped foundation is `button.css`.)*
5. **Display type `--ui-type-*` STAYS LINEAR (the fork — ruled).** ADR-0025's `--ui-type-*` (h1–h5/body/caption, for `ui-text`) keeps `× var(--ui-scale)` (linear). **Rationale:** the sublinear correction is the **glyph-in-a-square-box** optical rule (§1.1 is explicitly about a *control's* font%); **display type has no box** — it is free-standing document text, so there is no "fraction of the box" to shrink. Moreover the `content-*` band's intent is **reading density / real presence** — a `[scale=content-lg]` heading *should* grow fully (linearly); sublinear would undercut exactly the presence the band exists for. Control glyphs and display type are **two ledgers** (ADR-0025) with **two correct behaviors** — control font decouples (sublinear, in-box), display type stays linear (no box). ADR-0025 is unchanged.
6. **`[size]` is unaffected.** `[size]` (sm/md/lg) picks the base ramp row; at `scale = 1` every row is exact (clause 2). `[size]` and `[scale]` now *compose* through the one sublinear law: any final height (however `size × scale` produced it) gets the §1.1 glyphs for that height.

## Acceptance criteria (browser-measurable — the load-bearing gate; jsdom cannot see rendered px)

The gate is a **Chromium + WebKit** smoke measuring `getBoundingClientRect()` / `getComputedStyle` on a mounted control across `size × scale`:

- **AC1 — sublinear ratio (the fix).** At `[scale=content-lg]` `[size=md]`: rendered **height ≈ 49px**, **font ≈ 18px (≈ 37%)** — **NOT** 24.5px/50%. Tolerance ±1px on font (the §1.1 ±1px rounding). Sample ≥3 `size × scale` points and assert `font ÷ height` matches §1.1 within tolerance (e.g. content-lg lg ≈ 33%, content-sm md ≈ 42%).
- **AC2 — byte-identical default.** At `[scale=ui-md]` (or no `[scale]`, `--ui-scale = 1`) `[size=md]`: font **= 14px**, height **= 28px** (14/28 unchanged). No regression of the shipped default.
- **AC3 — `[size]` ramp within rounding.** At `scale = 1`, the sm/md/lg fonts are **13 · 14 · 16** (exact — the anchored base).
- **AC4 — negative control.** A probe asserts the **OLD linear `content-lg` font (24.5px) is GONE** (font at content-lg md is < 20px) — proving the change took, not just that a value is present (anti-vacuous).
- **AC5 — icon sublinear.** At `content-lg`, the rendered icon ÷ height is lower than at ui-md (the 0.58 sublinear), and the inline-pad `½(height − icon)` still centers (icon-only stays ~square). *(Scoped to `button` — the shipped icon-bearing control.)*
- **AC6 — display type unchanged (the fork).** A `ui-text` h1 under `[scale=content-lg]` scales **linearly** (`40 × 1.75 = 70px`), NOT sublinearly — confirming `--ui-type-*` is untouched.

## Slice plan (tokens-specialist builds; team-lead runs the browser gate + ratifies BEFORE build)

- **S1 — `dimensions.css` (the core).** `--ui-font-{sm,md,lg}`: `× var(--ui-scale)` → `× pow(var(--ui-scale), 0.45)`. The `--ui-gap` formula (`font/2 × density`) is **unchanged** (follows font). The `--ui-height`/`--ui-type-*`/`--ui-space` ledgers are **unchanged**. Update the dimensions.css header note (font is now sublinear-on-scale; cite §1.1 + this ADR).
- **S2 — `dimensions.test.ts` (source ripple).** The font assertions (`calc(13|14|16px * var(--ui-scale))`) → the `pow(var(--ui-scale), 0.45)` form. Add a source assertion that height stays linear (`× var(--ui-scale)`, no pow) and `--ui-type-*` stays linear (the fork). *(Source-structural only — the real px proof is the browser gate.)*
- **S3 — `button.css` (the icon).** `--ui-button-icon`: `× var(--ui-scale)` → `× pow(var(--ui-scale), 0.58)`. Verify the inline-pad `½(height − icon)` calc is unchanged (it self-corrects).
- **S4 — the browser smoke (the gate, AC1–AC6).** A Chromium+WebKit leg measuring font÷height across `size × scale`, the byte-identical default, the negative control, and the display-type fork. **This is the load-bearing acceptance** (jsdom can't see px).
- **S5 — docs.** `geometry-sizing-spec.md §1.1/§3`: note the sublinear law is now realized under `[scale]` (not only `[size]`); the dimensions.css header; ADR-0007 "font leg superseded" marker. *(Mine to reconcile at build time, like the #25 S3.)*
- Gate: `npm run check && npm test` green **+** the browser smoke (AC1–AC6) green. No app-markup migration.

## Consequences

- **`content-lg` controls now read correctly** — font 18 in a 49 box (37%), not 24.5 (50%). The whole `content-*` band gains its intended "generous frame, proportionate text" look; `[scale]` and `[size]` now agree (one final height → one glyph set).
- **The rhythm family decouples for free** — gap and caret follow font, so one `--ui-font-*` change cascades to the whole rhythm family with no extra edits.
- **The icon is a second, smaller change** (button-only in the shipped foundation) with a recommended shared-hoist follow-up when more icon-bearing controls land — flagged, not bundled.
- **Display type stays linear (intentional asymmetry)** — a `[scale=content-lg]` *control* gets sublinear text (in-box optical correction) while a `ui-text` *heading* scales fully (presence). This is two correct behaviors, not an inconsistency; recorded so it is not "fixed" later by mistake.
- **`pow()` is a new CSS primitive in the token layer** — safe (oklch-era), but the dimensions test asserts the `pow(...)` form, and the browser gate is now **required** for this token (a source test can't see the sublinear px). If a target ever predates `pow()`, the fallback is a hand-tuned per-tier `--ui-font` re-table (rejected here — see Alternatives).
- **ADR-0007's font leg is superseded** — its *-universal-declaration mechanism and the height leg stand; only the font/glyph value formula reverses. Mark ADR-0007 accordingly.
- **Stale → re-verify (on ratify + build gate):** geometry-sizing-spec §1.1/§3 · dimensions.css (`--ui-font-*` + header) · dimensions.test.ts (font assertions) · button.css (`--ui-button-icon`) · the browser smoke (AC1–AC6) · ADR-0007 (font-leg-superseded marker).

## Alternatives considered

- **Derive font from the ABSOLUTE final height** (`--ui-font-md = calc(3.16px * pow(var(--ui-height-md)/1px, 0.45))`, the brief's literal option (a)) — rejected in favor of anchoring on `scale`. Deriving from absolute height gives **14.16px at the default** (h=28), **violating the byte-identical-default requirement** (must be 14) and drifting the exact `[size]` ramp (13.2·14.16·15.9 instead of 13·14·16). Anchoring on `scale` (`base × pow(scale, 0.45)`) is **mathematically equivalent under scale** (since `base ≈ 3.16·base_height^0.45`) but **exact at scale = 1** — strictly better. (Same reasoning applies to the icon: `base × pow(scale, 0.58)`.)
- **A hand-tuned per-tier `--ui-font-scale` (≠ `--ui-scale`), discrete (option (b))** — rejected. A per-*tier* font multiplier does **not compose with `[size]`**: font must track the **final** height (`size × scale`), but a per-tier constant ignores `[size]`, so `[size=lg] [scale=content-lg]` would get the wrong font%. Only a function of `scale` (clause 2), applied to the per-size base, composes. (It also forfeits `pow()`'s continuity for no benefit, since `pow()` support is fine.)
- **Make display type `--ui-type-*` sublinear too (for "consistency")** — rejected (the fork, clause 5). Display type has no box, so the glyph-in-box optical correction does not apply; and the `content-*` band's presence intent wants headings to scale fully. Sublinear display type would be a *worse* result dressed as consistency. The two ledgers correctly differ.
- **Keep linear font + just cap `content-lg`'s multiplier lower** (e.g. content-lg → 1.4 instead of 1.75) — rejected. That mis-sizes the *height* (the frame the user wants generous) to compensate for the font, conflating the two levers. The §1.1 decoupling fixes the font *at any height* — the principled fix, not a per-tier patch.
