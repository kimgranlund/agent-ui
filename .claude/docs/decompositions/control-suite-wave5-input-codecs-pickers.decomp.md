# Decomp — Control suite Wave 5: Input codecs + date/time pickers (`ui-text-field` type completion + `ui-calendar`)

> #49 Wave 5 (milestone **G6/G7**). Kim's directive: *"iterate until all text input type fields are complete
> and we have comprehensive coverage (currencies, units, units with steppers, calendars, date-pickers, etc.)."*
> Two independently-committable sub-waves: **5A** grows `ui-text-field`'s numeric codec family (multi-currency ·
> unit · percent · generalized steppers with `step`/`min`/`max`) — **no new overlay**; **5B** adds a NEW
> `ui-calendar` control + the `date`/`time` picker `type`s (calendar opens through the Wave-4 `overlay`). Both
> **grow the SHIPPED `ui-text-field`** additively (the `type` default `'text'` stays byte-identical; existing
> tests stay green) and **compose** the shipped primitives (value-codec · overlay · container-box) — no
> reinvention. Bake the Wave-1..4 review lessons in upfront; date/time overlays are **WebKit-sensitive** —
> every smoke is Chromium **AND** WebKit. · proposed · 2026-07-01 · planning-lead

## Reasoning — both planes reconciled

**Outside-in (the type contract the author writes).** `<ui-text-field type=currency currency=JPY>` → a leading
`¥`, 0-fraction display, canonical number; `type=unit unit=kilogram` → a trailing `kg` suffix, canonical
number; `type=percent` → a trailing `%`, canonical = the **typed** number ("50", not `0.5`); `type=date` → a
trailing calendar button opening a month grid, canonical ISO `YYYY-MM-DD`; `type=time` → typed, canonical
`HH:MM`. `step`/`min`/`max` behave like the native numeric attributes. `<ui-calendar>` stands alone as a form
control AND is the popup body for `type=date`.

**Inside-out (the primitives already shipped).** `valueCodec` (display↔canonical, format-on-blur) — extend
with per-currency fraction digits + date/time codecs. `overlay` (Popover top-layer + JS flip/shift +
light-dismiss + anchor focus-restore + the 0.25rem gap, ADR-0043/0045) — the calendar popup rides it
unchanged. `container-box` (`[data-box]`, ADR-0046) — the calendar panel opts in. `roving-focus` is **1D
linear** — a day grid is **2D** (±1 day horiz, ±7 vert, ±month on PageUp/Down), a different navigation model
→ **bespoke grid handler** (below), not a 2D fork of roving.

**The reconciliation (where the two planes met and moved a design):**
1. **`unitCodecOptions`/`percentCodecOptions` collapse into the numeric core.** A unit/percent value is a free
   decimal — numerically identical to `number`. Their type-specificity is the **adornment label** (`kg` / `%`),
   NOT the parse/format. So percent reuses `numberCodecOptions` outright; `unitCodecOptions(unit, locale)` is a
   thin wrapper delegating to the numeric core with the `unit` param **reserved** for future per-unit precision
   (honest seam, zero redundant logic). Only **currency** carries a real numeric difference (per-currency
   fraction digits) → its own factory. *(This refines the brief, which speculated a distinct `unitCodecOptions`;
   on decomposition it has no distinct numeric behaviour to carry — recorded as ADR-0047 alt.)*
2. **`type=date` must not drag `ui-calendar` into every text-field's bundle.** A static `controls→controls`
   import breaks the G8 tree-shake proof (importing a plain text-field would pull the calendar). Resolution: the
   date type **lazily `import()`s the calendar module on first activation** — the calendar is a real dep of the
   date type only, code-split out of the base field. The `<ui-calendar>` element is created eagerly (an unknown
   element that **upgrades** when the dynamic import defines it). ADR-0048.
3. **The trailing cell composes.** `unit`/`percent` carry BOTH a text suffix AND steppers → the trailing
   adornment becomes a flex row `[suffix][▲▼]`; the exclusive interactive affordances (search clear, password
   reveal, date calendar-button) still own the cell alone. The `TYPE_CONFIG` grows from one `trailing` role to
   `{ leading, suffix, affordance, codec, validation }` (below).

---

# Wave 5A — Numeric-codec expansion (no new overlay)

## The `TYPE_CONFIG` v2 (the static `as-const` resolver, erasableSyntaxOnly: no enum)

The single `trailing` role splits into independent facets so `unit`/`percent` can carry a suffix **and** a
stepper. A non-null `codec` **implies steppers** (every numeric type is steppable — Kim: "units with steppers").

| `type` | inputmode | leading | suffix | affordance | codec | validation | steppers |
|---|---|---|---|---|---|---|---|
| text·email·url·tel | *(unchanged)* | — | — | — | — | email/url | — |
| search | search | magnifier | — | clear ✕ | — | — | — |
| password | text | — | — | reveal 👁 | — | — | — |
| **number** | numeric | — | — | — | number | number+range | ✓ |
| **currency** | decimal | currency `¤` | — | — | currency | number+range | ✓ |
| **unit** | decimal | — | unit label | — | *(unit→numeric)* | number+range | ✓ |
| **percent** | decimal | — | `%` | — | *(percent→numeric)* | number+range | ✓ |

- `affordance` = the exclusive interactive trailing button (search/password) — never coexists with steppers.
- `suffix` = a trailing **text** label; the trailing cell = `[suffix span?][step-up][step-down]` (a flex row).
- `leading` currency symbol is per-`currency` (below). Reading `this.currency` inside the currency branch of the
  type-effect means the effect **re-derives only for a currency field** when `currency` changes (a plain field
  never reads it, never re-runs) — the reactive-tracking discipline the kernel already gives us.

## The locked prop list (5A additions)

All reflect (native `<input min/max/step>` parity — attribute-backed IDL, declaratively authorable + inspectable;
these are static config, not the live value, so echo cost is nil):

| prop | shape | default | notes |
|---|---|---|---|
| `currency` | `prop.string` | `'USD'` | ISO 4217. Only meaningful for `type=currency`. Drives the leading symbol + the codec fraction digits. |
| `unit` | `prop.string` | `''` | A CLDR unit id (`kilogram`, `mile-per-hour`) → localized short label; else the raw string is the suffix. `type=unit`. |
| `step` | `prop.number` | `1` | The stepper increment + ArrowUp/Down delta. `step="any"` unsupported (moot — no `stepMismatch`; recorded). |
| `min` | `prop.string` | `''` | `''` = unconstrained (native `.min` is a string). Numeric bound → `rangeUnderflow`. |
| `max` | `prop.string` | `''` | `''` = unconstrained. Numeric bound → `rangeOverflow`. |

*(`min`/`max` are strings, not `prop.number`, precisely to carry the unset/`''` = no-bound state that a numeric
default can't. `step` is always numeric with a real default `1`.)*

## The value-codec extensions (`traits/value-codec.ts`)

Refactor the two current factories around **one numeric core** `numericCodec({ locale, minFraction?, maxFraction? })`
(strip non-`[\d.\-]`, `parseFloat`, `Intl.NumberFormat` format). Then:

- `numberCodecOptions(locale)` = `numericCodec({ locale })` — grouping, free decimals *(unchanged behaviour)*.
- `currencyCodecOptions(currency, locale)` — resolves the per-currency fraction digits via
  `Intl.NumberFormat(locale, { style:'currency', currency }).resolvedOptions().{min,max}imumFractionDigits`
  (USD 2 · JPY 0 · BHD 3), then formats the **number only** (fixed to that fraction count) — the symbol is the
  leading adornment, never embedded (the shipped separation). **Replaces the USD-only hardcode.**
- `unitCodecOptions(unit, locale)` — delegates to the numeric core today; `unit` param **reserved** for future
  per-unit precision. Percent reuses `numberCodecOptions` (no factory — canonical = typed number).
- NEW exported label helpers (co-located with the Intl logic): `currencySymbol(currency, locale)` (generalizes
  the control's static USD helper — `formatToParts` → the `currency` part, fallback `'$'`), `unitLabel(unit,
  locale)` (`Intl.NumberFormat({ style:'unit', unit, unitDisplay:'short' }).formatToParts(1)` → the `unit` part;
  Intl throws on an invalid unit → fall back to the raw `unit` string).

## Generalized steppers + range validity (`controls/text-field/text-field.{ts,css,md}`)

- `#step(dir: 1 | -1)` → `next = clamp(current + dir*step, min, max)` (parse `min`/`max`; empty → ∓∞). The two
  stepper buttons call `#step(±1)`; **ArrowUp/ArrowDown on the editor** call the same (native `type=number`
  parity) when a numeric codec is active (`preventDefault` the arrow). `setCanonical(next)` keeps the codec in
  sync (the shipped clear/stepper pattern).
- `formValidity()` gains **range** arms: after the codec parse succeeds, for a numeric type with a non-empty
  value, `canonical < min` → `{ rangeUnderflow }`, `canonical > max` → `{ rangeOverflow }` (native messages).
  **`stepMismatch` is NOT enforced** — too strict for free numeric entry (a currency field forcing 0.01
  increments would reject legitimate typed amounts); recorded, opt-in only if a consumer asks.
- The currency **symbol** + codec fraction digits re-derive when `this.currency` changes; the **suffix** label
  (unit/percent) is a `[data-part=suffix]` span in the trailing cell.

## Slices (build order)

- **5A-1 · the codec seam** (`traits/value-codec.ts` + test) — the numeric core + `currencyCodecOptions(currency,
  locale)` + `unitCodecOptions(unit, locale)` + `currencySymbol`/`unitLabel` helpers. *(single file; other
  slices depend on it)*
- **5A-2 · the field growth** (`controls/text-field/text-field.{ts,css,md}` + tests) — `TYPE_CONFIG` v2, the 5
  new props, the `unit`/`percent` types, the suffix cell, per-currency symbol, `#step` clamp + Arrow stepping,
  range validity, the enum + descriptor extension. Depends on 5A-1. **Additive** — `type=text` byte-identical.

## Per-type DoD (the G6 bar, per new `type`) — 5A

For `currency`(multi)·`unit`·`percent`·`number`(steppers): ✓ resolved **inputmode** · ✓ the **adornments**
(currency symbol per `currency` — USD `$` / JPY `¥` / EUR `€`; unit label per `unit` — `kg` valid / raw string
invalid; percent `%`; steppers present) · ✓ **codec round-trip** (display ↔ canonical; currency fraction digits
per code — JPY 0, BHD 3) · ✓ **stepper** click AND ArrowUp/Down step by `step`, **clamp** to `[min,max]` · ✓
**range validity** (`rangeUnderflow`/`rangeOverflow` on `min`/`max`; `stepMismatch` NOT raised) · ✓ percent
canonical = **typed number** (`50`, not `0.5`) · ✓ `type=text` byte-identical. **Browser smoke (Chromium +
WebKit):** the symbol/suffix/steppers render at `= font` (§4.6) per `[size]×[scale]` (exact px); forced-colors
keeps the glyphs (`forced-color-adjust:none`).

---

# Wave 5B — `ui-calendar` + date/time pickers

## `ui-calendar` — a NEW standalone control (`controls/calendar/`)

- **Class `UICalendarElement`, tag `ui-calendar`, `extends UIFormElement`** — it contributes a form value
  (canonical ISO `YYYY-MM-DD`), so it is a FACE form control, not a plain `UIElement`. `formValue()` = the
  selected ISO date (`null` when none); `formValidity()` = `required` && none → `valueMissing`; a selection
  outside `[min,max]` or a disabled date can't be committed. `formReset()` → the initial `value` attribute.
- **Anatomy** (parts created once, idempotent; host carries **no** role — ARIA on parts, the FACE pattern):
  ```
  <ui-calendar>
    <div data-part="panel" data-box>
      <header data-part="nav">
        <button data-part="prev" aria-label="Previous month">‹</button>
        <span   data-part="title" aria-live="polite">July 2026</span>
        <button data-part="next" aria-label="Next month">›</button>
      </header>
      <div data-part="grid" role="grid" aria-labelledby="…title">
        <div role="row">   <!-- weekday header -->
          <span role="columnheader" aria-label="Sunday">Su</span> … </div>
        <div role="row">   <!-- one week -->
          <button role="gridcell" tabindex="0|-1" aria-label="July 1, 2026"
                  aria-selected="…" aria-disabled="…" data-today data-outside>1</button> … </div>
        …6 week rows…
      </div>
    </div>
  </ui-calendar>
  ```
- **Grid decision — BESPOKE 2D handler on `ui-calendar` (NOT a 2D roving fork).** `roving-focus` is 1D linear;
  a day grid needs ±1/±7 movement, month-boundary **regeneration** (crossing an edge rebuilds the grid to the
  new month + focuses the target day), and disabled-date handling — a distinct model. The bespoke handler keeps
  a roving `tabindex` (one gridcell `=0`: the selected day, else today, else the 1st), and REUSES the *learned
  semantics*: `selectionCommit`'s **`preventDefault` on the committing Enter** (so a calendar in an overlay
  doesn't re-trigger the anchor button) + the `aria-selected` reflection pattern + internals ARIA. **A
  `roving-grid` trait is extracted only when a SECOND grid control appears** (YAGNI — one consumer now); recorded.
  - **Keys:** ←/→ ∓1 day · ↑/↓ ∓7 days · Home/End week-start/-end · PageUp/PageDown ∓1 month · Shift+PageUp/Down
    ∓1 year · Enter/Space commits. Nav MAY land on a disabled/out-of-range day (so you can move through) but
    Enter/click on it is a **no-op** (simpler than skip-logic; recorded).
  - Adjacent-month days are shown **muted** (`data-outside`) and navigating/clicking one moves to that month
    (standard). `data-today` marks today.
- **Panel** opts into `[data-box]` (ADR-0046): the `nav` is a `header` region, the `grid` is content; the
  0.25rem inset + region padding come for free.

## `type=date` on `ui-text-field`

- `TYPE_CONFIG` row `date`: `affordance='calendar'` (a trailing calendar-icon button), `codec='date'`,
  `validation='date'`, no stepper/suffix. The button toggles an `overlay(this, { popup: calendarPanel, anchor:
  button, focusOnOpen:true, auto:true })` — a control-created `[data-box]` panel whose body is a lazily-imported
  `<ui-calendar>` (reconciliation #2). A calendar `select`/`change` → `this.value = iso` + `open=false` (overlay
  closes → focus restores to the button, ADR-0045); typing parses on **blur** via the date codec.
- **`dateCodecOptions(locale)`** — canonical ISO `YYYY-MM-DD`; `format(iso)` → localized (`Intl.DateTimeFormat`
  `{dateStyle:'medium'}`); `parse(display)` → ISO always accepted; else a locale-part-order heuristic
  (`formatToParts` learns y/m/d order) then `new Date(display)`; `null` on invalid. **Caveat recorded:**
  free-form localized-date *parsing* is best-effort (Intl has no parser) — ISO always round-trips and the
  calendar is the reliable entry path; the codec is lenient, the calendar authoritative.

## `type=time`, `datetime-local`, `month` — scope calls

- **`type=time` — IN (typed, no overlay list).** `timeCodecOptions(locale)`: canonical `HH:MM` 24h; localized
  display (`{timeStyle:'short'}`); parse accepts `HH:MM` + `h:MM AM/PM`; `null` on invalid → `typeMismatch`. A
  **time-list overlay is OUT of scope** (recorded as future — the calendar proves the overlay-picker pattern;
  a time list is the same shape applied later).
- **`datetime-local` — STRETCH (build only if `date`+`time` land clean).** Canonical `YYYY-MM-DDTHH:MM` via a
  **compound codec** (date codec for the date half + time codec for the time half); the calendar sets the date
  part, the time is typed inline. If 5B is tight, it's a documented follow-up (no half-built control).
- **`type=month` — STRETCH.** Canonical `YYYY-MM`; the calendar in a **month-grid mode** (a 3×4 month picker) or
  typed. Build only if 5B is otherwise clean; else future.

## Slices (5B)

- **5B-1 · `ui-calendar`** (`controls/calendar/calendar.{ts,css,md}` + tests) — the standalone grid, bespoke 2D
  nav, form value, the `--ui-calendar-*` tokens (below), `[data-box]` panel. **Disjoint new dir** — parallel with
  5A. Depends only on `UIFormElement` + `container-box` (shipped).
- **5B-2 · date/time codecs** (`traits/value-codec.ts`) — `dateCodecOptions` + `timeCodecOptions` (+ compound
  `datetimeCodecOptions`, stretch). **Same file as 5A-1** → serialize after it.
- **5B-3 · `type=date`/`time`** (`controls/text-field/*`) — the `date`/`time` (+ stretch `datetime-local`/`month`)
  rows, the lazy-calendar overlay composition, the trailing calendar button, codec binding, enum + descriptor
  growth. **Same file as 5A-2** → serialize after it. Depends on 5B-1 + 5B-2.

## New tokens (→ flag to tokens-specialist; do NOT build here)

All colour tokens should **alias existing role tokens**, not add palette. `--ui-calendar-range-*` is
**reserved/future** (range selection is not in this wave).

| token | role | source |
|---|---|---|
| `--ui-calendar-cell-size` | day-cell square (place on the ramp; size-responsive sm/md/lg) | dimensional — new, ~`2.25rem` default |
| `--ui-calendar-gap` | inter-cell gap | `= font/2` rhythm or a small fixed rem |
| `--ui-calendar-selected-fill` | selected-day background | alias `--md-sys-color-primary-*` |
| `--ui-calendar-selected-ink` | selected-day text | alias `--md-sys-color-primary-on-*` |
| `--ui-calendar-today-ring` | today's ring/outline | alias `--md-sys-color-focus-ring` / `--md-sys-color-primary-outline` |
| `--ui-calendar-disabled-ink` | disabled / out-of-range day ink | alias `--md-sys-color-neutral-*-variant` |
| `--ui-calendar-outside-ink` | adjacent-month day ink (muted) | alias `--md-sys-color-neutral-*` |
| `--ui-calendar-range-fill` · `-range-ink` | **FUTURE** (range selection) — reserved, not built | — |

The nav `‹›` arrows are **inline affordances = font** — already covered by the §4.6 law ("calendar-nav ‹›");
no new glyph token.

## Per-slice DoD (the G6/G7 bar) — 5B

- **`ui-calendar`** — jsdom: renders the current month (correct day-of-week offset, 28/30/31 + leap-Feb); Arrow
  ±1/±7, PageUp/Down ±month (grid regenerates), Home/End; Enter/Space + click commit → `value` ISO + `change`
  +`select`; `min`/`max` disable days (Enter/click no-op); `required` → `valueMissing`; `formReset`; C10
  zero-residue; contract↔props trip-wire (biting NC on `value`/`min`/`max`/`select`). **Browser (Chromium +
  WebKit):** real roving focus across the grid + month boundary; `data-today`/selected/disabled render;
  forced-colors keeps the selected fill + today ring (`forced-color-adjust` where load-bearing); cell geometry
  exact px per `[size]`.
- **`type=date`** — jsdom: codec round-trip (ISO ↔ localized; `formValue()` = ISO); button opens/closes the
  overlay (`simulateLightDismiss` for dismiss); a calendar pick sets `value` + closes; typing parses on blur;
  invalid → `typeMismatch`. **Browser (Chromium + WebKit — overlays are WebKit-sensitive):** the calendar opens
  in the **top layer** above an `overflow/transform` ancestor, flips at the viewport edge, a keyboard pick
  commits + **restores focus to the button** (ADR-0045), light-dismiss syncs `open`; C10 zero-residue.
- **`type=time`** — jsdom: codec round-trip (`HH:MM` ↔ localized); invalid → `typeMismatch`; range validity if
  `min`/`max` set. Browser: the typed field + forced-colors.

---

## Wave-1..4 review lessons — BAKED IN (every slice)

(1) **contract↔props trip-wire with biting NCs** — the descriptor's new `type` enum values + props (`currency`/
`unit`/`step`/`min`/`max`; calendar `value`/`min`/`max`) + events match `static props`; a `@ts-expect-error` on
a non-member; a descriptor-mismatch FAILS. (2) **`inspect()` C10 zero-residue** — the codec + adornment
listeners, the overlay controller's scroll/resize/toggle, the calendar's grid keydown ALL released on
disconnect; `release()` idempotent; parts created once; the **lazy calendar import** doesn't leak a listener.
(3) **anti-vacuous exact-px** geometry (the symbol/suffix/steppers `= font`; the calendar cell square) —
asserted, not assumed. (4) **forced-colors** + `forced-color-adjust:none` where a token is load-bearing (the
adornment glyphs, the calendar selected-fill + today-ring). (5) **cross-engine (Chromium + WebKit) on every
overlay smoke** — the date calendar's top-layer + light-dismiss + focus-restore are WebKit-sensitive; a
Chromium-only pass is not a pass (the 18-assertion Wave-4 lesson, ADR-0045).

## Per-control DoD + fan-out

Full G6/G7 bar + **component-reviewer ≥4 both axes BEFORE each wave-commit** (the per-type / per-slice matrix is
the REALIZE evidence — jsdom-green ≠ done; the browser gate runs **before** the commit, checkbox is the
template). **Build order:** 5A-1 → 5A-2 *(commit 5A)*; 5B-1 (calendar, parallel with 5A) → 5B-2 → 5B-3 *(commit
5B)*. **Blocks on:** the shipped `ui-text-field` (G6) + `valueCodec`/`overlay`/`container-box` (Wave 0/3/4,
committed). **File-disjointness:** `value-codec.ts` (5A-1 + 5B-2 serialize), `text-field.*` (5A-2 + 5B-3
serialize), `controls/calendar/*` (new, parallel). Barrels + `BASE_CLASSES` + gz re-base + site pages
(→ docs-site-steward: the new type variants + a `ui-calendar` page) at each wave boundary. **Maps to:** goals.md
§G6 (the field `type` family) + §G7 (the overlay-composed picker). **Two proposed ADRs:** **0047** (5A numeric
codec expansion) · **0048** (5B date/time picker architecture) — proposed; the orchestrator ratifies on the
green gate. **Future (recorded, not this wave):** range/date-range selection (`--ui-calendar-range-*` reserved),
a time-list overlay, `datetime-local`/`month` if cut from 5B stretch, per-unit codec precision.
