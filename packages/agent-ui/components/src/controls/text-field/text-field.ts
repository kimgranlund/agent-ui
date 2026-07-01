// text-field.ts — UITextFieldElement, the first FACE form-associated control (goals.md §G6 / ADR-0014).
// BEHAVIOUR + props + the contenteditable editor part + self-define ONLY; geometry/colour live in
// text-field.css (s6), the public contract in text-field.md (s7).
//
// Editable surface — a stable contenteditable editor PART (ADR-0014 cl.1): a control-created light-DOM
// `<div data-part="editor" contenteditable="plaintext-only" role="textbox" aria-multiline="false">`, appended
// ONCE (an idempotent guard) and NEVER re-rendered — `render()` stays the inherited void, so the text-field
// has no `html\`\``/G3 dependency (re-committing a contenteditable subtree under the caret would destroy the
// selection on every keystroke). `value`↔surface is two scope-owned wires: surface→model (an editor `input`
// listener → `this.value` + a host `input`) and model→surface (an effect writing `editor.textContent` ONLY
// when the model diverges — the CARET GUARD: equal ⇒ skip), both suppressed during IME composition.
//
// The HOST carries no `role`/`aria-*` attribute — form semantics ride `internals` (the FACE pattern, ADR-0013)
// and the editor PART carries `role=textbox`. ARIA + the custom states are set THROUGH the protected
// `internals` (a trait cannot reach it). Disabled rides the editor + the platform form-disabled channel
// (`effectiveDisabled = own || form`, ADR-0014 dev#b), NOT host `ariaDisabled`; `readonly` is editable=false
// but focusable (still submits). `user-invalid` timing comes from the `trackUserInvalid` controller (the
// danger treatment surfaces only after the first blur/change), reinforced by a non-colour `aria-describedby`
// message node (WCAG 1.4.1, ADR-0014 cl.4). `controls → dom + traits` is the allowed import direction.
//
// Wave 3 growth (ADR-0044): a `type` prop (8 variants, reflected) drives a static type-resolver (TYPE_CONFIG,
// an as-const map — erasableSyntaxOnly: no enum) that maps type → inputmode + auto-adornments + codec +
// validation. type='text' resolves to the identity config — no adornments, no codec, no extra validation —
// preserving byte-identical behaviour with the shipped text-field. Number/currency types use the valueCodec
// trait (traits/value-codec.ts) for the display↔canonical split (formValue() returns canonical, not display).
//
// Wave 5A growth (ADR-0047): TYPE_CONFIG v2 — splits the single `trailing` role into
// `{ leading, suffix, affordance, codec }`. NEW types `unit` and `percent`. Multi-currency fraction digits,
// generalized steppers with `step`/`min`/`max`, suffix spans, ArrowUp/Down stepping, and range validity
// (rangeUnderflow/rangeOverflow). type='text' stays byte-identical.
//
// Wave 5B growth (ADR-0048): date/time types. `type=date` — display↔ISO-canonical split via dateCodecOptions()
// + a trailing calendar-button affordance that opens a lazily-imported `<ui-calendar>` in an overlay popup.
// `type=time` — display↔HH:MM-canonical split via timeCodecOptions(). Both use `typeMismatch` (not
// `customError`) for parse failures. The dynamic `import('../calendar/calendar.ts')` on first open keeps
// the calendar out of the text-field's STATIC import graph (tree-shake safe — the static regex crawl
// does not match `import()` expressions). date and time have codec but NO steppers (ADR-0047 "codec ⇒ steppers"
// applies to numeric types only). datetime-local/month = deferred (STRETCH, not this wave).

import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UIFormElement, type FormValue, type ValidityResult } from '../../dom/form.ts'
import { trackUserInvalid, type TrackUserInvalidController } from '../../traits/track-user-invalid.ts'
import {
  valueCodec,
  numberCodecOptions,
  currencyCodecOptions,
  unitCodecOptions,
  dateCodecOptions,
  timeCodecOptions,
  currencySymbol,
  unitLabel,
  type ValueCodecController,
} from '../../traits/value-codec.ts'
import { overlay, type OverlayHandle } from '../../traits/overlay.ts'

// The editor's editable mode (ADR-0014 cl.1) and a per-instance id seed for aria-describedby.
const EDITABLE = 'plaintext-only'
let messageSeq = 0

// ── email / URL validation patterns ──────────────────────────────────────────

// A practical email pattern (RFC 5321 simple form): local@domain.tld — no embedded whitespace or @.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── type-resolver v2 (TYPE_CONFIG, Wave 5A ADR-0047 — the static as-const config map) ──────────────
//
// The single `trailing` role from v1 is split into independent facets so `unit`/`percent` can carry a
// suffix TEXT label AND steppers in the same trailing cell. Key invariants:
//   • A non-null `codec` with a NUMERIC kind ('number'|'currency'|'unit') implies steppers (ADR-0047).
//     date/time have codec but NOT steppers — the stepper branch guards `codec !== 'date' && 'time'`.
//   • `affordance` (exclusive interactive button) NEVER coexists with steppers.
//   • `affordance === 'calendar'` DOES coexist with `codec === 'date'` (the one exception — ADR-0048).
//   • `suffix` is the trailing text label ('percent' → '%', 'unit' → this.unit via unitLabel()).
//   • `percent` reuses codec='number' — its canonical is the TYPED number ("50", not ÷100).

type LeadingRole = 'magnifier' | 'currency'
type SuffixKind = 'percent' | 'unit'
type AffordanceRole = 'clear' | 'reveal' | 'calendar'
type ValidationType = 'email' | 'url' | 'number' | 'date' | 'time'
type CodecKind = 'number' | 'currency' | 'unit' | 'date' | 'time'

interface TypeConfig {
  readonly inputmode: string
  readonly leading: LeadingRole | null
  readonly suffix: SuffixKind | null          // trailing text label ('percent'=static '%', 'unit'=dynamic this.unit)
  readonly affordance: AffordanceRole | null   // exclusive interactive trailing button
  readonly validation: ValidationType | null
  readonly codec: CodecKind | null             // non-null → display↔canonical split is active
}

const TYPE_CONFIG = {
  //            inputmode    leading        suffix       affordance      validation   codec
  text:     { inputmode: 'text',    leading: null,        suffix: null,      affordance: null,       validation: null,     codec: null       },
  email:    { inputmode: 'email',   leading: null,        suffix: null,      affordance: null,       validation: 'email',  codec: null       },
  url:      { inputmode: 'url',     leading: null,        suffix: null,      affordance: null,       validation: 'url',    codec: null       },
  tel:      { inputmode: 'tel',     leading: null,        suffix: null,      affordance: null,       validation: null,     codec: null       },
  search:   { inputmode: 'search',  leading: 'magnifier', suffix: null,      affordance: 'clear',    validation: null,     codec: null       },
  password: { inputmode: 'text',    leading: null,        suffix: null,      affordance: 'reveal',   validation: null,     codec: null       },
  number:   { inputmode: 'numeric', leading: null,        suffix: null,      affordance: null,       validation: 'number', codec: 'number'   },
  currency: { inputmode: 'decimal', leading: 'currency',  suffix: null,      affordance: null,       validation: 'number', codec: 'currency' },
  unit:     { inputmode: 'decimal', leading: null,        suffix: 'unit',    affordance: null,       validation: 'number', codec: 'unit'     },
  percent:  { inputmode: 'decimal', leading: null,        suffix: 'percent', affordance: null,       validation: 'number', codec: 'number'   },
  date:     { inputmode: 'text',    leading: null,        suffix: null,      affordance: 'calendar', validation: 'date',   codec: 'date'     },
  time:     { inputmode: 'text',    leading: null,        suffix: null,      affordance: null,       validation: 'time',   codec: 'time'     },
} as const satisfies Record<string, TypeConfig>

// ── props ─────────────────────────────────────────────────────────────────────

const props = {
  // The universal form attributes (name / disabled(reflect) / required(reflect)) are SPREAD, not inherited —
  // props.ts has no static-props prototype merge, so UIFormElement exposes them as a spreadable bag (ADR-0013).
  ...UIFormElement.formProps,
  // `value` is OBSERVED (its initial attribute seeds the reset baseline) but NOT reflected — the live value
  // rides the editor surface, never a host attribute.
  value: prop.string(),
  label: prop.string(), // → the editor's aria-label (the labelling SEAM; the visible wrapper is ui-field at G7)
  placeholder: prop.string(), // shown via [data-empty]::before { content: attr(data-placeholder) } when empty
  // size/readonly reflect so the [size] dimensional-ramp repoint + the [readonly]/[disabled] CSS hooks apply
  // to JS-set values too, not only author-set attributes.
  size: { ...prop.enum(['sm', 'md', 'lg'] as const, 'md'), reflect: true },
  // type reflects so [type] CSS selectors (e.g. [type=password] for masking) and the type-resolver apply
  // to JS-set values; 'text' is the identity config (byte-identical to the pre-Wave-3 shipped control).
  type: { ...prop.enum(['text', 'email', 'url', 'tel', 'password', 'search', 'number', 'currency', 'unit', 'percent', 'date', 'time'] as const, 'text'), reflect: true },
  readonly: { ...prop.boolean(false), reflect: true },
  // Wave 5A — the five new numeric-type props (ADR-0047). All reflected for native attribute-IDL parity.
  // Reading this.currency / this.unit inside the type-effect's currency/unit branch makes the effect reactive
  // ONLY for currency/unit types — a plain field never reads them, never re-runs (the kernel's tracking law).
  currency: { ...prop.string('USD'), reflect: true }, // ISO 4217; drives leading symbol + codec fraction digits
  unit: { ...prop.string(''), reflect: true },         // CLDR unit id → localized short label (type=unit)
  step: { ...prop.number(1), reflect: true },          // stepper/Arrow increment; null (unset attr) → 1
  min: { ...prop.string(''), reflect: true },          // '' = unconstrained; numeric → rangeUnderflow guard
  max: { ...prop.string(''), reflect: true },          // '' = unconstrained; numeric → rangeOverflow guard
} satisfies PropsSchema

export interface UITextFieldElement extends ReactiveProps<typeof props> {}
export class UITextFieldElement extends UIFormElement {
  static props = props

  // The stable contenteditable editor PART + the aria-describedby message node. Light-DOM children, so they
  // persist across disconnect/reconnect — created ONCE and never re-appended (the idempotent guard below).
  #editor: HTMLElement | null = null
  #message: HTMLElement | null = null

  // The native-parity reset baseline — seeded ONCE from the initial `value` attribute (native `defaultValue`).
  #defaultValue = ''
  #defaultCaptured = false

  // The `change`-on-commit baseline (value at the last focus/commit) + the IME-composition guard.
  #committed = ''
  #composing = false

  // The user-invalid TIMING controller, created per connection (re-arms on reconnect; released on disconnect).
  #userInvalid: TrackUserInvalidController | null = null

  // The active value-codec controller for number/currency/unit/percent types. Null for all other types.
  // formValue() returns codec.canonical.value when set; formValidity() checks codec.hasError.
  #codec: ValueCodecController | null = null

  // Password reveal state: tracks whether -webkit-text-security is suppressed.
  // Drives :state(revealed) on internals and aria-pressed on the reveal button.
  #revealed = false

  protected connected(): void {
    // Seed the reset baseline ONCE from the INITIAL `value` attribute (native `defaultValue` — the value
    // attribute is never reflected, so it stays the markup value and survives later property writes).
    if (!this.#defaultCaptured) {
      this.#defaultValue = this.getAttribute('value') ?? ''
      this.#defaultCaptured = true
    }

    const editor = this.#ensureParts()
    const message = this.#message as HTMLElement

    // ── surface → model (ADR-0014 cl.1) — the editor's edits flow into `value`, IME-guarded ──
    this.listen(editor, 'input', (event) => {
      if (this.#composing) return // never mid-composition — compositionend commits the final composed text
      event.stopPropagation() // suppress the raw editor input; the host re-emits ONE composed `input` (target = host)
      this.value = editor.textContent ?? '' // model ← surface (the caret guard below then skips the echo write)
      this.emit('input')
    })
    this.listen(editor, 'compositionstart', () => {
      this.#composing = true
    })
    this.listen(editor, 'compositionend', () => {
      this.#composing = false
      this.value = editor.textContent ?? '' // catch the model up to the composed result (the suppressed inputs)
    })

    // ── change on commit — blur-with-change or Enter (the value-at-focus baseline gates the blur) ──
    this.listen(editor, 'focus', () => {
      this.#committed = this.value
    })
    this.listen(editor, 'blur', () => {
      if (this.value === this.#committed) return
      this.#committed = this.value
      this.emit('change')
    })
    this.listen(editor, 'keydown', (event) => {
      const key = (event as KeyboardEvent).key
      if (key === 'Enter') {
        if (this.#composing) return
        event.preventDefault() // single-line field — Enter never inserts a newline
        this.#committed = this.value
        this.emit('change') // Enter commits (resets the baseline, so a following blur does not double-fire)
        return
      }
      // ArrowUp/Down: step the numeric value when a codec is active (native type=number parity).
      // Never mid-composition; preventDefault prevents cursor movement / page scroll during stepping.
      if ((key === 'ArrowUp' || key === 'ArrowDown') && this.#codec !== null && !this.#composing) {
        event.preventDefault()
        this.#step(key === 'ArrowUp' ? 1 : -1)
      }
    })

    // ── the user-invalid TIMING controller — gates the danger treatment until the first blur/change ──
    const controller = trackUserInvalid(this, { invalid: () => !this.formValidity().valid })
    this.#userInvalid = controller

    // ── type-dependent behavior: inputmode + auto-adornments + codec + validation (Wave 3/5A) ──
    // The effect re-runs when this.type changes, running the cleanup from the previous run first.
    // type='text' is the identity config (no adornments, no codec). Wave 5A: reading this.currency
    // inside the currency branch / this.unit inside the unit branch makes the effect reactive to
    // those props ONLY for the matching types — a plain field never reads them (kernel tracking law).
    this.effect((): (() => void) => {
      const type = this.type
      const config = TYPE_CONFIG[type]

      // inputmode: virtual-keyboard hint (omit for 'text' to stay byte-identical to the pre-Wave-3 editor).
      if (config.inputmode !== 'text') {
        editor.setAttribute('inputmode', config.inputmode)
      } else {
        editor.removeAttribute('inputmode')
      }

      // Per-type AbortController: adornment-button click listeners live for one type config lifetime
      // (aborted in the effect cleanup on type change or scope.dispose() on disconnect).
      const typeAc = new AbortController()

      // Leading adornment: magnifier glyph for search, currency symbol for currency.
      // For currency: reading this.currency makes the effect re-run when currency changes (only while
      // type=currency — a non-currency field never reads this.currency, so it never becomes a dep).
      let leadingText = ''
      if (config.leading === 'magnifier') {
        leadingText = '⌕'
      } else if (config.leading === 'currency') {
        leadingText = currencySymbol(this.currency ?? 'USD')
      }
      const leadingEl = config.leading ? this.#createLeadingAdornment(config.leading, leadingText) : null

      // Trailing adornment: affordance (search/password/calendar) XOR numeric steppers ± suffix.
      // These two never coexist — affordance 'calendar' is the one exception that ALSO carries a codec
      // (type=date: affordance='calendar' + codec='date'), but STILL no steppers (ADR-0048).
      let trailingEl: HTMLElement | null = null
      if (config.affordance !== null) {
        // Exclusive interactive button (clear / reveal / calendar) — no steppers alongside.
        trailingEl = this.#createAffordanceAdornment(config.affordance, typeAc.signal)
      } else if (config.codec !== null && config.codec !== 'time') {
        // Steppers, optionally with a suffix span (NUMERIC types only — type=time has codec but no steppers;
        // type=date never reaches this branch because its affordance='calendar' takes the first branch).
        // For unit: reading this.unit makes the effect re-run when unit changes (only while type=unit).
        const suffixText =
          config.suffix === 'percent'
            ? '%'
            : config.suffix === 'unit'
              ? unitLabel(this.unit ?? '')
              : null
        trailingEl = this.#createNumericAdornment(suffixText, typeAc.signal)
      }

      // Calendar overlay (type=date only): a lazily-imported `<ui-calendar>` in a popover popup.
      // The popup + overlay handle are per-type-effect-run; cleanup below tears them down on type-change.
      // The dynamic `import('../calendar/calendar.ts')` on first button-click keeps the calendar module
      // OUT of this file's static import graph — the tree-shake regex crawler cannot match `import()`
      // expressions, so `controls/calendar/` stays absent from `ui-text-field`'s static graph.
      let calendarPopup: HTMLElement | null = null
      let calendarHandle: OverlayHandle | null = null

      if (config.affordance === 'calendar' && trailingEl !== null) {
        const calBtn = trailingEl.querySelector('[data-part="calendar-button"]') as HTMLElement

        // Create the calendar popup: a `<ui-calendar>` inside a `[data-part=calendar-popup]` wrapper.
        // The `<ui-calendar>` is an UNKNOWN element until the lazy import resolves — it upgrades in
        // place without any re-render (the overlay popup doesn't re-mount the element on upgrade).
        const calEl = document.createElement('ui-calendar')
        calendarPopup = document.createElement('div')
        calendarPopup.setAttribute('data-part', 'calendar-popup')
        calendarPopup.append(calEl)
        this.append(calendarPopup)

        // Wire the overlay controller. The connection-scoped `host.listen(popup, 'toggle', …)` inside
        // overlay() persists until disconnect; the explicit `calendarHandle.cleanup()` in the effect
        // cleanup fires on type-change (setting `cleaned=true` so the toggle handler becomes a no-op).
        calendarHandle = overlay(this, {
          popup: calendarPopup,
          anchor: calBtn,
          placement: 'bottom-start',
          auto: true,
          focusOnOpen: true,
        })

        // Event-boundary guard (ADR-0048 §3 — B1): UIElement.emit() fires events with bubbles:true
        // composed:true, so the calendar's own `change` event bubbles out of <ui-calendar> and reaches
        // ui-text-field's external listeners BEFORE the field's select→re-emit fires — doubling the
        // event (consumer sees 2 change per pick; native <input type=date> emits 1). Stop the calendar's
        // `change` at the calEl boundary; the field remains the sole emitter for its own events.
        calEl.addEventListener('change', (e) => { e.stopPropagation() }, { signal: typeAc.signal })

        let calendarLoaded = false

        // Button click: sync field value/bounds → calendar, then open.
        // Fast path: if ui-calendar is ALREADY REGISTERED (e.g., statically imported via the barrel or
        // by another part of the app), open synchronously — `customElements.get` is a runtime check,
        // not a static import, so the tree-shaker still excludes calendar.ts from the text-field graph.
        // Slow path: dynamic import on first open; after that, `calendarLoaded` keeps it synchronous.
        //
        // NOTE — M1 test gap: the slow path (dynamic import) is NOT exercised by the test suite because
        // both the barrel (controls/index.ts) and the browser test harness pre-register <ui-calendar>,
        // making customElements.get('ui-calendar') always truthy. Isolating an unregistered-calendar
        // context would require unregistering a custom element, which the spec forbids. The slow path
        // is correct by code-review (same try-free import chain as `calendarLoaded=true → open()`); the
        // limitation is documented in text-field.md.
        calBtn.addEventListener('click', () => {
          calEl.setAttribute('value', this.value)
          if (this.min) calEl.setAttribute('min', this.min)
          if (this.max) calEl.setAttribute('max', this.max)

          if (calendarLoaded || customElements.get('ui-calendar') !== undefined) {
            calendarLoaded = true
            calendarHandle!.open()
          } else {
            // First open: dynamic import (NOT a static import — keeps ui-calendar out of the static graph).
            import('../calendar/calendar.ts').then(() => {
              calendarLoaded = true
              calendarHandle!.open()
            })
          }
        }, { signal: typeAc.signal })

        // Calendar selection: `select` fires with the chosen ISO date in event.detail (ADR-0048 §2).
        // The codec's setCanonical keeps the canonical in sync so blur-formatting starts from the new date.
        calEl.addEventListener('select', (event) => {
          const iso = (event as CustomEvent<string>).detail
          if (iso) {
            this.value = iso
            this.#codec?.setCanonical(iso)
            this.emit('input')
            this.emit('change')
          }
          calendarHandle!.close()
        }, { signal: typeAc.signal })
      }

      // Codec: number/currency/unit/percent get the numeric display↔canonical split (ADR-0047).
      // date/time get the locale display↔ISO-canonical split (ADR-0048). typeAc.signal is passed so
      // the codec's focus/blur listeners die on the NEXT type change (the M1-fix seam).
      // Local variable captures config.codec so TypeScript can narrow the literal union correctly
      // through the ternary chain (narrowing through `config.codec` on a union config type is fragile).
      const codecKind = config.codec
      const codec: ValueCodecController | null =
        codecKind === 'number'
          ? valueCodec(this, numberCodecOptions(), typeAc.signal)
          : codecKind === 'currency'
            ? valueCodec(this, currencyCodecOptions(this.currency ?? 'USD'), typeAc.signal)
            : codecKind === 'unit'
              ? valueCodec(this, unitCodecOptions(this.unit ?? ''), typeAc.signal)
              : codecKind === 'date'
                ? valueCodec(this, dateCodecOptions(), typeAc.signal)
                : codecKind === 'time'
                  ? valueCodec(this, timeCodecOptions(), typeAc.signal)
                  : null
      this.#codec = codec

      // Clear reveal state on type change so switching away from 'password' doesn't leave ghost state.
      if (type !== 'password') {
        this.#revealed = false
        this.internals.states?.delete('revealed')
      }

      // Effect cleanup: runs before the next type-change run AND on scope.dispose() (disconnect).
      return (): void => {
        typeAc.abort() // removes adornment-button listeners (clear/reveal/calendar) registered with typeAc.signal
        leadingEl?.remove()
        trailingEl?.remove()
        calendarPopup?.remove()   // remove the calendar popup panel from the host on type-change or disconnect
        calendarHandle?.cleanup() // early-teardown of the overlay controller (closed, cleaned=true — idempotent)
        codec?.release()
        this.#codec = null
      }
    })

    // ── model → surface (ADR-0014 cl.1: the CARET GUARD) + the placeholder presence flag ──
    this.effect(() => {
      const value = this.value // tracked — re-runs on every value change (typed OR programmatic/reset/restore)
      if (this.#composing) return // never write mid-composition
      // CARET GUARD: rewrite the editor ONLY when the model diverges from the surface, so a keystroke (which
      // already updated textContent) never resets the caret; a programmatic write/reset/restore DOES flow.
      if (editor.textContent !== value) editor.textContent = value
      editor.toggleAttribute('data-empty', value === '') // keys the CSS placeholder (not :empty — see ADR cl.1)
    })

    // ── editor attribute mirror — the label seam, the placeholder text, the required mirror ──
    this.effect(() => {
      if (this.label) editor.setAttribute('aria-label', this.label)
      else editor.removeAttribute('aria-label')
      editor.setAttribute('data-placeholder', this.placeholder) // the CSS placeholder reads attr(data-placeholder)
      if (this.required) editor.setAttribute('aria-required', 'true')
      else editor.removeAttribute('aria-required')
    })

    // ── the disabled / readonly channel (ADR-0014 dev#b) — effectiveDisabled = own || form-disabled ──
    this.effect(() => {
      if (this.effectiveDisabled()) {
        editor.setAttribute('contenteditable', 'false')
        editor.removeAttribute('tabindex') // not focusable (out of the tab order, like <input disabled>)
        editor.setAttribute('aria-disabled', 'true')
        editor.removeAttribute('aria-readonly')
        this.internals.states?.add('disabled') // the :state(disabled) CSS hook (NOT host ariaDisabled)
      } else if (this.readonly) {
        editor.setAttribute('contenteditable', 'false') // not editable …
        editor.setAttribute('tabindex', '0') // … but still focusable / selectable (and still submits)
        editor.removeAttribute('aria-disabled')
        editor.setAttribute('aria-readonly', 'true')
        this.internals.states?.delete('disabled')
      } else {
        editor.setAttribute('contenteditable', EDITABLE) // editable; a contenteditable region is intrinsically focusable
        editor.removeAttribute('tabindex')
        editor.removeAttribute('aria-disabled')
        editor.removeAttribute('aria-readonly')
        this.internals.states?.delete('disabled')
      }
    })

    // ── user-invalid → aria-invalid + the non-colour message cue + :state(user-invalid) (ADR-0014 cl.2c/4) ──
    // ADR-0029 A1 (user-ratified): when carrying a message the message node is VISIBLE — `message.hidden`
    // toggled false (dangerous treatment: --c-danger ink, small type, gated by :state(user-invalid) in CSS).
    // The `aria-describedby` wiring is unchanged; making the node visible is an extension only.
    this.effect(() => {
      if (controller.userInvalid()) {
        // userInvalid ⇒ invalid, so formValidity() is the invalid branch carrying the message + flags.
        const verdict = this.formValidity()
        const text = verdict.valid ? '' : verdict.message // the WCAG 1.4.1 non-colour reinforcement
        editor.setAttribute('aria-invalid', 'true')
        editor.setAttribute('aria-describedby', message.id)
        message.textContent = text
        message.hidden = text === '' // visible when there is a message (ADR-0029 A1)
        this.internals.states?.add('user-invalid')
      } else {
        editor.removeAttribute('aria-invalid')
        editor.removeAttribute('aria-describedby')
        message.textContent = ''
        message.hidden = true // no message → out of flow
        this.internals.states?.delete('user-invalid')
      }
    })

    // Motion gate (interaction-states standard) — arm `ready` ONE frame past first paint so the upgrade/first
    // paint SNAPS and only subsequent state changes animate (the text-field.css transition is gated behind
    // :state(ready)). `states` optional-chained — jsdom has no CustomStateSet (the real motion is the s11 smoke).
    requestAnimationFrame(() => this.internals.states?.add('ready'))
  }

  protected disconnected(): void {
    this.#userInvalid?.release() // idempotent — the controller's listeners already die with the connection scope
    this.#userInvalid = null
    // #codec is released + nulled by the type-effect's cleanup (which fires on scope.dispose()); explicit
    // null here is defensive for any code that reads #codec after disconnect.
    this.#codec = null
  }

  /** Forward host focus to the editor PART (label-association + native `.focus()` parity). */
  override focus(options?: FocusOptions): void {
    if (this.#editor) this.#editor.focus(options)
    else super.focus(options)
  }

  // ── form hooks (overrides of the UIFormElement seams) ─────────────────────────

  /**
   * The value contributed to the owning form (FACE — the base publishes it via internals.setFormValue).
   * When a value codec is active (number/currency/unit/percent types), the CANONICAL parsed value is the
   * form value, not `this.value` which holds the formatted display string after blur. For all other types,
   * `this.value` IS the form value (the editor textContent is the submission value).
   */
  protected formValue(): FormValue {
    return this.#codec?.canonical.value ?? this.value
  }

  /**
   * The validity verdict: `required && value === ''` → `valueMissing`; codec parse error → `customError`
   * (numeric) or `typeMismatch` (date/time — ADR-0048); range check (min/max) → `rangeUnderflow`/
   * `rangeOverflow` (numeric types only); email/url format error → `typeMismatch`; valid otherwise.
   * A disabled field is barred from constraint validation (native parity).
   * `stepMismatch` is NOT enforced — too strict for free numeric entry (ADR-0047).
   */
  protected formValidity(): ValidityResult {
    if (this.effectiveDisabled()) return { valid: true }

    // valueMissing: required + empty (gated on this.value, the display; an empty field is empty in all types).
    if (this.required && this.value === '') {
      return {
        valid: false,
        flags: { valueMissing: true },
        message: 'Please fill out this field.',
        anchor: this.#editor ?? undefined,
      }
    }

    // Read type once — used for both codec-error flag discrimination and type-specific validation below.
    const type = this.type

    // Codec parse error: hasError is set by the valueCodec controller on blur (all codec types).
    // date/time → typeMismatch (the platform validity flag for wrong-format date/time — ADR-0048);
    // numeric types → customError (a free-form parse failure, not a native input-type mismatch).
    if (this.#codec?.hasError.value) {
      return {
        valid: false,
        flags: type === 'date' || type === 'time' ? { typeMismatch: true } : { customError: true },
        message: this.#codec.errorMessage,
        anchor: this.#editor ?? undefined,
      }
    }

    // Type-specific validation (non-empty values only — empty passes to avoid double-reporting).
    const v = this.value
    if (v !== '') {
      // Range validity for NUMERIC types only (ADR-0047): rangeUnderflow / rangeOverflow from min/max.
      // date/time are excluded — their min/max are ISO strings, not numeric bounds (parseFloat would
      // silently truncate to the year portion, producing wrong comparisons). Date-range is a future item.
      if (this.#codec !== null && type !== 'date' && type !== 'time') {
        const canonical = this.#codec.canonical.value
        if (canonical !== '') {
          const numVal = parseFloat(canonical)
          if (Number.isFinite(numVal)) {
            if (this.min !== '') {
              const minNum = parseFloat(this.min)
              if (Number.isFinite(minNum) && numVal < minNum) {
                return {
                  valid: false,
                  flags: { rangeUnderflow: true },
                  message: `Value must be greater than or equal to ${minNum}.`,
                  anchor: this.#editor ?? undefined,
                }
              }
            }
            if (this.max !== '') {
              const maxNum = parseFloat(this.max)
              if (Number.isFinite(maxNum) && numVal > maxNum) {
                return {
                  valid: false,
                  flags: { rangeOverflow: true },
                  message: `Value must be less than or equal to ${maxNum}.`,
                  anchor: this.#editor ?? undefined,
                }
              }
            }
          }
        }
      }

      if (type === 'email' && !EMAIL_PATTERN.test(v)) {
        return {
          valid: false,
          flags: { typeMismatch: true },
          message: 'Please enter a valid email address.',
          anchor: this.#editor ?? undefined,
        }
      }
      if (type === 'url') {
        try {
          new URL(v) // throws for invalid URLs
        } catch {
          return {
            valid: false,
            flags: { typeMismatch: true },
            message: 'Please enter a valid URL.',
            anchor: this.#editor ?? undefined,
          }
        }
      }
    }

    return { valid: true }
  }

  /**
   * Form reset → value ← the initial `value` attribute (native-parity defaultValue) + clear the touched state.
   * A reset must not leave a required-empty field showing `:state(user-invalid)` until the user re-interacts, so
   * the timing controller is reset to its first-paint suppression (the danger treatment re-arms on the next
   * blur/change). The optional chain is defensive — `formReset` only fires while connected (the controller is live).
   */
  protected formReset(): void {
    this.value = this.#defaultValue
    this.#codec?.setCanonical(this.#defaultValue) // keep canonical in sync on reset
    this.#userInvalid?.reset()
  }

  /** Restore the value after navigation/autofill (FACE state restore). */
  protected formStateRestore(state: File | string | FormData | null): void {
    if (typeof state === 'string') this.value = state
  }

  // ── auto-adornment creation (Wave 3 + Wave 5A) ─────────────────────────────────

  /**
   * Create and prepend a control-injected LEADING adornment. Placed BEFORE the editor in the DOM so
   * the host-as-grid's `order` property (slot leading=0 · editor=1 · trailing=2) correctly positions
   * it in the leading cell. Returns the element for the effect cleanup to remove.
   *
   * @param role  The TYPE_CONFIG leading role ('magnifier' or 'currency').
   * @param text  The glyph text — '⌕' for magnifier, currencySymbol(this.currency) for currency.
   */
  #createLeadingAdornment(role: LeadingRole, text: string): HTMLElement {
    const el = document.createElement('span')
    el.setAttribute('slot', 'leading')
    el.setAttribute('data-part', 'leading-adornment')
    el.setAttribute('data-role', role)
    el.setAttribute('aria-hidden', 'true') // decorative — the editor carries the accessible name
    el.textContent = text
    // prepend: appears before the editor in DOM order; slot+order CSS positions it correctly.
    this.prepend(el)
    return el
  }

  /**
   * Create and append a control-injected TRAILING affordance adornment (clear / reveal / calendar).
   * The clear and reveal buttons register their click listeners with `typeAc` so they are aborted on
   * type change and on disconnect (the cleanup's typeAc.abort()). The calendar button's click listener
   * is wired by the CALLER (the type-effect) after overlay creation — this method only creates the
   * button element. Returns the container for the effect cleanup to remove.
   */
  #createAffordanceAdornment(role: AffordanceRole, typeAc: AbortSignal): HTMLElement {
    const container = document.createElement('span')
    container.setAttribute('slot', 'trailing')
    container.setAttribute('data-part', 'trailing-adornment')
    container.setAttribute('data-role', role)

    if (role === 'clear') {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.setAttribute('data-part', 'clear-button')
      btn.setAttribute('aria-label', 'Clear')
      btn.textContent = '✕'
      btn.addEventListener('click', () => {
        if (this.value === '') return // nothing to clear
        this.value = ''
        this.#codec?.setCanonical('')
        this.emit('input')
        this.emit('change')
        this.#editor?.focus()
      }, { signal: typeAc })
      container.append(btn)
    } else if (role === 'reveal') {
      // reveal: toggle password masking via :state(revealed) (ADR-0044)
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.setAttribute('data-part', 'reveal-button')
      btn.setAttribute('aria-label', 'Show password')
      btn.setAttribute('aria-pressed', 'false')
      btn.textContent = '👁'
      btn.addEventListener('click', () => {
        this.#revealed = !this.#revealed
        btn.setAttribute('aria-pressed', String(this.#revealed))
        btn.setAttribute('aria-label', this.#revealed ? 'Hide password' : 'Show password')
        if (this.#revealed) {
          this.internals.states?.add('revealed')
        } else {
          this.internals.states?.delete('revealed')
        }
        this.emit('toggle')
      }, { signal: typeAc })
      container.append(btn)
    } else {
      // 'calendar': trailing icon button that opens the date picker popup.
      // The click listener + overlay wiring are done by the type-effect AFTER overlay() is called —
      // the button must exist first so it can serve as the overlay anchor.
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.setAttribute('data-part', 'calendar-button')
      btn.setAttribute('aria-label', 'Open date picker')
      btn.setAttribute('aria-haspopup', 'dialog')
      btn.textContent = '📅'
      container.append(btn)
    }

    this.append(container)
    return container
  }

  /**
   * Create and append a control-injected TRAILING numeric adornment: steppers (▲▼) with an optional
   * suffix span. Used for ALL numeric types (number · currency · unit · percent — ADR-0047: codec ≠ null
   * implies steppers). `suffixText` is non-null for unit (the localized label) and percent ('%').
   * The trailing container's data-role is 'numeric' when a suffix is present, 'stepper' otherwise —
   * the two roles drive different CSS layout (row vs. column; inline-size auto vs. icon-sized).
   */
  #createNumericAdornment(suffixText: string | null, typeAc: AbortSignal): HTMLElement {
    const container = document.createElement('span')
    container.setAttribute('slot', 'trailing')
    container.setAttribute('data-part', 'trailing-adornment')
    // 'numeric' has suffix+steppers in a flex row; 'stepper' has steppers only in an icon-sized column.
    container.setAttribute('data-role', suffixText !== null ? 'numeric' : 'stepper')

    if (suffixText !== null) {
      const suffix = document.createElement('span')
      suffix.setAttribute('data-part', 'suffix')
      suffix.setAttribute('aria-hidden', 'true') // decorative label — the editor carries the value
      suffix.textContent = suffixText
      container.append(suffix)
    }

    const up = document.createElement('button')
    up.type = 'button'
    up.setAttribute('data-part', 'step-up')
    up.setAttribute('aria-label', 'Increase')
    up.textContent = '▲'
    up.addEventListener('click', () => { this.#step(1) }, { signal: typeAc })

    const down = document.createElement('button')
    down.type = 'button'
    down.setAttribute('data-part', 'step-down')
    down.setAttribute('aria-label', 'Decrease')
    down.textContent = '▼'
    down.addEventListener('click', () => { this.#step(-1) }, { signal: typeAc })

    container.append(up, down)
    this.append(container)
    return container
  }

  /**
   * Step the numeric value by `dir * step` (clamped to [min, max]). Called by stepper buttons AND by
   * ArrowUp/Down on the editor (native type=number parity). `this.step ?? 1` guards against a null step
   * (cleared attribute). Empty min/max = unbounded (native .min/.max parity — ADR-0047).
   */
  #step(dir: 1 | -1): void {
    // Prefer codec canonical (the last successfully parsed value); fall back to this.value for cases
    // where the user hasn't blurred yet (canonical is still the initial empty seed). Use || not ??
    // so an empty-string canonical (never blurred) falls through to this.value.
    const current = parseFloat(this.#codec?.canonical.value || this.value)
    const stepSize = this.step ?? 1
    const raw = Number.isFinite(current) ? current + dir * stepSize : dir * stepSize
    // Clamp to [min, max]: '' = unconstrained; invalid parse → treat as unbounded.
    const minNum = this.min !== '' ? parseFloat(this.min) : -Infinity
    const maxNum = this.max !== '' ? parseFloat(this.max) : Infinity
    const clamped = Math.max(
      Number.isFinite(minNum) ? minNum : -Infinity,
      Math.min(Number.isFinite(maxNum) ? maxNum : Infinity, raw),
    )
    const nextStr = String(clamped)
    this.value = nextStr // raw numeric string (will format on next blur via the codec)
    this.#codec?.setCanonical(nextStr) // keep canonical in sync immediately
    this.emit('input')
    this.emit('change')
  }

  /**
   * Create the editor PART + the aria message node ONCE (idempotent across reconnect — both are light-DOM
   * children that persist through disconnect), returning the editor. The message node is NOT a public part (the
   * descriptor lists only `editor` under `parts`; it is the control-managed `aria-describedby` node, ADR-0014
   * cl.4) — it is `hidden` (out of the host-as-grid + visual layout in G6; the VISIBLE error wrapper is ui-field
   * at G7 — aria-describedby still reads a hidden node's text), carrying `validity().message` only under
   * `user-invalid`.
   */
  #ensureParts(): HTMLElement {
    if (this.#editor) return this.#editor

    const editor = document.createElement('div')
    editor.setAttribute('data-part', 'editor')
    editor.setAttribute('contenteditable', EDITABLE)
    editor.setAttribute('role', 'textbox') // the role rides the PART — the host carries NO role/aria-* attribute
    editor.setAttribute('aria-multiline', 'false')
    this.#editor = editor

    const message = document.createElement('div')
    message.className = 'ui-text-field-message' // a queryable hook, NOT a [data-part] (it is not a public part)
    message.id = `ui-text-field-message-${++messageSeq}`
    message.hidden = true
    this.#message = message

    this.append(editor, message)
    return editor
  }
}

if (!customElements.get('ui-text-field')) customElements.define('ui-text-field', UITextFieldElement)
