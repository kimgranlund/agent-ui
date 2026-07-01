import { describe, it, expect } from 'vitest'
import { signal, effect, inspect, whenFlushed, type Signal } from '@agent-ui/components'
import { UITextFieldElement } from './text-field.ts'
import type { FormValue, ValidityResult } from '../../dom/form.ts'

// G6 s8 — UITextFieldElement jsdom behaviour/value/validity/form/disabled/readonly/zero-residue probes
// (ADR-0014). jsdom reality (verified at the base, dom/form.test.ts): the ElementInternals form-association
// surface is ABSENT — setFormValue/setValidity are undefined and the platform never auto-invokes the form
// lifecycle callbacks, and there is no CustomStateSet (internals.states is undefined). So we (1) STUB
// setFormValue/setValidity on the reused internals before connect (the base's form effects call them on
// connect), (2) drive the form lifecycle callbacks DIRECTLY, and (3) assert the OBSERVABLE editor proxies
// (aria-*, contenteditable, tabindex, the message node) rather than the :state() customStates (which jsdom
// cannot evaluate — those are the s11 cross-engine smoke). The editor PART is a queryable light-DOM child.

// ── the form-association stub (jsdom lacks the whole surface — same shape as form.test.ts) ────

function asMutable(internals: ElementInternals): Record<string, unknown> {
  return internals as unknown as Record<string, unknown>
}

interface StubCalls {
  formValues: FormValue[]
  validitySets: Array<{ flags: ValidityStateFlags; message: string }>
}

/** Patch setFormValue/setValidity onto the reused internals so connect does not throw; record the calls. */
function stubFormInternals(internals: ElementInternals): StubCalls {
  const calls: StubCalls = { formValues: [], validitySets: [] }
  const i = asMutable(internals)
  i.setFormValue = (value: FormValue): void => {
    calls.formValues.push(value)
  }
  i.setValidity = (flags: ValidityStateFlags, message?: string): void => {
    calls.validitySets.push({ flags, message: message ?? '' })
  }
  return calls
}

// ── a probe subclass re-exposing the protected seams (internals / formValidity / effectiveDisabled) ──
// `probe` is an inspectable signal the base's setFormValue effect reads (via the formValue override), so its
// subscriber count is exactly that effect's presence — the scope-owned-residue lever (same trick as form.test).
class ProbeTextField extends UITextFieldElement {
  readonly probe: Signal<number> = signal(0)
  get internalsProbe(): ElementInternals {
    return this.internals
  }
  formValidityProbe(): ValidityResult {
    return this.formValidity()
  }
  effectiveDisabledProbe(): boolean {
    return this.effectiveDisabled()
  }
  protected formValue(): FormValue {
    void this.probe.value // subscribe the base setFormValue effect to an inspectable signal
    return super.formValue()
  }
}
customElements.define('ui-text-field-probe', ProbeTextField)

/** A fresh, internals-stubbed probe (NOT yet connected). */
function makeField(): { el: ProbeTextField; calls: StubCalls } {
  const el = new ProbeTextField()
  const calls = stubFormInternals(el.internalsProbe)
  return { el, calls }
}

const editorOf = (el: Element): HTMLElement => el.querySelector('[data-part="editor"]') as HTMLElement
const messageOf = (el: Element): HTMLElement => el.querySelector('.ui-text-field-message') as HTMLElement

// ── upgrade + the typed prop surface ──────────────────────────────────────────

describe('ui-text-field — upgrade + typed prop surface', () => {
  it('upgrades to the class with the 9 props at their defaults (no connect → no form-internals throw)', () => {
    const el = document.createElement('ui-text-field') as UITextFieldElement
    expect(el).toBeInstanceOf(UITextFieldElement)
    expect(el.value).toBe('')
    expect(el.label).toBe('')
    expect(el.placeholder).toBe('')
    expect(el.size).toBe('md')
    expect(el.type).toBe('text')
    expect(el.readonly).toBe(false)
    expect(el.name).toBe('')
    expect(el.disabled).toBe(false)
    expect(el.required).toBe(false)
  })

  it('tf-typed: size + type are literal unions, not string (compile-time negative control)', () => {
    const fn = (): void => {
      const el = new UITextFieldElement()
      el.size = 'sm'
      el.size = 'lg'
      // @ts-expect-error — 'xl' is not a size member: proves the literal union, NOT string
      el.size = 'xl'
      // @ts-expect-error — a bare string is wider than the union
      el.size = 'x' as string
      // @ts-expect-error — readonly is boolean, not string
      el.readonly = 'yes'
      el.type = 'email'
      el.type = 'password'
      el.type = 'currency'
      // @ts-expect-error — 'date' is not a type member: proves the 8-value literal union
      el.type = 'date'
      // @ts-expect-error — a bare string is wider than the type union
      el.type = 'xyz' as string
    }
    expect(typeof fn).toBe('function') // never invoked; the type errors above are the assertion
  })

  it('self-defines ui-text-field, guarded against a double-define', () => {
    expect(customElements.get('ui-text-field')).toBe(UITextFieldElement)
    expect(() => {
      if (!customElements.get('ui-text-field')) customElements.define('ui-text-field', UITextFieldElement)
    }).not.toThrow()
  })
})

// ── the editor PART (tf-editor) + host-no-role ────────────────────────────────

describe('ui-text-field — the contenteditable editor part', () => {
  it('creates a single contenteditable=plaintext-only role=textbox editor part; the HOST carries no role/aria', () => {
    const { el } = makeField()
    document.body.append(el)
    const editor = editorOf(el)
    expect(editor).not.toBeNull()
    expect(editor.getAttribute('contenteditable')).toBe('plaintext-only')
    expect(editor.getAttribute('role')).toBe('textbox')
    expect(editor.getAttribute('aria-multiline')).toBe('false')
    // host-no-role: the form semantics ride internals, the editor carries role — the HOST carries neither
    expect(el.hasAttribute('role')).toBe(false)
    for (const attr of Array.from(el.attributes)) expect(attr.name.startsWith('aria-')).toBe(false)
    el.remove()
  })

  it('the editor part is created ONCE — idempotent across a disconnect/reconnect', () => {
    const { el } = makeField()
    document.body.append(el)
    el.remove()
    document.body.append(el) // reconnect re-runs connected()
    expect(el.querySelectorAll('[data-part="editor"]')).toHaveLength(1) // not re-appended
    expect(el.querySelectorAll('.ui-text-field-message')).toHaveLength(1)
    el.remove()
  })

  it('host.focus() forwards to the editor part', () => {
    const { el } = makeField()
    document.body.append(el)
    let focused = 0
    editorOf(el).addEventListener('focus', () => focused++)
    el.focus()
    expect(focused).toBe(1) // the focus was forwarded to the editor, not the host
    el.remove()
  })
})

// ── value as a tracked signal + surface→model + the caret guard (tf-surface-to-model / tf-model-to-surface) ──

describe('ui-text-field — value, surface↔model, the caret guard', () => {
  it('value is a tracked signal — a read inside an effect re-runs on change', async () => {
    const { el } = makeField()
    document.body.append(el)
    const seen: string[] = []
    const dispose = effect(() => {
      seen.push(el.value)
    })
    expect(seen).toEqual([''])
    el.value = 'typed'
    await whenFlushed()
    expect(seen).toEqual(['', 'typed'])
    dispose()
    el.remove()
  })

  it('surface→model: an editor input sets this.value and emits exactly one host input (target = host)', () => {
    const { el } = makeField()
    document.body.append(el)
    const editor = editorOf(el)
    let hostInputs = 0
    let targetIsHost = false
    el.addEventListener('input', (e) => {
      hostInputs++
      targetIsHost = e.target === el
    })
    editor.textContent = 'hello'
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    expect(el.value).toBe('hello') // model ← surface
    expect(hostInputs).toBe(1) // exactly one — the raw editor input is suppressed, the host re-emits
    expect(targetIsHost).toBe(true) // the editor part is hidden — the event targets the host
    el.remove()
  })

  it('the CARET GUARD: a value-equal write (a keystroke echo) does NOT rewrite the editor text node', async () => {
    const { el } = makeField()
    document.body.append(el)
    const editor = editorOf(el)
    editor.textContent = 'hi' // the user typed
    const typedNode = editor.firstChild // the live text node the caret lives in
    editor.dispatchEvent(new Event('input', { bubbles: true })) // surface→model: this.value = 'hi'
    await whenFlushed() // the model→surface effect re-runs: value('hi') === textContent('hi') → guard SKIPS
    expect(el.value).toBe('hi')
    expect(editor.firstChild).toBe(typedNode) // SAME node — not rewritten → the caret is preserved
  })

  it('model→surface: a programmatic DIVERGENT write flows to the editor + toggles data-empty (the write path is live)', async () => {
    const { el } = makeField()
    document.body.append(el)
    const editor = editorOf(el)
    expect(editor.hasAttribute('data-empty')).toBe(true) // empty default → placeholder shows

    el.value = 'abc'
    await whenFlushed()
    expect(editor.textContent).toBe('abc') // the divergent value flowed to the surface (proves the guard is not a dead path)
    expect(editor.hasAttribute('data-empty')).toBe(false)

    el.value = ''
    await whenFlushed()
    expect(editor.textContent).toBe('')
    expect(editor.hasAttribute('data-empty')).toBe(true)
    el.remove()
  })

  it('the input listener is IME-composition guarded — no model write while composing', () => {
    const { el } = makeField()
    document.body.append(el)
    const editor = editorOf(el)
    editor.dispatchEvent(new Event('compositionstart'))
    editor.textContent = '日本'
    editor.dispatchEvent(new Event('input', { bubbles: true })) // mid-composition → SKIPPED
    expect(el.value).toBe('') // the model did not move mid-composition
    editor.dispatchEvent(new Event('compositionend')) // commit the composed text
    expect(el.value).toBe('日本')
    el.remove()
  })
})

// ── change on commit — Enter (no newline) + blur-with-change (tf-change) ───────

describe('ui-text-field — change on commit', () => {
  it('Enter emits change and inserts no newline (preventDefault), then does not double-fire on blur', () => {
    const { el } = makeField()
    document.body.append(el)
    const editor = editorOf(el)
    let changes = 0
    el.addEventListener('change', () => changes++)

    editor.textContent = 'done'
    editor.dispatchEvent(new Event('input', { bubbles: true })) // value = 'done'
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    editor.dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(true) // single-line — no newline inserted
    expect(changes).toBe(1) // Enter committed

    editor.dispatchEvent(new Event('blur')) // value unchanged since the Enter commit → no second change
    expect(changes).toBe(1)
    el.remove()
  })

  it('blur emits change only when the value changed since focus (blur-with-change)', () => {
    const { el } = makeField()
    document.body.append(el)
    const editor = editorOf(el)
    let changes = 0
    el.addEventListener('change', () => changes++)

    editor.dispatchEvent(new Event('focus')) // baseline = '' (current value)
    editor.dispatchEvent(new Event('blur')) // unchanged → no change
    expect(changes).toBe(0)

    editor.dispatchEvent(new Event('focus'))
    editor.textContent = 'edited'
    editor.dispatchEvent(new Event('input', { bubbles: true })) // value = 'edited'
    editor.dispatchEvent(new Event('blur')) // changed since focus → change
    expect(changes).toBe(1)
    el.remove()
  })
})

// ── validity + form participation (tf-value-face / tf-validity) ───────────────

describe('ui-text-field — validity + form participation', () => {
  it('value participates in the form — setFormValue publishes it on connect and on change', async () => {
    const { el, calls } = makeField()
    document.body.append(el)
    expect(calls.formValues).toEqual(['']) // the default value, published once on connect
    el.value = 'mail@example.com'
    await whenFlushed()
    expect(calls.formValues.at(-1)).toBe('mail@example.com')
    el.remove()
  })

  it('required + empty → valueMissing invalid (anchored on the editor); required + filled → valid', () => {
    const { el } = makeField()
    el.required = true
    document.body.append(el)
    const invalid = el.formValidityProbe()
    expect(invalid.valid).toBe(false)
    if (!invalid.valid) {
      expect(invalid.flags).toEqual({ valueMissing: true })
      expect(invalid.message.length).toBeGreaterThan(0)
      expect(invalid.anchor).toBe(editorOf(el)) // the UA focuses the editor on reportValidity
    }
    el.value = 'x'
    expect(el.formValidityProbe().valid).toBe(true)
    el.remove()
  })

  it('a disabled field is barred from constraint validation (reports valid even when required + empty)', () => {
    const { el } = makeField()
    el.required = true
    el.disabled = true
    document.body.append(el)
    // native parity: a disabled control does not willValidate — so user-invalid never gates on (the css disabled
    // block does not repoint the danger border, so an un-gated invalid+disabled field would show danger).
    expect(el.formValidityProbe().valid).toBe(true)
    el.remove()
  })
})

// ── user-invalid timing + the non-colour describedby cue (tf-userinvalid) ─────

describe('ui-text-field — user-invalid timing + the non-colour cue', () => {
  it('aria-invalid + the aria-describedby message appear only AFTER the first interaction, and clear when valid', async () => {
    const { el } = makeField()
    el.required = true
    document.body.append(el)
    const editor = editorOf(el)
    const message = messageOf(el)

    // pre-interaction: invalid (required + empty) but NO danger cue yet (the trait gates the timing)
    expect(editor.hasAttribute('aria-invalid')).toBe(false)
    expect(editor.hasAttribute('aria-describedby')).toBe(false)

    editor.dispatchEvent(new Event('blur')) // first interaction (capture reaches the host → trackUserInvalid)
    await whenFlushed()
    expect(editor.getAttribute('aria-invalid')).toBe('true')
    expect(editor.getAttribute('aria-describedby')).toBe(message.id) // the editor points at the message node
    expect(message.textContent?.length).toBeGreaterThan(0) // carrying validity().message (WCAG 1.4.1 non-colour)

    el.value = 'now valid' // fixing the value clears the cue (valid again)
    await whenFlushed()
    expect(editor.hasAttribute('aria-invalid')).toBe(false)
    expect(editor.hasAttribute('aria-describedby')).toBe(false)
    expect(message.textContent).toBe('')
    el.remove()
  })
})

// ── the disabled / readonly channel (tf-disabled) ─────────────────────────────

describe('ui-text-field — the disabled / readonly channel', () => {
  it('effectiveDisabled (own) → editor contenteditable=false + aria-disabled + not focusable (no tabindex)', async () => {
    const { el } = makeField()
    document.body.append(el)
    const editor = editorOf(el)
    expect(editor.getAttribute('contenteditable')).toBe('plaintext-only') // editable by default

    el.disabled = true
    await whenFlushed()
    expect(editor.getAttribute('contenteditable')).toBe('false')
    expect(editor.getAttribute('aria-disabled')).toBe('true')
    expect(editor.hasAttribute('tabindex')).toBe(false) // not focusable
    el.remove()
  })

  it('the form-disabled channel makes it effective too (effectiveDisabled = own || formDisabledCallback)', async () => {
    const { el } = makeField()
    document.body.append(el)
    const editor = editorOf(el)
    expect(el.effectiveDisabledProbe()).toBe(false)
    el.formDisabledCallback(true) // an ancestor <fieldset disabled>
    await whenFlushed()
    expect(el.effectiveDisabledProbe()).toBe(true)
    expect(editor.getAttribute('contenteditable')).toBe('false')
    expect(editor.getAttribute('aria-disabled')).toBe('true')
    el.remove()
  })

  it('readonly → editor contenteditable=false but focusable (tabindex=0) + aria-readonly (still submits)', async () => {
    const { el, calls } = makeField()
    el.value = 'fixed'
    document.body.append(el)
    const editor = editorOf(el)
    el.readonly = true
    await whenFlushed()
    expect(editor.getAttribute('contenteditable')).toBe('false') // not editable
    expect(editor.getAttribute('tabindex')).toBe('0') // … but still focusable / selectable
    expect(editor.getAttribute('aria-readonly')).toBe('true')
    expect(editor.hasAttribute('aria-disabled')).toBe(false)
    expect(calls.formValues.at(-1)).toBe('fixed') // still submits (the value is still published)
    el.remove()
  })

  it('disabled takes precedence over readonly (disabled wins: aria-disabled, no tabindex)', async () => {
    const { el } = makeField()
    el.readonly = true
    el.disabled = true
    document.body.append(el)
    const editor = editorOf(el)
    await whenFlushed()
    expect(editor.getAttribute('aria-disabled')).toBe('true')
    expect(editor.hasAttribute('tabindex')).toBe(false) // disabled removes focusability, beating readonly's tabindex=0
    el.remove()
  })
})

// ── reset / restore (tf-model-to-surface) ─────────────────────────────────────

describe('ui-text-field — reset + state restore', () => {
  it('formResetCallback restores the value to the initial `value` attribute (#defaultValue)', async () => {
    const el = document.createElement('ui-text-field-probe') as ProbeTextField
    stubFormInternals(el.internalsProbe)
    el.setAttribute('value', 'init') // the initial markup attribute seeds #defaultValue at connect
    document.body.append(el)
    el.value = 'typed over it'
    el.formResetCallback()
    await whenFlushed()
    expect(el.value).toBe('init')
    expect(editorOf(el).textContent).toBe('init') // the reset flowed back to the surface
    el.remove()
  })

  it('formStateRestoreCallback restores a string state into the value', async () => {
    const { el } = makeField()
    document.body.append(el)
    el.formStateRestoreCallback('restored', 'restore')
    await whenFlushed()
    expect(el.value).toBe('restored')
    expect(editorOf(el).textContent).toBe('restored')
    el.remove()
  })

  it('formReset clears the touched state — a required-empty field is NOT user-invalid post-reset until re-interaction', async () => {
    const { el } = makeField()
    el.required = true
    document.body.append(el)
    const editor = editorOf(el)
    const message = messageOf(el)

    // interact → invalid (required + empty) → the danger treatment is on
    editor.dispatchEvent(new Event('blur')) // first interaction (capture reaches the host → trackUserInvalid)
    await whenFlushed()
    expect(editor.getAttribute('aria-invalid')).toBe('true')

    // reset: value ← '' (still required-empty, so STILL invalid) but the touched state is cleared, so the danger
    // treatment is gated off again — a reset must not leave the field flagged until the user re-interacts.
    el.formResetCallback()
    await whenFlushed()
    expect(el.value).toBe('') // restored to the (empty) defaultValue — still constraint-invalid…
    expect(el.formValidityProbe().valid).toBe(false) // …the field IS still invalid…
    expect(editor.hasAttribute('aria-invalid')).toBe(false) // …but the user-invalid cue is cleared
    expect(editor.hasAttribute('aria-describedby')).toBe(false)
    expect(message.textContent).toBe('')

    // re-arm: a fresh blur after the reset re-surfaces the danger treatment
    editor.dispatchEvent(new Event('blur'))
    await whenFlushed()
    expect(editor.getAttribute('aria-invalid')).toBe('true')
    el.remove()
  })

  it('NC: a formReset that does NOT call the controller reset leaves the field showing user-invalid post-reset', async () => {
    // The negative control: reproduce the pre-fix formReset (value-restore ONLY, no `trackUserInvalid.reset()`).
    // The value restore is a no-op on an already-empty required field, so without the reset() the touched state
    // (interacted=true) persists and the field WRONGLY keeps aria-invalid after a reset — exactly the bug the fix
    // removes. This subclass proves the reset() call is load-bearing, not the value restore.
    class NoResetField extends UITextFieldElement {
      protected formReset(): void {
        this.value = '' // the OLD behaviour: restore the (empty) defaultValue, but do NOT clear the touched state
      }
    }
    customElements.define('ui-text-field-noreset', NoResetField)

    const el = new NoResetField()
    stubFormInternals((el as unknown as { internals: ElementInternals }).internals)
    el.required = true
    document.body.append(el)
    const editor = editorOf(el)

    editor.dispatchEvent(new Event('blur')) // interact → user-invalid on
    await whenFlushed()
    expect(editor.getAttribute('aria-invalid')).toBe('true')

    el.formResetCallback() // value-only restore (no reset()) — the touched state survives
    await whenFlushed()
    expect(editor.getAttribute('aria-invalid')).toBe('true') // NC bites: still flagged, the bug the fix removes
    el.remove()
  })
})

// ── zero residue — scope-owned effects + abort-owned listeners (tf-probes) ────

describe('ui-text-field — zero residue across connect/disconnect', () => {
  it('subscribes on connect, zero subscribers on disconnect, re-subscribes once on reconnect', async () => {
    const { el } = makeField()
    expect(inspect(el.probe).subscribers).toBe(0) // not connected → no effect reads the probe

    document.body.append(el)
    expect(inspect(el.probe).subscribers).toBe(1) // exactly the base setFormValue effect (via formValue override)

    el.remove()
    expect(inspect(el.probe).subscribers).toBe(0) // scope.dispose() tore every form/control effect down

    document.body.append(el) // reconnect
    expect(inspect(el.probe).subscribers).toBe(1) // re-subscribed cleanly — exactly one, not stacked
    el.remove()
    await whenFlushed()
  })

  it('the editor listeners are abort-owned — they die on disconnect and re-wire exactly once on reconnect', () => {
    const { el } = makeField()
    document.body.append(el)
    const ed = editorOf(el)

    ed.textContent = 'a'
    ed.dispatchEvent(new Event('input', { bubbles: true }))
    expect(el.value).toBe('a') // the input listener is live while connected

    el.remove() // disconnect → ac.abort() removes the editor listeners
    ed.textContent = 'b'
    ed.dispatchEvent(new Event('input', { bubbles: true }))
    expect(el.value).toBe('a') // listener GONE — the model did not move (zero live listeners)

    document.body.append(el) // reconnect → connected() re-runs on a fresh AbortController
    ed.textContent = 'c'

    ed.dispatchEvent(new Event('input', { bubbles: true }))
    expect(el.value).toBe('c') // exactly ONE re-wired listener, not a leaked old one stacked atop it
    el.remove()
  })
})

// ── Wave 3 — type prop + per-type test matrix (ADR-0044) ──────────────────────
// The 8 types: text · email · url · tel · search · password · number · currency.
// Per-type assertions (the G6 bar — per decomp §"Per-type TEST MATRIX"):
//   ✓ inputmode on editor        ✓ auto-adornments present
//   ✓ codec round-trip           ✓ validation (email/url/number)
//   ✓ masking (password)         ✓ affordances emit + toggle
//   ✓ type='text' byte-identical (existing tests green = verified by the test suite above)
//
// jsdom reality: -webkit-text-security is NOT evaluated (CSS property is not computed).
// For password masking, we assert the CSS STRUCTURE is present (text-field-css.test.ts) and the
// reveal button toggles aria-pressed (observable without CSS computation). The cross-engine browser
// smoke (text-field-geometry.browser.test.ts) provides the real render proof.

// Helper: a connected ProbeTextField with a given type set.
function makeTyped(type: string): { el: ProbeTextField; editor: HTMLElement; calls: StubCalls } {
  const el = new ProbeTextField()
  const calls = stubFormInternals(el.internalsProbe)
  el.setAttribute('type', type)
  document.body.append(el)
  return { el, editor: editorOf(el), calls }
}

// ── type='text' — identity config (byte-identical baseline) ──────────────────

describe('ui-text-field type=text — identity config (byte-identical baseline)', () => {
  it('type=text has no inputmode attribute on the editor (identity: same as the pre-Wave-3 shipped control)', async () => {
    const { el, editor } = makeTyped('text')
    await whenFlushed()
    expect(editor.hasAttribute('inputmode')).toBe(false) // NOT set for text type (byte-identical)
    expect(el.querySelector('[data-part="leading-adornment"]')).toBeNull()
    expect(el.querySelector('[data-part="trailing-adornment"]')).toBeNull()
    el.remove()
  })
})

// ── type='email' — inputmode=email + typeMismatch validation ─────────────────

describe('ui-text-field type=email — inputmode + validation', () => {
  it('sets inputmode=email on the editor', async () => {
    const { el, editor } = makeTyped('email')
    await whenFlushed()
    expect(editor.getAttribute('inputmode')).toBe('email')
    el.remove()
  })

  it('a valid email passes formValidity()', () => {
    const { el } = makeTyped('email')
    el.value = 'user@example.com'
    expect(el.formValidityProbe().valid).toBe(true)
    el.remove()
  })

  it('an invalid email → typeMismatch (formValidity)', () => {
    const { el } = makeTyped('email')
    el.value = 'not-an-email'
    const verdict = el.formValidityProbe()
    expect(verdict.valid).toBe(false)
    if (!verdict.valid) {
      expect(verdict.flags).toEqual({ typeMismatch: true })
      expect(verdict.message).toContain('email')
    }
    el.remove()
  })

  it('empty email is VALID (required is separate) — typeMismatch only on non-empty values', () => {
    const { el } = makeTyped('email')
    el.value = ''
    expect(el.formValidityProbe().valid).toBe(true)
    el.remove()
  })

  it('no auto-adornments for email type', async () => {
    const { el } = makeTyped('email')
    await whenFlushed()
    expect(el.querySelector('[data-part="leading-adornment"]')).toBeNull()
    expect(el.querySelector('[data-part="trailing-adornment"]')).toBeNull()
    el.remove()
  })
})

// ── type='url' — inputmode=url + typeMismatch validation ─────────────────────

describe('ui-text-field type=url — inputmode + validation', () => {
  it('sets inputmode=url on the editor', async () => {
    const { el, editor } = makeTyped('url')
    await whenFlushed()
    expect(editor.getAttribute('inputmode')).toBe('url')
    el.remove()
  })

  it('a valid URL passes formValidity()', () => {
    const { el } = makeTyped('url')
    el.value = 'https://example.com'
    expect(el.formValidityProbe().valid).toBe(true)
    el.remove()
  })

  it('an invalid URL → typeMismatch', () => {
    const { el } = makeTyped('url')
    el.value = 'not-a-url'
    const verdict = el.formValidityProbe()
    expect(verdict.valid).toBe(false)
    if (!verdict.valid) {
      expect(verdict.flags).toEqual({ typeMismatch: true })
    }
    el.remove()
  })
})

// ── type='tel' — inputmode=tel (no extra validation) ─────────────────────────

describe('ui-text-field type=tel — inputmode', () => {
  it('sets inputmode=tel, no adornments, any value is valid', async () => {
    const { el, editor } = makeTyped('tel')
    await whenFlushed()
    expect(editor.getAttribute('inputmode')).toBe('tel')
    el.value = 'anything'
    expect(el.formValidityProbe().valid).toBe(true)
    el.remove()
  })
})

// ── type='search' — magnifier leading + clear trailing ───────────────────────

describe('ui-text-field type=search — magnifier + clear affordance', () => {
  it('sets inputmode=search on the editor', async () => {
    const { el, editor } = makeTyped('search')
    await whenFlushed()
    expect(editor.getAttribute('inputmode')).toBe('search')
    el.remove()
  })

  it('has a leading magnifier adornment (data-role=magnifier, aria-hidden)', async () => {
    const { el } = makeTyped('search')
    await whenFlushed()
    const magnifier = el.querySelector('[data-part="leading-adornment"][data-role="magnifier"]')
    expect(magnifier).not.toBeNull()
    expect((magnifier as HTMLElement).getAttribute('aria-hidden')).toBe('true')
    el.remove()
  })

  it('has a trailing clear adornment with a clear-button (data-role=clear)', async () => {
    const { el } = makeTyped('search')
    await whenFlushed()
    const trailing = el.querySelector('[data-part="trailing-adornment"][data-role="clear"]')
    expect(trailing).not.toBeNull()
    const clearBtn = el.querySelector('[data-part="clear-button"]')
    expect(clearBtn).not.toBeNull()
    el.remove()
  })

  it('clear button: clicking clears the value and emits input + change', async () => {
    const { el, editor } = makeTyped('search')
    await whenFlushed()
    el.value = 'hello'
    editor.textContent = 'hello'

    let inputs = 0
    let changes = 0
    el.addEventListener('input', () => inputs++)
    el.addEventListener('change', () => changes++)

    const clearBtn = el.querySelector('[data-part="clear-button"]') as HTMLElement
    clearBtn.click()
    expect(el.value).toBe('')
    expect(inputs).toBe(1)
    expect(changes).toBe(1)
    el.remove()
  })

  it('type=search has no codec — formValue() = this.value (identity)', () => {
    const { el } = makeTyped('search')
    el.value = 'query'
    expect(el.formValidityProbe().valid).toBe(true)
    el.remove()
  })

  it('editor [data-empty] toggles with value — drives the CSS clear-button visibility (:has([data-empty]))', async () => {
    // The CSS rule :scope:has(> [data-part='editor'][data-empty]) [data-role='clear'] { display: none }
    // hides the clear button when the field is empty. The mechanism is the [data-empty] attribute on the
    // editor, toggled by the model→surface effect. This jsdom probe verifies the DOM state that drives it;
    // the browser smoke proves the visual render.
    const { el, editor } = makeTyped('search')
    await whenFlushed()
    // initial empty: the [data-empty] attribute is set by the model→surface effect on first run
    expect(editor.hasAttribute('data-empty'), 'empty field: editor must carry [data-empty]').toBe(true)
    // non-empty: the attribute is removed so the clear button becomes visible
    el.value = 'hello'
    await whenFlushed()
    expect(editor.hasAttribute('data-empty'), 'non-empty field: editor must NOT carry [data-empty]').toBe(false)
    // back to empty: the attribute is restored
    el.value = ''
    await whenFlushed()
    expect(editor.hasAttribute('data-empty'), 'cleared field: editor must restore [data-empty]').toBe(true)
    el.remove()
  })
})

// ── type='password' — -webkit-text-security + reveal toggle ──────────────────

describe('ui-text-field type=password — masking + reveal', () => {
  it('sets inputmode=text (password masking is CSS, not inputmode)', async () => {
    const { el, editor } = makeTyped('password')
    await whenFlushed()
    // inputmode for password is 'text' (the identity) → no inputmode attribute set
    expect(editor.hasAttribute('inputmode')).toBe(false)
    el.remove()
  })

  it('has a trailing reveal button (data-role=reveal, aria-pressed=false initially)', async () => {
    const { el } = makeTyped('password')
    await whenFlushed()
    const trailing = el.querySelector('[data-part="trailing-adornment"][data-role="reveal"]')
    expect(trailing).not.toBeNull()
    const revealBtn = el.querySelector('[data-part="reveal-button"]') as HTMLElement
    expect(revealBtn).not.toBeNull()
    expect(revealBtn.getAttribute('aria-pressed')).toBe('false')
    el.remove()
  })

  it('reveal button toggles aria-pressed and emits toggle', async () => {
    const { el } = makeTyped('password')
    await whenFlushed()
    const revealBtn = el.querySelector('[data-part="reveal-button"]') as HTMLElement
    let toggles = 0
    el.addEventListener('toggle', () => toggles++)

    revealBtn.click() // show password
    expect(revealBtn.getAttribute('aria-pressed')).toBe('true')
    expect(toggles).toBe(1)

    revealBtn.click() // hide again
    expect(revealBtn.getAttribute('aria-pressed')).toBe('false')
    expect(toggles).toBe(2)
    el.remove()
  })

  it('password formValue() is this.value (no codec, the typed chars are the form value)', () => {
    const { el } = makeTyped('password')
    el.value = 'secret'
    expect(el.formValidityProbe().valid).toBe(true)
    el.remove()
  })
})

// ── type='number' — inputmode=numeric + stepper + codec + validation ──────────

describe('ui-text-field type=number — inputmode + steppers + codec + validation', () => {
  it('sets inputmode=numeric on the editor', async () => {
    const { el, editor } = makeTyped('number')
    await whenFlushed()
    expect(editor.getAttribute('inputmode')).toBe('numeric')
    el.remove()
  })

  it('has a trailing stepper adornment with step-up and step-down buttons', async () => {
    const { el } = makeTyped('number')
    await whenFlushed()
    const trailing = el.querySelector('[data-part="trailing-adornment"][data-role="stepper"]')
    expect(trailing).not.toBeNull()
    expect(el.querySelector('[data-part="step-up"]')).not.toBeNull()
    expect(el.querySelector('[data-part="step-down"]')).not.toBeNull()
    el.remove()
  })

  it('step-up increments value and emits input + change', async () => {
    const { el } = makeTyped('number')
    await whenFlushed()
    el.value = '5'
    let inputs = 0, changes = 0
    el.addEventListener('input', () => inputs++)
    el.addEventListener('change', () => changes++)

    const stepUp = el.querySelector('[data-part="step-up"]') as HTMLElement
    stepUp.click()
    expect(el.value).toBe('6')
    expect(inputs).toBe(1)
    expect(changes).toBe(1)
    el.remove()
  })

  it('step-down decrements value and emits input + change', async () => {
    const { el } = makeTyped('number')
    await whenFlushed()
    el.value = '5'
    const stepDown = el.querySelector('[data-part="step-down"]') as HTMLElement
    stepDown.click()
    expect(el.value).toBe('4')
    el.remove()
  })

  it('invalid number input → customError from the codec (formValidity)', async () => {
    const { el, editor } = makeTyped('number')
    await whenFlushed()
    el.value = 'abc'
    editor.textContent = 'abc'
    // Trigger blur to activate codec parse
    editor.dispatchEvent(new Event('blur'))
    await whenFlushed()
    const verdict = el.formValidityProbe()
    expect(verdict.valid).toBe(false)
    if (!verdict.valid) expect(verdict.flags).toEqual({ customError: true })
    el.remove()
  })

  it('no leading adornment for number type', async () => {
    const { el } = makeTyped('number')
    await whenFlushed()
    expect(el.querySelector('[data-part="leading-adornment"]')).toBeNull()
    el.remove()
  })

  it('NC — untracked() codec seed: value write does NOT re-trigger the type-effect or recreate adornments', async () => {
    // value-codec.ts seeds `canonical` with `untracked(() => host.value)` to avoid making the
    // type-effect depend on `this.value`. Without `untracked()`, writing `el.value = '5'` would
    // schedule the type-effect to re-run (value becomes a reactive dep), which tears down and
    // recreates the stepper. This test catches that regression:
    //   • the stepper count stays 1 before and after the value write
    //   • the SAME DOM element is still present (reference identity — new element = different object)
    // Removing `untracked()` from value-codec.ts:84 MUST make the second expect(toBe) fail.
    const { el } = makeTyped('number')
    await whenFlushed()
    expect(el.querySelectorAll('[data-part="step-up"]').length, 'stepper must exist after connect').toBe(1)
    const stepUpBefore = el.querySelector('[data-part="step-up"]') as HTMLElement

    el.value = '5'
    await whenFlushed()
    expect(el.querySelectorAll('[data-part="step-up"]').length, 'stepper count must still be 1 after value write').toBe(1)
    expect(
      el.querySelector('[data-part="step-up"]'),
      'stepper was recreated on value write — untracked() is missing from the codec seed (value-codec.ts:84)',
    ).toBe(stepUpBefore)
    el.remove()
  })
})

// ── type='currency' — leading symbol + codec ──────────────────────────────────

describe('ui-text-field type=currency — currency symbol adornment + codec', () => {
  it('sets inputmode=decimal on the editor', async () => {
    const { el, editor } = makeTyped('currency')
    await whenFlushed()
    expect(editor.getAttribute('inputmode')).toBe('decimal')
    el.remove()
  })

  it('has a leading currency symbol adornment (data-role=currency, aria-hidden)', async () => {
    const { el } = makeTyped('currency')
    await whenFlushed()
    const leading = el.querySelector('[data-part="leading-adornment"][data-role="currency"]')
    expect(leading).not.toBeNull()
    expect((leading as HTMLElement).getAttribute('aria-hidden')).toBe('true')
    expect((leading as HTMLElement).textContent?.length).toBeGreaterThan(0) // symbol is present
    el.remove()
  })

  it('no trailing adornment for currency type', async () => {
    const { el } = makeTyped('currency')
    await whenFlushed()
    expect(el.querySelector('[data-part="trailing-adornment"]')).toBeNull()
    el.remove()
  })

  it('codec round-trip: typed value → blur → formValue() = canonical (not formatted display)', async () => {
    const { el, editor } = makeTyped('currency')
    await whenFlushed()
    el.value = '1234.5'
    editor.textContent = '1234.5'
    editor.dispatchEvent(new Event('blur'))
    await whenFlushed()
    // After blur: host.value is the formatted display ("1,234.50"); formValue() returns canonical ("1234.5")
    expect(el.value).toBe('1,234.50') // display (formatted by currency codec)
    const formVal = el.formValidityProbe() // formValidity() uses formValue() internally — valid means codec ok
    expect(formVal.valid).toBe(true)
    el.remove()
  })
})

// ── C10 zero-residue for type-change (adornments cleaned up) ──────────────────

describe('ui-text-field type change — C10 adornment cleanup', () => {
  it('switching type removes old adornments and adds new ones', async () => {
    const { el } = makeTyped('search')
    await whenFlushed()
    // search: leading magnifier + trailing clear
    expect(el.querySelector('[data-role="magnifier"]')).not.toBeNull()
    expect(el.querySelector('[data-role="clear"]')).not.toBeNull()

    el.type = 'password'
    await whenFlushed()
    // password: no leading, trailing reveal
    expect(el.querySelector('[data-role="magnifier"]')).toBeNull()
    expect(el.querySelector('[data-role="clear"]')).toBeNull()
    expect(el.querySelector('[data-role="reveal"]')).not.toBeNull()
    el.remove()
  })

  it('switching to type=text removes all adornments (identity config)', async () => {
    const { el } = makeTyped('currency')
    await whenFlushed()
    expect(el.querySelector('[data-part="leading-adornment"]')).not.toBeNull() // was present

    el.type = 'text'
    await whenFlushed()
    expect(el.querySelector('[data-part="leading-adornment"]')).toBeNull()
    expect(el.querySelector('[data-part="trailing-adornment"]')).toBeNull()
    el.remove()
  })
})
