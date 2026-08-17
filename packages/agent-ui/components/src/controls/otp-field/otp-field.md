---
# otp-field.md frontmatter — the attributes-as-API descriptor for ui-otp-field (ADR-0004), the identity
# family's S2-a code-entry control (code-entry-control.lld.md, GH #490). The `attributes[]` block MUST
# mirror otp-field.ts `static props` (value/length/label/size, plus the ...UIFormElement.formProps spread —
# name/disabled/required) — the contract↔props trip-wire (otp-field.test.ts) and the frontmatter schema
# (validateComponentDescriptor) both target this fence. Field set per .claude/docs/plan.md §10 / ADR-0004;
# form participation per ADR-0013; the ONE-textbox/N-cells anatomy + the a11y ruling per the LLD §6.
tag: ui-otp-field
description: A segmented N-cell one-time-code entry field — one focusable editable surface, N presentational cells, auto-advance/backspace-walk/arrow traversal under a no-gaps invariant, and full/partial paste-split.
tier: control          # geometry size-class (Control band — full control height; geometry.md "five size-classes")
extends: UIFormElement  # FACE form-associated control (value/validity participation via ElementInternals; ADR-0013)
# marginal: measured via `npm run size` (scripts/measure-size.mjs) at build time — the components barrel delta with vs. without this control's export (it + UIFormElement + trackUserInvalid, tree-shaken); no codec/adornment machinery, so the marginal is expected near the checkbox/switch Wave-1 floor, not the text-field ceiling.

attributes:            # attributes-as-API — mirrors otp-field.ts `static props` (control-specific first, then the spread formProps)
  - name: value
    type: string
    default: ''
    reflect: false     # observed (seeds the reset baseline, native parity) but NOT reflected — the live value rides the cell/editor surface, never a host attribute
  - name: length
    type: number
    default: 6
    reflect: true      # N cells; cleaned to an integer clamped [1, 12] at every internal read (this.length itself stays the raw reflected prop — native attribute-IDL parity); nonsense/non-integer → default 6
  - name: label
    type: string
    default: ''
    reflect: true       # TKT-0069 item 2 ruling: label reflects fleet-wide
  - name: size
    type: enum
    values: [sm, md, lg]
    default: md
    reflect: true      # reflects so the [size] dimensional-ramp repoint in otp-field.css applies to JS-set values too
  - name: name
    type: string
    default: ''
    reflect: true      # the form field name (FACE; UIFormElement.formProps) — reflects (native parity)
  - name: disabled
    type: boolean
    default: false
    reflect: true      # reflects; editor contenteditable=false + effectiveDisabled = own || form-disabled channel (ADR-0013)
  - name: required
    type: boolean
    default: false
    reflect: true      # reflects to a `required` attribute; drives the valueMissing validity verdict + aria-required

properties:            # IDL beyond attributes-as-API: the FACE form IDL (delegated to ElementInternals by UIFormElement)
  - name: value
    description: The current (possibly partial) digit-string value — a contiguous digit prefix (/^[0-9]{0,length}$/, the no-gaps invariant). The primary value property — tracked signal, mirrors the invisible editor surface's text content and seeds the form value via ElementInternals.setFormValue (the FACE value, ADR-0013). The canonical IS the display — no codec.
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
    description: Fired after EVERY transition that mutates value — a digit, a backspace/delete, or a paste (one input per paste, not per character). Suppressed mid IME composition (the composed result lands via compositionend, routed through the paste path). Never fired by an external programmatic value write (§8 native parity).
  - name: change
    detail: 'null'
    description: Fired on commit — (a) the completion commit, the instant value.length reaches length (the len < N -> len === N edge; a full-code paste that re-completes an already-complete code fires this unconditionally too, §5), and (b) blur-with-change against the value-at-focus baseline (text-field parity; the completion commit resets the baseline so a following blur never double-fires). Enter also commits if the value changed since focus.

slots: []              # nothing is author-supplied inside this control — no slots (LLD §2 Anatomy row)

parts:                 # control-created light-DOM anatomy, created ONCE (idempotent guard, ADR-0014 cl.1)
  - name: editor
    description: The ONE focusable/hit-testable surface (LLD §6's ruling) — a control-created `<div data-part="editor" contenteditable="plaintext-only" role="textbox" aria-multiline="false" inputmode="numeric">`, stretched over the whole cell grid as a visually transparent overlay (opacity 0 — the cells paint the digits; its literal text content mirrors `value` for screen-reader navigation). Receives every keystroke/paste/composition/pointerdown; the native caret never edits (every beforeinput is intercepted unconditionally and routed through the pure reducer in model.ts). Created once, never re-rendered.
  - name: cell
    description: One of `length` presentational, `aria-hidden="true"` cells — a square box painted from `value[i]` (textContent) plus the `[data-filled]` / `[data-active]` state attributes. Created/removed by an effect on `length` (append/remove tail cells only, never recreate all). Never independently focusable or interactive — a click anywhere in the grid resolves to a cell index via the editor's own pointerdown handler (position math), not a per-cell listener.
  - name: echo
    description: The frozen LLD-C8 polite announcement channel — a visually hidden `<div data-part="echo" aria-live="polite" aria-atomic="true">`, NEVER id-referenced from aria-describedby (it must never double-read as a description). Written by the same #dispatch choke point that applies a reducer result, on USER-DRIVEN mutations only (never an external value write) — digit → "{d}, {len} of {N}" · backspace/delete → "cleared, {len} of {N}" · paste/multi-char insert → "{k} digits entered, {len} of {N}" · a transition that also completes the code → "code complete" (replacing whatever that transition's own echo would have been). Needed because the interception model (unconditional beforeinput preventDefault + scripted textContent writes) makes the editor mute by default — a real `<input>` would announce these on its own.

customStates:          # :state() hooks otp-field.css keys off — set via internals.states in otp-field.ts
  - ready              # the motion gate (ADR-0008): armed one frame past first paint
  - disabled           # effectiveDisabled (own || form-disabled channel) — the form-control disabled channel, NOT host ariaDisabled
  - user-invalid       # set only AFTER the first interaction (blur/change) via the trackUserInvalid controller, gating the per-cell danger border

face:
  formAssociated: true   # a FACE form-associated control — value + validity participate via ElementInternals (ADR-0013)
  value: value           # the prop whose value is published to internals.setFormValue — the raw (possibly partial) string; no codec
  validity: valueMissing | tooShort # valueMissing (required + value === ''); tooShort (0 < value.length < length — the native under-length flag, not customError)

aria:
  role: textbox          # set on the EDITOR part (data-part=editor), NOT the host — the host carries no role/aria-* attribute (form semantics ride internals)
  roleSource: editor part
  labelSource: label / aria-label   # bare usage: the `label` prop → the editor's aria-label; inside a ui-field (ADR-0051) applyFieldLabelling overrides this — the field's label/description/error part ids are id-referenced onto the editor's aria-labelledby/aria-describedby instead, and this aria-label yields
  disabledState: editor aria-disabled + the form-disabled channel   # effectiveDisabled = own disabled || form-disabled (ADR-0013); NOT host ariaDisabled — ADR-0014 dev#b
  describedBy: editor aria-describedby → a control-managed message node (a className hook, not a data-part — text-field precedent) carrying validity().message, VISIBLE (danger ink + text) under :state(user-invalid) (ADR-0029 A1, ADOPTED)   # the WCAG 1.4.1 non-colour validity cue (ADR-0014 cl.4 / ADR-0029 A1); the echo part is DELIBERATELY never referenced here (LLD-C8 — it must not double-read as a description)

keyboard:
  - keys: typing (digits)
    action: Overwrites the active cell, then auto-advances to the next empty cell (min(a+1, firstEmpty)). A non-digit character is filtered — no-op, no event.
  - keys: Backspace
    action: A filled active cell is spliced out (contiguity preserved, active stays); an empty active cell (a === length reached) walks back one cell first, then splices it out.
  - keys: Delete
    action: Backspace's filled-cell arm at the active cell (splice, stay) — a no-op when the active cell is empty (nothing after the caret to delete).
  - keys: ArrowLeft / ArrowRight
    action: Moves the active cell by one, never passing 0 or the first empty cell (traversal cannot create a gap).
  - keys: Home / End
    action: Home jumps the active cell to 0; End jumps it to the first empty cell (or the last cell, if the code is complete).
  - keys: Enter
    action: Commits (emits change) if the value has changed since focus — text-field parity. Never inserts anything (the editor's beforeinput is always intercepted).
  - keys: Escape
    action: Deliberate no-op — no clear-on-escape (a destructive surprise mid-entry).
  - keys: Ctrl/Cmd+V (paste)
    action: A full code (≥ length digits, after stripping every non-digit separator) pasted into ANY cell REPLACES the whole value and fires the completion commit. A partial code writes forward from the active cell, overwriting. An all-non-digit paste is a no-op (no event, no error).
  - note: The host is ONE Tab stop (the editor); cells are never separately focusable or tab stops. Disabled removes the editor from the tab order. A pointerdown anywhere in the grid focuses the editor and resolves the click position to the nearest cell index (clamped to the first empty cell past the fill).

geometry:
  sizeClass: control
  blockSize: var(--ui-otp-field-height)   # the vertical lever off the dimensional ramp; padding-block is 0
  paddingBlock: 0
  cellInlineSize: var(--ui-otp-field-cell-inline-size)   # = height — a square one-glyph entry cell, derived off the lever (no new ramp)
  gap: var(--ui-otp-field-gap)            # inter-cell rhythm — the one density-bearing quantity (gap = font/2 × density)
  radius: var(--md-sys-shape-corner-base)            # fixed rounded-rect — the container-fleet referent, NOT the h/2 pill; entry-control class, geometry.md "Corner radius" / ADR-0015 cl.5
  minInlineSize: none (deliberate, LLD §7)   # the N-cell grid's own intrinsic size (N × cell + (N−1) × gap) already floors the control — the entry-class min-inline-size token is deliberately NOT minted (a documented deviation from the general rule, not an omission)

forcedColors: A `@media (forced-colors: active)` block keeps every cell border + ink visible (CanvasText; GrayText when disabled); the active cell's focus outline survives via --md-sys-color-focus-ring → Highlight (the token layer's WHCM mapping) with no per-control rule needed.
---

# ui-otp-field

`ui-otp-field` is a FACE **form-associated** Control-class one-time-code entry field
(`extends UIFormElement`, ADR-0013): a segmented N-cell surface with **one** focusable editable surface and
**N** presentational cells. It owns the cross-cell interaction logic a one-time-code field needs — auto-
advance on digit entry, backspace walk-back, arrow traversal under a no-gaps invariant, first-empty focus on
entry, and paste-split of a full or partial code with non-digit filtering — behind the fleet's standard FACE
contract (no native `<input>`, ARIA via `ElementInternals` and a light-DOM part, never host attributes).

```html
<ui-otp-field label="One-time code"></ui-otp-field>
<ui-otp-field label="6-digit code" length="6" required></ui-otp-field>
<ui-otp-field label="4-digit PIN" length="4"></ui-otp-field>
```

## Value + form participation

`value` is a **contiguous digit prefix** (`/^[0-9]{0,length}$/`) — the canonical IS the display, no codec.
`required` + an empty value raises `valueMissing`; a partial code (`0 < value.length < length`) raises the
native `tooShort` flag. `formReset()` restores the initial `value` attribute baseline.

## The one-textbox, N-cells anatomy (RULED)

The accessible surface is **one** `role=textbox` — never N separate per-cell inputs (the known-hostile
N-tab-stops OTP pattern: every auto-advance would be an unrequested focus steal, re-announcing "edit text,
blank" on every keystroke). The editor is a control-created, invisible overlay stretched across the whole
grid; the cells are pure, `aria-hidden` presentation, each painted from `value[i]`. Every edit — typed digit,
backspace/delete, arrow/Home/End navigation, a pointer click anywhere in the grid, a real clipboard paste, or
an IME composition's final text — routes through one pure reducer (`model.ts`), never the native contenteditable
caret (`beforeinput` is always intercepted).

## Paste-split

Pasting (or dropping, or an autocorrect replacement, or an IME composition's final text) a string first strips
every non-digit — `"424 242"` and `"code: 424242"` both land clean. A **full** code (≥ `length` digits) pasted
into **any** cell replaces the whole value and fires the completion commit — "paste a full code" always means
"use this code". A **partial** code writes forward from the active cell, overwriting, preserving the no-gaps
contiguity invariant.

## Accessibility — the announcement channel

Because every edit is intercepted and scripted, a real `<input>`'s native announcements never fire here by
construction — so a dedicated `aria-live="polite"` **echo** part is the designed-in channel (not a repair):
every user-driven mutation (a digit, a clear, a paste, or the code completing) announces a short, frozen
message. An **external** `value` write (a data-bound prop/attribute set, a form reset/restore) never touches
the echo and never emits `input` — native parity: only a real user edit is "user-driven".

`required` + an empty value raises `valueMissing`; the danger border on every cell, `aria-invalid`, and a
**visible** inline validation message appear only **after the first interaction** (blur/change), timed by
the `trackUserInvalid` controller (ADR-0014 dev#c) — the message node (a `className` hook, not a `data-part`;
`ui-text-field`'s own shape) becomes visible (danger ink, small type) only while it carries text under
`:state(user-invalid)` (ADR-0029 A1, ADOPTED), the non-colour WCAG 1.4.1 reinforcement the danger border
alone cannot provide. In bare usage this is the sole validity cue; the visible label/description/error
wrapper is `ui-field` — once associated, the internal message node yields (emptied, hidden) so assistive
tech hears exactly one announced error, the field's.

## Sizes

`size` selects a step on the dimensional ramp (`sm` · `md` (default) · `lg`), the same `(scale × size) → §1
row` lookup `ui-text-field` uses (ADR-0038) — height + font move together; the cell's inline size is derived
`= height` (a square one-glyph box). Unlike the entry-control family's general rule, this control ships **no**
`min-inline-size` floor — the N-cell grid's own intrinsic width already prevents the bare-control collapse the
floor rule exists to guard against.

## Catalog posture

`ui-otp-field` is **permanently excluded** from the A2UI default catalog (ADR-0176 cl.3): a one-time-code
entry is the credential-bearing element of an authentication flow, and Registration/Authentication surfaces
are host-page-only forever, never agent-emittable.
