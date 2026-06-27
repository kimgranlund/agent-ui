import { describe, it, expect, afterEach } from 'vitest'
import { UIFormElement, prop } from '@agent-ui/components'
import type { FormValue, ValidityResult, PropsSchema } from '@agent-ui/components'

// s3 — the G4 INTEGRATION PROOF (decomp g4-g6 node s3, the BROWSER leg). The jsdom form.test.ts STUBS the
// whole form-association surface (jsdom has no `setFormValue`/`setValidity`, never auto-invokes the lifecycle
// callbacks). This file proves the SAME UIFormElement against a REAL engine where that surface is native: a
// throwaway form-associated subclass, mounted inside a real `<form>`, actually contributes its value to the
// form's `FormData` on submit, has its value restored by `form.reset()`, and reports real platform validity.
//
// It runs in BOTH Chromium and WebKit (vitest.browser.config.ts → the two playwright instances). This is also
// where NAME-REFLECT is empirically confirmed (task #70): FACE submission keys the entry by the `name` CONTENT
// attribute, so a `el.name = …` PROPERTY write must reflect to the attribute or the value submits unkeyed —
// the only way to prove that is a real form's real submission algorithm, here.
//
// No CSS/geometry — UIFormElement is CSS-agnostic (the field FRAME is the control's, s11). The package barrel
// is the only import; the throwaway self-defines below.

// ── the throwaway form-associated subclass (spreads formProps + a string `value`) ──────────────────────
// Mirrors the jsdom form.test.ts FieldEl, minus the stub plumbing (the real engine supplies it). It owns a
// typed string `value`, publishes it as its form value, validates `required && empty → valueMissing`, and
// restores its captured initial-attribute defaultValue on reset (native `defaultValue` parity).
interface ProofField {
  value: string
}
class ProofField extends UIFormElement {
  static props = { ...UIFormElement.formProps, value: prop.string() } satisfies PropsSchema

  // The native-parity reset baseline — captured ONCE from the initial `value` attribute (never reflected, so
  // it survives later property writes), exactly as the real text-field seeds its #defaultValue.
  #default = ''
  #captured = false

  protected connected(): void {
    if (!this.#captured) {
      this.#default = this.getAttribute('value') ?? ''
      this.#captured = true
    }
  }

  protected formValue(): FormValue {
    return this.value
  }
  protected formValidity(): ValidityResult {
    return this.required && this.value === ''
      ? { valid: false, flags: { valueMissing: true }, message: 'Please fill out this field.' }
      : { valid: true }
  }
  protected formReset(): void {
    this.value = this.#default
  }
}
if (!customElements.get('ui-form-proof')) customElements.define('ui-form-proof', ProofField)

// ── mount/cleanup — each case builds a real <form> imperatively so `name` is set with precision ─────────
const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

/**
 * Build a real connected `<form>` holding one ProofField, returning both. Optional initial attributes are set
 * on the field BEFORE it connects, so `value` seeds the native-parity reset baseline (connected() captures it).
 */
const mountForm = (attrs: Record<string, string> = {}): { form: HTMLFormElement; el: ProofField } => {
  const form = document.createElement('form')
  const el = document.createElement('ui-form-proof') as ProofField
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  form.append(el)
  document.body.append(form) // connects the field (connected() captures its defaultValue from the value attr)
  mounted.push(form)
  return { form, el }
}

/** Submit the form through the REAL submission path (requestSubmit fires `submit`), capturing the FormData. */
const submitAndCollect = (form: HTMLFormElement): FormData => {
  let data: FormData | null = null
  form.addEventListener(
    'submit',
    (event) => {
      event.preventDefault() // no navigation — we only want the collected entries
      data = new FormData(form)
    },
    { once: true },
  )
  form.requestSubmit() // fires `submit` synchronously after interactive validation
  if (data === null) throw new Error('the form did not submit (was the field invalid?)')
  return data
}

describe('UIFormElement — the G4 form round-trip proof (s3, both engines)', () => {
  it('a form-associated value contributes to the form FormData on submit, keyed by the [name] attribute', async () => {
    const { form, el } = mountForm()
    el.setAttribute('name', 'email') // the submission key, via the content attribute
    el.value = 'alice@example.com'
    await el.updateComplete // let the base's scope-owned setFormValue effect publish the value to internals

    const data = submitAndCollect(form)
    expect(data.get('email'), 'the form value did not reach FormData keyed by [name]').toBe('alice@example.com')
    // anti-vacuous: the entry is keyed by `name`, not contributed unkeyed/under another key.
    expect([...data.keys()]).toEqual(['email'])
  })

  it('name set via the PROPERTY reflects to the attribute AND keys FormData (the empirical name-reflect proof)', async () => {
    const { form, el } = mountForm()
    // PROPERTY write only — no setAttribute. FACE submission keys by the CONTENT attribute, so this only works
    // if `name` reflects (formProps name.reflect=true). The reflect is what this leg proves end-to-end.
    el.name = 'token'
    expect(el.getAttribute('name'), 'el.name = … did not reflect to the name attribute').toBe('token')

    el.value = 'xyz'
    await el.updateComplete
    const data = submitAndCollect(form)
    expect(data.get('token'), 'the property-set name did not key the submitted FormData entry').toBe('xyz')
    expect([...data.keys()]).toEqual(['token'])
  })

  it('an UNNAMED form-associated control contributes NO entry (the name-keying is load-bearing)', async () => {
    const { form, el } = mountForm()
    el.value = 'orphan' // no name set
    await el.updateComplete
    const data = submitAndCollect(form)
    expect([...data.keys()], 'an unnamed control leaked an entry into FormData').toEqual([])
  })

  it('form.reset() restores the value to its initial-attribute defaultValue (native parity, via the base hook)', async () => {
    const { form, el } = mountForm({ name: 'q', value: 'seed' }) // defaultValue captured as 'seed' on connect
    el.value = 'changed'
    await el.updateComplete
    expect(el.value).toBe('changed')

    form.reset() // platform → formResetCallback → formReset() hook → value ← defaultValue
    expect(el.value, 'form.reset() did not restore the defaultValue via the base formReset hook').toBe('seed')

    // and the restored value re-publishes to the form (the setFormValue effect re-ran on the value change).
    await el.updateComplete
    expect(submitAndCollect(form).get('q')).toBe('seed')
  })

  it('a real platform internals reports validity — required+empty → valueMissing, willValidate, reportValidity', async () => {
    const { el } = mountForm()
    el.setAttribute('name', 'required-field')
    el.required = true // required && value === '' → invalid (the base publishes it to internals.setValidity)
    await el.updateComplete

    // the REAL platform ValidityState (our IDL getter delegates to internals.validity).
    expect(el.willValidate, 'an enabled required field should be a validation candidate').toBe(true)
    expect(el.validity.valueMissing, 'required+empty did not report valueMissing').toBe(true)
    expect(el.validity.valid, 'required+empty reported valid').toBe(false)
    expect(el.checkValidity(), 'checkValidity passed an invalid field').toBe(false)
    expect(el.reportValidity(), 'reportValidity passed an invalid field').toBe(false)
    expect(el.validationMessage.length, 'no validation message on an invalid field').toBeGreaterThan(0)

    // fill it → the validity effect re-runs → the platform clears the validity.
    el.value = 'present'
    await el.updateComplete
    expect(el.validity.valueMissing, 'filling did not clear valueMissing').toBe(false)
    expect(el.validity.valid, 'a filled required field is still invalid').toBe(true)
    expect(el.checkValidity(), 'checkValidity failed a valid field').toBe(true)
  })

  it('a required+empty field BLOCKS form submission (real interactive validation gates the submit)', async () => {
    const { form, el } = mountForm()
    el.setAttribute('name', 'blocker')
    el.required = true // invalid
    await el.updateComplete // let the base's validity effect publish valueMissing to internals BEFORE submitting

    let submitted = false
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      submitted = true
    })
    form.requestSubmit()
    // the platform's interactive validation barred the submit — the `submit` listener never fired.
    expect(submitted, 'an invalid required field did not block submission').toBe(false)
  })
})
