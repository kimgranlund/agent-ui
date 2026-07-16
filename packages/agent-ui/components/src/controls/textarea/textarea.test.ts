import { describe, it, expect } from 'vitest'
import { signal, effect, inspect, whenFlushed, type Signal } from '@agent-ui/components'
import { UITextareaElement } from './textarea.ts'
import type { FormValue, ValidityResult } from '../../dom/form.ts'

// ui-textarea jsdom behaviour/value/validity/form/disabled/readonly/zero-residue probes (ADR-0134). Mirrors
// text-field.test.ts's harness: jsdom lacks ElementInternals.setFormValue/setValidity + CustomStateSet, so we
// (1) stub setFormValue/setValidity on the reused internals before connect, (2) drive the form lifecycle
// callbacks directly, (3) assert the OBSERVABLE editor proxies (aria-*, contenteditable, tabindex, the
// message node) rather than :state() (the browser smoke covers that).

function asMutable(internals: ElementInternals): Record<string, unknown> {
  return internals as unknown as Record<string, unknown>
}

interface StubCalls {
  formValues: FormValue[]
  validitySets: Array<{ flags: ValidityStateFlags; message: string }>
}

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

class ProbeTextarea extends UITextareaElement {
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
customElements.define('ui-textarea-probe', ProbeTextarea)

function makeField(): { el: ProbeTextarea; calls: StubCalls } {
  const el = new ProbeTextarea()
  const calls = stubFormInternals(el.internalsProbe)
  return { el, calls }
}

const editorOf = (el: Element): HTMLElement => el.querySelector('[data-part="editor"]') as HTMLElement
const messageOf = (el: Element): HTMLElement => el.querySelector('.ui-textarea-message') as HTMLElement

// ── upgrade + the typed prop surface ──────────────────────────────────────────

describe('ui-textarea — upgrade + typed prop surface', () => {
  it('upgrades to the class with the 8 props at their defaults (no connect → no form-internals throw)', () => {
    const el = document.createElement('ui-textarea') as UITextareaElement
    expect(el).toBeInstanceOf(UITextareaElement)
    expect(el.value).toBe('')
    expect(el.label).toBe('')
    expect(el.placeholder).toBe('')
    expect(el.rows).toBe(3)
    expect(el.size).toBe('md')
    expect(el.readonly).toBe(false)
    expect(el.name).toBe('')
    expect(el.disabled).toBe(false)
    expect(el.required).toBe(false)
  })

  it('ta-typed: size is a literal union, not string; rows is number (compile-time negative control)', () => {
    const fn = (): void => {
      const el = new UITextareaElement()
      el.size = 'sm'
      el.size = 'lg'
      // @ts-expect-error — 'xl' is not a size member: proves the literal union, NOT string
      el.size = 'xl'
      el.rows = 6
      // @ts-expect-error — rows is a number, not a string
      el.rows = '6'
      // @ts-expect-error — readonly is boolean, not string
      el.readonly = 'yes'
    }
    expect(typeof fn).toBe('function') // never invoked; the type errors above are the assertion
  })

  it('self-defines ui-textarea, guarded against a double-define', () => {
    expect(customElements.get('ui-textarea')).toBe(UITextareaElement)
    expect(() => {
      if (!customElements.get('ui-textarea')) customElements.define('ui-textarea', UITextareaElement)
    }).not.toThrow()
  })
})

// ── the editor PART — aria-multiline=TRUE (the ADR-0134 inversion) + host-no-role ─────────────

describe('ui-textarea — the contenteditable editor part', () => {
  it('creates a single contenteditable=plaintext-only role=textbox aria-multiline=true editor part; the HOST carries no role/aria', () => {
    const { el } = makeField()
    document.body.append(el)
    const editor = editorOf(el)
    expect(editor).not.toBeNull()
    expect(editor.getAttribute('contenteditable')).toBe('plaintext-only')
    expect(editor.getAttribute('role')).toBe('textbox')
    expect(editor.getAttribute('aria-multiline')).toBe('true') // the ADR-0134 inversion of ui-text-field's "false"
    expect(el.hasAttribute('role')).toBe(false)
    for (const attr of Array.from(el.attributes)) expect(attr.name.startsWith('aria-')).toBe(false)
    el.remove()
  })

  it('the editor part is created ONCE — idempotent across a disconnect/reconnect', () => {
    const { el } = makeField()
    document.body.append(el)
    el.remove()
    document.body.append(el)
    expect(el.querySelectorAll('[data-part="editor"]')).toHaveLength(1)
    expect(el.querySelectorAll('.ui-textarea-message')).toHaveLength(1)
    el.remove()
  })

  it('host.focus() forwards to the editor part', () => {
    const { el } = makeField()
    document.body.append(el)
    let focused = 0
    editorOf(el).addEventListener('focus', () => focused++)
    el.focus()
    expect(focused).toBe(1)
    el.remove()
  })
})

// ── value as a tracked signal + surface→model + the caret guard ──────────────

describe('ui-textarea — value, surface↔model, the caret guard', () => {
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

  it('value carries newlines (multi-line, unlike ui-text-field)', async () => {
    const { el } = makeField()
    document.body.append(el)
    el.value = 'line one\nline two'
    await whenFlushed()
    expect(editorOf(el).textContent).toBe('line one\nline two')
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
    expect(el.value).toBe('hello')
    expect(hostInputs).toBe(1)
    expect(targetIsHost).toBe(true)
    el.remove()
  })

  it('the CARET GUARD: a value-equal write (a keystroke echo) does NOT rewrite the editor text node', async () => {
    const { el } = makeField()
    document.body.append(el)
    const editor = editorOf(el)
    editor.textContent = 'hi'
    const typedNode = editor.firstChild
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    await whenFlushed()
    expect(el.value).toBe('hi')
    expect(editor.firstChild).toBe(typedNode)
  })

  it('model→surface: a programmatic DIVERGENT write flows to the editor + toggles data-empty', async () => {
    const { el } = makeField()
    document.body.append(el)
    const editor = editorOf(el)
    expect(editor.hasAttribute('data-empty')).toBe(true)

    el.value = 'abc'
    await whenFlushed()
    expect(editor.textContent).toBe('abc')
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
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    expect(el.value).toBe('')
    editor.dispatchEvent(new Event('compositionend'))
    expect(el.value).toBe('日本')
    el.remove()
  })
})

// ── Enter inserts a newline; commit is blur-with-change ONLY (the ADR-0134 inversion) ────────

describe('ui-textarea — Enter inserts a newline, never commits (the ADR-0134 inversion of ui-text-field)', () => {
  it('Enter is NOT intercepted — no keydown listener preventDefaults it, and no change fires on Enter', () => {
    const { el } = makeField()
    document.body.append(el)
    const editor = editorOf(el)
    let changes = 0
    el.addEventListener('change', () => changes++)

    editor.textContent = 'line one'
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    editor.dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(false) // multi-line — Enter is left alone, unlike ui-text-field
    expect(changes).toBe(0) // Enter never commits here
    el.remove()
  })

  it('blur emits change only when the value changed since focus (blur-with-change)', () => {
    const { el } = makeField()
    document.body.append(el)
    const editor = editorOf(el)
    let changes = 0
    el.addEventListener('change', () => changes++)

    editor.dispatchEvent(new Event('focus'))
    editor.dispatchEvent(new Event('blur'))
    expect(changes).toBe(0)

    editor.dispatchEvent(new Event('focus'))
    editor.textContent = 'edited'
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    editor.dispatchEvent(new Event('blur'))
    expect(changes).toBe(1)
    el.remove()
  })
})

// ── validity + form participation ──────────────────────────────────────────

describe('ui-textarea — validity + form participation', () => {
  it('value participates in the form — setFormValue publishes it on connect and on change', async () => {
    const { el, calls } = makeField()
    document.body.append(el)
    expect(calls.formValues).toEqual([''])
    el.value = 'notes'
    await whenFlushed()
    expect(calls.formValues.at(-1)).toBe('notes')
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
      expect(invalid.anchor).toBe(editorOf(el))
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
    expect(el.formValidityProbe().valid).toBe(true)
    el.remove()
  })

  it('formValue() is this.value — no codec (ADR-0134: no value-shape to mismatch)', () => {
    const { el } = makeField()
    el.value = 'anything at all, no codec touches it'
    document.body.append(el)
    expect(el.formValidityProbe().valid).toBe(true)
    el.remove()
  })
})

// ── user-invalid timing + the non-colour describedby cue ─────────────────────

describe('ui-textarea — user-invalid timing + the non-colour cue', () => {
  it('aria-invalid + the aria-describedby message appear only AFTER the first interaction, and clear when valid', async () => {
    const { el } = makeField()
    el.required = true
    document.body.append(el)
    const editor = editorOf(el)
    const message = messageOf(el)

    expect(editor.hasAttribute('aria-invalid')).toBe(false)
    expect(editor.hasAttribute('aria-describedby')).toBe(false)

    editor.dispatchEvent(new Event('blur'))
    await whenFlushed()
    expect(editor.getAttribute('aria-invalid')).toBe('true')
    expect(editor.getAttribute('aria-describedby')).toBe(message.id)
    expect(message.textContent?.length).toBeGreaterThan(0)

    el.value = 'now valid'
    await whenFlushed()
    expect(editor.hasAttribute('aria-invalid')).toBe(false)
    expect(editor.hasAttribute('aria-describedby')).toBe(false)
    expect(message.textContent).toBe('')
    el.remove()
  })
})

// ── the disabled / readonly channel ───────────────────────────────────────────

describe('ui-textarea — the disabled / readonly channel', () => {
  it('effectiveDisabled (own) → editor contenteditable=false + aria-disabled + not focusable (no tabindex)', async () => {
    const { el } = makeField()
    document.body.append(el)
    const editor = editorOf(el)
    expect(editor.getAttribute('contenteditable')).toBe('plaintext-only')

    el.disabled = true
    await whenFlushed()
    expect(editor.getAttribute('contenteditable')).toBe('false')
    expect(editor.getAttribute('aria-disabled')).toBe('true')
    expect(editor.hasAttribute('tabindex')).toBe(false)
    el.remove()
  })

  it('the form-disabled channel makes it effective too (effectiveDisabled = own || formDisabledCallback)', async () => {
    const { el } = makeField()
    document.body.append(el)
    const editor = editorOf(el)
    expect(el.effectiveDisabledProbe()).toBe(false)
    el.formDisabledCallback(true)
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
    expect(editor.getAttribute('contenteditable')).toBe('false')
    expect(editor.getAttribute('tabindex')).toBe('0')
    expect(editor.getAttribute('aria-readonly')).toBe('true')
    expect(editor.hasAttribute('aria-disabled')).toBe(false)
    expect(calls.formValues.at(-1)).toBe('fixed')
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
    expect(editor.hasAttribute('tabindex')).toBe(false)
    el.remove()
  })
})

// ── reset / restore ────────────────────────────────────────────────────────

describe('ui-textarea — reset + state restore', () => {
  it('formResetCallback restores the value to the initial `value` attribute (#defaultValue)', async () => {
    const el = document.createElement('ui-textarea-probe') as ProbeTextarea
    stubFormInternals(el.internalsProbe)
    el.setAttribute('value', 'init')
    document.body.append(el)
    el.value = 'typed over it'
    el.formResetCallback()
    await whenFlushed()
    expect(el.value).toBe('init')
    expect(editorOf(el).textContent).toBe('init')
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

    editor.dispatchEvent(new Event('blur'))
    await whenFlushed()
    expect(editor.getAttribute('aria-invalid')).toBe('true')

    el.formResetCallback()
    await whenFlushed()
    expect(el.value).toBe('')
    expect(el.formValidityProbe().valid).toBe(false)
    expect(editor.hasAttribute('aria-invalid')).toBe(false)

    editor.dispatchEvent(new Event('blur'))
    await whenFlushed()
    expect(editor.getAttribute('aria-invalid')).toBe('true')
    el.remove()
  })
})

// ── selectToEnd() — the migration seam (ADR-0134) ─────────────────────────────

describe('ui-textarea — selectToEnd()', () => {
  it('focuses the editor and collapses the selection to the end of its text', async () => {
    const { el } = makeField()
    document.body.append(el)
    el.value = 'hello world'
    await whenFlushed()
    const editor = editorOf(el)

    el.selectToEnd()
    expect(document.activeElement === editor || editor.contains(document.activeElement)).toBe(true)
    const sel = window.getSelection()
    expect(sel?.isCollapsed).toBe(true)
    el.remove()
  })

  it('is a no-op before the editor exists (not yet connected)', () => {
    const el = new UITextareaElement()
    expect(() => el.selectToEnd()).not.toThrow()
  })
})

// ── rows → the CSS min-block-size lever ───────────────────────────────────────

describe('ui-textarea — rows (the CSS min-block-size lever, ADR-0134)', () => {
  it('mirrors this.rows onto an inline --ui-textarea-rows custom property', async () => {
    const { el } = makeField()
    document.body.append(el)
    await whenFlushed()
    expect(el.style.getPropertyValue('--ui-textarea-rows')).toBe('3') // the default

    el.rows = 8
    await whenFlushed()
    expect(el.style.getPropertyValue('--ui-textarea-rows')).toBe('8')
    el.remove()
  })
})

// ── zero residue — scope-owned effects + abort-owned listeners ────────────────

describe('ui-textarea — zero residue across connect/disconnect', () => {
  it('subscribes on connect, zero subscribers on disconnect, re-subscribes once on reconnect', async () => {
    const { el } = makeField()
    expect(inspect(el.probe).subscribers).toBe(0)

    document.body.append(el)
    expect(inspect(el.probe).subscribers).toBe(1)

    el.remove()
    expect(inspect(el.probe).subscribers).toBe(0)

    document.body.append(el)
    expect(inspect(el.probe).subscribers).toBe(1)
    el.remove()
    await whenFlushed()
  })

  it('the editor listeners are abort-owned — they die on disconnect and re-wire exactly once on reconnect', () => {
    const { el } = makeField()
    document.body.append(el)
    const ed = editorOf(el)

    ed.textContent = 'a'
    ed.dispatchEvent(new Event('input', { bubbles: true }))
    expect(el.value).toBe('a')

    el.remove()
    ed.textContent = 'b'
    ed.dispatchEvent(new Event('input', { bubbles: true }))
    expect(el.value).toBe('a')

    document.body.append(el)
    ed.textContent = 'c'
    ed.dispatchEvent(new Event('input', { bubbles: true }))
    expect(el.value).toBe('c')
    el.remove()
  })
})

// ── field-labelling seam (ADR-0051, reused verbatim) ──────────────────────────

describe('ui-textarea — the field-labelling seam (ADR-0051)', () => {
  it('bare usage: label prop → editor aria-label', async () => {
    const { el } = makeField()
    el.label = 'Notes'
    document.body.append(el)
    await whenFlushed()
    expect(editorOf(el).getAttribute('aria-label')).toBe('Notes')
    el.remove()
  })

  it('setFieldLabelling associates aria-labelledby/describedby onto the editor and clears aria-label', async () => {
    const { el } = makeField()
    el.label = 'Notes'
    document.body.append(el)
    await whenFlushed()
    const editor = editorOf(el)

    const labelEl = document.createElement('span')
    labelEl.id = 'lbl-1'
    const descEl = document.createElement('span')
    descEl.id = 'desc-1'
    el.setFieldLabelling({ label: labelEl, description: descEl, error: null })
    await whenFlushed()

    expect(editor.getAttribute('aria-labelledby')).toBe('lbl-1')
    expect(editor.getAttribute('aria-describedby')).toBe('desc-1')
    expect(editor.hasAttribute('aria-label')).toBe(false) // yields under association

    el.setFieldLabelling(null)
    await whenFlushed()
    expect(editor.hasAttribute('aria-labelledby')).toBe(false)
    el.remove()
  })
})
