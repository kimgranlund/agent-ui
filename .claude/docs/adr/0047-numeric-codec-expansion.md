# ADR-0047 — Numeric-codec expansion: multi-currency, unit/percent suffixes, generalized steppers + range validity

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-01
>
> | Field | Value |
> |---|---|
> | **Status** | accepted *(2026-07-01 — ratified on the green Wave-5A gate: component-reviewer G5-done shippable [COMPOSE 4.8 · REALIZE 4.8], check + jsdom 153 + cross-engine browser 46 green, the 4 review findings cleared [M1 per-type-signal codec-listener fix + m2 marginal + m3 percent gestalt twin + m4 CSS NCs])* |
> | **Date** | 2026-07-01 |
> | **Proposed by** | planning-lead — the design seat, on the Wave-5 brief (#49 / #98): complete the `ui-text-field` numeric `type` family (Kim: "currencies, units, units with steppers"). |
> | **Ratified by** | orchestration-lead — on the green G6 gate (the per-type numeric matrix + the cross-engine adornment-geometry smoke) |
> | **Repairs** | `controls/text-field/text-field.{ts,css,md}` (the `TYPE_CONFIG` v2 + the 5 new props + `#step` clamp + range validity) · `traits/value-codec.ts` (the numeric core + `currencyCodecOptions(currency, locale)` + `unitCodecOptions(unit, locale)` + `currencySymbol`/`unitLabel` helpers) · `.claude/docs/decompositions/control-suite-wave5-input-codecs-pickers.decomp.md` (Wave 5A) · **Extends ADR-0044** (the Wave-3 `type`-resolver + valueCodec seam it grew) + **relates ADR-0012** (the leading/trailing slot adornments) + geometry-sizing-spec §4.6 (affordance `= font`). |
> | **Supersedes / Superseded by** | None. **Extends ADR-0044** (the numeric codec / type-resolver established there). |

## Context

Wave 3 (ADR-0044) shipped `ui-text-field type ∈ {…, number, currency}` with a `valueCodec` display↔canonical
split. `currency` was **USD-only** (a hardcoded `$` + fixed 2-fraction format); `number` had a fixed `±1`
stepper and no `min`/`max`. Kim's Wave-5 directive is comprehensive numeric coverage — **multi-currency, units,
units with steppers**. The single `trailing` role in `TYPE_CONFIG` cannot express a type that needs BOTH a text
suffix (`kg`, `%`) AND steppers, and the codec factories bake in USD.

## Decision

We will **generalize the numeric type family** — no new overlay, additive over the shipped field
(`type=text` stays byte-identical).

1. **`TYPE_CONFIG` v2** splits the single `trailing` role into `{ leading, suffix, affordance, codec, validation }`
   so `unit`/`percent` carry a **suffix span + steppers** in a trailing flex cell, while the exclusive
   interactive affordances (search clear, password reveal) still own the cell alone. A non-null `codec` **implies
   steppers** (every numeric type is steppable). NEW types **`unit`** and **`percent`**.
2. **The codec factories rebuild on a shared numeric core.** `currencyCodecOptions(currency, locale)` resolves
   the **per-currency fraction digits** from `Intl.NumberFormat(…,{style:'currency',currency}).resolvedOptions()`
   (USD 2 · JPY 0 · BHD 3) and formats the number only — the symbol is the leading adornment via a generalized
   `currencySymbol(currency, locale)` (`narrowSymbol`). `unitCodecOptions(unit, locale)` delegates to the numeric
   core (the `unit` param **reserved** for future per-unit precision); the unit **label** comes from
   `unitLabel(unit, locale)` (`Intl` `style:unit` short → the raw string on an invalid unit). **`percent` reuses
   `numberCodecOptions`** — its canonical is the **typed number** (`"50"`), NOT Intl-percent's ÷100.
3. **Generalized steppers + range.** New props `step` (`prop.number`, default 1), `min`/`max` (`prop.string`,
   `''` = unconstrained — native `.min`/`.max` are strings), `currency` (`'USD'`), `unit` (`''`) — all reflected
   (native attribute-backed-IDL parity). `#step(±1)` clamps `current + dir*step` to `[min,max]`; **ArrowUp/Down on
   the editor** step too (native `type=number` parity). `formValidity()` adds `rangeUnderflow`/`rangeOverflow`
   from `min`/`max`; **`stepMismatch` is NOT enforced** (too strict for free numeric entry).

Owning docs repaired by ID: the decomp's Wave-5A `TYPE_CONFIG` v2 + prop table hold the facts; this ADR records
*why*.

## Consequences

- **`percent` canonical = the typed number, not a fraction.** `type=percent` submits `"50"` for a field showing
  `50 %`. This is the less-surprising form-value convention (a consumer needing 0.0–1.0 divides by 100 itself);
  the opposite (Intl's ÷100) is the recorded, rejected alternative. **Caveat to document in `text-field.md`.**
- **Localized numeric parsing stays simple-strip.** The codec strips to `[\d.\-]` — robust for grouping
  separators, but a locale using `,` as the decimal separator (`1.234,56`) parses loosely. Recorded caveat
  (unchanged from ADR-0044); pin `en-US` in tests for determinism.
- **`unitCodecOptions` currently has no numeric behaviour distinct from `numberCodecOptions`** — it exists as a
  named seam with a reserved `unit` param. Honest redundancy (a future per-unit precision rule fills it); the
  unit-specificity that matters today is the adornment label.
- **Reflecting `step`/`min`/`max`/`currency`/`unit`** adds five reflected attributes to the field's surface —
  native-parity and declaratively authorable; echo cost is nil (static config, not the live value).
- **Stale → re-verify:** `text-field.{ts,css,md}` + its descriptor trip-wire · `value-codec.ts` + its test ·
  the decomp · goals §G6 · the adornment-geometry smoke (the suffix/symbol/steppers `= font`, Chromium + WebKit).

## Acceptance

Per-type matrix (jsdom): the currency symbol + fraction digits per `currency` (USD `$`/2 · JPY `¥`/0 · BHD 3);
the unit label per `unit` (valid CLDR → `kg`, invalid → raw); the `%` suffix; steppers step by `step`, clamp to
`[min,max]`, and ArrowUp/Down mirror them; `rangeUnderflow`/`rangeOverflow` on bound violation; `stepMismatch`
never raised; percent canonical = the typed number; `type=text` byte-identical (existing tests green). Browser
smoke (Chromium + WebKit): the adornments render `= font` per `[size]×[scale]` (exact px); forced-colors keeps
the glyphs. C10 zero-residue.

## Alternatives considered

- **Bake the unit/`%` into the formatted display string** (`Intl` `style:unit` → `"5 kg"` in the editor) —
  rejected: it couples the number and its label, complicates parse/caret UX, and breaks the shipped currency
  separation (symbol = adornment, number = plain). The suffix-as-adornment model is uniform with currency.
- **Percent canonical = Intl ÷100** (`50 %` → `0.5`) — rejected: surprises authors wiring a form value; the
  typed-number canonical matches the visible field. Documented so a fraction-needing consumer converts explicitly.
- **Enforce `stepMismatch`** — rejected: a currency/unit field forcing exact `step` increments would reject
  legitimate free-typed values; steppers are a convenience, not a constraint. Opt-in only if asked.
- **A distinct `unitCodecOptions`/`percentCodecOptions` with real logic** — rejected as currently vacuous: unit
  and percent are free decimals numerically identical to `number`. Kept `unitCodecOptions` as a reserved seam;
  folded percent into `numberCodecOptions`.
- **`min`/`max` as `prop.number`** — rejected: a numeric default can't carry the unset/no-bound state; native
  `.min`/`.max` are strings where `''` = unconstrained.
