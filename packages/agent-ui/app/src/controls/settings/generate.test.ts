import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest'
import { whenFlushed, UIFormElement } from '@agent-ui/components'
import { generateSection } from './generate.ts'
import { createMemoryStore } from './memory-store.ts'
import type { SettingsSection } from './schema.ts'
import type { SettingsStore } from './store.ts'

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

// ── TKT-0021 — external sync (store.subscribe → the rendered control) ────────────────────────────────
//
// The M4 LLD §8 Fork F7 optional-`subscribe` arm (store.ts:34, RESOLVED per the LLD's recommendation),
// realized: an external `store.set(key, value)` — from OUTSIDE this generated tree — reflects into the
// matching control via `registered.setValue`. Covers all six v1 registry types, INCLUDING the two
// `ui-text-field` codec-wall types (number/date, schema.test.ts:127's documented limitation): those two
// reflect the RAW value visibly (the model→surface effect) but their internal codec `canonical` does not
// resync without a real blur — a `ui-text-field`-tier gap (no public seam to force a resync short of a
// real blur; a synthetic blur dispatch is the disallowed hack — see generate.ts's `subscribeExternalSync`
// doc), not something this bridge can root-cause-fix. Asserted here via the control's own `.value`/
// `.checked` property (what "reflects into the rendered control" means for those two types), never
// `getValue()` (which stays wall-gated exactly as documented).

const SYNC_SECTION: SettingsSection = {
  id: 'sync', label: 'Sync',
  fields: [
    { key: 'name', type: 'text', label: 'Name', default: '' },
    { key: 'count', type: 'number', label: 'Count', default: 0 },
    { key: 'when', type: 'date', label: 'When', default: '' },
    { key: 'enabled', type: 'boolean', label: 'Enabled', default: false },
    {
      key: 'mode', type: 'select', label: 'Mode', default: 'a',
      options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
    },
    { key: 'level', type: 'slider', label: 'Level', default: 0, validation: { min: 0, max: 10 } },
  ],
}

describe('generateSection — external sync (TKT-0021, store.subscribe)', () => {
  it('text: an external store.set reflects into the control\'s own value', () => {
    const store = createMemoryStore()
    const { element } = generateSection(SYNC_SECTION, store)
    connect(element)
    store.set('name', 'Ada')
    const control = element.querySelector('ui-text-field[name="name"]') as unknown as { value: string }
    expect(control.value).toBe('Ada')
  })

  it('number (the codec-wall type): an external store.set reflects the RAW value into the control (visible immediately; canonical stays wall-gated until a real blur, unchanged from schema.test.ts:127)', () => {
    const store = createMemoryStore()
    const { element } = generateSection(SYNC_SECTION, store)
    connect(element)
    store.set('count', 42)
    const control = element.querySelector('ui-text-field[name="count"]') as unknown as { value: string }
    expect(control.value).toBe('42')
  })

  it('date (the codec-wall type): an external store.set reflects the RAW ISO value into the control', () => {
    const store = createMemoryStore()
    const { element } = generateSection(SYNC_SECTION, store)
    connect(element)
    store.set('when', '2024-03-04')
    const control = element.querySelector('ui-text-field[name="when"]') as unknown as { value: string }
    expect(control.value).toBe('2024-03-04')
  })

  it('boolean: an external store.set checks/unchecks the switch', () => {
    const store = createMemoryStore()
    const { element } = generateSection(SYNC_SECTION, store)
    connect(element)
    store.set('enabled', true)
    const control = element.querySelector('ui-switch') as unknown as { checked: boolean }
    expect(control.checked).toBe(true)
    store.set('enabled', false)
    expect(control.checked).toBe(false)
  })

  it('select: an external store.set selects the matching option', () => {
    const store = createMemoryStore()
    const { element } = generateSection(SYNC_SECTION, store)
    connect(element)
    store.set('mode', 'b')
    const control = element.querySelector('ui-select') as unknown as { value: string }
    expect(control.value).toBe('b')
  })

  it('slider: an external store.set moves the value', () => {
    const store = createMemoryStore()
    const { element } = generateSection(SYNC_SECTION, store)
    connect(element)
    store.set('level', 7)
    const control = element.querySelector('ui-slider') as unknown as { value: number }
    expect(control.value).toBe(7)
  })

  it('NO echo: an external set never re-invokes store.set (asserts exactly zero additional writes)', async () => {
    const store = createMemoryStore()
    const setSpy = vi.spyOn(store, 'set')
    const { element } = generateSection(SYNC_SECTION, store)
    connect(element)
    setSpy.mockClear() // drop the calls generateSection's own construction may have made, if any
    store.set('name', 'Bob') // the "external" write under test
    await whenFlushed()
    expect(setSpy).toHaveBeenCalledTimes(1) // ONLY the call this test made — the reflection wrote no more
  })

  it('a USER edit still commits exactly once — the subscribe echo-back does not double-commit (Object.is cutoff)', async () => {
    const store = createMemoryStore()
    const setSpy = vi.spyOn(store, 'set')
    const { element } = generateSection(SYNC_SECTION, store)
    connect(element)
    setSpy.mockClear()
    const control = element.querySelector('ui-switch') as unknown as HTMLElement & { checked: boolean }
    control.checked = true
    control.dispatchEvent(new Event('change', { bubbles: true }))
    await whenFlushed()
    expect(setSpy).toHaveBeenCalledTimes(1)
    expect(setSpy).toHaveBeenCalledWith('enabled', true)
  })

  it('a store WITHOUT subscribe: byte-identical — generateSection never throws, resubscribe() is a safe no-op', () => {
    const bareStore: SettingsStore = {
      get: (key) => (key === 'enabled' ? true : undefined),
      set: () => {},
    }
    const { element, resubscribe } = generateSection(SYNC_SECTION, bareStore)
    connect(element)
    const control = element.querySelector('ui-switch') as unknown as { checked: boolean }
    expect(control.checked).toBe(true) // the initial store.get() seed still applies, unchanged
    const dispose = resubscribe()
    expect(() => dispose()).not.toThrow()
  })

  it('resubscribe() re-arms external sync on the SAME control — no DOM regeneration (the reconnect law)', () => {
    const store = createMemoryStore()
    const { element, dispose, resubscribe } = generateSection(SYNC_SECTION, store)
    const controlBefore = element.querySelector('ui-switch')
    connect(element)

    // Simulate settings.ts's disconnected(): the ORIGINAL subscribe listener is torn down — an external
    // set no longer reflects at all.
    dispose()
    const control = element.querySelector('ui-switch') as unknown as { checked: boolean }
    store.set('enabled', true)
    expect(control.checked).toBe(false) // confirmed dead — subscribe died with dispose()

    // Re-arm WITHOUT touching the DOM (no generateSection call, no new control) — the reconnect fix.
    const freshDispose = resubscribe()
    store.set('enabled', true) // the memory-store notifies on every set() regardless of value-unchanged;
    // this re-notification now reaches the freshly re-armed listener, which reflects (control.checked is
    // still false from the dead write above, so Object.is fails and setValue(true) fires).
    expect(control.checked).toBe(true)
    expect(element.querySelector('ui-switch')).toBe(controlBefore) // the SAME node — never regenerated
    freshDispose()
  })
})

// ── the select commit-event gap (a real functional bug in the shipped Phase 3 feature this ticket
// extends, caught while auditing every registry type's commit event for the external-sync work) ────────
//
// `ui-select` never emits a native `change` — only `select` (its own code comment, select.ts). generate.ts
// wired `change` universally, so a `select`-type field's user edit NEVER persisted to the store in the
// shipped Phase 3, until now. `COMMIT_EVENT` (generate.ts) fixes it with a per-type, exhaustively-typed
// event-name table, verified against each control's own `.md` descriptor's `events:` block.

describe('generateSection — per-field commit event (the select gap fix)', () => {
  it("select: a real user commit (the control's OWN 'select' event) persists to the store — the pre-fix gap, fixed", async () => {
    const store = createMemoryStore()
    const { element } = generateSection(SYNC_SECTION, store)
    connect(element)
    const control = element.querySelector('ui-select') as unknown as HTMLElement & { value: string }
    control.value = 'b'
    control.dispatchEvent(new Event('select', { bubbles: true })) // ui-select's ONLY commit event
    await whenFlushed()
    expect(store.get('mode')).toBe('b')
  })

  it("select: dispatching 'change' (the pre-fix listener) commits NOTHING — proves the fix targets the right event, not an extra one alongside the wrong one", async () => {
    const store = createMemoryStore()
    const { element } = generateSection(SYNC_SECTION, store)
    connect(element)
    const control = element.querySelector('ui-select') as unknown as HTMLElement & { value: string }
    control.value = 'b'
    control.dispatchEvent(new Event('change', { bubbles: true })) // ui-select never fires this itself
    await whenFlushed()
    expect(store.get('mode')).toBeUndefined()
  })

  it('the other five v1 types still commit on their own documented event — unregressed by the per-type table', async () => {
    const store = createMemoryStore()
    const { element } = generateSection(SYNC_SECTION, store)
    connect(element)

    const text = element.querySelector('ui-text-field[name="name"]') as unknown as HTMLElement & { value: string }
    text.value = 'Ada'
    text.dispatchEvent(new Event('change', { bubbles: true }))

    const boolean = element.querySelector('ui-switch') as unknown as HTMLElement & { checked: boolean }
    boolean.checked = true
    boolean.dispatchEvent(new Event('change', { bubbles: true }))

    const slider = element.querySelector('ui-slider') as unknown as HTMLElement & { value: number }
    slider.value = 9
    slider.dispatchEvent(new Event('change', { bubbles: true }))

    await whenFlushed()
    expect(store.get('name')).toBe('Ada')
    expect(store.get('enabled')).toBe(true)
    expect(store.get('level')).toBe(9)
  })

  it('external-set reflection on select stays zero-echo across the \'select\' commit-event path', async () => {
    const store = createMemoryStore()
    const setSpy = vi.spyOn(store, 'set')
    const { element } = generateSection(SYNC_SECTION, store)
    connect(element)
    setSpy.mockClear()
    store.set('mode', 'b') // the "external" write under test
    await whenFlushed()
    expect(setSpy).toHaveBeenCalledTimes(1) // only this test's own call — reflecting via setValue() never dispatches 'select'
  })

  it('a select USER commit still commits exactly once — the subscribe echo-back does not double-commit', async () => {
    const store = createMemoryStore()
    const setSpy = vi.spyOn(store, 'set')
    const { element } = generateSection(SYNC_SECTION, store)
    connect(element)
    setSpy.mockClear()
    const control = element.querySelector('ui-select') as unknown as HTMLElement & { value: string }
    control.value = 'b'
    control.dispatchEvent(new Event('select', { bubbles: true }))
    await whenFlushed()
    expect(setSpy).toHaveBeenCalledTimes(1)
    expect(setSpy).toHaveBeenCalledWith('mode', 'b')
  })
})
