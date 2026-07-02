// form-provider.test.ts — jsdom probes for UIFormProviderElement (ADR-0050; LLD-C7, decomp
// g7-field-form-provider slice s9) AND traits/form-registry.ts (LLD-C3) — the registry has no standalone
// test file; per the LLD's verification map (§4 s9) it is exercised here, mostly through the provider's
// public surface, with one direct-registry describe block where a raw signal is the only honest proof
// (the track-user-invalid.test.ts precedent for a bare-controller residue check).
//
// jsdom reality (the dom/form.test.ts precedent): the ElementInternals form-association surface
// (setFormValue/setValidity/form) is ENTIRELY absent — stubbed per member BEFORE it ever connects
// (connecting runs the base's form effects synchronously). `.form` is stubbed explicitly to `null`
// (form-less) unless a test wires a real `<form>` — an unstubbed `.form` reads `undefined` in jsdom, which
// would send reset()'s `form === null` branch down the wrong path.
//
// Two registration-safe DOM-building idioms are both exercised (LLD-C1's "ancestors connect before
// descendants" note): BULK insert (a whole subtree assembled offline, then connected in ONE append — the
// "discovery at connect" idiom, and the exact shape of the F1 regression this slice's own repro fed into
// the dom/form.ts fix — see that file's `announceFormConnect` doc) and SEQUENTIAL insert (a control
// appended one at a time into an already-connected provider — the late-added path).
//
// A throwaway `UIFormElement` leaf (MemberEl — the dom/form.test.ts FieldEl precedent) stands in for a real
// control everywhere: full control over name/value/required/disabled/form keeps each probe single-purpose,
// and the registry does not care which UIFormElement subclass it is aggregating.

import { describe, it, expect, vi } from 'vitest'
import { effect, inspect, whenFlushed } from '../../reactive/index.ts'
import { UIElement, UIFormElement, FORM_RESET_EVENT, prop, type PropsSchema } from '../../dom/index.ts'
import type { FormValue, ValidityResult } from '../../dom/index.ts'
import { formRegistry, type FormRegistryController } from '../../traits/form-registry.ts'
import { UIFormProviderElement } from './form-provider.ts'

// ── the throwaway member control (mirrors dom/form.test.ts's FieldEl) ────────────────────────────────

interface MemberEl {
  value: string
}
class MemberEl extends UIFormElement {
  static props = { ...UIFormElement.formProps, value: prop.string() } satisfies PropsSchema
  /** Re-expose the protected internals so the stub + native-`.form` wiring below can reach it. */
  get internalsProbe(): ElementInternals {
    return this.internals
  }
  protected formValue(): FormValue {
    return this.value
  }
  protected formValidity(): ValidityResult {
    return this.required && this.value === ''
      ? { valid: false, flags: { valueMissing: true }, message: 'Required' }
      : { valid: true }
  }
}
customElements.define('ui-form-provider-probe-member', MemberEl)

interface MemberInit {
  name?: string
  value?: string
  required?: boolean
  /** The owning `<form>` — defaults to `null` (form-less). jsdom leaves an unstubbed `.form` `undefined`,
   *  not `null`, so every member gets an explicit stub either way (reset()'s partition depends on it). */
  form?: HTMLFormElement | null
}

/** Build + stub a fresh member BEFORE it ever connects — connecting runs the base's setFormValue/setValidity
 *  effects synchronously, and jsdom has no form-association surface to run them against (dom/form.test.ts). */
function makeMember(init: MemberInit = {}): MemberEl {
  const el = new MemberEl()
  const i = el.internalsProbe as unknown as Record<string, unknown>
  i.setFormValue = (): void => {}
  i.setValidity = (): void => {}
  i.form = init.form ?? null
  if (init.name !== undefined) el.name = init.name
  if (init.value !== undefined) el.value = init.value
  if (init.required) el.required = true
  return el
}

// ── the non-form-child negative control ──────────────────────────────────────────────────────────────

class PlainEl extends UIElement {}
customElements.define('ui-form-provider-probe-plain', PlainEl)

// ── a throwaway host installing the RAW registry (traits/form-registry.ts) directly — the provider's
//    public surface has no signal to hand `inspect()`, so the residue probe below goes straight to the
//    trait (the track-user-invalid.test.ts pattern: a scope-owned reading effect is the anti-vacuous
//    subscriber, since only a SCOPE-OWNED subscriber is guaranteed to die with the connection). ──────────

class RegistryHostEl extends UIElement {
  registry: FormRegistryController | null = null
  protected connected(): void {
    this.registry = formRegistry(this)
    this.effect(() => {
      void this.registry!.values.value
    })
  }
  protected disconnected(): void {
    this.registry?.release()
  }
}
customElements.define('ui-form-provider-probe-registry-host', RegistryHostEl)

// ── discovery at connect (LLD-C3 §onConnect) — probe #1, both insertion legs ──────────────────────────

describe('discovery at connect (LLD-C3 §onConnect)', () => {
  it('bulk-insert: a provider wrapping N pre-appended controls sees them all at connect (the F1 regression)', () => {
    const provider = new UIFormProviderElement()
    const a = makeMember({ name: 'a', value: '1' })
    const b = makeMember({ name: 'b', value: '2' })
    provider.append(a, b) // offline — provider not yet connected; the WHOLE subtree connects in ONE append
    expect(() => document.body.append(provider)).not.toThrow() // the s1 fix — dom/form.ts's announceFormConnect doc
    expect(provider.controls).toHaveLength(2)
    expect(provider.controls[0]).toBe(a)
    expect(provider.controls[1]).toBe(b)
    expect(provider.entries()).toEqual([['a', '1'], ['b', '2']])
    expect(provider.values()).toEqual({ a: '1', b: '2' })
    provider.remove()
  })

  it('sequential-insert: a provider already connected sees each control as it is individually appended', () => {
    const provider = new UIFormProviderElement()
    document.body.append(provider) // connect FIRST — the registry listener installs with zero members
    expect(provider.controls).toEqual([])

    const a = makeMember({ name: 'a', value: '1' })
    provider.append(a) // a single-node insertion into an already-connected provider
    expect(provider.controls).toEqual([a])

    const b = makeMember({ name: 'b', value: '2' })
    provider.append(b)
    expect(provider.controls).toHaveLength(2)
    expect(provider.entries()).toEqual([['a', '1'], ['b', '2']])
    provider.remove()
  })
})

// ── late-added control — probe #2 (LLD-C1 "no MutationObserver" claim) ────────────────────────────────

describe('late-added control (LLD-C1 "no MutationObserver" claim)', () => {
  it('a control appended well after the provider connects is discovered — no observer, just its own connect dispatch', () => {
    const provider = new UIFormProviderElement()
    const a = makeMember({ name: 'a', value: '1' })
    provider.append(a)
    document.body.append(provider)
    expect(provider.controls).toHaveLength(1)

    // time passes / other things happen — a SECOND control then joins the already-live tree
    const b = makeMember({ name: 'b', value: '2' })
    provider.append(b)
    expect(provider.controls).toHaveLength(2)
    expect(provider.controls[1]).toBe(b)
    expect(provider.entries()).toEqual([['a', '1'], ['b', '2']])
    provider.remove()
  })
})

// ── removed control — probe #3 (the abort-handle path) ─────────────────────────────────────────────────

describe('removed control (the abort-handle path)', () => {
  it('removing a control from the provider drops it from the aggregate', () => {
    const provider = new UIFormProviderElement()
    const a = makeMember({ name: 'a', value: '1' })
    const b = makeMember({ name: 'b', value: '2' })
    provider.append(a, b)
    document.body.append(provider)
    expect(provider.controls).toHaveLength(2)

    a.remove() // disconnect aborts a's connection signal → the registry's per-member abort listener fires
    expect(provider.controls).toEqual([b])
    expect(provider.entries()).toEqual([['b', '2']])
    provider.remove()
  })
})

// ── reactivity proof — probe #4 (props-are-signals, ADR-0050 §4) ───────────────────────────────────────

describe('reactivity proof (props-are-signals — ADR-0050 §4)', () => {
  it('an effect reading values() re-runs when a member writes its value prop', async () => {
    const provider = new UIFormProviderElement()
    const a = makeMember({ name: 'a', value: '1' })
    provider.append(a)
    document.body.append(provider)

    const seen: Array<Readonly<Record<string, FormValue>>> = []
    const dispose = effect(() => {
      seen.push(provider.values())
    })
    expect(seen).toEqual([{ a: '1' }]) // the initial synchronous run

    a.value = '2'
    await whenFlushed() // effects are microtask-batched
    expect(seen).toEqual([{ a: '1' }, { a: '2' }]) // exactly one re-run, tracked through value() → the value prop

    dispose()
    provider.remove()
  })
})

// ── aggregate rules — probe #5 (LLD-C3 pinned mechanics) ────────────────────────────────────────────────

describe('aggregate rules (LLD-C3 pinned mechanics)', () => {
  it('duplicate names: entries preserves BOTH (FormData parity); values last-wins', () => {
    const provider = new UIFormProviderElement()
    const a = makeMember({ name: 'dup', value: '1' })
    const b = makeMember({ name: 'dup', value: '2' })
    provider.append(a, b)
    document.body.append(provider)
    expect(provider.entries()).toEqual([['dup', '1'], ['dup', '2']])
    expect(provider.values()).toEqual({ dup: '2' })
    provider.remove()
  })

  it('unnamed control (name==="") is excluded from entries/values but INCLUDED in invalid', () => {
    const provider = new UIFormProviderElement()
    const unnamed = makeMember({ value: '', required: true }) // name stays '' (default) — required+empty ⇒ invalid
    provider.append(unnamed)
    document.body.append(provider)
    expect(provider.entries()).toEqual([])
    expect(provider.values()).toEqual({})
    expect(provider.invalid()).toEqual([unnamed])
    provider.remove()
  })

  it('effectiveDisabled member is excluded from entries AND validity — reactively, via formDisabledCallback', async () => {
    const provider = new UIFormProviderElement()
    const a = makeMember({ name: 'a', value: '', required: true }) // required+empty ⇒ invalid while enabled
    provider.append(a)
    document.body.append(provider)
    expect(provider.entries()).toEqual([['a', '']]) // present while enabled — an empty value still submits
    expect(provider.invalid()).toEqual([a])

    a.formDisabledCallback(true)
    await whenFlushed()
    expect(provider.entries()).toEqual([]) // disabled ⇒ barred from submission
    expect(provider.invalid()).toEqual([]) // disabled ⇒ barred from constraint validation (native parity)

    a.formDisabledCallback(false)
    await whenFlushed()
    expect(provider.entries()).toEqual([['a', '']]) // re-enabled ⇒ back
    expect(provider.invalid()).toEqual([a])
    provider.remove()
  })
})

// ── submit() legs — probe #6 ─────────────────────────────────────────────────────────────────────────

describe('submit()', () => {
  it('invalid: returns false, no change emitted, reportValidity() on the FIRST invalid member (registration order)', () => {
    const provider = new UIFormProviderElement()
    const a = makeMember({ name: 'a', value: 'ok' }) // valid
    const b = makeMember({ name: 'b', value: '', required: true }) // first invalid — registered 2nd
    const c = makeMember({ name: 'c', value: '', required: true }) // also invalid — registered 3rd
    provider.append(a, b, c)
    document.body.append(provider)

    const bReport = vi.spyOn(b, 'reportValidity').mockReturnValue(true)
    const cReport = vi.spyOn(c, 'reportValidity').mockReturnValue(true)
    const seen: Event[] = []
    provider.addEventListener('change', (e) => seen.push(e))

    expect(provider.submit()).toBe(false)
    expect(bReport).toHaveBeenCalledTimes(1) // the FIRST invalid member, registration order — not c
    expect(cReport).not.toHaveBeenCalled()
    expect(seen).toEqual([]) // no emit on an invalid submit
    provider.remove()
  })

  it('valid: returns true + ONE change with the aggregate detail, event.target === the provider', () => {
    const provider = new UIFormProviderElement()
    const a = makeMember({ name: 'a', value: '1' })
    const b = makeMember({ name: 'b', value: '2' })
    provider.append(a, b)
    document.body.append(provider)

    const seen: CustomEvent[] = []
    provider.addEventListener('change', (e) => seen.push(e as CustomEvent))

    expect(provider.submit()).toBe(true)
    expect(seen).toHaveLength(1)
    expect(seen[0]?.target).toBe(provider) // disambiguates from a bubbled member `change` (detail: null)
    expect(seen[0]?.detail).toEqual({ entries: [['a', '1'], ['b', '2']], values: { a: '1', b: '2' } })
    provider.remove()
  })
})

// ── reset() partitions — probe #7 ────────────────────────────────────────────────────────────────────

describe('reset() (native <form> composition)', () => {
  it('(a) members sharing a <form> get ONE form.reset() — no double-reset', () => {
    const provider = new UIFormProviderElement()
    const form1 = document.createElement('form')
    const form2 = document.createElement('form')
    const a = makeMember({ name: 'a', form: form1 })
    const b = makeMember({ name: 'b', form: form1 }) // same form as a
    const c = makeMember({ name: 'c', form: form2 }) // a different form
    provider.append(a, b, c)
    document.body.append(provider)

    const reset1 = vi.spyOn(form1, 'reset').mockImplementation(() => {})
    const reset2 = vi.spyOn(form2, 'reset').mockImplementation(() => {})
    provider.reset()
    expect(reset1).toHaveBeenCalledTimes(1) // ONE call despite TWO members on form1
    expect(reset2).toHaveBeenCalledTimes(1)
    provider.remove()
  })

  it('(b) form-less members get a direct formResetCallback() — dispatches ui-form-reset (RESERVED under gen-3: zero consumers — the field re-suppresses via its own tracker signal write, not this event)', () => {
    const provider = new UIFormProviderElement()
    const a = makeMember({ name: 'a' }) // form: null (default) — form-less
    const b = makeMember({ name: 'b' })
    provider.append(a, b)
    document.body.append(provider)

    const spyA = vi.spyOn(a, 'formResetCallback')
    const spyB = vi.spyOn(b, 'formResetCallback')
    const resetEvents: Event[] = []
    provider.addEventListener(FORM_RESET_EVENT, (e) => resetEvents.push(e))

    provider.reset()
    expect(spyA).toHaveBeenCalledTimes(1) // the public platform callback, called DIRECTLY (no native form)
    expect(spyB).toHaveBeenCalledTimes(1)
    expect(resetEvents).toHaveLength(2) // one ui-form-reset per member, bubbled to the provider (LLD-C1)
    provider.remove()
  })
})

// ── nesting negative control — probe #8 (LLD-C3 §nesting, nearest-provider scoping) ────────────────────

describe('nesting (LLD-C3 §nesting) — nearest-provider scoping', () => {
  it('a control registers with the NEAREST provider only — the outer aggregate excludes it', () => {
    const outer = new UIFormProviderElement()
    const inner = new UIFormProviderElement()
    const a = makeMember({ name: 'a', value: '1' })
    inner.append(a)
    outer.append(inner) // still offline
    expect(() => document.body.append(outer)).not.toThrow() // bulk-insert through TWO provider levels
    expect(inner.controls).toEqual([a])
    expect(outer.controls).toEqual([]) // stopPropagation scopes registration to inner only
    outer.remove()
  })
})

// ── non-form-child negative control — probe #9 ──────────────────────────────────────────────────────

describe('non-form-child negative control', () => {
  it('a plain UIElement child never registers (the instanceof guard is defense, not the discovery path)', () => {
    const provider = new UIFormProviderElement()
    const plain = new PlainEl()
    provider.append(plain)
    document.body.append(provider)
    expect(provider.controls).toEqual([])
    provider.remove()
  })
})

// ── provider disconnect with live members — probe #10 ───────────────────────────────────────────────

describe('provider disconnect with live members (LLD-C3/C7 edge enumeration)', () => {
  it('zero residue: a scope-owned reader on the raw registry loses its subscription on disconnect; release() empties members', () => {
    const host = new RegistryHostEl()
    document.body.append(host)
    const registry = host.registry!
    expect(inspect(registry.values).subscribers).toBeGreaterThanOrEqual(1) // anti-vacuous — the host's own reader

    const a = makeMember({ name: 'a', value: '1' })
    host.append(a)
    expect(registry.members.value).toHaveLength(1)

    host.remove() // disconnected() releases the registry WHILE resources are live; the base then disposes the
                   // scope (the reading effect dies) + aborts the connection signal (the connect listener AND
                   // every per-member abort listener die with it — LLD-C3's dual-lifetime teardown)
    expect(inspect(registry.values).subscribers).toBe(0) // zero — the scope-owned reader is gone
    expect(registry.members.value).toEqual([]) // release() emptied it too
  })

  it('members keep their own native form association untouched — the teardown never touches it', () => {
    const provider = new UIFormProviderElement()
    const form = document.createElement('form')
    const a = makeMember({ name: 'a', form })
    provider.append(a)
    document.body.append(provider)
    expect(a.form).toBe(form)

    provider.remove() // the provider's own teardown (registry.release()) only clears ITS OWN members list
    expect(a.form).toBe(form) // unchanged
  })

  it('methods after disconnect return empty snapshots', () => {
    const provider = new UIFormProviderElement()
    const a = makeMember({ name: 'a', value: '1' })
    provider.append(a)
    document.body.append(provider)
    expect(provider.controls).toHaveLength(1)

    provider.remove()
    expect(provider.controls).toEqual([])
    expect(provider.entries()).toEqual([])
    expect(provider.values()).toEqual({})
    expect(provider.invalid()).toEqual([])
    expect(provider.valid()).toBe(true) // vacuously true while disconnected (LLD-C7 §2, pinned)
  })

  it('submit() while disconnected: false, no emit — the #registry===null check runs BEFORE the vacuous valid() read', () => {
    const provider = new UIFormProviderElement()
    document.body.append(provider)
    provider.remove()

    const seen: CustomEvent[] = []
    provider.addEventListener('change', (e) => seen.push(e as CustomEvent))
    expect(provider.submit()).toBe(false) // an empty aggregate from a disconnected provider is "can't see the form", not a hollow success
    expect(seen).toEqual([])
  })
})

// ── announceFormConnect() semantics — probe #11 (F1) ────────────────────────────────────────────────

describe('announceFormConnect() semantics (F1)', () => {
  it('re-dispatch on an already-registered control is a dup — members stays at ONE entry', () => {
    const provider = new UIFormProviderElement()
    const a = makeMember({ name: 'a', value: '1' })
    provider.append(a)
    document.body.append(provider)
    expect(provider.controls).toHaveLength(1)

    a.announceFormConnect() // re-announce — the registry's already-registered guard makes it a no-op
    a.announceFormConnect()
    expect(provider.controls).toHaveLength(1) // stable — no duplicate entries
    provider.remove()
  })

  it('is a no-op on a disconnected control', () => {
    const provider = new UIFormProviderElement()
    const a = makeMember({ name: 'a', value: '1' })
    provider.append(a)
    document.body.append(provider)
    expect(provider.controls).toHaveLength(1)

    a.remove() // disconnect — a drops out of the aggregate
    expect(provider.controls).toEqual([])

    expect(() => a.announceFormConnect()).not.toThrow() // connectionSignal is null ⇒ returns immediately
    expect(provider.controls).toEqual([]) // nothing re-registered
    provider.remove()
  })
})
