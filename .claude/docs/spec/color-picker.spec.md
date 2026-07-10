# SPEC — `ui-color-picker` (+ `ui-text-field type=color`)

> Status: proposed · v0.1 · 2026-07-10 · Layer: SPEC (execution contract)
> Refines: [TKT-0011](../tickets/tkt-0011-ui-color-picker.md) under the ratified scope + contract directions of
> [ADR-0123](../adr/0123-ui-color-picker-value-model-and-2d-input.md) (proposed; forks F1–F7 as recommended).
>
> **No owning PRD — a deliberate, acknowledged deviation from the family-PRD pattern**, on the ADR-0117 /
> `theme-provider.spec.md` precedent: this is a single-control intake whose Problem/Users/Acceptance already
> live in TKT-0011 (a TICKET, which carries Summary/Acceptance/Links per its type contract). Authoring a PRD
> here would restate the ticket under different frontmatter — the "restated substrate" failure
> `doc-authoring-standards` names. **Known, deliberate gap:** the harness SPEC↔PRD uplink check has no PRD to
> resolve for this file, by construction; recorded here as a reviewed deviation, not a silent miss.
> Refined by: [`../lld/color-picker.lld.md`](../lld/color-picker.lld.md). Build plan:
> [`../decompositions/color-picker-ship.decomp.json`](../decompositions/color-picker-ship.decomp.json)
> (coverage-clean, plan mode).
> Altitude: owns **what the shipped control does and how it behaves at every boundary** — the value grammar and
> its serialization, the anatomy + composition contract, the pad/channel/readout interaction and its ARIA, the
> form-participation seams, the catalog disposition, and the observable end-state of the `type=color` leg.
> Implementation (canvas paint mechanics, the OKLCH↔sRGB numerics, CSS selectors, page prose) is the LLD's.
> Requirement IDs file-scoped (`SPEC-R1…`).

---

## 1. Purpose

Contract the control ADR-0123 admits: `ui-color-picker`, a Pattern-class `UIFormElement` that edits ONE color
value through a 2-axis pad + channel sliders + an editable numeric readout, on an OKLCH-internal model whose
`value` serializes to a `format`-selected syntax (hex default, oklch opt-in), gamut-mapped into sRGB. It
composes `ui-swatch` (preview) and `ui-slider` (channels); it introduces the `area-drag` trait and the
`colorCodecOptions` codec. A `ui-text-field type=color` leg lazily composes the standalone control into the
Wave-4 overlay. This SPEC is normative for the control's contract, its ARIA/keyboard model, its form seams, its
catalog disposition, and the migration's observable end-state; it is NOT normative for the color numerics, the
canvas paint, or CSS mechanics, which the LLD owns.

## 2. Definitions

- **Internal model** — the control's live working representation of the current color: an OKLCH triple
  (`L ∈ [0,1]`, `C ∈ [0, MAX_CHROMA]`, `H ∈ [0,360)`). NOT a reactive prop; ephemeral component state the render
  reads. `value` is the serialized, form-facing surface.
- **`format`** — the enum prop selecting the SERIALIZATION syntax of `value`: `hex` (default) → `#rrggbb`;
  `oklch` → `oklch(L C H)`. It selects only *how `value` reads/writes*; the internal model is always OKLCH.
- **Canonical value** — what `value` holds and what the form submits: the internal model rendered through
  `format`, sRGB-gamut-mapped when `format=hex`.
- **Gamut mapping** — reducing an OKLCH triple's chroma until it falls inside the sRGB gamut, so a hex
  serialization is exact. Applied before every hex render; NOT applied to an `oklch` serialization.
- **Channel** — one of the color's independent axes exposed as a composed `ui-slider`: **hue** (0–360) always;
  the **pad's two axes** (chroma, lightness) mirrored as sliders so every axis is reachable without the pad.
- **The pad** — the `[data-part=pad]` 2-axis area editing the chroma (X) × lightness (Y) plane at the current
  hue; a pointer/keyboard accelerator over two channels, NOT the accessible spine.
- **The accessible spine** — the channel `ui-slider`s: a keyboard/SR user sets every channel through them,
  never needing the pad (SPEC-R6).
- **Commit** — the moment a `change` event fires: pointer-up on pad/channel, channel blur with a moved value, or
  a readout entry parse-success. Distinct from the live `input` stream during a gesture.
- **Unset display color** — a control whose `value` is `''` (untouched) still PAINTS a color (the pad/thumb/preview
  are never blank): it displays a defined default working color (a defined mid-gamut point). This is orthogonal
  to submission — an unset control submits nothing (SPEC-R9) yet shows this default. Setting/clearing `value`
  never changes the "submit-null-when-unset" contract.

## 3. Requirements

Normative per RFC 2119; each carries an ID and acceptance criteria.

### 3.1 Component contract

**SPEC-R1 — Base class, tag, self-definition.** The control MUST be `ui-color-picker`, class
`UIColorPickerElement` extending `UIFormElement` (NOT a raw `_base/` family — it is a composite), living at
`packages/agent-ui/components/src/controls/color-picker/`, self-defining on import with an idempotent guard.
*(ADR-0123 cl.1)*
- **AC1** *Given* the module is imported, *then* `customElements.get('ui-color-picker')` resolves to a
  constructor that is a subclass of `UIFormElement`, `formAssociated === true`.
- **AC2** *Given* an instance connected then disconnected then reconnected, *then* its light-DOM parts are
  created exactly once (no duplicate `[data-part=pad]`/`[data-part=readout]` — the idempotent-shell law).

**SPEC-R2 — Props schema.** The control MUST declare exactly **five reflected attributes**: its own two —
`value: string('')` and `format: enum(['hex','oklch'], 'hex')` — plus the three spread from
`UIFormElement.formProps` (`name`, `disabled`, `required`). No others: NO app-specific generation-constraint
props (`maxChroma`/`minL`/`hueDriftMax`/`baseHue`/`constraint-clamp` are adia's ultimate-tokens concerns, NOT
fleet API — ADR-0123 Alternatives). The descriptor `attributes[]` fence MUST mirror these five 1:1.
*(ADR-0123 cl.1/cl.2)*
- **AC1** *Given* a fresh instance, *then* `el.value === ''` and `el.format === 'hex'`.
- **AC2** *Given* `el.format = 'oklch'`, *then* `el.getAttribute('format') === 'oklch'` and the reverse reflect
  holds; an out-of-vocabulary `format` value falls back to `'hex'` (fail-open, never a crash).
- **AC3** *Given* the descriptor↔props trip-wire (`compareDescriptorToProps`), *then* it passes with zero drift.

**SPEC-R3 — The value model + serialization (F1).** The control's internal model MUST be OKLCH; `value` MUST
serialize that model through `format` — `#rrggbb` (sRGB-gamut-mapped) for `format=hex`, `oklch(L C H)` for
`format=oklch`. Setting `value` externally (any accepted syntax — `#rgb`/`#rrggbb`/`oklch(...)`) MUST parse into
the internal model. An unparseable `value` MUST leave the prior model intact (no throw, no reset to a default
color). *(ADR-0123 cl.2)*
- **AC1** *Given* `format=hex` and the model is set to a wide-gamut OKLCH triple (chroma beyond sRGB), *then*
  `value` reads a `#rrggbb` string whose color is the gamut-mapped (chroma-reduced) sRGB equivalent — and a
  round-trip `hexToOklch(value)` lands within ε of the mapped triple.
- **AC2** *Given* `format=oklch`, *then* `value` reads `oklch(L C H)` at the authored chroma (NOT gamut-reduced).
- **AC3** *Given* `el.value = '#3b82f6'`, *then* the internal model updates and the pad thumb + channel sliders
  reposition to that color; *given* `el.value = 'oklch(0.62 0.19 260)'`, likewise.
- **AC4** *Given* `el.value = 'not-a-color'`, *then* the model is unchanged, no exception propagates, and (LLD)
  a once-per-element dev warning may be emitted.
- **AC5** *Given* the `colorCodecOptions(format)` factory, *then* its `parse`/`format`/`errorMessage` are PURE
  functions (no DOM), exercised directly in a unit test AND reused by the `type=color` leg (SPEC-R11).

**SPEC-R4 — Anatomy + composition (F4).** The control MUST render, as idempotent light-DOM parts:
`[data-part=pad]` (the 2-axis area + a `[data-part=pad-thumb]`) · `[data-part=channels]` containing composed
`ui-slider`s (hue always; chroma + lightness mirrored) · `[data-part=readout]` containing an embedded editable
`ui-text-field` (two-way-bound to the serialized value through `colorCodecOptions`) AND a composed `ui-swatch`
preview · an optional `[slot=presets]` for author-supplied preset content. The control MUST NOT re-implement
color DISPLAY — the preview MUST be a composed `ui-swatch` (the ADR-0118 fence). *(ADR-0123 cl.5)*
- **AC1** *Given* a connected instance, *then* the pad, the hue/chroma/lightness `ui-slider`s, the readout
  `ui-text-field`, and the `ui-swatch` preview are all present in light DOM.
- **AC2** *Given* the preview, *then* it is a `<ui-swatch>` element whose `value` tracks the control's color —
  NOT a bespoke color `<div>` (grep-provable: no `background`-painting div outside the pad).
- **AC3** *Given* author content in `[slot=presets]` (e.g. `ui-swatch`es), *then* it renders; *given* none,
  *then* the control shows no presets region and no layout hole.

**SPEC-R5 — Events (F4).** The control MUST emit only `input` (live — every drag-move, channel step, pad
key-step) and `change` (on commit — pointer-up, channel blur with a moved value, readout parse-success). Both ⊂
the fleet allowlist; NO new event name. *(ADR-0123 cl.5)*
- **AC1** *Given* a pad pointer-drag, *then* `input` fires repeatedly during the drag and exactly one `change`
  fires on pointer-up (the `ui-slider` precedent — a drag that returns to its start fires no `change`).
- **AC2** *Given* a valid readout entry committed (blur/Enter), *then* one `change` fires; an invalid entry
  fires no `change` and surfaces validity (SPEC-R9).

### 3.2 Interaction + accessibility

**SPEC-R6 — The accessible spine is the channels, not the pad (F2).** Every color channel MUST be settable via a
composed `ui-slider` with full `UIRangeElement` arrow-key/`aria-valuetext`/form semantics; a keyboard-only or
screen-reader user MUST be able to reach and set every channel WITHOUT interacting with the pad. *(ADR-0123
cl.4)*
- **AC1** *Given* keyboard-only navigation, *then* Tab reaches each channel `ui-slider` and the readout
  `ui-text-field`; arrow keys on a focused channel change its value and fire `input`/`change` per the slider
  contract.
- **AC2** *Given* a screen reader on a channel, *then* it announces that channel's role=slider + its
  `aria-valuetext` (e.g. "Hue 260"). *(Verified via the internals-ARIA read pattern — tabs precedent — not a
  vitest-browser locator, which is blind to internals-only ARIA.)*

**SPEC-R7 — The pad as a 2D-slider accelerator (F2).** The `[data-part=pad]` MUST be a single focusable
`tabindex=0` element carrying, on the PART (not `internals` — the host is the form element; the
`ui-calendar` role-on-a-part precedent): `role="slider"`, `aria-roledescription="2D slider"`, an `aria-label`
naming both axes, and an `aria-valuetext` that cross-announces BOTH pad-channel values. Keyboard: ←/→ step the X
channel (chroma), ↑/↓ step the Y channel (lightness), Shift = coarse step, Home/End → X min/max, PageUp/PageDown
→ Y min/max; the handler MUST `preventDefault()` every navigation key. *(ADR-0123 cl.4)*
- **AC1** *Given* focus on the pad, *then* `role`, `aria-roledescription="2D slider"`, `aria-label`, and
  `aria-valuetext` (naming both channel values) are present on `[data-part=pad]`.
- **AC2** *Given* the pad focused, *then* ←/→ changes chroma and ↑/↓ changes lightness (each firing `input`,
  `change` on the key-step commit), and `aria-valuetext` updates; browser probes (both engines) assert the
  thumb moves on the expected axis and the emitted `value` changes accordingly.
- **AC3** *Given* a real pointer-drag on the pad (browser, both engines), *then* the thumb tracks the pointer in
  BOTH axes and the emitted color changes in both chroma and lightness (the `area-drag` 2-axis proof — the 1D
  `value-drag` cannot produce this).

**SPEC-R8 — Whole-shape + non-color signifier (ADR-0102, ADR-0057).** A bare `<ui-color-picker>` in an unstyled
flex/block container MUST paint a visible, non-collapsed, operable control with zero consumer CSS: the pad MUST
have a bespoke default block-size (never collapse to a line — the `ui-slider` DOT-bug class), and every channel
MUST print its numeric value (the control never signifies state by hue alone). *(ADR-0123 cl.1/cl.8)*
- **AC1** *Given* a bare instance in a realistic container (browser, both engines), *then* the whole rendered
  bounding box is non-degenerate (pad has real height, channels have real width — the whole-shape law), asserted
  against the gestalt, not just per-part pixels.
- **AC2** *Given* any channel, *then* a numeric readout of its value is present as text (non-color signifier).

### 3.3 Form participation

**SPEC-R9 — Form seams.** The control MUST implement `UIFormElement`'s seams: `formValue()` returns the
serialized `value` (null when unset/empty — no default color is submitted for an untouched control); `formValidity()`
returns `valueMissing` when `required` and unset, and a `customError` (via the readout codec's error state) when
the readout holds an unparseable entry; `formReset()` restores the HTML-authored initial `value`;
`formStateRestore(string)` re-parses a restored value into the model. The field-labelling seam
(`applyFieldLabelling`, ADR-0051) MUST wire the field's label/description onto the control's labelled part, and
`trackUserInvalid` MUST drive `:state(user-invalid)` timing (the calendar/text-field precedent). *(ADR-0123
cl.1)*
- **AC1** *Given* the control in a `<form>` with a `name`, *then* submission includes `name=value` when set and
  omits it when unset.
- **AC2** *Given* `required` and unset, *then* `formValidity()` is invalid with `valueMissing`; *given* an
  unparseable readout entry, *then* invalid with `customError` carrying the codec message.
- **AC3** *Given* a form reset, *then* `value` returns to the authored initial and `:state(user-invalid)` clears
  (no lingering invalid state — the text-field/calendar formReset precedent).
- **AC4** *Given* a fresh, untouched control (`value === ''`), *then* its pad/thumb/preview render a defined
  default working color (the render is non-empty) AND `formValue()` is `null` SIMULTANEOUSLY — the unset-display
  color (§2) and the submit-null-when-unset contract hold together, neither implying the other.

### 3.4 Catalog + the `type=color` leg + site

**SPEC-R10 — Catalog: emittable, follow-on wave (F5).** `ColorPicker` (the descriptor-derived PascalCase type)
MUST enter the default catalog with the ADR-0019 two-way seam `value:{prop:'value', event:'change'}`, in a
FOLLOW-ON M2 wave: the control-ship wave (M1) seeds `EXCLUSION_ALLOWLIST` with `'ColorPicker'` (drained at M2),
keeping each wave one-context-sized (the ADR-0118 M1/M2 discipline). `ColorPicker` MUST join `FEED_EXCLUDED`
(an input, not artifact-feed content — the ADR-0097 total-partition bookkeeping). *(ADR-0123 cl.6)*
- **AC1** *Given* `color-picker.md` ships at M1, *then* `ColorPicker` enters the fleet-derived `FLEET_TYPES` and
  the catalog-coverage gate stays green ONLY via the M1 allowlist seed; the residue-guard proves it is not also
  a catalog key at M1.
- **AC2** *Given* the M2 wave, *then* the `ColorPicker` catalog row + a validator-clean exemplar + §5.2 guidance
  land, the allowlist drains to zero residue, and `FEED_EXCLUDED` carries the bookkeeping entry.

**SPEC-R11 — The `ui-text-field type=color` leg (F3).** `ui-text-field` MUST gain a thirteenth `type`, `color`,
whose trailing affordance (a swatch button) on FIRST activation lazily dynamic-`import()`s the standalone
`ui-color-picker` module (the LLD owns the exact specifier) and mounts a `<ui-color-picker>` into a Wave-4
overlay popup — the ADR-0048 `type=date`→`ui-calendar` seam
verbatim (module dynamic-`import()` AND popup element BOTH deferred to first open; the readout displays the hex
+ a `ui-swatch`; the picker's `change` bubbles out and updates the field value through `colorCodecOptions`).
The static import graph MUST NOT statically pull `color-picker.ts` (tree-shake: a `type=text` field ships no
picker bytes). *(ADR-0123 cl.3)*
- **AC1** *Given* a `type=text`/`type=number` field bundle, *then* `color-picker.ts` is absent from its static
  graph (the `import()`-not-statically-matched proof, the calendar precedent).
- **AC2** *Given* a `type=color` field, *then* until the swatch button's first activation the field carries no
  picker subtree; on first activation the picker mounts in the overlay and a pick commits back to the field
  value (browser probe — the calendar-overlay precedent, including the Enter-preventDefault anchor-refocus
  guard, ADR-0045/0048).

**SPEC-R12 — Descriptor + site pages.** The descriptor (`color-picker.md`) MUST declare `tier: pattern`,
`extends: UIFormElement`, `geometry.sizeClass: pattern`, `face.formAssociated: true`, an `attributes[]` fence
mirroring `static props`, `parts[]` for pad/pad-thumb/channels/readout, `slots[]` for `presets`, `events[]`
`input`+`change`, `aria` naming the pad's role/roledescription, and a `forcedColors` note. Its `tier: pattern`
REQUIRES a `{doc, demo}` page pair (`site-coverage.test.ts`). *(ADR-0123 cl.1)*
- **AC1** *Given* the descriptor, *then* `validateComponentDescriptor` + the contract trip-wires pass; the
  required-page-set check for a `tier: pattern` control passes.

**SPEC-R13 — EyeDropper: feature-detected progressive enhancement (F7).** The control MUST render an eyedropper
affordance (in `[data-part=channels]`/readout) IF AND ONLY IF the Chromium `EyeDropper` API is present
(`'EyeDropper' in window`); where absent it MUST leave no affordance and no layout hole (no disabled stub, no
gap). Where present, activating it MUST open the OS eyedropper and, on a sample, commit the sampled color
through the model (a `change`). No polyfill; a non-supporting engine is never broken. *(ADR-0123 cl.7 / F7)*
- **AC1** *Given* an engine WITHOUT `EyeDropper` (WebKit/Firefox), *then* no eyedropper button is present and the
  control's layout is hole-free (a browser probe asserting the absent branch).
- **AC2** *Given* an engine WITH `EyeDropper` (Chromium) and a stubbed/faked `window.EyeDropper` resolving a
  color, *then* the button is present, activating it invokes the API, and a resolved sample commits the color
  and fires `change` (the present branch — the API itself is stubbed; the real OS picker is not driven in test).

## 4. Non-goals (explicit fences)

- **Alpha / transparency** — no alpha channel, no `#rrggbbaa`/`oklch(... / a)` output (F6). A future `format`
  value is the fenced extension.
- **Palette generation** — the `[slot=presets]` renders author-supplied swatches; the control never GENERATES a
  palette, harmony, or scale (that is the `palette-design` skill / an app concern — the ticket non-goal).
- **Wide-gamut (P3) output** — `format=hex` is sRGB; `format=oklch` emits at authored chroma but the control
  offers no display-P3 serialization in v1.
- **Re-owning ADR-0118's display surfaces** — the preview composes `ui-swatch`; the control never re-implements
  color display.
- **The adia generation-constraint API** — `maxChroma`/`minL`/`hueDriftMax`/`baseHue`/`constraint-clamp` stay
  out of fleet API (app-specific).
- **A color-math dependency / a `@agent-ui/color` package** — the math is zero-dep pure functions in the control
  folder.

## 5. Trace

| Requirement | ADR-0123 clause | Decomp node(s) |
|---|---|---|
| SPEC-R1 | cl.1 | n3 |
| SPEC-R2 | cl.1, cl.2 | n5, n6 |
| SPEC-R3 | cl.2 | n7, n8 |
| SPEC-R4 | cl.5 | n9, n10, n11, n12 |
| SPEC-R5 | cl.5 | n13 |
| SPEC-R6 | cl.4 | n10 |
| SPEC-R7 | cl.4 | n14, n15 |
| SPEC-R8 | cl.1, cl.8 | n16, n26 |
| SPEC-R9 | cl.1 | n17 |
| SPEC-R10 | cl.6 | n20 |
| SPEC-R11 | cl.3 | n21, n22 |
| SPEC-R12 | cl.1 | n18, n23, n24 |
| SPEC-R13 | cl.7 | n31 |
