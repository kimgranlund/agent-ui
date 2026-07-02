// form-provider-late-define.test.ts — the UPGRADE-ORDER catch-up probe (LLD-C1 / ADR-0051 cl.5, decomp
// g7-field-form-provider slice s9, probe #12). Dedicated, per-file isolation (vitest's default `isolate:
// true` gives each test FILE its own module registry + jsdom globals — vitest.config.ts): the whole point
// is to prove a provider defined/upgraded AFTER its descendant control's module is already loaded (and the
// DOM already built) still discovers that control, via the one-shot catch-up scan. Sharing this file with
// form-provider.test.ts (which imports form-provider.ts at the top) would make the premise untestable —
// that file's OWN import would already have defined `ui-form-provider` before any test ran.
//
// Sequence: (1) build DOM with the NOT-YET-DEFINED `ui-form-provider` tag wrapping an ALREADY-defined member
// control — the member connects immediately (its module IS imported), dispatching `ui-form-connect` into
// the void (no listener yet — the provider tag is still un-upgraded); (2) assert nothing throws and the tag
// is still undefined; (3) dynamically `import('./form-provider.ts')` — defining the class upgrades the
// already-connected tag SYNCHRONOUSLY within that call (the custom-element-definition algorithm runs its
// connectedCallback as part of `customElements.define()`) → the registry listener installs → the one-shot
// catch-up scan (`querySelectorAll('*') → instanceof UIFormElement → announceFormConnect()`) finds the
// long-since-connected member (its OWN connectedCallback completed ticks ago — `connectionSignal` is live,
// the exact case the F1 guard is FOR, unlike the bulk-insert regression form-provider.test.ts covers) and
// re-announces it → registered.

import { describe, it, expect } from 'vitest'
import { UIFormElement, prop, type PropsSchema } from '../../dom/index.ts'
import type { FormValue } from '../../dom/index.ts'
// type-only — erased under verbatimModuleSyntax, so this carries NO runtime import (the whole point).
import type { UIFormProviderElement } from './form-provider.ts'

// ── the already-defined member control (self-contained — imports only ../../dom, never form-provider.ts) ──

interface LateMemberEl {
  value: string
}
class LateMemberEl extends UIFormElement {
  static props = { ...UIFormElement.formProps, value: prop.string() } satisfies PropsSchema
  get internalsProbe(): ElementInternals {
    return this.internals
  }
  protected formValue(): FormValue {
    return this.value
  }
}
customElements.define('ui-form-provider-latedefine-member', LateMemberEl)

/** Build + stub a fresh member BEFORE it ever connects (dom/form.test.ts precedent — jsdom has no
 *  form-association surface to run the base's connect-time effects against). */
function makeLateMember(name: string): LateMemberEl {
  const el = new LateMemberEl()
  const i = el.internalsProbe as unknown as Record<string, unknown>
  i.setFormValue = (): void => {}
  i.setValidity = (): void => {}
  i.form = null
  el.name = name
  return el
}

const PROVIDER_TAG = 'ui-form-provider' // the real tag form-provider.ts defines — must match for the upgrade to land

describe('upgrade-order catch-up (LLD-C1 / ADR-0051 cl.5) — a provider defined AFTER its descendant', () => {
  it('a control connected before the provider module loads is discovered once the provider upgrades', async () => {
    expect(customElements.get(PROVIDER_TAG)).toBeUndefined() // anti-vacuous: the provider truly isn't defined yet

    // (1) build the DOM first — the provider tag is undefined, so `wrapper` sits as a plain un-upgraded
    // element; its member CHILD is already defined and connects normally, dispatching ui-form-connect into
    // the void (no listener exists yet to hear it).
    const wrapper = document.createElement(PROVIDER_TAG)
    const a = makeLateMember('a')
    wrapper.append(a)
    expect(() => document.body.append(wrapper)).not.toThrow()

    // (2) still not upgraded — no UIFormProviderElement instance surface exists on it yet
    expect(customElements.get(PROVIDER_TAG)).toBeUndefined()
    expect('controls' in wrapper).toBe(false)

    // (3) the provider module loads NOW — defining the class upgrades `wrapper` SYNCHRONOUSLY within this
    // call (the custom-element-definition algorithm), running connectedCallback → the registry listener
    // installs → the one-shot catch-up scan finds `a` (long since connected) and re-announces it.
    await import('./form-provider.ts')

    expect(customElements.get(PROVIDER_TAG)).toBeDefined()
    const provider = wrapper as unknown as UIFormProviderElement
    expect(provider).toBeInstanceOf(customElements.get(PROVIDER_TAG)!)
    expect(provider.controls).toEqual([a]) // the catch-up scan registered it
    expect(provider.entries()).toEqual([['a', '']])

    wrapper.remove()
  })
})
