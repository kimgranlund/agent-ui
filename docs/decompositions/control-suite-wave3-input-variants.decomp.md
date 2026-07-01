# Decomp — Control suite Wave 3: Input variants (config-driven `ui-text-field` `type` growth)

> #49 Wave 3 (milestone **G6/G7**). **NOT new tags** (Kim ruled) — `ui-text-field` GROWS a `type` prop; a
> type-resolver drives inputmode + auto-adornments (ADR-0012 slots) + codec + validation. **Modifies the SHIPPED
> G6-done `ui-text-field`** — the growth is **additive** (`type` defaults `'text'` = today's behavior,
> byte-compatible; existing text-field tests stay green). Bake the Wave-1 review lessons in upfront. · proposed ·
> 2026-06-30 · planning-lead

## The model

`ui-text-field` gains `type: enum(['text','email','url','tel','password','search','number','currency'], 'text')`
(reflected). A **static type-resolver** (an `as-const` map — erasableSyntaxOnly, no enum) maps `type` → the
config below; the control applies it (inputmode on the editor, auto-adornments into the existing leading/trailing
slots, the codec, the validation). `type='text'` resolves to the identity config → **no behavior change**.

### The type-resolver (the core `as-const` map)

| `type` | `inputmode` | leading slot | trailing slot | codec | validation |
|---|---|---|---|---|---|
| **text** | `text` | — | — | identity | — |
| **email** | `email` | — | — | identity | email pattern (`setCustomValidity`/typeMismatch) |
| **url** | `url` | — | — | identity | url pattern |
| **tel** | `tel` | — | — | identity | — |
| **search** | `search` | magnifier (mask glyph) | **clear ✕** (control-injected, when non-empty) | identity | — |
| **password** | `text` | — | **reveal toggle** (eye) | identity | — (+ masking, below) |
| **number** | `numeric` | — | optional steppers (▲▼) | number codec | numeric range/step |
| **currency** | `decimal` | currency symbol | — | currency codec | numeric |

Auto-adornments go into the **existing ADR-0012 leading/trailing slots** (control-injected parts, like the
editor) — no new anatomy. The interactive ones (clear ✕, reveal, steppers) are `data-role` affordances sized
`= font` (§4.6), emitting through the control.

## The password-masking DECISION (the one real wrinkle — RULED)

`ui-text-field` is **contenteditable** (no native `<input>`, ADR-0014), so `<input type=password>` masking is
unavailable. **Decision: `-webkit-text-security: disc` on the editor part** (a de-facto-standard, universally
implemented property — Chrome/Safari/Firefox) — CSS-only, no mask-layer complexity; the **reveal toggle** (the
trailing eye) flips it to `none`. Rejected: a JS mask-overlay layer (heavy — caret sync, a shadow value) and a
native password input (breaks the uniform no-native-input contenteditable model, ADR-0014).
**Caveats to record + probe:** (a) the value lives in the editor's `textContent` (client-side, pre-submit — same
exposure as any client password field; `formValue()` carries it to the form); (b) a contenteditable "password"
is not a native password field — AT reads the masked discs; the FACE `internals` should signal the field's
purpose (aria) and the reveal toggle is the accessible reveal. **→ a small ADR** (the contenteditable-password
masking approach), proposed. *(If Kim/the reviewer wants stronger masking than `-webkit-text-security`, that's a
mask-layer follow-up — flagged, not built.)*

## Slices

### S-A — the `valueCodec` seam  (NEW `traits/value-codec.ts` + the codecs)  [file-disjoint, parallel]
- `valueCodec(host, { parse, format })` → cleanup: **format-on-blur** (form value → display string, e.g.
  `1234.56 → "1,234.56"`) + **parse-on-commit** (display string → form value); focus may show the raw value.
  The seam is codec-agnostic; number/currency/percent codecs are `Intl.NumberFormat`-based (zero-dep, native).
- Probes (jsdom): round-trip (type "1234.56" → blur → "1,234.56" → `formValue()` `1234.56`); locale-safe;
  invalid input → `setCustomValidity`. C10 zero-residue.

### S-B — the `ui-text-field` `type` growth  (`controls/text-field/text-field.{ts,css,md}`)  [serial — one control]
- The `type` prop + the type-resolver + inputmode-on-editor + the auto-adornment injection (into the ADR-0012
  slots) + the password masking (`-webkit-text-security`, S above) + the `valueCodec` binding (number/currency)
  + the descriptor `type`-enum extension. **Additive** — `type='text'` is the current behavior; the existing
  text-field tests MUST stay green (the byte-compatible-default guard).
- Depends on S-A (the codec) for number/currency.

## Per-type TEST MATRIX (the G6 bar, per `type`)

For each of the 8 types: ✓ the resolved **inputmode** on the editor · ✓ the **auto-adornments present** (search
→ magnifier + clear-when-non-empty; password → reveal; currency → symbol; number → steppers) · ✓ the **codec
round-trip** (number/currency: display ↔ form value) · ✓ **validation** (email/url typeMismatch; number range)
· ✓ **masking** (password: editor `-webkit-text-security:disc`; reveal flips to `none`) · ✓ the **clear/reveal/
stepper affordances** emit + toggle · ✓ `type='text'` = **byte-identical** to today (existing tests green).
Browser smoke: the adornments render at `= font` (§4.6) per `[size]×[scale]` (**exact px**); forced-colors.

## Wave-1 review lessons — BAKED IN
(1) contract↔props trip-wire with **biting NCs** — the descriptor's `type`-enum + the new adornment parts/events
match `static props`; a `@ts-expect-error` on a non-member `type`; a descriptor-mismatch FAILS. (2) `inspect()`
C10 zero-residue (the codec + adornment listeners released; `release()` idempotent). (3) anti-vacuous exact-px
adornment geometry. (4) forced-colors + `forced-color-adjust:none` (the magnifier/symbol/reveal survive).
(5) no `:state(ready)` regressions; the additive growth keeps the shipped text-field's existing motion.

## Per-control DoD + fan-out

Full G6 bar + **component-reviewer ≥4 both axes BEFORE commit** (the per-type matrix is the REALIZE evidence).
**Blocks on:** the shipped `ui-text-field` (G6-done) + S-A (the codec, for number/currency). **Disjointness:**
S-A is a new file (parallel); S-B is serial (one control). **Maps to:** goals.md §G6 (the field variants) — keep
goals honest. **Deferred to Phase 2** (per the team-lead's core-first scope): the heavy pickers (date/time/file,
range-picker) + percent/unit/pin/tags — NOT in this wave.
