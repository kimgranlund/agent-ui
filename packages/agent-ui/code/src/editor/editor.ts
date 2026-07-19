// editor.ts — UICodeEditorElement, the FACE editable-source primitive (ADR-0139). A general-purpose
// `ui-code-editor` control: `value` + FACE validity ride `ElementInternals` (UIFormElement, ADR-0013); the
// EDITABLE-FIRST fallback (ADR-0139 cl.5) is the defining behaviour.
//
// It renders a plain, fully-working editable surface IMMEDIATELY on connect — the ADR-0134 contenteditable
// PATTERN (ui-textarea's), re-implemented here so this element OWNS its editor part and can hand it off to
// CodeMirror. This surface works with ZERO CodeMirror loaded, ever. ONLY for `language="markdown"` (v1's one
// language) does it THEN attempt a dynamic `import('./cm-editor.ts')` behind a 10s ceiling; on success CM
// PROGRESSIVELY ENHANCES the surface (mounts alongside, preserving value/caret/focus, hiding the plain
// editor); on failure/timeout — or under jsdom, where CM cannot mount — the plain editable surface stays
// PERMANENTLY (never read-only, ADR-0139 cl.5; this inverts gen-ui-kit's display-first `<pre>` fallback).
// This module's graph carries ZERO static CodeMirror imports (confinement.test.ts) — CM arrives via dynamic
// import ONLY, always inside cm-editor.ts.
//
// value↔surface is two scope-owned wires over ONE `value` signal (the source of truth): surface→model on
// input / CM doc-change (IME-guarded), model→surface under a caret guard (a plain textContent write, or a CM
// dispatch while CM is unfocused). `change` is blur-with-change ONLY — byte-identical to ui-textarea's timing
// (ADR-0134), which is what makes entry-list.ts a drop-in tag+type swap. `no catalog row` (the element lives
// outside @agent-ui/components — the SPEC-N2 fleet gate owes nothing, ADR-0119 cl.7 / ADR-0139 cl.4).

import { UIFormElement, prop, signal } from '@agent-ui/components'
import type { PropsSchema, ReactiveProps, FormValue, ValidityResult, FieldLabelling } from '@agent-ui/components'
import type { CmHandle } from './cm-editor.ts'

const EDITABLE = 'plaintext-only' // the ADR-0014 contenteditable mode, reused
// v1 languages that trigger CodeMirror enhancement (ADR-0139 cl.1). Unknown/absent ⇒ plain, no highlight,
// no CM load at all — the plain contenteditable surface is the whole element.
const CM_LANGUAGES = new Set(['markdown'])
const CM_LOAD_TIMEOUT_MS = 10_000 // ADR-0139 cl.5 — the gen-ui-kit-proven ceiling on the lazy CM import
let messageSeq = 0

/** Race a loader against a timeout (ADR-0139 cl.5's 10s ceiling on the lazy CM import). Clears the timer on
 *  settle so a resolved import never leaves a dangling rejection. */
function importWithTimeout<T>(loader: () => Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('ui-code-editor: CodeMirror load timed out')), ms)
  })
  return Promise.race([loader().finally(() => clearTimeout(timer)), timeout])
}

/** Whether CodeMirror can actually MOUNT here. CM needs a real layout engine; jsdom has none, so the CM path
 *  is skipped there — the plain editable surface is the jsdom-tested contract and the CM mount/highlight/
 *  handoff are browser-leg obligations (ADR-0139 cl.5 / Consequences: "jsdom is blind to the CM path"). Not a
 *  test-runner sniff: it gates on the environment's inability to lay out, using jsdom's own UA marker; every
 *  real engine (incl. the Playwright browser legs) reports no "jsdom" and enhances normally. */
function codeMirrorCanMount(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  return !/jsdom/i.test(navigator.userAgent)
}

const props = {
  // The universal form attributes (name / disabled(reflect) / required(reflect)) — SPREAD, not inherited
  // (props.ts has no static-props prototype merge; the ADR-0013 formProps bag).
  ...UIFormElement.formProps,
  // OBSERVED (its initial attribute seeds the reset baseline) but NOT reflected — the live value rides the
  // surface, never a host attribute.
  value: prop.string(),
  // v1: `markdown`; unknown/absent ⇒ plain, no highlight (ADR-0139 cl.4). Reflects for `[language]` CSS hooks.
  language: { ...prop.string(), reflect: true },
  // v1: 'source' (default) | 'richtext' (ADR-0147). Reflects for `[mode]` CSS hooks. Unknown ⇒ treated as
  // 'source' — the runtime guard is `this.mode === 'richtext'`, everything else IS source behavior, so an
  // unknown value degrades safely with zero validation code (the `language` precedent; `erasableSyntaxOnly`
  // bars an enum, so the type surface `'source' | 'richtext'` is a literal union in prose/descriptor only).
  mode: { ...prop.string('source'), reflect: true },
  label: { ...prop.string(), reflect: true }, // → the editor's aria-label (the labelling SEAM; yields under ui-field)
  placeholder: prop.string(),
  // multi-line MIN-height lever (ADR-0134's law — rows × line-box + padding as a growable minimum, NOT the
  // single-line (scale×size)→§1-row lookup). Reflects so attribute-keyed CSS applies to JS-set values.
  rows: { ...prop.number(4), reflect: true },
  readonly: { ...prop.boolean(false), reflect: true },
} satisfies PropsSchema

export interface UICodeEditorElement extends ReactiveProps<typeof props> {}
export class UICodeEditorElement extends UIFormElement {
  static props = props

  // The stable plain contenteditable editor PART + the aria message node — light-DOM, created ONCE (the
  // idempotent guard), persisting across disconnect/reconnect.
  #editor: HTMLElement | null = null
  #message: HTMLElement | null = null

  // The richtext mode-toggle part (ADR-0147 cl.5) — created ONLY on a successful CM enhancement whose
  // handle reports `richtextAvailable` (never in #ensureParts; the affordance appears WITH the capability).
  // Removed in disconnected() alongside #cmMount; recreated on a reconnect's re-enhance.
  #modeToggle: HTMLElement | null = null

  // The CodeMirror layer — the mount host + the live handle. Null until (and unless) enhancement succeeds.
  #cmMount: HTMLElement | null = null
  #cm: CmHandle | null = null
  #cmPending = false
  // Consume-once flag: the handoff's OWN synthetic focus (focusEnd) must not re-baseline #committed (M1b).
  #skipCmFocusBaseline = false
  // Bumps on every connect/disconnect — an in-flight async CM mount checks it to discard a stale mount.
  #mountGen = 0

  // The native-parity reset baseline — seeded ONCE from the initial `value` attribute (native defaultValue).
  #defaultValue = ''
  #defaultCaptured = false

  // The `change`-on-commit baseline (value at the last focus) + the IME-composition guard.
  #committed = ''
  #composing = false

  // The inline user-invalid TIMING gate (a cross-package trait is unavailable; this replicates the
  // trackUserInvalid timing minimally) — flips true on the first commit (blur), gating the danger treatment.
  #touched = signal(false)

  protected connected(): void {
    if (!this.#defaultCaptured) {
      this.#defaultValue = this.getAttribute('value') ?? ''
      this.#defaultCaptured = true
    }

    const editor = this.#ensureParts()
    const message = this.#message as HTMLElement
    this.#mountGen += 1
    const gen = this.#mountGen

    // ── surface → model (plain editor), IME-guarded — inert once CM owns the surface ──
    this.listen(editor, 'input', (event) => {
      if (this.#cm || this.#composing) return
      event.stopPropagation() // suppress the raw editor input; the host re-emits ONE composed input (target = host)
      this.value = editor.textContent ?? ''
      this.emit('input')
    })
    this.listen(editor, 'compositionstart', () => {
      this.#composing = true
    })
    this.listen(editor, 'compositionend', () => {
      this.#composing = false
      if (!this.#cm) this.value = editor.textContent ?? ''
    })

    // ── change on commit — blur-with-change ONLY (plain editor); Enter inserts a newline, never commits ──
    this.listen(editor, 'focus', () => {
      if (!this.#cm) this.#committed = this.value
    })
    this.listen(editor, 'blur', () => {
      if (this.#cm) return
      this.#touched.value = true
      if (this.value === this.#committed) return
      this.#committed = this.value
      this.emit('change')
    })

    // ── model → surface — CM dispatch (unfocused) OR the plain caret-guard write + the placeholder flag ──
    this.effect(() => {
      const value = this.value // tracked — re-runs on every value change (typed OR programmatic/reset/restore)
      if (this.#cm) {
        this.#cm.setDoc(value) // no-op when already equal; the setter guards a redundant transaction
        return
      }
      if (this.#composing) return
      if (editor.textContent !== value) editor.textContent = value // CARET GUARD: only when the model diverges
      editor.toggleAttribute('data-empty', value === '')
    })

    // ── editor attribute mirror — the label seam, the placeholder text, the required mirror ──
    this.effect(() => {
      if (this.label && this.fieldLabelling === null) editor.setAttribute('aria-label', this.label)
      else editor.removeAttribute('aria-label')
      editor.setAttribute('data-placeholder', this.placeholder)
      if (this.required) editor.setAttribute('aria-required', 'true')
      else editor.removeAttribute('aria-required')
    })

    // ── disabled / readonly channel (effectiveDisabled = own || form-disabled) — drives BOTH surfaces ──
    this.effect(() => {
      const disabled = this.effectiveDisabled()
      const readonly = this.readonly
      if (disabled) {
        editor.setAttribute('contenteditable', 'false')
        editor.removeAttribute('tabindex')
        editor.setAttribute('aria-disabled', 'true')
        editor.removeAttribute('aria-readonly')
        this.internals.states?.add('disabled')
      } else if (readonly) {
        editor.setAttribute('contenteditable', 'false')
        editor.setAttribute('tabindex', '0') // not editable, but still focusable / selectable (still submits)
        editor.removeAttribute('aria-disabled')
        editor.setAttribute('aria-readonly', 'true')
        this.internals.states?.delete('disabled')
      } else {
        editor.setAttribute('contenteditable', EDITABLE)
        editor.removeAttribute('tabindex')
        editor.removeAttribute('aria-disabled')
        editor.removeAttribute('aria-readonly')
        this.internals.states?.delete('disabled')
      }
      this.#cm?.setEditable(!disabled && !readonly)
      // The toggle interplay (ADR-0147 cl.5/F5): disabled strips operability; readonly stays FULLY operable (a
      // readonly rendered view is a legitimate "read this rendered" surface — richtext under readonly still
      // reveals-near-cursor via selection). #syncModeToggle is a no-op before the toggle part exists.
      this.#syncModeToggle()
    })

    // ── user-invalid → aria-invalid + the non-colour message cue + :state(user-invalid) ──
    this.effect(() => {
      const fielded = this.fieldLabelling !== null
      const verdict = this.formValidity()
      if (this.#touched.value && !verdict.valid) {
        editor.setAttribute('aria-invalid', 'true')
        if (fielded) {
          message.textContent = ''
          message.hidden = true
        } else {
          editor.setAttribute('aria-describedby', message.id)
          message.textContent = verdict.message
          message.hidden = verdict.message === ''
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

    // ── rows → the CSS min-block-size lever (ADR-0134: rows is a growable MINIMUM, not a fixed height) ──
    this.effect(() => {
      this.style.setProperty('--ui-code-editor-rows', String(this.rows ?? 4))
    })

    // ── richtext mode → the CM richtext Compartment (ADR-0147 cl.1/cl.2/cl.6) ──
    // A no-op via optional chaining wherever CM never mounted (jsdom / load failure / non-markdown language)
    // — the inert-fallback law: the plain surface, FACE hooks, and event wiring are untouched by `mode` on
    // every code path (asserted by editor.test.ts's with/without `mode="richtext"` diff).
    this.effect(() => {
      const rich = this.mode === 'richtext'
      this.#cm?.setRichtext(rich && this.#cm.richtextAvailable)
      this.#syncModeToggle() // aria-pressed + presence; a no-op before the toggle part exists
    })

    // Motion gate — arm `ready` one frame past first paint so the upgrade SNAPS (states optional-chained;
    // jsdom has no CustomStateSet — the browser smoke is the real motion proof).
    requestAnimationFrame(() => this.internals.states?.add('ready'))

    // ── CM progressive enhancement — markdown only, editable-first (ADR-0139 cl.5) ──
    if (CM_LANGUAGES.has(this.language) && codeMirrorCanMount() && !this.#cm && !this.#cmPending) {
      void this.#enhanceWithCodeMirror(gen)
    }
  }

  protected disconnected(): void {
    this.#mountGen += 1 // invalidate any in-flight CM mount
    // Clear the pending flag so a RECONNECT can re-enhance (reviewer m6): a mount in flight when this fires
    // bails on the gen check above and never sets #cm, so without this reset a disconnect-during-load would
    // leave #cmPending stuck true and the reconnected element would stay plain forever. Its own finally still
    // runs (harmlessly re-clearing it); the flag is consumed-once, reset here for a clean reconnect.
    this.#cmPending = false
    this.#skipCmFocusBaseline = false
    if (this.#cm) {
      this.#cm.destroy()
      this.#cm = null
    }
    if (this.#cmMount) {
      this.#cmMount.remove()
      this.#cmMount = null
    }
    if (this.#modeToggle) {
      this.#modeToggle.remove()
      this.#modeToggle = null
    }
    if (this.#editor) this.#editor.hidden = false // restore the plain surface for a potential reconnect
  }

  /**
   * Lazy-load CodeMirror and let it progressively enhance the plain surface (ADR-0139 cl.5). On success CM
   * mounts alongside the plain editor, preserving the current value + focus/caret, and the plain editor is
   * hidden. On failure/timeout the plain editable surface simply stays — never read-only. `gen` is captured
   * at call time; a disconnect/reconnect bumps `#mountGen`, so a resolved-but-stale mount is discarded.
   */
  async #enhanceWithCodeMirror(gen: number): Promise<void> {
    this.#cmPending = true
    const editor = this.#editor as HTMLElement
    try {
      const mod = await importWithTimeout(() => import('./cm-editor.ts'), CM_LOAD_TIMEOUT_MS)
      if (gen !== this.#mountGen || !this.isConnected || this.#cm) return

      const active = this.ownerDocument.activeElement
      const hadFocus = active === editor || editor.contains(active)

      // Build the view into a DETACHED mount first, then insert it atomically — so `[data-part="cm"]` and its
      // `.cm-editor` never appear half-built in the DOM (a WebKit-observed race otherwise).
      const mount = this.ownerDocument.createElement('div')
      mount.setAttribute('data-part', 'cm')

      // Re-sync scope post-mount (reviewer m7): `value` re-syncs (setDoc after handoff + the model→surface
      // effect) and `disabled`/`readonly` re-sync (the disabled effect's `this.#cm?.setEditable(...)`).
      // `placeholder` and `language` are captured at mount ONLY — a runtime change to either does NOT
      // re-configure a LIVE CM view (the plain-surface attrs still update via the editor-attr effect). This is
      // a v1 bound, not a defect: no consumer changes placeholder/language after mount (entry-list sets both
      // once, pre-connect); adding placeholder/language Compartments is unwarranted machinery for a path with
      // no caller. If a consumer ever needs it, add a Compartment reconfigure the same shape as setEditable.
      const handle = await mod.mountCodeMirror({
        parent: mount,
        doc: this.value,
        placeholder: this.placeholder,
        editable: !this.effectiveDisabled() && !this.readonly,
        richtext: this.mode === 'richtext', // captured at mount; LIVE afterward via the mode effect's setRichtext
        onDocChange: (value) => {
          this.value = value
          this.emit('input')
        },
        onFocusChange: (focused) => {
          if (focused) {
            // Preserve the commit baseline across the handoff's OWN synthetic focus (focusEnd below): if the
            // user edited the plain surface pre-handoff, re-baselining here would erase that divergence, so the
            // next blur would see value === #committed and NEVER fire `change` — the edit silently lost
            // (reviewer M1b). A genuine later focus re-baselines normally (the flag is consumed once).
            if (this.#skipCmFocusBaseline) {
              this.#skipCmFocusBaseline = false
              return
            }
            this.#committed = this.value
            return
          }
          this.#touched.value = true
          if (this.value === this.#committed) return
          this.#committed = this.value
          this.emit('change')
        },
      })

      if (gen !== this.#mountGen || !this.isConnected) {
        handle.destroy()
        return
      }

      // Suppress CM's native contentDOM `input` at the mount boundary — the host re-emits ONE synthetic,
      // host-targeted `input` via onDocChange; without this a keystroke yields TWO inputs with different
      // targets once CM is mounted (reviewer M3; the plain path stops its own raw input the same way). Dies
      // with the mount on disconnect (the mount is removed there).
      mount.addEventListener('input', (event) => event.stopPropagation())
      this.insertBefore(mount, editor) // mount + its live .cm-editor land together, atomically
      this.#cmMount = mount
      this.#cm = handle
      // Re-sync to the CURRENT value (reviewer M1a): keystrokes typed into the plain surface DURING the async
      // CM load updated `this.value` AFTER `doc:` was snapshotted (cm-editor.ts does more async work — the
      // nested markdown import — before the view exists), so the freshly-built view can hold a stale doc. Push
      // the live value in now — programmatic (fires no `input`, per M2), a no-op when already equal — so no
      // typed characters are lost. (This is also the value-side of the m7 post-mount re-sync.)
      this.#cm.setDoc(this.value)
      editor.hidden = true // the plain surface yields to CM (kept in the DOM, hidden — the reconnect restore)
      if (hadFocus) {
        this.#skipCmFocusBaseline = true // the handoff's own focus must not re-baseline #committed (M1b)
        handle.focusEnd() // preserve focus across the handoff (best-effort: caret → end)
      }
      // The mode-toggle part (ADR-0147 cl.5/cl.6) — ONLY when richtext can actually render here; the
      // affordance appears WITH the capability, never before it.
      if (handle.richtextAvailable) this.#ensureModeToggle()
    } catch {
      // Load failure / timeout — the plain editable surface stays, permanently (ADR-0139 cl.5). Never read-only.
    } finally {
      this.#cmPending = false
    }
  }

  /** Forward host focus to the live surface (CM when mounted, else the plain editor part). */
  override focus(options?: FocusOptions): void {
    if (this.#cm) {
      this.#cm.view.focus()
      return
    }
    if (this.#editor) this.#editor.focus(options)
    else super.focus(options)
  }

  /**
   * Focus the surface and move the caret to the END — the ADR-0134 migration seam `entry-list.ts` uses to
   * restore an in-progress edit's caret after a re-render (a `<textarea>.setSelectionRange(len, len)`
   * equivalent). CM path when mounted; else a `Selection`/`Range` on the plain editor part. A no-op before
   * the editor part exists (guards a not-yet-connected control).
   */
  selectToEnd(): void {
    if (this.#cm) {
      this.#cm.focusEnd()
      return
    }
    const editor = this.#editor
    if (!editor) return
    editor.focus()
    const selection = editor.ownerDocument.defaultView?.getSelection() ?? window.getSelection()
    if (!selection) return
    const range = editor.ownerDocument.createRange()
    range.selectNodeContents(editor)
    range.collapse(false) // collapse to the END
    selection.removeAllRanges()
    selection.addRange(range)
  }

  // ── form hooks (overrides of the UIFormElement seams) ──────────────────────────

  protected formValue(): FormValue {
    return this.value
  }

  /**
   * `required && value === ''` → `valueMissing`; valid otherwise. No codec/type validation — editable source
   * text has no value-shape to mismatch. A disabled field is barred from constraint validation (native parity).
   */
  protected formValidity(): ValidityResult {
    if (this.effectiveDisabled()) return { valid: true }
    if (this.required && this.value === '') {
      return {
        valid: false,
        flags: { valueMissing: true },
        message: 'Please fill out this field.',
        anchor: this.#cm?.view.contentDOM ?? this.#editor ?? undefined,
      }
    }
    return { valid: true }
  }

  protected formReset(): void {
    this.value = this.#defaultValue
    this.#committed = this.#defaultValue
    this.#touched.value = false
  }

  protected formStateRestore(state: File | string | FormData | null): void {
    if (typeof state === 'string') this.value = state
  }

  // ── ADR-0051 — the field-labelling seam (the part-role override, ui-textarea's wire reused) ──────

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
    return this.#touched.value && !this.formValidity().valid
  }

  /**
   * Create the plain editor PART + the aria message node ONCE (idempotent across reconnect — both are
   * light-DOM children that persist through disconnect), returning the editor.
   */
  #ensureParts(): HTMLElement {
    if (this.#editor) return this.#editor

    const editor = this.ownerDocument.createElement('div')
    editor.setAttribute('data-part', 'editor')
    editor.setAttribute('contenteditable', EDITABLE)
    editor.setAttribute('role', 'textbox') // the role rides the PART — the host carries NO role/aria-* attribute
    editor.setAttribute('aria-multiline', 'true')
    this.#editor = editor

    const message = this.ownerDocument.createElement('div')
    message.className = 'ui-code-editor-message' // a queryable hook, NOT a [data-part] (not a public part)
    message.id = `ui-code-editor-message-${++messageSeq}`
    message.hidden = true
    this.#message = message

    this.append(editor, message)
    return editor
  }

  // ── the richtext mode-toggle part (ADR-0147 cl.5/cl.6/cl.8) ─────────────────────

  /**
   * Create the mode-toggle part ONCE — ONLY on a successful CM enhancement whose handle reports
   * `richtextAvailable` (never in #ensureParts; the affordance appears WITH the capability). Placed FIRST
   * child of the host — before `[data-part='cm']` — so tab order is toggle → editor surface (LLD-C4).
   */
  #ensureModeToggle(): void {
    if (this.#modeToggle) return
    const toggle = this.ownerDocument.createElement('div')
    toggle.setAttribute('data-part', 'mode-toggle')
    toggle.setAttribute('role', 'button') // the no-native-form-elements law — role rides the PART
    toggle.setAttribute('aria-label', 'Rendered markdown view')
    // Raw listeners (not this.listen) — the toggle's whole lifecycle is create/remove paired with the CM
    // mount (disconnected() removes the node), the same pattern the `mount` input-suppression listener uses.
    toggle.addEventListener('click', () => this.#userToggleMode())
    toggle.addEventListener('keydown', (event) => {
      const key = (event as KeyboardEvent).key
      if (key !== 'Enter' && key !== ' ') return
      event.preventDefault() // Space's default is page-scroll; harmless to prevent on Enter too
      this.#userToggleMode()
    })
    this.prepend(toggle)
    this.#modeToggle = toggle
    this.#syncModeToggle() // seed aria-pressed + tabindex/aria-disabled for the CURRENT state immediately
  }

  /** A USER-initiated toggle (click/Enter/Space) flips `mode` and emits ONE host-targeted `toggle` — the
   *  ONLY path that emits it (a programmatic `mode` set is silent, ADR-0147 F4 — the `value`/`input` symmetry). */
  #userToggleMode(): void {
    this.mode = this.mode === 'richtext' ? 'source' : 'richtext'
    this.emit('toggle')
  }

  /** Sync the toggle's `aria-pressed` (mirrors `mode === 'richtext'`) + its disabled/tabindex interplay
   *  (ADR-0147 cl.5/F5) to the CURRENT state. A no-op before the toggle part exists. */
  #syncModeToggle(): void {
    const toggle = this.#modeToggle
    if (!toggle) return
    toggle.setAttribute('aria-pressed', String(this.mode === 'richtext'))
    if (this.effectiveDisabled()) {
      toggle.removeAttribute('tabindex')
      toggle.setAttribute('aria-disabled', 'true')
    } else {
      toggle.setAttribute('tabindex', '0')
      toggle.removeAttribute('aria-disabled')
    }
  }
}

if (!customElements.get('ui-code-editor')) customElements.define('ui-code-editor', UICodeEditorElement)
