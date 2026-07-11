---
# color-picker.md frontmatter — the attributes-as-API descriptor for ui-color-picker (ADR-0004 /
# color-picker.lld.md LLD-C8 / ADR-0123). The machine-checkable public surface lives HERE (frontmatter); the
# prose below the fence is the /site doc. The `attributes[]` block MUST mirror UIColorPickerElement.props —
# the contract↔props trip-wire (color-picker.test.ts) and the frontmatter schema (validateComponentDescriptor)
# both target this fence.
tag: ui-color-picker
tier: pattern             # a composite: 2-axis pad + channel sliders + editable readout — no _base/ family fits
extends: UIFormElement    # form-associated: formValue() = the serialized `value` (null when unset); formValidity() = valueMissing + customError

attributes:               # attributes-as-API — mirrors UIColorPickerElement.props (formProps spread first, then own)
  - name: name
    type: string
    default: ''
    reflect: true         # reflects for native form-submission keying (FACE form-control parity)
  - name: disabled
    type: boolean
    default: false
    reflect: true         # reflects so [disabled] attribute-selector styling applies to JS-set values
  - name: required
    type: boolean
    default: false
    reflect: true         # reflects so [required] styling applies; drives formValidity() valueMissing
  - name: value
    type: string
    default: ''
    reflect: true         # reflects + BINDABLE — value:{prop:'value',event:'change'} two-way bind; '' = unset (still PAINTS a default working color, §2)
  - name: format
    type: enum
    values: [hex, oklch]
    default: hex
    reflect: true         # selects the SERIALIZATION syntax of `value` only — the internal model is always OKLCH; an out-of-vocabulary value falls back to hex (fail-open)

properties:
  - name: name
    description: The form-submission key (string). Reflects the `name` attribute.
  - name: disabled
    description: Whether the control is disabled (boolean). Reflects `disabled`. The pad, channel sliders, and readout all become pointer/keyboard-inert. effectiveDisabled() also responds to ancestor <fieldset disabled>.
  - name: required
    description: Whether a color is required (boolean). Reflects `required`. Drives formValidity() → valueMissing when `value` is unset.
  - name: value
    description: The serialized color, in the syntax `format` selects (`#rrggbb` for hex, `oklch(L C H)` for oklch). '' = unset. Setting it externally (any accepted syntax — #rgb/#rrggbb/oklch(...)) parses into the internal OKLCH model and repositions the pad thumb + every channel slider; an unparseable set leaves the prior model intact (no throw). Reflected + bindable via `change`.
  - name: format
    description: "'hex' (default) or 'oklch' — selects only how `value` reads/writes; the control's internal working model is ALWAYS OKLCH. `format=hex` gamut-maps the OKLCH triple into sRGB (binary-search chroma reduction) before serializing; `format=oklch` emits the AUTHORED chroma, which may exceed the sRGB gamut (the browser resolves/clamps it at paint)."

events:
  - name: input
    detail: 'null'
    description: Fired live during a pad pointer-drag, on each channel-slider step, and on each pad keyboard step — every intermediate value during a gesture.
  - name: change
    detail: 'null'
    description: Fired on commit — pad pointer-up (only if the color actually moved since the drag began), a channel slider's blur-with-moved-value, a pad keyboard step (which fires input+change together, an atomic committed step), or a successful readout entry parse. Also drives the `value` two-way bind (value:{prop:'value',event:'change'}).

slots:
  - name: presets
    optional: true
    description: Author-supplied preset/recent-color content (e.g. `ui-swatch` elements or a `ui-ramp`) — a plain light-DOM `[slot=presets]` sibling, positioned last by the control's own CSS `order` (no real Shadow `<slot>` exists in this light-DOM fleet). The control never GENERATES a palette; absent, it renders no region and leaves no layout hole.

parts:
  - name: pad
    role: slider
    description: The `<div data-part="pad" tabindex="0" role="slider" aria-roledescription="2D slider">` 2-axis chroma(X)×lightness(Y) area at the current hue. A pointer/keyboard ACCELERATOR over two channels — NOT the accessible spine (SPEC-R6). Carries a cross-announcing `aria-valuetext` (e.g. "Chroma 0.12, Lightness 0.62") updated on every model change, and an `aria-label` naming both axes (merged with a `ui-field`'s label text when associated).
  - name: pad-thumb
    description: The `<div data-part="pad-thumb">` positioned indicator inside the pad, `pointer-events:none`, placed by `left`/`top` percentages the control sets on every model change.
  - name: pad-canvas
    description: The `<canvas data-part="pad-canvas">` filling the pad, painted per-pixel (OKLCH→sRGB, gamut-mapped) at the current hue on every hue change or resize. Decorative only — hidden under `forced-colors` (SPEC-R8/cl.8); the pad itself carries the pointer/keyboard/ARIA surface, never the canvas. Canvas pixels are never the test contract (browser-only paint; jsdom's `getContext('2d')` returns null).
  - name: channels
    description: The `<div data-part="channels">` container holding three labeled channel rows (hue always; chroma + lightness mirrored) — the ACCESSIBLE SPINE (SPEC-R6). A keyboard-only or screen-reader user sets every channel through these, never needing the pad.
  - name: channel-row
    description: One labeled channel row (`<div data-part="channel-row" data-channel="hue|chroma|lightness">`) inside `[data-part=channels]`, holding a `channel-label`, the composed `<ui-slider>`, and a `channel-value` numeral.
  - name: channel-label
    description: Inside a `channel-row`. A `<span data-part="channel-label">` printing the channel's name ("Hue"/"Chroma"/"Lightness").
  - name: channel-value
    description: Inside a `channel-row`. A `<span data-part="channel-value">` printing the channel's current numeric value (ADR-0123 cl.8 / SPEC-R8 AC2 non-color signifier) — a plain composed `ui-slider` carries no visible text of its own, only ARIA, so this is the control's own printed datum.
  - name: readout
    description: The `<div data-part="readout">` container holding an embedded editable `<ui-text-field>` (two-way-bound to the serialized `value` through `colorCodecOptions`) and a composed `<ui-swatch>` preview (never a bespoke color div — the ADR-0118 fence). Also hosts the feature-detected EyeDropper affordance where `'EyeDropper' in window`.
  - name: eyedropper
    description: Inside `[data-part=readout]`, present ONLY where `'EyeDropper' in window` (SPEC-R13/F7). A `<button data-part="eyedropper">` that opens the OS color picker and commits a sampled color (a `change`). No dedicated icon exists in the current icon pack — a plain text-labeled button ("Pick"), no polyfill, no layout hole where absent.

customStates:
  - user-invalid          # ADR-0051 — set only AFTER the first interaction (blur/change) via the trackUserInvalid controller

face:
  formAssociated: true    # UIFormElement: formValue/formValidity/formReset/formStateRestore seams active
  value: value (null when unset — no default color is submitted for an untouched control, even though the pad/thumb/preview DO paint a defined default working color, §2)

aria:
  role: none              # host carries NO explicit role (ARIA rides the pad part + the composed ui-slider/ui-text-field/ui-swatch children)
  pad: 'role=slider + aria-roledescription="2D slider" + aria-label (both axes, merged with a ui-field label when associated) + a cross-announcing aria-valuetext ("Chroma C, Lightness L") updated every model change. There is no blessed WAI-ARIA 2D-slider role (verified vs the APG + react-aria/Adobe-Spectrum ColorArea) — this is the fleet-honest realization, an ACCELERATOR only.'
  channels: each composed ui-slider carries its own UIRangeElement role=slider + aria-valuenow/min/max/text — a full, independently-audited accessible control per channel (hue/chroma/lightness).
  readout: the composed ui-text-field's own role=textbox (its editor part) + the composed ui-swatch's role=img.

keyboard:
  - key: Tab
    description: Reaches the pad, then each channel ui-slider (hue, chroma, lightness), then the readout ui-text-field, in DOM order — every channel is independently reachable without ever touching the pad (SPEC-R6).
  - key: ArrowLeft / ArrowRight (pad focused)
    description: Step chroma (X axis) by ∓0.004 (Shift = coarse, ∓0.04). Fires input + change together (an atomic committed step); preventDefault suppresses scroll.
  - key: ArrowUp / ArrowDown (pad focused)
    description: Step lightness (Y axis) by ±0.01 (Shift = coarse, ±0.05). Fires input + change together.
  - key: Home / End (pad focused)
    description: Chroma → minimum (0) / maximum (0.4).
  - key: PageUp / PageDown (pad focused)
    description: Lightness → maximum (1) / minimum (0).
  - key: Arrow keys / Home / End / PageUp / PageDown (a channel ui-slider focused)
    description: The unmodified UIRangeElement keyboard contract (±step / ±10×step / min/max) for that one channel.

geometry:
  tier: pattern                                  # container + control-height rows (geometry.md) — the pad is a sized surface, channel rows are Indicator-class ui-sliders, the readout is a Control-height ui-text-field
  pad: --ui-color-picker-pad-block-size           # a bespoke density-invariant floor (10rem default) — NOT a §1 geometry-lookup row (the ui-swatch box / ui-calendar cell precedent)
  channels: Indicator-class ui-slider rows        # self-sized under the ADR-0038 (scale × size) lookup — no new row here
  readout: Control-height ui-text-field           # self-sized under the same lookup
  noNewRow: true                                  # the novelty is the INTERACTION (the area-drag trait + the pad a11y model), not the metric

forcedColors: 'The pad CANNOT paint a gradient under forced-colors (like ui-swatch''s box, the color surface degrades): the canvas is hidden, the pad maps to Canvas/CanvasText, and the thumb becomes a CanvasText-bordered ring — never a fake system color. The channel sliders + numeric readout remain the authoritative, operable input path (they are real controls that survive WHCM unaided; the printed channel values ARE the accessible+WHCM data — the ADR-0118 "the printed value IS the content there" doctrine).'
---

# ui-color-picker

A standalone color-input control that edits ONE color through a 2-axis chroma×lightness pad, three channel
sliders (hue always; chroma + lightness mirrored), and an editable numeric readout with a live swatch preview.
The internal working model is always **OKLCH** — the perceptual space this fleet's own design tokens are
authored in — and `value` serializes through the `format` prop: `#rrggbb` (default, sRGB-gamut-mapped) or
`oklch(L C H)` (opt-in, authored chroma).

## Anatomy

The control creates its light-DOM parts ONCE (idempotent across disconnect/reconnect): the `[data-part=pad]`
2-axis area (a `<canvas>` painting the current hue's chroma×lightness plane, plus a positioned thumb), the
`[data-part=channels]` container holding three composed `<ui-slider>` elements, and the `[data-part=readout]`
container holding an embedded editable `<ui-text-field>` and a composed `<ui-swatch>` preview. An optional
author `[slot=presets]` sibling (e.g. a row of `<ui-swatch>` elements) renders after the readout; the control
never generates a palette of its own.

## The accessible spine is the channels, not the pad

There is no blessed WAI-ARIA "2D slider" role. Rather than making the pad the only fine-adjust path, every
channel (hue, chroma, lightness) is a composed `<ui-slider>` — an already-audited `role=slider` with full
arrow-key stepping and `aria-valuetext`. A screen-reader or keyboard-only user can set every channel without
ever touching the pad. The pad is a pointer/keyboard *accelerator* over two of those channels: it carries its
own `role=slider` + `aria-roledescription="2D slider"` + a cross-announcing `aria-valuetext` naming both
channel values, and a bespoke two-axis keyboard (←/→ chroma, ↑/↓ lightness, Shift = coarse step, Home/End →
chroma min/max, PageUp/PageDown → lightness min/max).

## Value model

`value` is the serialized, form-facing surface; the internal OKLCH triple is ephemeral component state. Setting
`value` (any accepted syntax) parses into the model and repositions every part; an unparseable set leaves the
prior model untouched (no throw). A fresh, untouched control (`value === ''`) still **paints** a defined default
working color — the pad/thumb/preview are never blank — while `formValue()` still submits `null`: the
unset-display default and the submit-null-when-unset contract hold simultaneously, neither implying the other.

## Events

Only `input` (live, every drag-move/channel-step/pad key-step) and `change` (on commit) — both in the fleet's
event allowlist, no new name.

## EyeDropper (progressive enhancement)

Where the Chromium `EyeDropper` API exists (`'EyeDropper' in window`), a small affordance appears in the
readout that opens the OS color picker and commits a sampled color. Absent elsewhere, with no polyfill and no
layout hole.

## Composition — the `ui-text-field type=color` leg

`ui-text-field` gains a thirteenth `type`, `color`: its trailing swatch-affordance lazily mounts a
`<ui-color-picker>` into a popup overlay on first activation (the `type=date` → `ui-calendar` seam, verbatim).
