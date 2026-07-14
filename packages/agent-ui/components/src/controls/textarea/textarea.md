---
# textarea.md frontmatter — the attributes-as-API descriptor for ui-textarea (ADR-0004). The
# machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc.
# The `attributes[]` block MUST mirror textarea.ts `static props` (the ...UIFormElement.formProps spread —
# name/disabled/required — plus value/label/placeholder/rows/size/readonly) — the contract↔props trip-wire
# (textarea-descriptor.test.ts) and the frontmatter schema both target this fence. Field set per
# .claude/docs/plan.md §10 / ADR-0004; the form participation + the contenteditable editor part per ADR-0013 /
# ADR-0014 (reused pattern); the multi-line geometry law + the sibling-not-mode decision per ADR-0134.
tag: ui-textarea
description: A form-associated multi-line text input with a contenteditable surface — the fleet's first long-form editable primitive (ADR-0134), a sibling of ui-text-field, not one of its modes.
tier: control          # geometry size-class (Control band); the geometry LEVER itself is ADR-0134's own multi-line law, not the single-line (scale×size)→§1-row lookup ui-text-field rides
extends: UIFormElement  # FACE form-associated control (value/validity participation via ElementInternals; ADR-0013)
# marginal: measured by `npm run size` (scripts/measure-size.mjs) — the delta of the components barrel with vs. without this control's export, tree-shaken.

attributes:            # attributes-as-API — mirrors textarea.ts `static props` (control-specific first, then the spread formProps)
  - name: value
    type: string
    default: ''
    reflect: false     # observed (seeds #defaultValue for reset, native parity) but NOT reflected — the value rides the editor surface, not a host attribute
  - name: label
    type: string
    default: ''
    reflect: false     # → the editor's aria-label (the labelling SEAM; yields to a ui-field association's aria-labelledby, ADR-0051)
  - name: placeholder
    type: string
    default: ''
    reflect: false     # shown via [data-empty]::before when the editor is empty (a control-toggled attr, not :empty)
  - name: rows
    type: number
    default: 3
    reflect: true      # native <textarea rows> parity — sets the CSS min-block-size lever (rows × line-box + 2·block-padding) as a MINIMUM, not a fixed height (ADR-0134); also mirrored onto an inline --ui-textarea-rows custom property by textarea.ts for the calc() chain
  - name: size
    type: enum
    values: [sm, md, lg]
    default: md
    reflect: true      # repoints ONLY the font token; padding-block/padding-inline/the per-row line-box all derive from font via calc() (ADR-0134) — NOT the single-line (scale×size)→§1-row height lookup
  - name: readonly
    type: boolean
    default: false
    reflect: true      # reflects to a `readonly` attribute → CSS hook; editor contenteditable=false but still focusable + still submits (ADR-0014 dev#b, reused)
  - name: name
    type: string
    default: ''
    reflect: true      # the form field name (FACE; UIFormElement.formProps) — reflects (native parity; FACE submission keys by the `name` content attribute)
  - name: disabled
    type: boolean
    default: false
    reflect: true      # reflects so the [disabled] state hook applies to JS-set values; effectiveDisabled = own || form-disabled channel (ADR-0013)
  - name: required
    type: boolean
    default: false
    reflect: true      # reflects to a `required` attribute; drives the valueMissing validity verdict + aria-required

properties:            # IDL beyond attributes-as-API: the value property + the FACE form IDL (delegated to ElementInternals by UIFormElement) + the caret-restoration seam
  - name: value
    description: The current text value (string), newlines included. The primary value property — tracked signal, mirrors the editor surface (surface→model) and seeds the form value via ElementInternals.setFormValue (the FACE value, ADR-0013).
  - name: form
    description: The owning <form>, or null (delegates to ElementInternals.form).
  - name: validity
    description: The live ValidityState (delegates to ElementInternals.validity).
  - name: validationMessage
    description: The current validation message (empty when valid).
  - name: willValidate
    description: Whether the control is a candidate for constraint validation.
  - name: checkValidity
    description: Method — runs constraint validation, firing an invalid event when invalid.
  - name: reportValidity
    description: Method — like checkValidity, additionally reporting the problem to the user (focuses the editor anchor).
  - name: selectToEnd
    description: Method — focuses the editor and moves the caret to the end of its text, via a Selection/Range on the editor part. The contenteditable-friendly equivalent of a native `<textarea>.setSelectionRange(len, len)` (ADR-0134's migration seam — used by ui-agent-admin's entry-list re-render to restore an in-progress edit's caret position).

events:
  - name: input
    detail: 'null'
    description: Fired on each edit of the editor (surface→model) as the value tracks the contenteditable. Suppressed mid IME composition. The host re-emits; matches native <textarea> input semantics.
  - name: change
    detail: 'null'
    description: Fired on commit — blur-with-change ONLY (ADR-0134 — the ui-text-field Enter-commits law inverts here; Enter inserts a newline and never commits). Matches native <textarea> change semantics.

slots: []              # no adornment machinery (ADR-0134 — none of ui-text-field's leading/trailing/type-driven adornments apply to plain multi-line text)

parts:                 # the contenteditable editable surface is a control-owned PART, not a slot (ADR-0014 cl.1, reused)
  - name: editor
    description: The editable surface — a control-created light-DOM `<div data-part="editor" contenteditable="plaintext-only" role="textbox" aria-multiline="true">` filling the host box. Created ONCE (idempotent guard) and NEVER re-rendered. Carries role=textbox; the host carries no role/aria-* attribute. `aria-multiline="true"` is the ADR-0134 inversion of ui-text-field's `"false"`.

customStates:          # :state() hooks the stylesheet keys off — set via internals.states, never host attrs
  - ready              # the motion gate (ADR-0008): armed one frame past first paint so the upgrade SNAPS and only subsequent state changes animate
  - disabled           # effectiveDisabled (own || form-disabled channel) — the form-control disabled channel, NOT host ariaDisabled (ADR-0014 dev#b)
  - user-invalid       # set only AFTER the first interaction (blur/change) via the trackUserInvalid controller, gating the danger border

face:
  formAssociated: true   # a FACE form-associated control — value + validity participate via ElementInternals (ADR-0013)
  value: value           # the prop whose value is published to internals.setFormValue
  validity: valueMissing # required+empty; no codec/type validation (ADR-0134 — plain multi-line text has no value-shape to mismatch)

aria:
  role: textbox          # set on the EDITOR part (data-part=editor), NOT the host — the host carries no role/aria-* attribute (form semantics ride internals)
  roleSource: editor part
  labelSource: label / aria-label   # bare usage: the `label` prop → the editor's aria-label; inside a ui-field, applyFieldLabelling overrides this (ADR-0051 seam, reused verbatim)
  disabledState: editor aria-disabled + the form-disabled channel   # effectiveDisabled = own disabled || form-disabled (ADR-0013); NOT host ariaDisabled — ADR-0014 dev#b
  describedBy: editor aria-describedby → a control-managed message node carrying validity().message under :state(user-invalid)   # the WCAG 1.4.1 non-colour validity cue (ADR-0014 cl.4, reused)

keyboard:
  - keys: Enter
    action: Inserts a newline (native <textarea> parity) — does NOT commit. This is the ADR-0134 inversion of ui-text-field's Enter-commits law; commit is blur-with-change only.
  - keys: typing
    action: Edits the editor surface; each edit updates value (surface→model) and emits input (suppressed mid IME composition).
  - note: The editor is intrinsically focusable (contenteditable). host.focus() forwards to the editor (label-association + .focus() parity). disabled removes it from focus (contenteditable=false, no tabindex); readonly keeps it focusable (tabindex=0) and selectable but not editable.

geometry:
  sizeClass: control
  blockSize: var(--ui-textarea-min-block-size)   # a GROWABLE MINIMUM (rows × line-box + 2·block-padding), never a fixed §1-row height — ADR-0134's own multi-line law, NOT geometry.md's single-line Control-class lookup
  paddingBlock: var(--ui-textarea-padding-block)   # REAL block padding — the inversion of the single-line law's padding-block:0
  inlinePad: var(--ui-textarea-padding-inline)
  gap: n/a                # no adornment slots — no slot↔editor gap
  radius: var(--ui-radius-base)            # fixed rounded-rect — the container-fleet referent, entry-control class (geometry.md "Corner radius")
  minInlineSize: var(--ui-textarea-min-inline-size) (~20ch — entry-control typing-width floor, native <textarea> parity; ADR-0021)

forcedColors: A `@media (forced-colors: active)` block keeps the idle frame border, ink, and placeholder visible (CanvasText); the :focus-within outline ring survives via --md-sys-color-focus-ring → Highlight (ADR-0014, reused verbatim).
---

# ui-textarea

`ui-textarea` is the fleet's first long-form **multi-line** FACE form-associated primitive (`extends
UIFormElement`, ADR-0013) — a **sibling** of [`ui-text-field`](../text-field/text-field.md), not one of its
modes (ADR-0134). It carries a `value` (newlines included), participates in form submission and constraint
validation through `ElementInternals`, and contributes no native `<textarea>`. Its editable surface reuses
`ui-text-field`'s contenteditable **pattern** verbatim (ADR-0014) — a stable `<div data-part="editor"
contenteditable="plaintext-only" role="textbox" aria-multiline="true">` — but **inverts** the interaction and
geometry laws that make `ui-text-field` single-line.

```html
<ui-textarea label="Notes" placeholder="Write something…"></ui-textarea>
<ui-textarea label="Description" rows="6" required></ui-textarea>
<ui-textarea label="Fixed" value="pinned text" readonly></ui-textarea>
```

## The inversion from `ui-text-field`

Three things invert, all deliberate (ADR-0134 — "the fork, ruled"):

- **`aria-multiline="true"`**, not `"false"`.
- **`Enter` inserts a newline** — it is never intercepted, so there is no Enter-commit handler at all.
  Commit is **blur-with-change only**, matching the existing `entry-list.ts` consumer contract this control
  was built to replace.
- **Geometry is a growable minimum**, not a fixed height: `rows` sets `min-block-size` (`rows × line-box +
  2·block-padding`); content beyond it scrolls (`overflow-y: auto`) or the user drags it taller
  (`resize: vertical`). `[size]` repoints the font, and padding/line-box **derive from font** — there is no
  single-line `(scale × size) → §1-row` lookup here (geometry.md's Control-class law does not apply; this
  control declares its own).

There is **no `type` prop** and **no adornment/codec/overlay machinery** — none of `ui-text-field`'s 13
value-shapes apply to plain multi-line prose.

## The editable surface

Typing in the editor updates `value` (**surface→model**) and emits a native-parity `input`; a programmatic
`value` write (or a form reset/restore) flows back to the editor (**model→surface**) under the same **caret
guard** `ui-text-field` uses — the editor's `textContent` is rewritten only when the model diverges from the
surface, so a keystroke never resets the caret — and never mid IME composition. The placeholder shows via a
control-toggled `data-empty` attribute, not `:empty`.

## Sizes

`size` (`sm` · `md` (default) · `lg`) repoints the editor's font; `padding-block`, `padding-inline`, and the
per-row line-box all **derive from that font** via `calc()`, so one repoint cascades through all three. This
is deliberately **not** the `(scale × size) → §1-row` lookup `ui-text-field`/`ui-select` ride — a multi-line
box has no single fixed height to look up (ADR-0134). The frame (border + radius) is drawn **on the host**,
the same fixed `--ui-radius-base` rounded-rect entry-control class `ui-text-field` uses (geometry.md "Corner
radius"). A bare textarea carries a default minimum typing width (`min-inline-size: ~20ch`) so it stays
hittable; layout owns width above the floor.

## States

The border-channel state ladder — idle → `:hover` → focus (transparent border + the shared outline ring) →
the `user-invalid` danger border — and `disabled` (a role repoint, not opacity) are reused verbatim from
`ui-text-field` (ADR-0014 cl.2c / dev#b / dev#c) — the field-frame pattern is shape-independent. A disabled
textarea is not user-resizable (`resize: none`).

## Validity & accessibility

`required` + an empty value raises a `valueMissing` constraint (anchored on the editor); the danger border
and `aria-invalid` appear only **after the first interaction** (blur/change), timed by the `trackUserInvalid`
controller. The editor points at a control-managed message node via `aria-describedby` carrying
`validity().message` (WCAG 1.4.1). In bare usage the `label` prop becomes the editor's `aria-label`; inside a
[`ui-field`](../field/field.md) association, `applyFieldLabelling` id-references the field's own
label/description/error parts instead (the ADR-0051 seam, reused verbatim).

## Form participation

`value` is published to the owning `<form>` via `ElementInternals.setFormValue` (ADR-0013), so the control
round-trips through `FormData`/submit, `formResetCallback` restores its initial `value`, and
`validity`/`validationMessage`/`checkValidity()`/`reportValidity()` delegate to `internals` — all without a
native `<textarea>`.

## `selectToEnd()`

A contenteditable host exposes no `setSelectionRange` — `selectToEnd()` is the migration seam ADR-0134 named
for `ui-agent-admin`'s per-entry editors: it focuses the editor and collapses the selection to the end of its
text via a `Selection`/`Range`, the equivalent of a native `<textarea>.setSelectionRange(value.length,
value.length)`.
