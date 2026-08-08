// otp-field.ts — UIOtpFieldElement, the identity family's S2-a code-entry control (code-entry-control.lld.md,
// GH #490 S2-a). BEHAVIOUR + props + the anatomy + self-define ONLY; geometry/colour live in otp-field.css
// (LLD-C4), the public contract in otp-field.md (LLD-C5), the pure edit model in model.ts (LLD-C2).
//
// Anatomy (LLD §2/§6, RULED — ONE focusable editable surface, N presentational cells): the host IS the cell
// grid (inline-grid; each `data-part="cell"` gets its own explicit `grid-column-start` written once at
// creation, so DOM order never matters for layout). A single control-created, idempotent-guarded (ADR-0014
// cl.1) `data-part="editor"` `contenteditable="plaintext-only"` div — ui-text-field's exact editable-surface
// PATTERN, reused, not re-derived — is stretched over the WHOLE grid (`grid-column: 1 / -1`) as a visually
// transparent overlay: it is the sole `role=textbox`, the sole focusable/hit-testable node, the sole paste/
// composition target, and its literal text content mirrors `value` (SR-readable, §6) even though the paint is
// invisible (opacity 0 — the cells show the digits). `beforeinput` is intercepted UNCONDITIONALLY
// (`preventDefault`, §3) and routed, through the pure `routeBeforeInput`/`reduce` pair in model.ts, to a
// single `#dispatch` choke point; the native caret never edits. Cells are pure presentation (`aria-hidden`),
// painted from `value`/the session-local `#active` signal by a separate effect — never a `[data-active]`
// custom state (that closed set is fleet-wide; a component-local visual axis stays a `data-*` attribute,
// naming.md §6).
//
// A11y (LLD §6, RULED): one `role=textbox`, N `aria-hidden` cells — the N-tab-stops alternative is REJECTED
// on mechanics (screen-reader hostility, one FACE value/one ElementInternals, one focus graph, one paste
// target); see the LLD for the full rejection. Because §3's interception model makes the editor MUTE by
// default (every `beforeinput` is prevented; every `textContent` write is scripted, so no native input
// announcement ever fires), the LLD-C8 `data-part="echo"` polite live region is FROZEN DESIGN, not a
// contingency — it is the announcement channel for every USER-DRIVEN mutation (digit/clear/paste/complete),
// written by the SAME `#dispatch` choke point that applies a reducer result; an EXTERNAL `value` write never
// touches it (§8 native parity — a data-bound programmatic write is not a user edit).
//
// Form participation (LLD §2 Form-participation row): `formValue()` is the raw (possibly partial) string —
// no codec, the canonical IS the display. `formValidity()`: `required && value===''` → `valueMissing`;
// `0 < len < N` → the native `tooShort` flag (not `customError` — this IS an under-length native concept).
// `trackUserInvalid` gates the danger treatment exactly like text-field (merged validity, GH #554 pattern).
//
// ADR-0051 — `applyFieldLabelling` is text-field's own part-role override, copied verbatim (the LLD's own
// instruction, §4 LLD-C1): the editor's `role=textbox` rides a light-DOM PART, so the base's guarded
// internals-reflection default (dom/form.ts) never fires here.

import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { signal, untracked } from '../../reactive/index.ts'
import { UIFormElement, type FormValue, type ValidityResult, type FieldLabelling } from '../../dom/form.ts'
import { trackUserInvalid, type TrackUserInvalidController } from '../../traits/track-user-invalid.ts'
import { reduce, normalize, routeBeforeInput, firstEmptyOf, type OtpState, type OtpAction, type EchoEvent } from './model.ts'

const EDITABLE = 'plaintext-only' // ADR-0014 cl.1 — the editable mode text-field's editor part uses
const DEFAULT_LENGTH = 6
const MIN_LENGTH = 1
const MAX_LENGTH = 12
let messageSeq = 0

// The four preventDefault-and-dispatch navigation keys (§3) — a lookup table, not a switch (Escape is the
// one deliberate no-op that needs no preventDefault, handled inline at the call site).
const NAV_KEYS: Record<string, OtpAction> = {
  ArrowLeft: { type: 'arrow-left' },
  ArrowRight: { type: 'arrow-right' },
  Home: { type: 'home' },
  End: { type: 'end' },
  Enter: { type: 'enter' },
}

/** `length` cleaning (§2 Props row): a non-finite/non-integer raw value falls back to the default (6);
 *  otherwise clamp to [1, 12]. Pure so the descriptor/geometry probes can exercise it directly. */
export function cleanLength(raw: number | null): number {
  if (raw === null || !Number.isFinite(raw) || !Number.isInteger(raw)) return DEFAULT_LENGTH
  return Math.max(MIN_LENGTH, Math.min(MAX_LENGTH, raw))
}

// ── props ─────────────────────────────────────────────────────────────────────

const props = {
  ...UIFormElement.formProps,
  // `value` is OBSERVED (its initial attribute seeds the reset baseline) but NOT reflected — the live value
  // rides the cell/editor surface, never a host attribute (the text-field convention, verbatim).
  value: prop.string(),
  // N cells — cleaned via cleanLength() at every read (this.length itself stays the raw reflected prop,
  // native-attribute-IDL parity; #n() is the ONE internal consumer of the cleaned value).
  length: { ...prop.number(DEFAULT_LENGTH), reflect: true },
  label: { ...prop.string(), reflect: true }, // TKT-0069 item 2 — label reflects fleet-wide
  size: { ...prop.enum(['sm', 'md', 'lg'] as const, 'md'), reflect: true },
} satisfies PropsSchema

export interface UIOtpFieldElement extends ReactiveProps<typeof props> {}
export class UIOtpFieldElement extends UIFormElement {
  static props = props

  // Light-DOM parts, created ONCE (idempotent guard) and never re-appended — persist across disconnect/reconnect.
  #editor: HTMLElement | null = null
  #message: HTMLElement | null = null
  #echo: HTMLElement | null = null
  #cells: HTMLElement[] = []

  // The session-local edit position (§3 — NOT a prop; meaningless outside a focused session).
  #active = signal(0)
  // Whether the editor currently holds DOM focus — gates the `[data-active]` paint (LLD §2 Anatomy row).
  #focused = signal(false)

  // The native-parity reset baseline, seeded ONCE from the initial `value` attribute.
  #defaultValue = ''
  #defaultCaptured = false

  // The `change`-on-commit baseline (value at the last focus/commit) + the IME-composition guard.
  #committed = ''
  #composing = false

  // The "this write already went through #dispatch (or the length-reconcile effect)" settled marker — the
  // caret-guard-shaped trick that lets ONE effect on `this.value` tell an #dispatch-originated write apart
  // from an EXTERNAL one (initial attribute / `el.value = …` / formReset / formStateRestore) without a
  // transient boolean flag (which a microtask-batched effect could observe after it was already reset).
  #lastDispatched: string | null = null
  #lastN = DEFAULT_LENGTH

  #userInvalid: TrackUserInvalidController | null = null

  protected connected(): void {
    if (!this.#defaultCaptured) {
      this.#defaultValue = this.getAttribute('value') ?? ''
      this.#defaultCaptured = true
    }

    const editor = this.#ensureParts()
    const message = this.#message as HTMLElement

    // ── editor listeners (LLD-C1) ──────────────────────────────────────────────────────────────────

    // beforeinput — intercepted UNCONDITIONALLY (§3); routed through the pure model.ts pair.
    //
    // GH #589 ROOT-CAUSE REPAIR (§3, documented engine exception — investigated in real WebKit, evidence
    // in the fix commit): `collapsed` used to come from `event.getTargetRanges()` — the wrong seam. A
    // delete inputType's target range describes the CONTENT ABOUT TO BE REMOVED, which is never collapsed
    // once anything real is being deleted (it always spans at least the one character). Chromium happened
    // to return an EMPTY ranges array for a plain-caret backspace (an implementation quirk our old code
    // accidentally rode as "collapsed"); WebKit spec-correctly returns a REAL, non-collapsed 1-character
    // range (`start=(#text,1) end=(#text,2)` for a backspace on "12") — which the old check misread as "a
    // highlighted selection exists", silently no-opping every WebKit backspace. `window.getSelection()
    // .isCollapsed`, read HERE ONLY to discriminate a plain caret from a real highlighted selection BEFORE
    // routing (never to derive WHERE to edit — the active index alone still governs that, §3's actual
    // concern), is the correct, cross-engine-robust signal instrumentation confirmed reads `true` for a
    // plain caret and `false` for a real selection in BOTH engines — a narrow, cited exception to "the DOM
    // selection is never managed and never read" (§3), not a reversal of it.
    this.listen(editor, 'beforeinput', (event) => {
      const ie = event as InputEvent
      ie.preventDefault() // the native caret never edits — every mutation flows through #dispatch
      if (this.#composing) return // suppressed mid-composition; compositionend supplies the final text (§3)
      const collapsed = window.getSelection()?.isCollapsed ?? true
      const transferText = ie.dataTransfer ? ie.dataTransfer.getData('text/plain') : null
      this.#dispatch(routeBeforeInput({ inputType: ie.inputType, data: ie.data, transferText, collapsed }))
    })

    // paste — the PRIMARY paste path (§3/§5); beforeinput's insertFromPaste arm is defense-in-depth only.
    this.listen(editor, 'paste', (event) => {
      const ce = event as ClipboardEvent
      ce.preventDefault()
      const text = ce.clipboardData ? ce.clipboardData.getData('text/plain') : ''
      this.#dispatch({ type: 'paste', text })
    })

    // composition (IME) — suppressed while composing; compositionend's final text runs through the paste path.
    this.listen(editor, 'compositionstart', () => {
      this.#composing = true
    })
    this.listen(editor, 'compositionend', (event) => {
      this.#composing = false
      const data = (event as CompositionEvent).data ?? ''
      if (data !== '') this.#dispatch({ type: 'paste', text: data })
    })

    // navigation keys — NOT beforeinput-routed (no content mutation): arrows/Home/End/Enter/Escape. A
    // lookup table over the four preventDefault-and-dispatch keys; Escape is the one deliberate no-op that
    // needs no preventDefault (§3).
    this.listen(editor, 'keydown', (event) => {
      if (this.#composing) return
      const key = (event as KeyboardEvent).key
      if (key === 'Escape') {
        this.#dispatch({ type: 'escape' })
        return
      }
      const action = NAV_KEYS[key]
      if (action) {
        event.preventDefault()
        this.#dispatch(action)
      }
    })

    // pointer down — the editor is the ONE hit-testable surface (§6); translate the click's X position into
    // a cell index (the "pointer down on cell k" row, §3) rather than giving cells their own listeners.
    // MINOR-4 (component-checker, 2026-08-08 host round): nearest-cell-CENTER math over the REAL per-cell
    // rects — not `editor.getBoundingClientRect()` divided evenly by N, which ignores `--ui-otp-field-gap`
    // and skews the resolved index once the inter-cell gaps accumulate across the row.
    this.listen(editor, 'pointerdown', (event) => {
      const pe = event as PointerEvent
      if (this.#cells.length === 0) return
      let index = 0
      let bestDist = Infinity
      for (let i = 0; i < this.#cells.length; i++) {
        const r = this.#cells[i]!.getBoundingClientRect()
        if (r.width <= 0) return // no layout yet (jsdom / not painted) — nothing to compute
        const dist = Math.abs(pe.clientX - (r.left + r.width / 2))
        if (dist < bestDist) {
          bestDist = dist
          index = i
        }
      }
      this.#dispatch({ type: 'pointer-down', index })
    })

    // focus / blur — the first-empty rule on entry; blur-with-change against the value-at-focus baseline.
    this.listen(editor, 'focus', () => {
      this.#focused.value = true
      this.#committed = this.value
      this.#dispatch({ type: 'focus' })
    })
    this.listen(editor, 'blur', () => {
      this.#focused.value = false
      if (this.value !== this.#committed) {
        this.#committed = this.value
        this.emit('change')
      }
    })

    // ── the user-invalid TIMING controller (merged validity, GH #554 pattern) ────────────────────────
    const controller = trackUserInvalid(this, { invalid: () => !this.mergedValidity().valid })
    this.#userInvalid = controller

    // ── cell creation — an effect on N (append/remove tail cells; NEVER recreate all, LLD-C3) ────────
    this.effect(() => {
      const n = this.#n()
      while (this.#cells.length < n) {
        const cell = document.createElement('div')
        cell.setAttribute('data-part', 'cell')
        cell.setAttribute('aria-hidden', 'true')
        cell.style.gridColumnStart = String(this.#cells.length + 1)
        cell.style.gridRow = '1'
        this.append(cell)
        this.#cells.push(cell)
      }
      while (this.#cells.length > n) {
        this.#cells.pop()!.remove()
      }
    })

    // ── length-change reconcile — truncates `value` / clamps `#active` on a LIVE length shrink (§8) ──
    // Tracks ONLY `this.#n()` (i.e. `this.length`); reads `value`/`#active` untracked so a plain value edit
    // never re-runs this effect — that is the SEPARATE effect below.
    this.effect(() => {
      const n = this.#n()
      const nChanged = n !== this.#lastN
      this.#lastN = n
      if (!nChanged) return
      untracked(() => {
        const current = this.value
        if (current.length > n) {
          const truncated = current.slice(0, n)
          this.#lastDispatched = truncated
          this.value = truncated
        }
        const len = Math.min(this.value.length, n)
        this.#active.value = Math.max(0, Math.min(this.#active.value, firstEmptyOf(len, n)))
      })
    })

    // ── external value write — normalize/truncate + a = firstEmpty, NO input/echo (§8, native parity) ──
    // Tracks ONLY `this.value`. `#lastDispatched` is the settled marker #dispatch (and the effect above)
    // write BEFORE their own assignment, so a write this effect itself is responsible for never re-enters
    // as "external" on its own re-run.
    this.effect(() => {
      const raw = this.value
      if (raw === this.#lastDispatched) return // an internal write already fully handled — skip
      const n = untracked(() => this.#n())
      const normalized = normalize(raw).slice(0, n)
      this.#lastDispatched = normalized
      this.#active.value = firstEmptyOf(normalized.length, n) // §8: external write → a = firstEmpty, no exceptions
      if (normalized !== raw) this.value = normalized
    })

    // ── cell paint — value / #active / #focused → textContent + [data-filled] + [data-active] ────────
    this.effect(() => {
      const value = this.value
      const active = this.#active.value
      const focused = this.#focused.value
      for (let i = 0; i < this.#cells.length; i++) {
        const cell = this.#cells[i]!
        const ch = value[i] ?? ''
        if (cell.textContent !== ch) cell.textContent = ch
        cell.toggleAttribute('data-filled', ch !== '')
        cell.toggleAttribute('data-active', focused && i === active)
      }
    })

    // ── editor SR-readable mirror — the editor's literal text content = value (§6: "SRs read them as
    // entered and navigate them by character"), painted invisibly (opacity 0, otp-field.css). ─────────
    // Every mutation runs through #dispatch, never the native caret (§3's unconditional beforeinput
    // preventDefault) — so this effect is the SOLE writer of the editor's textContent, on EVERY value
    // change, not just an occasional divergence (unlike text-field's caret guard, which mostly SKIPS the
    // write because the browser's own edit already produced matching content). A plain `textContent =`
    // invalidates the browser's live Selection, which some engines then use to decide whether the NEXT
    // native edit command (e.g. Backspace's deleteContentBackward) has anything to act on — a real,
    // measured WebKit hazard (backspace silently no-ops after a scripted rewrite leaves the caret at a
    // stale/cleared position). Re-collapsing a real Selection to the END of the (invisible) text after
    // every rewrite, while the editor is actually focused, keeps the browser's own edit-command dispatch
    // sane; the model never READS this position back (§3's "the DOM selection is never managed and never
    // read" governs OUR logic, not the courtesy of leaving the native caret somewhere valid).
    this.effect(() => {
      const value = this.value
      if (this.#composing) return
      if (editor.textContent !== value) {
        editor.textContent = value
        if (document.activeElement === editor) {
          const selection = window.getSelection()
          if (selection) {
            const range = document.createRange()
            range.selectNodeContents(editor)
            range.collapse(false)
            selection.removeAllRanges()
            selection.addRange(range)
          }
        }
      }
    })

    // ── label / required mirror (bare-usage aria-label, yielding under ui-field association) ─────────
    this.effect(() => {
      if (this.label && this.fieldLabelling === null) editor.setAttribute('aria-label', this.label)
      else editor.removeAttribute('aria-label')
      if (this.required) editor.setAttribute('aria-required', 'true')
      else editor.removeAttribute('aria-required')
    })

    // ── disabled channel (ADR-0014 dev#b — effectiveDisabled = own || form-disabled) ───────────────────
    this.effect(() => {
      if (this.effectiveDisabled()) {
        editor.setAttribute('contenteditable', 'false')
        editor.removeAttribute('tabindex')
        editor.setAttribute('aria-disabled', 'true')
        this.internals.states?.add('disabled')
      } else {
        editor.setAttribute('contenteditable', EDITABLE)
        editor.removeAttribute('tabindex')
        editor.removeAttribute('aria-disabled')
        this.internals.states?.delete('disabled')
      }
    })

    // ── user-invalid → aria-invalid + the non-colour message cue + :state(user-invalid) (ADR-0014 cl.2c/4) ──
    this.effect(() => {
      const fielded = this.fieldLabelling !== null
      if (controller.userInvalid()) {
        const verdict = this.mergedValidity()
        const text = verdict.valid ? '' : verdict.message
        editor.setAttribute('aria-invalid', 'true')
        if (fielded) {
          message.textContent = ''
          message.hidden = true
        } else {
          editor.setAttribute('aria-describedby', message.id)
          message.textContent = text
          message.hidden = text === ''
        }
        this.internals.states?.add('user-invalid')
      } else {
        editor.removeAttribute('aria-invalid')
        if (!fielded) editor.removeAttribute('aria-describedby')
        message.textContent = ''
        message.hidden = true
        this.internals.states?.delete('user-invalid')
      }
    })

    // Motion gate (interaction-states standard) — armed one frame past first paint.
    requestAnimationFrame(() => this.internals.states?.add('ready'))
  }

  protected disconnected(): void {
    this.#userInvalid?.release()
    this.#userInvalid = null
  }

  /** Forward host focus to the editor PART (label-association + native `.focus()` parity). */
  override focus(options?: FocusOptions): void {
    if (this.#editor) this.#editor.focus(options)
    else super.focus(options)
  }

  // ── the #dispatch choke point (LLD-C1/C8) — applies ONE reducer result: value/active write, the
  // composed `input` re-emit, the LLD-C8 echo, and the completion/Enter `change` commit. ────────────

  #dispatch(action: OtpAction): void {
    const n = this.#n()
    const prev: OtpState = { value: this.value, active: this.#active.value }
    const r = reduce(prev, action, n)

    if (r.state.active !== prev.active) this.#active.value = r.state.active
    if (r.changed) {
      this.#lastDispatched = r.state.value // settled BEFORE the assignment — see the external-write effect
      this.value = r.state.value
      this.emit('input')
      if (r.echo) this.#writeEcho(r.echo, r.state.value.length, n)
    }

    if (r.completed) {
      this.#committed = r.state.value
      this.emit('change')
    } else if (r.commit && r.state.value !== this.#committed) {
      this.#committed = r.state.value
      this.emit('change')
    }
  }

  /** LLD-C8's frozen announcement templates — the ONLY place these four strings are spelled. */
  #writeEcho(echo: EchoEvent, len: number, n: number): void {
    if (!this.#echo) return
    this.#echo.textContent =
      echo.kind === 'digit' ? `${echo.digit}, ${len} of ${n}` :
      echo.kind === 'clear' ? `cleared, ${len} of ${n}` :
      echo.kind === 'paste' ? `${echo.count} digits entered, ${len} of ${n}` :
      'code complete'
  }

  /** The cleaned cell count (§2 Props row) — the ONE internal consumer of `cleanLength`; `this.length`
   *  itself stays the raw reflected prop (native-attribute-IDL parity). */
  #n(): number {
    return cleanLength(this.length)
  }

  // ── form hooks (UIFormElement seams) ──────────────────────────────────────────

  /** The raw (possibly partial) string — no codec; the canonical IS the display (§2 Form-participation row). */
  protected formValue(): FormValue {
    return this.value
  }

  /** `required && value===''` → `valueMissing`; `0 < len < N` → the native `tooShort` flag. */
  protected formValidity(): ValidityResult {
    if (this.effectiveDisabled()) return { valid: true }
    const n = this.#n()
    const len = this.value.length
    if (this.required && len === 0) {
      return {
        valid: false,
        flags: { valueMissing: true },
        message: 'Please fill out this field.',
        anchor: this.#editor ?? undefined,
      }
    }
    if (len > 0 && len < n) {
      return {
        valid: false,
        flags: { tooShort: true },
        message: `Please enter all ${n} digits.`,
        anchor: this.#editor ?? undefined,
      }
    }
    return { valid: true }
  }

  /** Form reset → value ← the initial `value` attribute baseline; clears the touched state. */
  protected formReset(): void {
    this.value = this.#defaultValue
    this.#userInvalid?.reset()
  }

  /** Restore the value after navigation/autofill (FACE state restore). */
  protected formStateRestore(state: File | string | FormData | null): void {
    if (typeof state === 'string') this.value = state
  }

  // ── ADR-0051 — the field-labelling seam wire (text-field's own part-role override, copied verbatim) ──

  protected applyFieldLabelling(refs: FieldLabelling | null): void {
    const editor = this.#editor
    if (!editor) return
    if (refs === null) {
      editor.removeAttribute('aria-labelledby')
      return
    }
    if (refs.label) editor.setAttribute('aria-labelledby', refs.label.id)
    else editor.removeAttribute('aria-labelledby')
    const described = [refs.description, refs.error].filter((el): el is HTMLElement => el !== null)
    if (described.length > 0) editor.setAttribute('aria-describedby', described.map((el) => el.id).join(' '))
    else editor.removeAttribute('aria-describedby')
  }

  protected formUserInvalid(): boolean {
    return this.#userInvalid?.userInvalid() ?? false
  }

  // ── part creation (idempotent, ADR-0014) ──────────────────────────────────────

  /** Create the editor PART + the aria message node + the LLD-C8 echo node ONCE — light-DOM children that
   *  persist across disconnect/reconnect. Cells are created separately, by the length-driven effect above
   *  (LLD-C3). */
  #ensureParts(): HTMLElement {
    if (this.#editor) return this.#editor

    const editor = document.createElement('div')
    editor.setAttribute('data-part', 'editor')
    editor.setAttribute('contenteditable', EDITABLE)
    editor.setAttribute('role', 'textbox') // the role rides the PART — the host carries NO role/aria-* attribute
    editor.setAttribute('aria-multiline', 'false')
    editor.setAttribute('inputmode', 'numeric') // summons the mobile numeric keyboard (§3)
    this.#editor = editor

    const message = document.createElement('div')
    message.className = 'ui-otp-field-message' // a queryable hook, NOT a [data-part] (not a public part)
    message.id = `ui-otp-field-message-${++messageSeq}`
    message.hidden = true
    this.#message = message

    const echo = document.createElement('div')
    echo.setAttribute('data-part', 'echo')
    echo.setAttribute('aria-live', 'polite')
    echo.setAttribute('aria-atomic', 'true')
    this.#echo = echo

    this.append(editor, message, echo)
    return editor
  }
}

if (!customElements.get('ui-otp-field')) customElements.define('ui-otp-field', UIOtpFieldElement)
