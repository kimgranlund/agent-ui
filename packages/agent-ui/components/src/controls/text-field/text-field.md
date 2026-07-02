---
# text-field.md frontmatter — the attributes-as-API descriptor for ui-text-field (ADR-0004). The
# machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc.
# The `attributes[]` block MUST mirror text-field.ts `static props` (the ...UIFormElement.formProps spread
# — name/disabled/required — plus value/label/placeholder/size/readonly) — the contract↔props trip-wire
# (s10, text-field-descriptor.test.ts) and the frontmatter schema both target this fence. Field set per
# .claude/docs/plan.md §10 / ADR-0004; the form participation + the contenteditable editor part per ADR-0013 / ADR-0014.
tag: ui-text-field
tier: control          # geometry size-class (Control band — full control height; geometry.md "five size-classes")
extends: UIFormElement  # FACE form-associated control (value/validity participation via ElementInternals; ADR-0013)
# marginal: ui-text-field adds 2623 B gz (10975 B min) to the self-defining ui-* family (the delta of `npm run size`'s components barrel with vs. without this control's export, tree-shaken — it + UIFormElement + trackUserInvalid + the Wave 5A codec factories/helpers). Wave 5A (ADR-0047) grew the marginal from 1110 B gz (Wave 3) by adding currencyCodecOptions/unitCodecOptions/currencySymbol/unitLabel, TYPE_CONFIG v2 (10 types), numeric adornment factories, ArrowUp/Down, and range validity. The family total is gated each run by `npm run size` (scripts/measure-size.mjs)

attributes:            # attributes-as-API — mirrors text-field.ts `static props` (control-specific first, then the spread formProps)
  - name: value
    type: string
    default: ''
    reflect: false     # observed (seeds #defaultValue for reset, native parity) but NOT reflected — the value rides the editor surface, not a host attribute
  - name: label
    type: string
    default: ''
    reflect: false     # → the editor's aria-label (the labelling SEAM; the visible label/description/error wrapper is ui-field, SHIPPED — ADR-0051, controls/field/field.md)
  - name: placeholder
    type: string
    default: ''
    reflect: false     # shown via [data-empty]::before when the editor is empty (a control-toggled attr, not :empty)
  - name: size
    type: enum
    values: [sm, md, lg]
    default: md
    reflect: true      # reflects so the [size] dimensional-ramp repoint in text-field.css applies to JS-set values
  - name: type
    type: enum
    values: [text, email, url, tel, password, search, number, currency, unit, percent, date, time]
    default: text
    reflect: true      # reflects so [type] CSS selectors (e.g. [type=password] for -webkit-text-security masking) + the type-resolver apply to JS-set values; type='text' is the identity config (byte-identical to the pre-Wave-3 shipped control; ADR-0044). Wave 5A (ADR-0047) adds unit + percent. Wave 5B (ADR-0048) adds date + time.
  - name: readonly
    type: boolean
    default: false
    reflect: true      # reflects to a `readonly` attribute → CSS hook; editor contenteditable=false but still focusable + still submits (ADR-0014 dev#b)
  - name: currency
    type: string
    default: USD
    reflect: true      # ISO 4217 currency code (e.g. 'JPY', 'EUR'). Only meaningful for type=currency. Drives the leading narrow symbol + the per-currency fraction-digit count via Intl (USD 2 · JPY 0 · BHD 3). Changing currency while type=currency re-derives both symbol and codec fraction digits.
  - name: unit
    type: string
    default: ''
    reflect: true      # CLDR unit identifier (e.g. 'kilogram', 'mile-per-hour') → localized short suffix via Intl (e.g. 'kg', 'mph'). Only meaningful for type=unit. An invalid CLDR id falls back to the raw string as the suffix. Changing unit while type=unit re-derives the suffix label.
  - name: step
    type: number
    default: 1
    reflect: true      # The stepper-button and ArrowUp/Down increment for all numeric types (number · currency · unit · percent). null (cleared attr) → treated as 1 at runtime. step="any" is unsupported (stepMismatch is not enforced — ADR-0047).
  - name: min
    type: string
    default: ''
    reflect: true      # '' = unconstrained. A numeric string sets the lower bound; canonical < min → rangeUnderflow validity flag. Matches native <input min> string semantics where '' = no bound.
  - name: max
    type: string
    default: ''
    reflect: true      # '' = unconstrained. A numeric string sets the upper bound; canonical > max → rangeOverflow validity flag. Matches native <input max> string semantics where '' = no bound.
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
    description: Fired on each edit of the editor (surface→model) as the value tracks the contenteditable. Suppressed mid IME composition. The host re-emits; matches native <input> input semantics. Also fired by the clear button (type=search) and steppers (type=number) when they change the value.
  - name: change
    detail: 'null'
    description: Fired on commit — blur-with-change or Enter (Enter also suppresses the newline). Also fired by the clear button and steppers. For type=date, fired once when the user picks a date in the calendar (the field is the sole emitter — the calendar's own change is stopped at the field boundary so consumers see exactly one change per pick, matching native <input type=date> semantics). Matches native <input> change semantics.
  - name: toggle
    detail: 'null'
    description: Fired by the password reveal button (type=password) when the user toggles password masking on/off. The :state(revealed) custom state reflects the current revealed condition.

slots:                 # leading/trailing name a POSITION in the host-as-grid (anatomy.md); the EDITOR is a control PART, not a user slot (see parts)
  - name: leading
    optional: true
    description: Optional leading adornment — a light-DOM `[slot="leading"]` child placed in the start cell by the presence-driven host-as-grid (anatomy.md / ADR-0006); commonly a `data-role="icon"`. Absent ⇒ the bare editor layout.
  - name: trailing
    optional: true
    description: Optional trailing adornment — a light-DOM `[slot="trailing"]` child placed in the end cell (a status glyph / unit). Layout only; mark decorative glyphs aria-hidden — the editor keeps the accessible name.

parts:                 # the contenteditable editable surface is a control-owned PART, not a slot (ADR-0014 cl.1)
  - name: editor
    description: The editable surface — a control-created light-DOM `<div data-part="editor" contenteditable="plaintext-only" role="textbox" aria-multiline="false">` in the centre value cell. Created ONCE (idempotent guard) and NEVER re-rendered. Carries role=textbox; the host carries no role/aria-* attribute.
  - name: leading-adornment
    description: Control-injected leading adornment (type=search → magnifier ⌕; type=currency → narrow currency symbol per `currency` attr, e.g. '$' for USD, '¥' for JPY). `[slot="leading"]` element with aria-hidden="true". Present only when the type resolver maps a leading role (search/currency).
  - name: trailing-adornment
    description: Control-injected trailing adornment container. type=search → clear button (data-role="clear"); type=password → reveal button (data-role="reveal"); type=number or type=currency → stepper only (data-role="stepper"); type=unit or type=percent → suffix span + steppers (data-role="numeric"); type=date → calendar button (data-role="calendar"). Present only for these types.
  - name: suffix
    description: Inside the trailing-adornment for type=unit and type=percent. A `<span data-part="suffix" aria-hidden="true">` carrying the trailing text label — the localized unit label (e.g. 'kg') for type=unit, or '%' for type=percent. Sized = font (§4.6 inline affordance law); decorative only.
  - name: clear-button
    description: Inside the trailing-adornment for type=search. A `<button>` (aria-label="Clear") that clears the value and emits input + change. Hidden by CSS when the field is empty (`:has([data-part="editor"][data-empty])`).
  - name: reveal-button
    description: Inside the trailing-adornment for type=password. A `<button>` (aria-pressed="false"/"true") that toggles password masking (-webkit-text-security: disc/none) by adding/removing :state(revealed) and emits a `toggle` event.
  - name: step-up
    description: Inside the trailing-adornment for type=number/currency/unit/percent. A `<button>` (aria-label="Increase") that increments the numeric value by `step` (clamped to max), emitting input + change. Also triggered by ArrowUp on the editor.
  - name: step-down
    description: Inside the trailing-adornment for type=number/currency/unit/percent. A `<button>` (aria-label="Decrease") that decrements the numeric value by `step` (clamped to min), emitting input + change. Also triggered by ArrowDown on the editor.
  - name: calendar-button
    description: Inside the trailing-adornment for type=date. A `<button data-part="calendar-button" aria-haspopup="dialog" aria-label="Open date picker">` that opens the calendar popup overlay. Button chrome is reset (no border/background) and forced-color-adjust is none (ADR-0048 §2). Created and removed with the type-effect lifecycle.
  - name: calendar-popup
    description: For type=date only. A `<div data-part="calendar-popup" popover="auto">` wrapper hosting a `<ui-calendar>` in the Popover API top layer. The wrapper has no visual chrome (padding/border/background reset to 0); the `<ui-calendar>` owns all spacing. NOT created eagerly with the type-effect — the wrapper + `<ui-calendar>` + its overlay wiring are built on the calendar button's FIRST CLICK (ensureCalendar(), idempotent past the first call), the same activation moment that triggers the lazy module import; a type=date field carries no popup subtree at all until then. Removed with the type-effect lifecycle on type-change/disconnect (C10) if it was ever built. The calendar module (`ui-calendar`) is loaded lazily via a dynamic `import('../calendar/calendar.ts')` on first open when not already registered; if the module is pre-registered (barrel import), the open is synchronous. NOTE — dynamic-import slow path: the test suite cannot exercise the slow path in isolation because the spec does not allow unregistering a custom element once defined. The fast path (`customElements.get('ui-calendar') !== undefined`) is always taken in tests.

customStates:          # :state() hooks the stylesheet keys off — set via internals.states, never host attrs
  - ready              # the motion gate (ADR-0008): armed one frame past first paint so the upgrade SNAPS and only subsequent state changes animate
  - disabled           # effectiveDisabled (own || form-disabled channel) — the form-control disabled channel, NOT host ariaDisabled (ADR-0014 dev#b)
  - user-invalid       # set only AFTER the first interaction (blur/change) via the trackUserInvalid controller, gating the danger border (ADR-0014 dev#c)
  - revealed           # set when the password reveal button is toggled ON (:state(revealed) flips -webkit-text-security from disc to none in CSS; ADR-0044)

face:
  formAssociated: true   # a FACE form-associated control — value + validity participate via ElementInternals (ADR-0013)
  value: value           # the prop whose value is published to internals.setFormValue; for number/currency/date/time types, formValue() returns the codec's canonical parsed value, not this.value (the formatted display)
  validity: valueMissing | customError | typeMismatch | rangeUnderflow | rangeOverflow # valueMissing (required+empty); customError (numeric parse failure via valueCodec hasError — type=number/currency/unit/percent); typeMismatch (email/URL pattern failure, OR date/time codec parse failure — ADR-0048: date+time use typeMismatch not customError, matching native <input type=date>); rangeUnderflow (canonical < min); rangeOverflow (canonical > max). stepMismatch is NOT enforced (ADR-0047).

aria:
  role: textbox          # set on the EDITOR part (data-part=editor), NOT the host — the host carries no role/aria-* attribute (form semantics ride internals)
  roleSource: editor part
  labelSource: label / aria-label   # bare usage: the `label` prop → the editor's aria-label; inside a ui-field (SHIPPED, ADR-0051) applyFieldLabelling overrides this — the field's label/description/error part ids are id-referenced onto the editor's aria-labelledby/aria-describedby instead, and this aria-label yields — see controls/field/field.md
  disabledState: editor aria-disabled + the form-disabled channel   # effectiveDisabled = own disabled || form-disabled (ADR-0013); NOT host ariaDisabled (the ADR-0010 channel is for non-form controls) — ADR-0014 dev#b
  describedBy: editor aria-describedby → a control-managed message node carrying validity().message under :state(user-invalid)   # the WCAG 1.4.1 non-colour validity cue (ADR-0014 cl.4)

keyboard:
  - keys: Enter
    action: Commits the value (emits change) and is preventDefault-suppressed — single-line field, no newline is inserted.
  - keys: ArrowUp
    action: For numeric types (number · currency · unit · percent) — increments the value by `step` (clamped to max), emitting input + change. preventDefault prevents page scroll. No-op for non-numeric types or mid-IME composition.
  - keys: ArrowDown
    action: For numeric types — decrements the value by `step` (clamped to min), emitting input + change. No-op for non-numeric types or mid-IME composition.
  - keys: typing
    action: Edits the editor surface; each edit updates value (surface→model) and emits input (suppressed mid IME composition).
  - keys: Space / Enter (on calendar-button)
    action: For type=date — activates the calendar-button, opening the `<ui-calendar>` overlay popup. Standard button keyboard activation; the button carries aria-haspopup="dialog".
  - keys: Calendar grid keys (when popup is open)
    action: Delegated entirely to `<ui-calendar>`'s own keyboard model (Arrow keys navigate days; Enter commits the focused date; Escape closes via Popover API light-dismiss; Tab/Shift-Tab move to the month nav buttons). See the `ui-calendar` descriptor for details.
  - note: The editor is intrinsically focusable (contenteditable). host.focus() forwards to the editor (label-association + .focus() parity). disabled removes it from focus (contenteditable=false, no tabindex); readonly keeps it focusable (tabindex=0) and selectable but not editable.

geometry:
  sizeClass: control
  blockSize: var(--ui-text-field-height)   # the vertical lever off the dimensional ramp; padding-block is 0
  paddingBlock: 0
  inlinePad: h/2 (value/text edge) · ½(h−icon) (leading / trailing slot edge)   # the centering law, geometry.md
  gap: var(--ui-text-field-gap)            # adornment↔editor column-gap — the one density-bearing quantity (gap = font/2 × density)
  radius: var(--ui-radius-base)            # fixed rounded-rect — the container-fleet referent, NOT the h/2 pill; entry-control class, geometry.md "Corner radius" / ADR-0015 cl.5 (#71 amendment)
  minInlineSize: var(--ui-text-field-min-inline-size) (~20ch — entry-control typing-width floor, native <input size> parity; ADR-0021)   # the host floor so a bare field is hittable; size-invariant (ch is font-relative)

forcedColors: A `@media (forced-colors: active)` block keeps the idle field border, ink, and placeholder visible (CanvasText); the :focus-within outline ring survives via --c-focus-ring → Highlight (ADR-0014). Control-injected adornment glyphs (magnifier/symbol/reveal/steppers/calendar-button) use `forced-color-adjust:none` to keep their inherited ink — they are aria-hidden decorative cues, so bypassing the system palette is intentional (ADR-0044/ADR-0048).

localeParse: The date codec (`type=date`) uses `Intl.DateTimeFormat` to FORMAT the display value (locale-aware) but PARSES via a strict YYYY-MM-DD regex (the ISO 8601 canonical form that `<ui-calendar>` emits). Locale-aware parsing of user-typed dates is a **best-effort** fallback: when the editor blurs with a non-ISO string, the codec attempts a `Date` parse; if it fails, `typeMismatch` is set. The time codec (`type=time`) uses `Intl.DateTimeFormat({ timeStyle:'short' })` for display and parses via `HH:MM` / `HH:MM:SS` regex. Consumers should treat the localized display as decorative — the canonical `value` is always ISO (YYYY-MM-DD or HH:MM).
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
slotted adornment sits inside the box; the corner is the fixed `--ui-radius-base` rounded-rect (the
container-fleet referent an entry control takes, not the action family's `h/2` pill — ADR-0015 cl.5).
A bare field carries a default minimum **typing width** (`min-inline-size: ~20ch`, native `<input size>`
parity) so an unsized field stays hittable; **layout owns the width above that floor** (a flex/grid track
or an explicit `inline-size`; the `--ui-text-field-min-inline-size` token is the per-field override) —
ADR-0021.

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
  (keyboard-only). The shared `outline` ring is the **sole** focus indicator; the field border steps to
  **`transparent`** on `:focus-within` (a `--c-focus-ring` border-color step would double with the ring into a
  visible double border — corrected per ADR-0014's amendment). The ring reads the fleet-wide `--c-focus-ring` /
  `--ui-focus-ring-*` tokens (ADR-0009, as amended), and a transparent border preserves the box geometry (no
  layout shift). The outline is the forced-colors indicator (`--c-focus-ring → Highlight`).
- **`disabled` rides the editor + the platform form-disabled channel** (`effectiveDisabled = own || form`),
  not host `ariaDisabled` — disabled → editor `contenteditable=false` + not focusable + `aria-disabled` +
  host inert + `:state(disabled)`. **`readonly`** → editor `contenteditable=false` **but** focusable
  (`tabindex=0`) + `aria-readonly`, and **still submits**.

## Validity & accessibility

`required` + an empty value raises a `valueMissing` constraint (anchored on the editor); the danger border
and `aria-invalid` appear **only after the first interaction** (blur/change), timed by the `trackUserInvalid`
controller (ADR-0014 dev#c). Because the invalid cue leans on colour, the editor points at a control-managed
message node via `aria-describedby` carrying `validity().message` — a non-colour reinforcement per **WCAG
1.4.1** (ADR-0014 cl.4). In bare usage the `label` prop becomes the editor's `aria-label`. The visible
label / description / error wrapper is [`ui-field`](../field/field.md), shipped (ADR-0051): once associated,
its `applyFieldLabelling` override id-references the field's label/description/error parts directly onto
the editor's `aria-labelledby`/`aria-describedby` (beating `aria-label` in accname resolution), and the
editor's own internal message node yields — emptied + hidden — so assistive tech hears exactly one
announced error, the field's.

## Form participation

`value` is published to the owning `<form>` via `ElementInternals.setFormValue` (the FACE pattern,
ADR-0013), so the field round-trips through `FormData`/submit, `formResetCallback` restores its initial
`value`, and `validity`/`validationMessage`/`checkValidity()`/`reportValidity()` delegate to `internals` —
all without a native `<input>`.
