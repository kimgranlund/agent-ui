---
# text-field.md frontmatter — the attributes-as-API descriptor for ui-text-field (ADR-0004). The
# machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc.
# The `attributes[]` block MUST mirror text-field.ts `static props` (the ...UIFormElement.formProps spread
# — name/disabled/required — plus value/label/placeholder/size/readonly) — the contract↔props trip-wire
# (s10, text-field-descriptor.test.ts) and the frontmatter schema both target this fence. Field set per
# docs/plan.md §10 / ADR-0004; the form participation + the contenteditable editor part per ADR-0013 / ADR-0014.
tag: ui-text-field
tier: control          # geometry size-class (Control band — full control height; geometry.md "five size-classes")
extends: UIFormElement  # FACE form-associated control (value/validity participation via ElementInternals; ADR-0013)

attributes:            # attributes-as-API — mirrors text-field.ts `static props` (control-specific first, then the spread formProps)
  - name: value
    type: string
    default: ''
    reflect: false     # observed (seeds #defaultValue for reset, native parity) but NOT reflected — the value rides the editor surface, not a host attribute
  - name: label
    type: string
    default: ''
    reflect: false     # → the editor's aria-label (the labelling SEAM; the visible label wrapper is ui-field at G7)
  - name: placeholder
    type: string
    default: ''
    reflect: false     # shown via [data-empty]::before when the editor is empty (a control-toggled attr, not :empty)
  - name: size
    type: enum
    values: [sm, md, lg]
    default: md
    reflect: true      # reflects so the [size] dimensional-ramp repoint in text-field.css applies to JS-set values
  - name: readonly
    type: boolean
    default: false
    reflect: true      # reflects to a `readonly` attribute → CSS hook; editor contenteditable=false but still focusable + still submits (ADR-0014 dev#b)
  - name: name
    type: string
    default: ''
    reflect: true      # the form field name (FACE; UIFormElement.formProps) — reflects (native parity; FACE submission keys by the `name` content attribute), matching the form.ts base
  - name: disabled
    type: boolean
    default: false
    reflect: true      # reflects so the [disabled] state hook applies to JS-set values; effectiveDisabled = own || form-disabled channel (ADR-0013)
  - name: required
    type: boolean
    default: false
    reflect: true      # reflects to a `required` attribute; drives the valueMissing validity verdict + aria-required

properties:            # IDL beyond attributes-as-API: the value property + the FACE form IDL (delegated to ElementInternals by UIFormElement)
  - name: value
    description: The current text value (string). The primary value property — tracked signal, mirrors the editor surface (surface→model) and seeds the form value via ElementInternals.setFormValue (the FACE value, ADR-0013).
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

events:
  - name: input
    detail: 'null'
    description: Fired on each edit of the editor (surface→model) as the value tracks the contenteditable. Suppressed mid IME composition. The host re-emits; matches native <input> input semantics.
  - name: change
    detail: 'null'
    description: Fired on commit — blur-with-change or Enter (Enter also suppresses the newline). Matches native <input> change semantics.

slots:                 # leading/trailing name a POSITION in the host-as-grid (anatomy.md); the EDITOR is a control PART, not a user slot (see parts)
  - name: leading
    optional: true
    description: Optional leading adornment — a light-DOM `[slot="leading"]` child placed in the start cell by the presence-driven host-as-grid (anatomy.md / ADR-0006); commonly a `data-role="icon"`. Absent ⇒ the bare editor layout.
  - name: trailing
    optional: true
    description: Optional trailing adornment — a light-DOM `[slot="trailing"]` child placed in the end cell (a status glyph / unit). Layout only; mark decorative glyphs aria-hidden — the editor keeps the accessible name.

parts:                 # the contenteditable editable surface is a control-owned PART, not a slot (ADR-0014 cl.1)
  - name: editor
    description: The editable surface — a control-created light-DOM `<div data-part="editor" contenteditable="plaintext-only" role="textbox" aria-multiline="false">` in the centre value cell. Created ONCE (idempotent guard) and NEVER re-rendered (render() stays the inherited void — re-committing a contenteditable subtree destroys the caret; ADR-0014). Carries role=textbox; the host carries no role/aria-* attribute.

customStates:          # :state() hooks the stylesheet keys off — set via internals.states, never host attrs
  - ready              # the motion gate (ADR-0008): armed one frame past first paint so the upgrade SNAPS and only subsequent state changes animate
  - disabled           # effectiveDisabled (own || form-disabled channel) — the form-control disabled channel, NOT host ariaDisabled (ADR-0014 dev#b)
  - user-invalid       # set only AFTER the first interaction (blur/change) via the trackUserInvalid controller, gating the danger border (ADR-0014 dev#c)

face:
  formAssociated: true   # a FACE form-associated control — value + validity participate via ElementInternals (ADR-0013)
  value: value           # the prop whose value is published to internals.setFormValue (formValue() = this.value)
  validity: valueMissing # the constraint this control raises — required && value === '' → valueMissing (anchored on the editor)

aria:
  role: textbox          # set on the EDITOR part (data-part=editor), NOT the host — the host carries no role/aria-* attribute (form semantics ride internals)
  roleSource: editor part
  labelSource: label / aria-label   # the `label` prop → the editor's aria-label (the seam); the visible label/description/error wrapper is ui-field at G7
  disabledState: editor aria-disabled + the form-disabled channel   # effectiveDisabled = own disabled || form-disabled (ADR-0013); NOT host ariaDisabled (the ADR-0010 channel is for non-form controls) — ADR-0014 dev#b
  describedBy: editor aria-describedby → a control-managed message node carrying validity().message under :state(user-invalid)   # the WCAG 1.4.1 non-colour validity cue (ADR-0014 cl.4)

keyboard:
  - keys: Enter
    action: Commits the value (emits change) and is preventDefault-suppressed — single-line field, no newline is inserted.
  - keys: typing
    action: Edits the editor surface; each edit updates value (surface→model) and emits input (suppressed mid IME composition).
  - note: The editor is intrinsically focusable (contenteditable). host.focus() forwards to the editor (label-association + .focus() parity). disabled removes it from focus (contenteditable=false, no tabindex); readonly keeps it focusable (tabindex=0) and selectable but not editable.

geometry:
  sizeClass: control
  blockSize: var(--ui-text-field-height)   # the vertical lever off the dimensional ramp; padding-block is 0
  paddingBlock: 0
  inlinePad: h/2 (value/text edge) · ½(h−icon) (leading / trailing slot edge)   # the centering law, geometry.md
  gap: var(--ui-text-field-gap)            # adornment↔editor column-gap — the one density-bearing quantity (gap = font/2 × density)

forcedColors: A `@media (forced-colors: active)` block keeps the field border, ink, and placeholder visible (CanvasText); the :focus-within outline ring survives via --c-focus-ring → Highlight (the focus border-color step does not, which is why the ring is load-bearing) — ADR-0014.
---

# ui-text-field

`ui-text-field` is the first FACE **form-associated** control (`extends UIFormElement`, ADR-0013): it
carries a `value`, participates in form submission and constraint validation through `ElementInternals`,
and contributes no native `<input>`. Its editable surface is a control-owned **contenteditable editor
part** (ADR-0014) — a stable `<div data-part="editor" contenteditable="plaintext-only" role="textbox">`
placed in the host-as-grid centre cell, created once and never re-rendered. The host carries **no**
`role`/`aria-*` attribute; the editor carries `role="textbox"`, and the host's form semantics ride
`internals`.

```html
<ui-text-field label="Email" placeholder="you@example.com"></ui-text-field>
<ui-text-field label="Name" size="lg" required></ui-text-field>
<ui-text-field label="Read only" value="fixed" readonly></ui-text-field>
```

## The editable surface

Typing in the editor updates `value` (**surface→model**) and emits a native-parity `input`; a programmatic
`value` write (or a form reset/restore) flows back to the editor (**model→surface**) under a **caret guard**
— the editor's `textContent` is rewritten only when the model diverges from the surface, so a keystroke
never resets the caret — and never mid IME composition (ADR-0014 cl.1). `Enter` commits (`change`) and
inserts no newline (single-line). The placeholder shows via a control-toggled `data-empty` attribute, not
`:empty` (a contenteditable clear leaves a bogus `<br>`).

## Sizes

`size` selects a step on the dimensional ramp (`sm` · `md` (default) · `lg`), setting the control height
and font; an ancestor `[scale]` multiplies the frame and an ancestor `[density]` multiplies the
adornment↔editor gap. The geometry follows the **Control size-class** in `geometry.md`: the block-size is
the vertical lever (`padding-block` is always `0`), the value/text edge sits at `h/2`, and a leading/trailing
slot edge at the emergent `½(h − icon)`. The field frame (border + radius) is drawn **on the host** so a
slotted adornment sits inside the box.

## Slots & anatomy

The anatomy is the family host-as-grid (`anatomy.md` / ADR-0006), with the **editor** substituted for the
label as the centre value cell. Two optional adornment **positions** flank it — `slot="leading"` and
`slot="trailing"` — placed by the presence-driven `:has()` grid via `order`. What goes *into* a slot carries
its content role on the node via `data-role` (`icon` today); decorative glyphs are `aria-hidden` so the
editor keeps the accessible name. The editor itself is a control **part**, not a user slot.

## States

The control authors its own interaction states off the **border channel** (a text field has no
pressed/active state, so the button's background-fill ladder does not apply; `interaction-states.md`,
ADR-0014 dev#c). The border steps through a solid colour-role ladder — idle → `:hover` → focus → the
`user-invalid` danger border — and `disabled` is a role **repoint** (muted surface + ink, a faint frame),
**not** opacity. Motion is gated behind `:state(ready)` and zeroed under reduced-motion (the
`interaction-states.md` motion standard).

Two deviations from the button-derived standard are explicit (ADR-0014):

- **Focus shows on `:focus-within`** (ALL focus, native text-input parity), not `:focus-visible`
  (keyboard-only). The treatment is **both** a `border-color` step **and** the shared `outline` ring — both
  keyed on `:focus-within`, reading the fleet-wide `--c-focus-ring` / `--ui-focus-ring-*` tokens (ADR-0009,
  as amended). The outline is the forced-colors indicator (`--c-focus-ring → Highlight`); the focus
  `border-color` does not survive forced-colors, which is why both are drawn.
- **`disabled` rides the editor + the platform form-disabled channel** (`effectiveDisabled = own || form`),
  not host `ariaDisabled` — disabled → editor `contenteditable=false` + not focusable + `aria-disabled` +
  host inert + `:state(disabled)`. **`readonly`** → editor `contenteditable=false` **but** focusable
  (`tabindex=0`) + `aria-readonly`, and **still submits**.

## Validity & accessibility

`required` + an empty value raises a `valueMissing` constraint (anchored on the editor); the danger border
and `aria-invalid` appear **only after the first interaction** (blur/change), timed by the `trackUserInvalid`
controller (ADR-0014 dev#c). Because the invalid cue leans on colour, the editor points at a control-managed
message node via `aria-describedby` carrying `validity().message` — a non-colour reinforcement per **WCAG
1.4.1** (ADR-0014 cl.4). The `label` prop becomes the editor's `aria-label` (the labelling seam); the
visible label / description / error wrapper is `ui-field`'s job at G7.

## Form participation

`value` is published to the owning `<form>` via `ElementInternals.setFormValue` (the FACE pattern,
ADR-0013), so the field round-trips through `FormData`/submit, `formResetCallback` restores its initial
`value`, and `validity`/`validationMessage`/`checkValidity()`/`reportValidity()` delegate to `internals` —
all without a native `<input>`.
