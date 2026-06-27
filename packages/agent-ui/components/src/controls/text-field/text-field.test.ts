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
  it('upgrades to the class with the 8 props at their defaults (no connect → no form-internals throw)', () => {
    const el = document.createElement('ui-text-field') as UITextFieldElement
    expect(el).toBeInstanceOf(UITextFieldElement)
    expect(el.value).toBe('')
    expect(el.label).toBe('')
    expect(el.placeholder).toBe('')
    expect(el.size).toBe('md')
    expect(el.readonly).toBe(false)
    expect(el.name).toBe('')
    expect(el.disabled).toBe(false)
    expect(el.required).toBe(false)
  })

  it('tf-typed: size is the literal union, not string (compile-time negative control)', () => {
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
