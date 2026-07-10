# LLD — `ui-color-picker` (+ `ui-text-field type=color`)

> Status: proposed · v0.1 · 2026-07-10 · Layer: LLD (implementation contract)
> Refines: [`../spec/color-picker.spec.md`](../spec/color-picker.spec.md) (SPEC-R1…R12) under
> [ADR-0123](../adr/0123-ui-color-picker-value-model-and-2d-input.md).
> Build plan: [`../decompositions/color-picker-ship.decomp.json`](../decompositions/color-picker-ship.decomp.json).
> Altitude: owns the file layout, the class + trait + codec interfaces, the OKLCH/gamut numerics, the CSS
> geometry, and the `type=color` overlay wiring. Component IDs `LLD-C#`.
> **Every API named in §5 (Frozen interface) is verified present with the exact signature in shipped source —
> §5 carries the file:line proof (the frozen-interface-vs-real-code check).**

---

## 1. File layout

```
packages/agent-ui/components/src/
  traits/
    area-drag.ts            LLD-C4  NEW — the 2-axis pointer→(x,y) gesture trait (sibling of value-drag.ts)
    area-drag.test.ts               unit: ratio mapping, per-drag AbortController lifetime, clamp
  controls/color-picker/
    color-picker.ts         LLD-C1..C6  the UIColorPickerElement composite
    color-picker.css        LLD-C7  the single {name}.css (@scope, --ui-color-picker-* roles, geometry)
    color.ts                LLD-C3  NEW — pure OKLCH↔sRGB + gamut-map + colorCodecOptions (zero-dep, no DOM)
    color.test.ts                   unit: round-trips, gamut binary-search, codec parse/format
    color-picker.md         LLD-C8  the descriptor (tier: pattern)
    color-picker.test.ts            jsdom probes (model, form seams, keyboard, ARIA-via-internals-read)
    color-picker.browser.test.ts    cross-engine: whole-shape, real pad + channel pointer-drag, 2-axis keys, WHCM
    index.ts                        barrel
  controls/text-field/
    text-field.ts           LLD-C9  +type=color config row + the lazy color-picker overlay (ADR-0048 seam)
```

`color.ts` is import-free (pure functions) so it is unit-testable without the DOM and reusable by the
`type=color` leg. `area-drag.ts` imports only the `UIElement` host type (`traits → dom`, the one allowed
cross-layer direction — the `value-drag.ts` precedent).

## 2. LLD-C1 — the element skeleton

`UIColorPickerElement extends UIFormElement`. Props (SPEC-R2), spread over `UIFormElement.formProps`:

```ts
const props = {
  ...UIFormElement.formProps,                                   // name / disabled / required
  value:  { ...prop.string(''), reflect: true },                // serialized per `format`; '' = unset
  format: { ...prop.enum(['hex', 'oklch'] as const, 'hex'), reflect: true },
} satisfies PropsSchema
```

Internal model (NOT reactive props — ephemeral, the adia `#L/#C/#H` precedent):

```ts
#L = 0.62; #C = 0.12; #H = 260   // OKLCH working triple
#dragging: 'pad' | null = null
#pad: HTMLElement | null = null; #padThumb: HTMLElement | null = null
#hueSlider / #chromaSlider / #lightnessSlider: HTMLElement | null   // composed <ui-slider>
#readoutField: HTMLElement | null   // composed <ui-text-field>
#swatch: HTMLElement | null          // composed <ui-swatch>
#userInvalid: TrackUserInvalidController | null = null
#areaRelease: (() => void) | null = null   // area-drag cleanup
```

Lifecycle mirrors `ui-calendar`: an idempotent `#ensureShell()` builds parts once; `connected()` seeds the
model from `value` (via `color.ts` parse), wires listeners through `this.listen`/`this.effect`,
`trackUserInvalid` for user-invalid timing; `disconnected()` releases the tracker + `#areaRelease`.

## 3. LLD-C2 — the render/commit cycle

- **Model → surface** (an `effect` tracking `value`/`format` + imperative calls after model mutations):
  paints the canvas for the current hue (LLD-C7), positions `#padThumb` (`left = C/MAX_CHROMA`, `top = 1−L`),
  syncs each `ui-slider`'s `value`, sets the `ui-swatch` preview's `value` **to the control's own serialized
  `this.value`** (so the preview matches `value` by construction — in `format=oklch` it shows the authored
  color the browser resolves, in `format=hex` the gamut-mapped hex; no WYSIWYG split), writes the readout
  field's `value`, and updates the pad's `aria-valuetext` (SPEC-R7).
- **Surface → model**: `area-drag` `onValue(x,y)` sets `#C = x·MAX_CHROMA`, `#L = 1−y`, emits `input`; each
  channel `ui-slider`'s `input` sets its axis and emits `input`; the readout field's committed `change`
  parses through `colorCodecOptions` and, on success, sets the model + emits `change`.
- **Commit choke point** `#commit(kind: 'input' | 'change')`: serialize the model through `format`
  (gamut-map when hex), write `this.value` (guarded against the model→surface effect re-parsing its own write —
  the adia `#internalUpdate` flag), then `this.emit(kind)`. **The form value syncs automatically** — the base's
  reactive effect `this.internals.setFormValue(this.formValue())` (`dom/form.ts:174`) re-runs on the tracked
  `this.value` write; there is no method to call (no `syncValue`). `change` fires on pointer-up / channel
  blur-with-move / readout parse-success; `input` during a gesture. (SPEC-R5.)

## 4. LLD-C3 — `color.ts` (pure numerics + codec)

Promoted from adia (never ported — no app-specific constraint code). `MAX_CHROMA = 0.4`.

- `oklchToRgb(L,C,H): [r,g,b]` (0–1) · `rgbToHex` · `hexToOklch(hex): {L,C,H}` · `oklchToHex(L,C,H)` — the
  OKLCH↔sRGB matrices (Björn Ottosson's constants).
- `gamutMapChroma(L,C,H): number` — binary-search chroma reduction until in-gamut (8 iterations; the adia
  mechanism). Applied before every hex serialization; NOT before an `oklch` serialization (SPEC-R3 AC1/AC2).
- `colorCodecOptions(format: 'hex' | 'oklch'): ValueCodecOptions` — returns `{ parse, format, errorMessage }`
  in the ADR-0044/0047 dialect: `parse(display) → canonical | null` accepts `#rgb`/`#rrggbb`/`oklch(L C H)`
  (the adia lenient parser incl. `none`/`NaN`/`%` per CSS Color 4 powerless), returning the serialized string
  in the requested `format`; `format(canonical) → canonical` (idempotent normalization); `errorMessage =
  'Please enter a valid color.'`. **Pure — no DOM** (SPEC-R3 AC5); the standalone control calls
  `parse`/`format` directly to move between `value` and the model, and the `type=color` field wires the SAME
  factory through the `valueCodec` trait.

## 5. LLD-C4 — the `area-drag` trait (frozen interface)

The 2-axis sibling of `value-drag.ts`, same lifetime discipline (host.listen pointerdown → setPointerCapture →
per-drag `AbortController` aborted on any drag-end → rect re-read each move). It maps `(clientX, clientY)` on
the area rect to `(ratioX, ratioY) ∈ [0,1]²` and calls `onValue(x, y)`.

```ts
// area-drag.ts — NEW
import type { UIElement } from '../dom/index.ts'
export interface AreaDragOptions {
  area: () => HTMLElement | null                 // live accessor (re-read on each pointerdown) — value-drag's `track` shape
  onValue: (x: number, y: number) => void        // both ratios, clamped [0,1]; x = left→right, y = top→bottom
}
export function areaDrag(host: UIElement, opts: AreaDragOptions): () => void   // returns idempotent cleanup
```

Mirrors `value-drag`'s exported shape (a `(host, opts) => () => void` trait) — the LLD-C4 build reuses
`value-drag.ts`'s structure verbatim, adding the Y axis; the 2-axis keyboard is NOT in the trait (it lives on
the pad handler, LLD-C5, exactly as `UIRangeElement` owns keyboard while `value-drag` owns pointer).

### Frozen-interface-vs-real-code proof

Every fleet API this LLD's interfaces build on, verified present with the named signature in shipped source:

| API (as used here) | Shipped signature | Source |
|---|---|---|
| `valueDrag(host, opts): () => void`; `opts = { track, min, max, step, onValue }` | exact — the trait `area-drag` mirrors | `traits/value-drag.ts:17,49` |
| `valueCodec(host, opts, typeSignal?): ValueCodecController`; `ValueCodecOptions = { parse(d):string\|null, format(v):string, errorMessage }` | exact — `colorCodecOptions` returns this shape | `traits/value-codec.ts:31,87` |
| `overlay(host, { popup, anchor, placement? }): OverlayHandle`; `.open/.close/.toggle/.cleanup` | exact — the `type=color` leg reuses (the handle opens with `.open()`, NOT `.show()`) | `traits/overlay.ts:30,53` |
| `trackUserInvalid(host, { invalid: () => boolean }): { userInvalid(), reset(), release() }` | exact — the calendar precedent | `traits/track-user-invalid.ts` (used `calendar.ts:462`) |
| `UIFormElement` seams `formValue(): FormValue`, `formValidity(): ValidityResult`, `formReset()`, `formStateRestore(state)`, `applyFieldLabelling(refs: FieldLabelling\|null)`, `formUserInvalid(): boolean` | exact — overridden as in calendar | `controls/calendar/calendar.ts:283,300,357,371,551,575` |
| `prop.string/enum/number/boolean`, `PropsSchema`, `ReactiveProps`, `UIFormElement.formProps` | exact | `controls/_base/range-element.ts:12,15,25` · `calendar.ts:77,205` |
| `this.emit('input'\|'change')`, `this.listen`, `this.effect`, `this.internals`, `this.effectiveDisabled()` | exact — and form-value sync rides the base effect `internals.setFormValue(formValue())` at `dom/form.ts:174` (there is NO `syncValue` method — verified: zero matches in the tree) | `range-element.ts:104,117,155` · `calendar.ts:462,481` · `dom/form.ts:174` |
| `ui-slider` composition — `UIRangeElement` with `min/max/step/value/size`, emits `input`/`change`, two-way via `value` | exact — the adia `makeSlider` dogfood promoted to `ui-slider` | `controls/_base/range-element.ts:15–26` |
| `ui-swatch` composition — props `value/label/scheme`, `role=img`, display-only | exact — the composed preview | `controls/swatch/swatch.md:14–28` |
| `setIcon(el, name)` from `@agent-ui/icons` (eyedropper/copy glyphs) | exact | `calendar.ts:82,609` |

No INVENTED API and no value-vs-accessor mismatch: `area-drag`'s `area`/`onValue` copy `value-drag`'s
`track`/`onValue` accessor-and-callback shape; `colorCodecOptions` returns the real `ValueCodecOptions`; every
override matches the calendar's shipped seams.

## 6. LLD-C5 — the pad a11y + 2-axis keyboard

`[data-part=pad]` is `tabindex=0` with (set once in `#ensureShell`, on the PART not `internals` — the host is
the form element, the `ui-calendar` `role=grid`-on-a-part precedent): `role="slider"`,
`aria-roledescription="2D slider"`, `aria-label="Chroma and lightness"` (the OKLCH axes; if Kim rules F1
alternative (a) HSV-internal, this reads "Saturation and value" — the label vocabulary follows the F1 ruling). `aria-valuetext` is updated each
render to cross-announce both channel values (SPEC-R7 AC1). A bespoke `keydown` handler (the `ui-calendar`
`#handleGridKey` precedent) intercepts ←/→ (chroma ±step), ↑/↓ (lightness ±step), Shift (coarse), Home/End (X
min/max), PageUp/PageDown (Y min/max), and `preventDefault()`s every one (suppresses scroll and, in the overlay
leg, the anchor re-activation — ADR-0045/0048). Each key-step routes through `#commit('change')`. The channel
`ui-slider`s (LLD-C1) are the accessible spine (SPEC-R6): they carry their own `UIRangeElement` keyboard/ARIA
unmodified.

## 7. LLD-C6 — form seams

Override as `ui-calendar` does: `formValue()` = `this.value` or null when `''`; `formValidity()` =
`valueMissing` (required+unset) / `customError` from a control-owned `#readoutError` signal (set true when the
readout's committed entry fails `colorCodecOptions.parse`, cleared on a successful parse or a pad/channel
commit). **NOTE (m1, doc-review):** the STANDALONE control parses the readout's `change` DIRECTLY through the
pure `colorCodecOptions` (it does NOT instantiate the `valueCodec` controller — that controller and its
`hasError` signal are wired only by the `type=color` text-field leg, LLD-C9), so validity reads `#readoutError`,
not a codec-controller `hasError`. `formReset()` restores the first-connect `#initialValue`;
`formStateRestore(string)` re-parses into the model. `applyFieldLabelling` wires the field label onto the pad's
labelling (merge, not clobber — the calendar precedent); `trackUserInvalid` drives `:state(user-invalid)` +
`formUserInvalid()` (SPEC-R9).

## 8. LLD-C7 — CSS + geometry (`color-picker.css`)

`@scope (ui-color-picker)`. `--ui-color-picker-*` roles in a `:where(:scope)` block:
`--ui-color-picker-pad-block-size` (bespoke default, e.g. `10rem` — density-invariant, the swatch-box / calendar-cell
precedent; the whole-shape floor, SPEC-R8) · `--ui-color-picker-gap` (off `--space-*`) · pad radius/border off
`--md-sys-color-outline-variant` (the swatch hairline, so the pad never vanishes) · thumb size/border/shadow.
Size-class **pattern** (SPEC-R12): the shell is a flex column on the space scale; the pad is a sized surface;
the channel rows are `ui-slider`s (Indicator-class, self-sized under ADR-0038); the readout is a `ui-text-field`
(Control-height). **No new geometry ROW** — no `--ui-color-picker` entry in the `(scale × size)` lookup tables.

**Pad rendering** (F1 sub-fork — canvas): a `<canvas>` inside `[data-part=pad]` painted per-pixel via
`oklchToRgb` + `gamutMapChroma` at the current hue (the adia `#drawArea`, DPR-capped `min(dpr,2)·0.5`, redrawn
on hue change + `ResizeObserver`). The thumb is a positioned `[data-part=pad-thumb]` div (`pointer-events:none`).

**Forced colors** (SPEC-R8, cl.8): an explicit `@media (forced-colors: active)` block — the canvas/pad
`background` forced to `Canvas`, the thumb to a `CanvasText` border (never a fake color); the channel sliders +
numeric readout remain the operable path; an explicit probe asserts they stay usable.

## 9. LLD-C8 — the descriptor (`color-picker.md`)

`tier: pattern` · `extends: UIFormElement` · `geometry.sizeClass: pattern` · `face.formAssociated: true` ·
`attributes[]` = `value`(string,'',reflect) + `format`(enum[hex,oklch],hex,reflect) + the formProps
(`name`/`disabled`/`required`) mirrored 1:1 · `parts[]` = pad/pad-thumb/channels/readout · `slots[]` =
`presets` · `events[]` = `input`,`change` · `aria` = pad `role=slider` / `aria-roledescription="2D slider"` /
composed name · `customStates[]` = `user-invalid` · `forcedColors` note (pad degrades; channels/readout carry
input). The contract↔props + contract↔source trip-wires gate it.

## 10. LLD-C9 — the `ui-text-field type=color` leg

Add a `color` row to the text-field type-config table (`text-field.ts`), shape `{ inputmode:'text',
leading:null, suffix:null, affordance:'swatch', validation:'color', codec:'color' }` — a NEW `affordance`
role `swatch` (a trailing color-swatch button) and codec `color` (`colorCodecOptions(field.format ?? 'hex')`).
On the swatch button's FIRST activation, the ADR-0048 `ensureCalendar` seam is copied verbatim as
`ensureColorPicker`: lazily `import('../color-picker/color-picker.ts')`, create `<ui-color-picker>` in a
`[data-part=color-popup]` div, wire `overlay(this, { popup, anchor: swatchBtn })` and open it on the swatch
button's activation with `handle.open()` (the `OverlayHandle` open method — NOT `show`), and forward the
picker's bubbling `change` to the field value through the codec. Until first activation the field carries no picker
subtree (SPEC-R11 AC2); the static graph never pulls `color-picker.ts` (SPEC-R11 AC1). The trailing swatch
shows the current color via a composed `ui-swatch` (the fence).

## 11. Test plan (the per-control bar; INSTRUMENT-BRIDGE for drag/canvas)

- **`color.test.ts` (unit, jsdom):** `hexToOklch`∘`oklchToHex` round-trips within ε; `gamutMapChroma` returns
  an in-gamut chroma for a wide-gamut triple and is a no-op for an in-gamut one; `colorCodecOptions('hex')`
  parses `#rgb`/`#rrggbb`/`oklch(...)` and formats to `#rrggbb`; `colorCodecOptions('oklch')` formats to
  `oklch(L C H)` at authored chroma; unparseable → `null`. (SPEC-R3.)
- **`area-drag.test.ts` (unit, jsdom — INSTRUMENT-BRIDGE):** synthetic `pointerdown`+`pointermove` on a
  stubbed area with a mocked `getBoundingClientRect` (the `value-drag.test.ts` precedent) prove `onValue(x,y)`
  maps both axes, clamps to [0,1], and the per-drag `AbortController` bounds the move listeners (no residue
  after pointer-up). Real pointer geometry is proven in the browser leg (below).
- **`color-picker.test.ts` (jsdom):** model round-trip (`value` set both syntaxes → thumb %/slider values —
  positions read off style, not paint); `format` switch re-serializes; form seams (`formValue`/`formValidity`
  required+customError/`formReset` clears user-invalid); pad ARIA read DIRECTLY off the part attributes (the
  tabs precedent — vitest-browser locators are blind to internals-only ARIA, but the pad's role rides a PART
  attribute so it is readable); 2-axis keyboard changes the right channel; the `ui-swatch` preview is a real
  `<ui-swatch>` (SPEC-R4 AC2, grep + DOM).
- **`color-picker.browser.test.ts` (Chromium + WebKit):** **whole-shape** — a bare picker in a realistic
  container has a non-degenerate bounding box, pad real height, channels real width (SPEC-R8, the `ui-slider`
  DOT-bug guard); **real pointer-drag** on the pad moves the thumb in BOTH axes and changes chroma+lightness
  (SPEC-R7 AC3 — the `area-drag` proof a synthetic dispatch can't give); **real pointer-drag** on a channel
  moves it (the composed slider works in place); **2-axis keyboard** (real arrow keys) moves the expected axis
  and updates `aria-valuetext`; **forced-colors** (emulated) — channels + readout stay operable, no fake pad
  color. The canvas PIXELS are not asserted (paint is not the contract) — thumb position + emitted `value` are
  (the whole-shape law: assert the gestalt + the value, not the raster).
- **`type=color` leg (browser):** tree-shake (static graph excludes the picker for non-color types); first-open
  lazy mount; a pick commits back to the field value; the Enter-preventDefault anchor-refocus guard holds
  (ADR-0048 precedent). A NODE-side built-output check is NOT required (no built-CSS resolution class here — the
  canvas + drag are runtime, proven cross-engine).
- **Descriptor + barrels/exports/size + independent `component-reviewer` GO** before the wave commit (the
  standing per-control-wave DoD; `npm run size` by hand — this composite likely re-bases the family budget).

## 12. Risks / tradeoffs (recorded)

- **WebKit `userEvent.tab()` near `[popover]`** — the `type=color` leg mounts the picker in a `[popover]`
  overlay, and the known fleet tool gap (Playwright-WebKit `userEvent.tab()` mis-skips near any `[popover]`,
  the calendar-wave finding) threatens the leg's keyboard browser legs. Use the INSTRUMENT-BRIDGE pattern:
  Chromium real-Tab + a WebKit structural probe (assert focus/DOM state directly), never rely on WebKit
  `userEvent.tab()` there.
- **Canvas cost** — the pad redraws per-pixel on every hue change; DPR-capped `min(dpr,2)·0.5` (the adia bound)
  and redraw only on hue change / resize (not on chroma/lightness moves — the thumb moves, the field does not).
- **Gamut binary-search precision** — `gamutMapChroma` is bounded to 8 iterations (the adia constant): a
  ~`MAX_CHROMA/256` chroma resolution, imperceptible and deterministic. Do not raise it for "accuracy" without
  a measured need — it is per-pixel in the canvas paint.
- **`format=oklch` gamut** — an `oklch` serialization emits authored chroma; a wide-gamut value is clamped by
  the browser at paint (sRGB monitor) but the STRING is faithful. Documented, not a defect (SPEC-R3 AC2).
