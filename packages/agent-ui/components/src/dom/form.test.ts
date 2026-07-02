import { describe, it, expect } from 'vitest'
import { signal, effect, inspect, whenFlushed, type Signal } from '@agent-ui/components'
import { prop, type PropsSchema } from '@agent-ui/components'
import { UIFormElement, FORM_CONNECT_EVENT, type FormValue, type ValidityResult, type FormConnectDetail } from './form.ts'
import { UIElement } from './element.ts'

// s1 — UIFormElement, the FACE form-associated base (ADR-0013). jsdom reality (verified before writing):
// `attachInternals()` works (+ the second-call throw, e-internals), but the form-association surface is
// ENTIRELY absent — `setFormValue`/`setValidity`/`form`/`validity`/`validationMessage`/`willValidate` are
// undefined and the platform NEVER auto-invokes the form lifecycle callbacks. So we (1) STUB that surface on
// the reused internals before connect (form effects call it on connect), and (2) drive the lifecycle
// callbacks DIRECTLY (their platform invocation is the s3 browser proof, out of scope here). The probes cover
// each of the six ADR-0013 clauses: form-associated + internals reused (1) · the spreadable formProps (2) ·
// the value/validity hooks → setFormValue/setValidity (3+4) · the lifecycle callbacks → hooks + effectiveDisabled
// (5) · the IDL delegators (6) — plus zero residue, the preserved no-`super` connected() hook, and a negative
// control (an always-valid subclass never sets an invalid validity).

// ── the form-association stub (jsdom lacks the whole surface) ──────────────────

interface StubCalls {
  formValues: FormValue[]
  validitySets: Array<{ flags: ValidityStateFlags; message: string; anchor: HTMLElement | undefined }>
}

/** A mutable view of the (jsdom-partial) internals — its form-association members are absent, so assignable. */
function asMutable(internals: ElementInternals): Record<string, unknown> {
  return internals as unknown as Record<string, unknown>
}

/** Patch `setFormValue`/`setValidity` onto the reused internals, recording every call for assertion. */
function stubFormInternals(internals: ElementInternals): StubCalls {
  const calls: StubCalls = { formValues: [], validitySets: [] }
  const i = asMutable(internals)
  i.setFormValue = (value: FormValue): void => {
    calls.formValues.push(value)
  }
  i.setValidity = (flags: ValidityStateFlags, message?: string, anchor?: HTMLElement): void => {
    calls.validitySets.push({ flags, message: message ?? '', anchor })
  }
  return calls
}

// ── the primary throwaway subclass (spreads formProps + a string `value`) ─────

interface FieldEl {
  value: string
}
class FieldEl extends UIFormElement {
  static props = { ...UIFormElement.formProps, value: prop.string() } satisfies PropsSchema

  // A test-owned signal `formValue()` reads — an INSPECTABLE subscription proving the setFormValue effect is
  // scope-owned (its only subscriber, so the count is exactly the effect's presence).
  readonly probe: Signal<number> = signal(0)
  defaultValue = 'init'
  resetCalls = 0
  restoreCalls = 0
  associatedForms: Array<HTMLFormElement | null> = []

  protected formValue(): FormValue {
    void this.probe.value
    return this.value
  }
  protected formValidity(): ValidityResult {
    return this.required && this.value === ''
      ? { valid: false, flags: { valueMissing: true }, message: 'Required', anchor: this }
      : { valid: true }
  }
  protected formReset(): void {
    this.resetCalls++
    this.value = this.defaultValue
  }
  protected formStateRestore(state: File | string | FormData | null): void {
    this.restoreCalls++
    if (typeof state === 'string') this.value = state
  }
  protected formAssociated(form: HTMLFormElement | null): void {
    this.associatedForms.push(form)
  }
  // expose the protected seams for the probes
  get internalsProbe(): ElementInternals {
    return this.internals
  }
  effectiveDisabledProbe(): boolean {
    return this.effectiveDisabled()
  }
}
customElements.define('ui-form-field', FieldEl)

function makeField(): { el: FieldEl; calls: StubCalls } {
  const el = new FieldEl()
  const calls = stubFormInternals(el.internalsProbe)
  return { el, calls }
}

// ── a subclass that overrides connected() WITHOUT super (the clean hook) ──────

interface HookFieldEl {
  value: string
}
class HookFieldEl extends UIFormElement {
  static props = { ...UIFormElement.formProps, value: prop.string() } satisfies PropsSchema
  connectedHookRan = 0
  hookEffectRuns = 0
  readonly sig: Signal<number> = signal(0)
  protected connected(): void {
    this.connectedHookRan++
    this.effect(() => {
      this.hookEffectRuns++
      void this.sig.value
    })
  }
  protected formValue(): FormValue {
    return this.value
  }
  get internalsProbe(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-form-hookfield', HookFieldEl)

// ── a subclass that never overrides the hooks (always valid — the negative control) ──

class AlwaysValidEl extends UIFormElement {
  get internalsProbe(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-form-alwaysvalid', AlwaysValidEl)

// ── a plain UIElement wrapper whose connected() races a descendant's OWN connectedCallback — the F1
// bulk-insert hazard (an s9 repro against the real ui-form-provider), reproduced here at the base layer:
// ancestors' connectedCallback fires before a descendant's, so a catch-up scan (querySelectorAll +
// announceFormConnect — the exact shape form-provider.ts's connected() uses) can reach a descendant that
// is already `isConnected` but has not yet run its OWN connectedCallback (connectionSignal still null). ──

class RaceWrapperEl extends UIElement {
  raceResults: Array<{ isConnected: boolean; threw: boolean }> = []
  protected connected(): void {
    for (const el of this.querySelectorAll('*')) {
      if (el instanceof UIFormElement) {
        let threw = false
        try {
          el.announceFormConnect()
        } catch {
          threw = true
        }
        this.raceResults.push({ isConnected: el.isConnected, threw })
      }
    }
  }
}
customElements.define('ui-form-race-wrapper', RaceWrapperEl)

// ── clause 1 — form-associated, internals reused (not re-acquired) ────────────

describe('clause 1 — form-associated + internals reused', () => {
  it('static formAssociated is true on the base and inherited by a subclass', () => {
    expect(UIFormElement.formAssociated).toBe(true)
    expect(FieldEl.formAssociated).toBe(true) // static inheritance
  })

  it('reuses the inherited single internals handle — a second attachInternals() throws', () => {
    const el = new FieldEl()
    expect(el.internalsProbe).toBe(el.internalsProbe) // the one stable handle
    expect(() => el.attachInternals()).toThrow() // re-acquisition forbidden → the base never re-acquired
  })
})

// ── clause 2 — the spreadable formProps (no static-props inheritance) ─────────

describe('clause 2 — the spreadable formProps', () => {
  it('owns exactly name/disabled/required, and NOT a typed value', () => {
    expect(Object.keys(UIFormElement.formProps)).toEqual(['name', 'disabled', 'required'])
    expect('value' in UIFormElement.formProps).toBe(false) // value belongs to the subclass
  })

  it('name/disabled/required all reflect (native parity + FACE submission keys by the name attribute)', () => {
    expect(UIFormElement.formProps.disabled.reflect).toBe(true)
    expect(UIFormElement.formProps.required.reflect).toBe(true)
    expect(UIFormElement.formProps.name.reflect).toBe(true)
  })

  it('a subclass folds them into its own static props alongside its typed value', () => {
    expect(Object.keys(FieldEl.props)).toEqual(['name', 'disabled', 'required', 'value'])
    // and finalize installed the reactive accessors (the spread is real, not just a type)
    const el = new FieldEl()
    el.value = 'x'
    el.disabled = true
    expect(el.value).toBe('x')
    expect(el.disabled).toBe(true)
    expect(el.hasAttribute('disabled')).toBe(true) // reflected
    expect(el.hasAttribute('value')).toBe(false) // value is not reflected
  })
})

// ── clauses 3+4 — formValue() → setFormValue, reactively ──────────────────────

describe('clauses 3+4 — formValue() published to internals.setFormValue', () => {
  it('publishes the value on connect and re-publishes (one call) when value changes', async () => {
    const { el, calls } = makeField()
    document.body.append(el)
    expect(calls.formValues).toEqual(['']) // the default value, published once on connect

    el.value = 'hello'
    await el.updateComplete // effects re-run on a microtask flush
    expect(calls.formValues).toEqual(['', 'hello']) // exactly one further setFormValue
    el.remove()
  })

  it('the default base formValue() contributes null', async () => {
    const el = new AlwaysValidEl()
    const calls = stubFormInternals(el.internalsProbe)
    document.body.append(el)
    expect(calls.formValues).toEqual([null])
    el.remove()
  })
})

// ── clauses 3+4 — formValidity() → setValidity (clear / flags+message+anchor) ─

describe('clauses 3+4 — formValidity() published to internals.setValidity', () => {
  it('clears validity when valid and sets flags+message+anchor when invalid, reactively', async () => {
    const { el, calls } = makeField()
    document.body.append(el)
    // required=false → valid → setValidity({}) (a clear)
    expect(calls.validitySets).toEqual([{ flags: {}, message: '', anchor: undefined }])

    el.required = true // now required && value==='' → invalid
    await el.updateComplete
    const last = calls.validitySets.at(-1)
    expect(last?.flags).toEqual({ valueMissing: true })
    expect(last?.message).toBe('Required')
    expect(last?.anchor).toBe(el) // the anchor element rides through

    el.value = 'filled' // valid again → cleared
    await el.updateComplete
    expect(calls.validitySets.at(-1)).toEqual({ flags: {}, message: '', anchor: undefined })
    el.remove()
  })

  it('negative control — an always-valid subclass NEVER sets an invalid validity', () => {
    const el = new AlwaysValidEl()
    const calls = stubFormInternals(el.internalsProbe)
    document.body.append(el)
    expect(calls.validitySets.length).toBeGreaterThan(0)
    for (const v of calls.validitySets) expect(Object.keys(v.flags)).toHaveLength(0) // only ever cleared
    el.remove()
  })
})

// ── clause 4 — super-wrapped wiring keeps the no-`super` connected() hook ─────

describe('clause 4 — the no-`super` connected() hook is preserved', () => {
  it('a subclass overriding connected() (no super) still runs its hook AND gets the form wiring', () => {
    const el = new HookFieldEl()
    const calls = stubFormInternals(el.internalsProbe)
    document.body.append(el)
    expect(el.connectedHookRan).toBe(1) // the clean no-super hook ran
    expect(el.hookEffectRuns).toBe(1) // the scope was live inside connected()
    expect(calls.formValues.length).toBeGreaterThan(0) // the base installed the form effect regardless
    el.remove()
  })
})

// ── clause 5 — formResetCallback → formReset() (value ← defaultValue) ─────────

describe('clause 5 — form lifecycle callbacks map to overridable hooks', () => {
  it('formResetCallback restores the value to defaultValue', () => {
    const el = new FieldEl()
    el.value = 'typed'
    el.formResetCallback()
    expect(el.resetCalls).toBe(1)
    expect(el.value).toBe('init') // ← defaultValue
  })

  it('formDisabledCallback drives a reactive effectiveDisabled = own || formDisabled', async () => {
    const el = new FieldEl()
    expect(el.effectiveDisabledProbe()).toBe(false)

    // reactive: a standalone effect re-runs when the fieldset-disabled signal flips
    const seen: boolean[] = []
    const dispose = effect(() => {
      seen.push(el.effectiveDisabledProbe())
    })
    expect(seen).toEqual([false])

    el.formDisabledCallback(true)
    await whenFlushed()
    expect(seen).toEqual([false, true]) // re-ran on the form-disabled change
    expect(el.effectiveDisabledProbe()).toBe(true)

    el.formDisabledCallback(false)
    el.disabled = true // the OWN channel also forces effectiveDisabled
    await whenFlushed()
    expect(el.effectiveDisabledProbe()).toBe(true)
    dispose()
  })

  it('formStateRestoreCallback forwards the state to formStateRestore()', () => {
    const el = new FieldEl()
    el.formStateRestoreCallback('saved', 'restore')
    expect(el.restoreCalls).toBe(1)
    expect(el.value).toBe('saved')
  })

  it('formAssociatedCallback forwards the form to the no-op hook', () => {
    const el = new FieldEl()
    const form = document.createElement('form')
    el.formAssociatedCallback(form)
    el.formAssociatedCallback(null)
    expect(el.associatedForms).toEqual([form, null])
  })
})

// ── clause 6 — the IDL delegators ─────────────────────────────────────────────

describe('clause 6 — IDL delegators read through internals', () => {
  it('form/validity/validationMessage/willValidate/checkValidity/reportValidity delegate to internals', () => {
    const el = new FieldEl()
    const i = asMutable(el.internalsProbe)
    const form = document.createElement('form')
    const validity = { valid: false, valueMissing: true } as unknown as ValidityState
    i.form = form
    i.validity = validity
    i.validationMessage = 'Required'
    i.willValidate = true
    i.checkValidity = (): boolean => true
    i.reportValidity = (): boolean => false

    expect(el.form).toBe(form)
    expect(el.validity).toBe(validity)
    expect(el.validationMessage).toBe('Required')
    expect(el.willValidate).toBe(true)
    expect(el.checkValidity()).toBe(true)
    expect(el.reportValidity()).toBe(false)
  })

  it('name is the reactive prop surface (internals has no name to delegate to)', () => {
    const { el } = makeField() // stub the form surface — connect runs the setFormValue effect
    el.setAttribute('name', 'email')
    document.body.append(el)
    expect(el.name).toBe('email') // the formProps `name` prop, read off the attribute
    el.remove()
  })
})

// ── setCustomValidity — the renderer-driven custom-validity seam (ADR-0029 §5) ──

describe('setCustomValidity — renderer-driven custom-validity seam (ADR-0029)', () => {
  it('setCustomValidity("x") → customError true + validationMessage "x"', async () => {
    const { el, calls } = makeField()
    document.body.append(el)
    el.setCustomValidity('Zip code is required')
    await el.updateComplete // effects re-run on a microtask flush
    const last = calls.validitySets.at(-1)
    expect(last?.flags).toEqual({ customError: true })
    expect(last?.message).toBe('Zip code is required')
    el.remove()
  })

  it("setCustomValidity('') clears the custom contribution — resolves to valid", async () => {
    const { el, calls } = makeField()
    document.body.append(el)
    el.setCustomValidity('some error')
    await el.updateComplete
    el.setCustomValidity('') // clear
    await el.updateComplete
    const last = calls.validitySets.at(-1)
    expect(last?.flags).toEqual({}) // valid clear
    el.remove()
  })

  it('native valueMissing wins over a custom message when both are non-empty', async () => {
    const { el, calls } = makeField()
    document.body.append(el)
    el.required = true // triggers valueMissing (value is '')
    el.setCustomValidity('custom message')
    await el.updateComplete
    const last = calls.validitySets.at(-1)
    expect(last?.flags).toEqual({ valueMissing: true }) // native wins
    expect(last?.message).toBe('Required')
    el.remove()
  })

  it('negative control — no setCustomValidity call: behaves identically to today', () => {
    const el = new AlwaysValidEl()
    const calls = stubFormInternals(el.internalsProbe)
    document.body.append(el)
    // No setCustomValidity call — only the initial clear should appear
    for (const v of calls.validitySets) expect(Object.keys(v.flags)).toHaveLength(0)
    el.remove()
  })
})

// ── zero residue — the form effects ride the connection scope ─────────────────

describe('zero residue — the form effects are scope-owned', () => {
  it('subscribes on connect, leaves zero subscribers on disconnect, re-subscribes on reconnect', async () => {
    const { el, calls } = makeField()
    expect(inspect(el.probe).subscribers).toBe(0) // not connected → no effect

    document.body.append(el)
    expect(inspect(el.probe).subscribers).toBe(1) // exactly the setFormValue effect

    el.remove()
    expect(inspect(el.probe).subscribers).toBe(0) // scope.dispose() tore it down

    // behavioural residue: a post-disconnect value change must NOT re-publish (the effect is gone)
    const before = calls.formValues.length
    el.value = 'after-disconnect'
    await whenFlushed()
    expect(calls.formValues).toHaveLength(before)

    document.body.append(el) // reconnect
    expect(inspect(el.probe).subscribers).toBe(1) // re-subscribed cleanly — exactly one
    el.remove()
  })
})

// ── announceFormConnect (F1) — the base catch-up re-announce ──────────────────

describe('announceFormConnect (F1) — the base catch-up re-announce', () => {
  it('no-ops before this control has ever connected (connectionSignal null) — no listener notified', () => {
    const el = new FieldEl() // constructed, never appended
    let count = 0
    document.addEventListener(FORM_CONNECT_EVENT, () => { count++ })
    el.announceFormConnect()
    expect(count).toBe(0)
  })

  it('re-dispatches ui-form-connect with a FRESH detail once actually connected', () => {
    const { el } = makeField()
    document.body.append(el)
    const received: FormConnectDetail[] = []
    document.addEventListener(FORM_CONNECT_EVENT, (e) => {
      received.push((e as CustomEvent<FormConnectDetail>).detail)
    })
    el.announceFormConnect()
    expect(received).toHaveLength(1)
    expect(received[0].control).toBe(el)
    expect(received[0].signal.aborted).toBe(false) // the CURRENT (live) connection signal, not a stale one
    el.remove()
  })

  it('no-ops again after disconnect (connectionSignal nulled by disconnectedCallback)', () => {
    const { el } = makeField()
    document.body.append(el)
    el.remove()
    let count = 0
    document.addEventListener(FORM_CONNECT_EVENT, () => { count++ })
    el.announceFormConnect()
    expect(count).toBe(0)
  })

  it('the upgrade-order hazard (the s9-caught bug): a bulk offline-subtree insert calls announceFormConnect on a descendant whose OWN connectedCallback has not run yet — isConnected is already true there, but the guard is connectionSignal, so it must NOT throw', () => {
    const wrapper = new RaceWrapperEl()
    const { el: child } = makeField()
    wrapper.append(child) // offline — wrapper not yet connected, so child's connectedCallback hasn't run either
    expect(() => document.body.append(wrapper)).not.toThrow() // the bulk insert IS the repro
    // The hazard, observed AND survived: by the time wrapper.connected() ran its catch-up scan, child
    // already reported isConnected (DOM structural fact, set the instant the subtree was spliced in) —
    // yet announceFormConnect correctly no-op'd (connectionSignal was still null) instead of crashing on
    // a null connect-detail signal (the pre-fix bug: `detail.signal.aborted` in a registry listener).
    expect(wrapper.raceResults).toEqual([{ isConnected: true, threw: false }])
    wrapper.remove()
  })
})

// ── nested-member guard — a UIFormElement inside another UIFormElement is an INTERNAL PART ───────
//
// Defect repair (A2UI patterns-page-caught, coordinator-ruled): `ui-text-field type=date` nests its own
// internal `<ui-calendar>` (itself a `UIFormElement`) inside itself; a wrapping `ui-form-provider`'s
// catch-up scan discovered it as a phantom SECOND member, causing an aggregation write-loop (>100 waves,
// the kernel budget throw). Fix: a control with a `UIFormElement` ANCESTOR never announces — neither the
// initial connect dispatch nor a catch-up `announceFormConnect()` re-announce reaches a listener, so it
// can never register anywhere (dom/form.ts `#dispatchFormConnect`/`#hasFormElementAncestor`). These probes
// pin the guard at the base level with two nested `FieldEl` fixtures (no text-field/calendar needed here);
// the REAL repro shape (an actual `ui-text-field type=date` inside a `ui-form-provider`, converging to
// exactly one member with no write-loop) is a controls-layer concern — dom tests cannot import controls
// (the layering trip-wire) — added instead to controls/form-provider/form-provider-date.test.ts (a NEW
// file beside form-provider.test.ts; s9's file was left untouched rather than assuming its conventions
// welcome an addition — flagged in the handoff).

describe('nested-member guard (defect repair) — a UIFormElement inside another UIFormElement never announces', () => {
  it('nested-never-announces: the INNER control never reaches a listener; the OUTER (no UIFormElement ancestor) still announces normally', () => {
    const { el: outer } = makeField()
    const { el: inner } = makeField()
    outer.append(inner) // nest BEFORE connecting — inner has a UIFormElement ancestor (outer) from the start

    const received: UIFormElement[] = []
    document.addEventListener(FORM_CONNECT_EVENT, (e) => {
      received.push((e as CustomEvent<FormConnectDetail>).detail.control)
    })

    document.body.append(outer) // bulk connect: outer's connectedCallback runs, then inner's

    expect(received).toContain(outer) // the outer control has no UIFormElement ancestor — announces normally
    expect(received).not.toContain(inner) // the inner control is an internal part — never announces
    outer.remove()
  })

  it('nested-announce-form-connect-noop: a catch-up announceFormConnect() on the inner control is ALSO a no-op — the guard covers both dispatch sites, matching a provider/field catch-up scan discovering the internal part late', () => {
    const { el: outer } = makeField()
    const { el: inner } = makeField()
    outer.append(inner)
    document.body.append(outer)

    let count = 0
    document.addEventListener(FORM_CONNECT_EVENT, () => { count++ })
    inner.announceFormConnect()
    expect(count).toBe(0)
    outer.remove()
  })

  it('nested-negative-control: a form control nested inside a PLAIN (non-UIFormElement) wrapper still announces — the guard is UIFormElement-ancestor-specific, not any-ancestor', () => {
    const wrapper = document.createElement('div') // a structural ancestor, NOT a UIFormElement
    const { el: inner } = makeField()
    wrapper.append(inner)

    const received: UIFormElement[] = []
    document.addEventListener(FORM_CONNECT_EVENT, (e) => {
      received.push((e as CustomEvent<FormConnectDetail>).detail.control)
    })

    document.body.append(wrapper)
    expect(received).toContain(inner) // an ordinary (non-UIFormElement) ancestor never suppresses the dispatch
    wrapper.remove()
  })
})
