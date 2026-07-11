import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest'
import { whenFlushed, UIFormElement } from '@agent-ui/components'
import { generateSection } from './generate.ts'
import { createMemoryStore } from './memory-store.ts'
import type { SettingsSection } from './schema.ts'

// n3b (generate half) — jsdom probes for the schema→form-out generator (LLD-C13, SPEC-R11/R12). Proves:
// one ui-form-provider per section, one ui-field per field (label/description from the schema, 0
// app-authored form CSS/glue), initial values read from store ?? default, per-field-on-change commit to
// the store, and the unknown-type degrade (SPEC-R10 AC2).
//
// jsdom reality (validate.test.ts's header) — no native ElementInternals.setFormValue/setValidity; the
// prototype is stubbed for this file's duration so the REAL shipped tags this generator composes can
// connect at all. Validity-dependent assertions read `setCustomValidity`'s own call, never `.validity`.
let realAttachInternals: typeof HTMLElement.prototype.attachInternals
beforeAll(() => {
  realAttachInternals = HTMLElement.prototype.attachInternals
  HTMLElement.prototype.attachInternals = function (this: HTMLElement): ElementInternals {
    const internals = realAttachInternals.call(this) as unknown as Record<string, unknown>
    if (typeof internals.setFormValue !== 'function') internals.setFormValue = () => {}
    if (typeof internals.setValidity !== 'function') internals.setValidity = () => {}
    return internals as unknown as ElementInternals
  }
})
afterAll(() => {
  HTMLElement.prototype.attachInternals = realAttachInternals
})

const mounted: Element[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

function connect(el: HTMLElement): HTMLElement {
  document.body.append(el)
  mounted.push(el)
  return el
}

const SECTION: SettingsSection = {
  id: 'general',
  label: 'General',
  fields: [
    { key: 'displayName', type: 'text', label: 'Display name', description: 'Shown in the header', default: '' },
    { key: 'darkMode', type: 'boolean', label: 'Dark mode', default: false },
  ],
}

describe('generateSection — the generated tree (SPEC-R11 AC1)', () => {
  it('one ui-form-provider wrapping one ui-field per field, label/description from the schema', () => {
    const { element } = generateSection(SECTION, undefined)
    expect(element.tagName.toLowerCase()).toBe('ui-form-provider')
    const fields = element.querySelectorAll('ui-field')
    expect(fields).toHaveLength(2)
    expect((fields[0] as unknown as { label: string }).label).toBe('Display name')
    expect((fields[0] as unknown as { description: string }).description).toBe('Shown in the header')
    expect(fields[0].querySelector('ui-text-field')).not.toBeNull()
    expect(fields[1].querySelector('ui-switch')).not.toBeNull()
  })

  it('each generated control carries `name` = the field key (the provider aggregate keys on it)', () => {
    const { element } = generateSection(SECTION, undefined)
    const control = element.querySelector('ui-text-field') as unknown as { name: string }
    expect(control.name).toBe('displayName')
  })

  it('no store ⇒ every field renders from its OWN schema default, never throws (SPEC-R12 AC2)', () => {
    let generated: ReturnType<typeof generateSection> | null = null
    expect(() => {
      generated = generateSection(SECTION, undefined)
    }).not.toThrow()
    const control = generated!.element.querySelector('ui-switch') as unknown as { checked: boolean }
    connect(generated!.element)
    expect(control.checked).toBe(false) // the field's own `default`
  })

  it('a supplied store seeds the initial value (store.get() OVER the schema default)', () => {
    const store = createMemoryStore({ initial: { darkMode: true } })
    const { element } = generateSection(SECTION, store)
    const control = element.querySelector('ui-switch') as unknown as { checked: boolean }
    connect(element)
    expect(control.checked).toBe(true) // store wins over `default: false`
  })

  it('a user-driven `change` on a generated control commits store.set(key, canonical value)', async () => {
    const store = createMemoryStore()
    const { element } = generateSection(SECTION, store)
    connect(element)
    const control = element.querySelector('ui-switch') as unknown as HTMLElement & { checked: boolean }
    control.checked = true
    control.dispatchEvent(new Event('change', { bubbles: true }))
    await Promise.resolve() // the commit is deferred one microtask (generate.ts — the codec staleness guard)
    expect(store.get('darkMode')).toBe(true)
  })
})

describe('generateSection — unknown field type degrades (SPEC-R10 AC2)', () => {
  it('renders a disabled placeholder + logs ONE warning, never throws', () => {
    const section: SettingsSection = {
      id: 's', label: 'S',
      fields: [{ key: 'k', type: 'not-a-real-type' as never, label: 'K', default: null }],
    }
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      let generated: ReturnType<typeof generateSection> | null = null
      expect(() => {
        generated = generateSection(section, undefined)
      }).not.toThrow()
      const placeholder = generated!.element.querySelector('[data-part="unsupported-field"]')
      expect(placeholder).not.toBeNull()
      expect(placeholder!.getAttribute('aria-disabled')).toBe('true')
      expect(warnSpy).toHaveBeenCalledTimes(1)
    } finally {
      warnSpy.mockRestore()
    }
  })
})

describe('generateSection — dispose() tears down any reactive validation effects', () => {
  it('dispose() never throws even when NOTHING reactive was installed (plain fields, no validation)', () => {
    const { dispose } = generateSection(SECTION, undefined)
    expect(() => dispose()).not.toThrow()
  })

  it('a required boolean field wires setCustomValidity via validate.ts — dispose() stops the effect; the provider AGGREGATE reports invalid too (SPEC-R11 AC2 end-to-end)', async () => {
    const section: SettingsSection = {
      id: 's', label: 'S',
      fields: [{ key: 'agree', type: 'boolean', label: 'Agree', default: false, validation: { required: true } }],
    }
    // validate.ts's effect runs its FIRST pass synchronously inside generateSection() itself (effect()
    // runs immediately on creation) — a vi.spyOn attached AFTER generateSection would miss that first call,
    // so the prototype method is patched BEFORE generation instead (restored in `finally`).
    const calls: string[] = []
    const original = UIFormElement.prototype.setCustomValidity
    UIFormElement.prototype.setCustomValidity = function (this: UIFormElement, message: string): void {
      calls.push(message)
      original.call(this, message)
    }
    try {
      const { element, dispose } = generateSection(section, undefined)
      const provider = element as unknown as { valid(): boolean }
      connect(element)
      await whenFlushed() // the validate.ts effect's first run
      expect(calls.at(-1)).toMatch(/.+/) // required + unchecked
      // SPEC-R11 AC2's END-TO-END proof: not just that setCustomValidity fired, but that the AGGREGATE
      // ui-form-provider (the same one a real submit()/reportValidity() flow reads) sees the member as
      // invalid too — the merged-validity effect (dom/form.ts) publishes setCustomValidity into the SAME
      // internals.setValidity the registry aggregates over.
      expect(provider.valid()).toBe(false)
      const control = element.querySelector('ui-switch') as unknown as { checked: boolean }
      control.checked = true
      await whenFlushed()
      expect(calls.at(-1)).toBe('')
      expect(provider.valid()).toBe(true)
      expect(() => dispose()).not.toThrow()
    } finally {
      UIFormElement.prototype.setCustomValidity = original
    }
  })

  it('reapplyValidation() re-arms validity on the SAME (already-generated) control — no DOM regeneration', async () => {
    const section: SettingsSection = {
      id: 's', label: 'S',
      fields: [{ key: 'agree', type: 'boolean', label: 'Agree', default: false, validation: { required: true } }],
    }
    const calls: string[] = []
    const original = UIFormElement.prototype.setCustomValidity
    UIFormElement.prototype.setCustomValidity = function (this: UIFormElement, message: string): void {
      calls.push(message)
      original.call(this, message)
    }
    try {
      const { element, dispose, reapplyValidation } = generateSection(section, undefined)
      const controlBefore = element.querySelector('ui-switch')
      connect(element)
      await whenFlushed()

      // Simulate settings.ts's `disconnected()`: the ORIGINAL validation effect is torn down —
      // subsequent `checked` writes no longer call setCustomValidity at all.
      dispose()
      const control = element.querySelector('ui-switch') as unknown as { checked: boolean }
      calls.length = 0
      control.checked = false
      await whenFlushed()
      expect(calls).toEqual([]) // confirmed dead — the exact MAJOR-finding symptom pre-fix

      // Re-arm WITHOUT touching the DOM (no generateSection call, no new control) — the reconnect fix.
      const freshDispose = reapplyValidation()
      await whenFlushed() // reapplyValidation's own effect first-run
      expect(calls.at(-1)).toMatch(/.+/) // required + still unchecked ⇒ invalid again, reactively
      expect(element.querySelector('ui-switch')).toBe(controlBefore) // the SAME node — never regenerated

      control.checked = true
      await whenFlushed()
      expect(calls.at(-1)).toBe('')
      freshDispose()
    } finally {
      UIFormElement.prototype.setCustomValidity = original
    }
  })
})
