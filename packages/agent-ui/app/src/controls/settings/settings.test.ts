import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest'
import { UISettingsElement } from './settings.ts'
import { createMemoryStore } from './memory-store.ts'
import type { SettingsSchema } from './schema.ts'
import type { SettingsStore } from './store.ts'
import { whenFlushed, UIFormElement } from '@agent-ui/components'
import type { UINavRailItemElement } from '../nav-rail/nav-rail-item.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
} from '@agent-ui/components/descriptor'
import type { ParsedAttribute } from '@agent-ui/components/descriptor'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// n3a — jsdom probes for ui-settings (LLD-C12, SPEC-R9). jsdom cannot resolve the composed
// ui-master-detail's own CSS Grid/@container drill-in — that geometry is settings.browser.test.ts's job
// (the master-detail.test.ts/master-detail.browser.test.ts split, mirrored). This file proves: the
// connect-time generation into a real ui-master-detail + rail + panel, section → panel/rail-marker/event
// derivation (incl. no-event-on-first-run), degenerate schema handling (absent / unsupported version),
// reconnect-safe rail wiring, and the descriptor's structural + contract↔props/source trip-wires.

// jsdom reality (validate.test.ts's header) — no native ElementInternals.setFormValue/setValidity; the
// prototype is stubbed for this file's duration so the REAL generated fleet controls (ui-text-field/
// ui-switch, via generate.ts) this composition connects can connect at all.
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

function mount(el: UISettingsElement): UISettingsElement {
  document.body.append(el)
  mounted.push(el)
  return el
}

const SCHEMA: SettingsSchema = {
  version: 1,
  sections: [
    { id: 'general', label: 'General', fields: [{ key: 'name', type: 'text', label: 'Name', default: '' }] },
    { id: 'privacy', label: 'Privacy', fields: [{ key: 'shareData', type: 'boolean', label: 'Share data', default: false }] },
  ],
}

// A schema whose ONLY native-validity-free field (`required` on a `boolean`) exercises the validate.ts
// setCustomValidity BRIDGE, not a native constraint prop — the MAJOR reconnect finding only reproduces on
// a field whose validity is reactive (SCHEMA above uses no `validation` at all, so it never exposed it).
const SCHEMA_WITH_REACTIVE_VALIDATION: SettingsSchema = {
  version: 1,
  sections: [
    { id: 'general', label: 'General', fields: [{ key: 'agree', type: 'boolean', label: 'Agree', default: false, validation: { required: true } }] },
  ],
}

describe('UISettingsElement — upgrade + defaults', () => {
  it('upgrades to the class; section defaults to the empty string; schema/store default to undefined', () => {
    const el = mount(document.createElement('ui-settings') as UISettingsElement)
    expect(el).toBeInstanceOf(UISettingsElement)
    expect(el.section).toBe('')
    expect(el.schema).toBeUndefined()
    expect(el.store).toBeUndefined()
  })

  it('static props is exactly [schema, store, section]', () => {
    expect(Object.keys(UISettingsElement.props)).toEqual(['schema', 'store', 'section'])
  })
})

describe('UISettingsElement — composition (SPEC-R9, "0 bespoke shell CSS")', () => {
  it('composes exactly one ui-master-detail with a rail (list pane) and a panel (detail pane)', () => {
    const el = mount(new UISettingsElement())
    const md = el.querySelector('ui-master-detail')
    expect(md).not.toBeNull()
    expect(el.children).toHaveLength(1)
    const listPane = md!.querySelector('ui-master-detail-pane[pane="list"]')
    const detailPane = md!.querySelector('ui-master-detail-pane[pane="detail"]')
    expect(listPane!.querySelector('ui-nav-rail')).not.toBeNull()
    expect(detailPane!.querySelector('[data-part="panel"]')).not.toBeNull()
  })

  it('no schema ⇒ an empty rail, no throw', () => {
    const el = new UISettingsElement()
    expect(() => mount(el)).not.toThrow()
    expect(el.querySelectorAll('ui-nav-rail-item')).toHaveLength(0)
  })

  it('an unsupported schema version renders a notice, never throws', () => {
    const el = new UISettingsElement()
    el.schema = { version: 2 as unknown as 1, sections: [] }
    expect(() => mount(el)).not.toThrow()
    expect(el.querySelector('[data-part="notice"]')).not.toBeNull()
  })

  it('one rail-item per section, labelled from the schema', () => {
    const el = new UISettingsElement()
    el.schema = SCHEMA
    mount(el)
    const items = el.querySelectorAll<UINavRailItemElement>('ui-nav-rail-item')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toBe('General')
    expect(items[0].dataset.sectionId).toBe('general')
    expect(items[1].textContent).toBe('Privacy')
  })

  it('resolves the default active section to the FIRST section when `section` is unset', () => {
    const el = new UISettingsElement()
    el.schema = SCHEMA
    mount(el)
    expect(el.section).toBe('general')
    expect(el.querySelector('[data-part="panel"] ui-form-provider ui-field')?.textContent).toContain('') // a provider is mounted
    const panel = el.querySelector('[data-part="panel"]') as HTMLElement
    expect(panel.querySelector('ui-text-field')).not.toBeNull() // the general section's field
  })

  it('a pre-set `section` (deep link) is honoured over the first-section default', () => {
    const el = document.createElement('ui-settings') as UISettingsElement
    el.schema = SCHEMA
    el.section = 'privacy'
    mount(el)
    expect(el.section).toBe('privacy')
    const panel = el.querySelector('[data-part="panel"]') as HTMLElement
    expect(panel.querySelector('ui-switch')).not.toBeNull() // the privacy section's field
  })
})

describe('UISettingsElement — section → panel/rail-marker + select/change (SPEC-R9 AC2)', () => {
  it('the resolved default at connect does NOT fire select/change', () => {
    const el = document.createElement('ui-settings') as UISettingsElement
    el.schema = SCHEMA
    const spy = vi.fn()
    el.addEventListener('select', spy)
    el.addEventListener('change', spy)
    mount(el)
    expect(spy).not.toHaveBeenCalled()
  })

  it('reassigning `section` after connect fires ONE select + ONE change, switches the panel + rail marker', async () => {
    const el = mount(new UISettingsElement())
    el.schema = SCHEMA
    await el.updateComplete
    const selectSpy = vi.fn()
    const changeSpy = vi.fn()
    el.addEventListener('select', selectSpy)
    el.addEventListener('change', changeSpy)

    el.section = 'privacy'
    await el.updateComplete

    expect(selectSpy).toHaveBeenCalledTimes(1)
    expect(changeSpy).toHaveBeenCalledTimes(1)
    expect((selectSpy.mock.calls[0][0] as CustomEvent).detail).toBe('privacy')

    const panel = el.querySelector('[data-part="panel"]') as HTMLElement
    expect(panel.querySelector('ui-switch')).not.toBeNull()
    expect(panel.querySelector('ui-text-field')).toBeNull() // the general provider was DETACHED, not destroyed

    const items = el.querySelectorAll<UINavRailItemElement>('ui-nav-rail-item')
    const privacyItem = [...items].find((i) => i.dataset.sectionId === 'privacy')!
    const generalItem = [...items].find((i) => i.dataset.sectionId === 'general')!
    // ADR-0130 cl.4 a11y CORRECTION: an in-page selection commit is role="tab"/aria-selected on the
    // composed ui-nav-rail-item's OWN activator — NOT the old aria-current="page" page-nav verb.
    expect(privacyItem.selected).toBe(true)
    const privacyActivator = privacyItem.querySelector('[data-part="activator"]')!
    expect(privacyActivator.getAttribute('role')).toBe('tab')
    expect(privacyActivator.getAttribute('aria-selected')).toBe('true')
    expect(privacyActivator.hasAttribute('aria-current')).toBe(false)
    expect(generalItem.selected).toBe(false)
    const generalActivator = generalItem.querySelector('[data-part="activator"]')!
    expect(generalActivator.getAttribute('aria-selected')).toBe('false')
    expect(generalActivator.hasAttribute('aria-current')).toBe(false)
  })

  it('clicking a rail item sets `.section` and switches the panel', async () => {
    const el = mount(new UISettingsElement())
    el.schema = SCHEMA
    await el.updateComplete
    const items = el.querySelectorAll<UINavRailItemElement>('ui-nav-rail-item')
    const privacyItem = [...items].find((i) => i.dataset.sectionId === 'privacy')!
    privacyItem.click()
    await el.updateComplete
    expect(el.section).toBe('privacy')
  })
})

describe('UISettingsElement — a real store round-trip through the generated field', () => {
  it('a change on a generated field commits to the supplied store', async () => {
    const store = createMemoryStore()
    const el = mount(new UISettingsElement())
    el.store = store
    el.schema = SCHEMA
    await el.updateComplete
    const control = el.querySelector('ui-text-field') as unknown as HTMLElement & { value: string }
    // the active (first, "general") section's control is a ui-text-field
    expect(control).not.toBeNull()
    control.value = 'Ada'
    control.dispatchEvent(new Event('change', { bubbles: true }))
    await Promise.resolve() // the commit is deferred one microtask (generate.ts — the codec staleness guard)
    expect(store.get('name')).toBe('Ada')
  })

  it("a REAL select field's user commit (its own 'select' event) reaches the store end-to-end (the select gap fix)", async () => {
    const store = createMemoryStore()
    const el = mount(new UISettingsElement())
    el.store = store
    el.schema = {
      version: 1,
      sections: [{
        id: 'general', label: 'General',
        fields: [{
          key: 'theme', type: 'select', label: 'Theme', default: 'light',
          options: [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }],
        }],
      }],
    }
    await el.updateComplete
    const control = el.querySelector('ui-select') as unknown as HTMLElement & { value: string }
    expect(control).not.toBeNull()
    control.value = 'dark'
    control.dispatchEvent(new Event('select', { bubbles: true })) // ui-select's OWN commit event — never 'change'
    await Promise.resolve()
    expect(store.get('theme')).toBe('dark')
  })
})

describe('UISettingsElement — reconnect (component-reviewer MAJOR class — the master-detail precedent)', () => {
  it('re-parenting a connected instance leaves EXACTLY ONE ui-master-detail — no duplicate composition', () => {
    const el = new UISettingsElement()
    el.schema = SCHEMA
    mount(el)
    expect(el.querySelectorAll('ui-master-detail')).toHaveLength(1)

    const newParent = document.createElement('div')
    document.body.append(newParent)
    newParent.append(el) // a real re-parent: disconnectedCallback then connectedCallback, no children changed

    expect(el.querySelectorAll('ui-master-detail'), 'a second, duplicate composition was appended on reconnect').toHaveLength(1)
    expect(el.querySelectorAll('ui-nav-rail-item')).toHaveLength(2) // not regenerated either
    newParent.remove()
  })

  it('a rail item still works after a reconnect (the select listener is re-armed, not just the DOM preserved)', async () => {
    const el = new UISettingsElement()
    el.schema = SCHEMA
    mount(el)
    await el.updateComplete

    const newParent = document.createElement('div')
    document.body.append(newParent)
    newParent.append(el) // reconnect — a fresh AbortController; the OLD rail select listener (if any) died with it

    const items = el.querySelectorAll<UINavRailItemElement>('ui-nav-rail-item')
    const privacyItem = [...items].find((i) => i.dataset.sectionId === 'privacy')!
    privacyItem.click()
    await el.updateComplete
    expect(el.section, 'the rail item is inert after a reconnect — its listener was not re-armed').toBe('privacy')

    newParent.remove()
  })

  it('a reconnect with the SAME schema/store objects does not rebuild — the generated control survives by node identity', async () => {
    const el = new UISettingsElement()
    el.schema = SCHEMA
    mount(el)
    await el.updateComplete
    const before = el.querySelector('ui-text-field')

    const newParent = document.createElement('div')
    document.body.append(newParent)
    newParent.append(el) // reconnect — SAME el.schema object reference, nothing reassigned
    await el.updateComplete

    const after = el.querySelector('ui-text-field')
    expect(after, 'the generated control was torn down and rebuilt on a mere reconnect').toBe(before)
    newParent.remove()
  })

  it('reactive validation (setCustomValidity) still fires after a reconnect (component-reviewer MAJOR finding)', async () => {
    const calls: string[] = []
    const original = UIFormElement.prototype.setCustomValidity
    UIFormElement.prototype.setCustomValidity = function (this: UIFormElement, message: string): void {
      calls.push(message)
      original.call(this, message)
    }
    try {
      const el = new UISettingsElement()
      el.schema = SCHEMA_WITH_REACTIVE_VALIDATION
      mount(el)
      await el.updateComplete
      const control = el.querySelector('ui-switch') as unknown as HTMLElement & { checked: boolean }
      const provider = el.querySelector('ui-form-provider') as unknown as { valid(): boolean }
      expect(calls.at(-1)).toMatch(/.+/) // required + unchecked ⇒ invalid on first build
      expect(provider.valid()).toBe(false)

      const newParent = document.createElement('div')
      document.body.append(newParent)
      newParent.append(el) // reconnect — SAME el.schema object reference, #build() never re-runs
      await el.updateComplete

      // Pre-fix: disconnected() disposed the ORIGINAL validation effect and nothing re-armed it — this
      // write would call setCustomValidity ZERO times and the control would stay "invalid" forever,
      // regardless of `checked`. Post-fix: the reconnect branch re-applies validation on the SAME control.
      calls.length = 0
      control.checked = true
      await whenFlushed()
      expect(calls.at(-1), 'validation stopped reacting after the reconnect — the MAJOR finding regressed').toBe('')
      expect(provider.valid()).toBe(true)

      control.checked = false
      await whenFlushed()
      expect(calls.at(-1)).toMatch(/.+/)
      expect(provider.valid()).toBe(false)

      newParent.remove()
    } finally {
      UIFormElement.prototype.setCustomValidity = original
    }
  })
})

describe('UISettingsElement — external sync (TKT-0021, store.subscribe)', () => {
  it('an external store.set reflects into the LIVE generated control', async () => {
    const store = createMemoryStore()
    const el = mount(new UISettingsElement())
    el.store = store
    el.schema = SCHEMA
    await el.updateComplete
    const control = el.querySelector('ui-text-field') as unknown as HTMLElement & { value: string }
    store.set('name', 'Grace') // the "external" write — no user gesture, no `change` dispatch
    expect(control.value).toBe('Grace')
  })

  it('the subscribe wiring survives a reconnect (the reconnect law — the reactive-validation precedent)', async () => {
    const store = createMemoryStore()
    const el = mount(new UISettingsElement())
    el.store = store
    el.schema = SCHEMA
    await el.updateComplete

    const newParent = document.createElement('div')
    document.body.append(newParent)
    newParent.append(el) // reconnect — SAME schema/store objects, the re-arm branch (never a rebuild)
    await el.updateComplete

    const control = el.querySelector('ui-text-field') as unknown as HTMLElement & { value: string }
    store.set('name', 'Hedy')
    expect(control.value, 'external sync went inert after a reconnect — the reconnect law regressed').toBe('Hedy')
    newParent.remove()
  })

  it('repeated relocations never leak subscriptions (the reconnect-law leak test)', async () => {
    // A hand-rolled store (not memory-store.ts) so the test can read the listener Set's SIZE directly —
    // the leak signature is "grows without bound across relocations", not any particular value round-trip.
    const listenerCounts: number[] = []
    const values = new Map<string, unknown>()
    const listeners = new Set<(key: string, value: unknown) => void>()
    const store: SettingsStore = {
      get: (key) => values.get(key),
      set: (key, value) => {
        values.set(key, value)
        for (const listener of listeners) listener(key, value)
      },
      subscribe: (listener) => {
        listeners.add(listener)
        listenerCounts.push(listeners.size)
        return () => listeners.delete(listener)
      },
    }
    const el = mount(new UISettingsElement())
    el.store = store
    el.schema = SCHEMA // 2 sections × 1 field each = 2 fields total, generated (and subscribed) up front
    await el.updateComplete

    const parent = document.createElement('div')
    document.body.append(parent)
    for (let i = 0; i < 5; i++) {
      parent.append(el) // a genuine disconnect+reconnect each time (already connected elsewhere)
      await el.updateComplete
    }

    // SCHEMA's 2 fields ⇒ exactly 2 active subscriptions at rest, on the LAST reconnect same as the
    // very first mount — never 3, 4, 5… as relocations repeat.
    expect(listeners.size).toBe(2)
    expect(new Set(listenerCounts)).toEqual(new Set([1, 2])) // every (re)subscribe ever saw AT MOST 2 active — no growth observed across any of the 6 build/re-arm cycles (1 initial + 5 reconnects)
    parent.remove()
  })
})

describe('UISettingsElement — schema/store are REACTIVE (a real reassignment rebuilds; a reconnect does not)', () => {
  it('assigning `schema` AFTER mount (the async-loaded-schema case) builds the rail + panel from scratch', async () => {
    const el = mount(new UISettingsElement()) // no schema at connect time — an empty shell
    expect(el.querySelectorAll('ui-nav-rail-item')).toHaveLength(0)

    el.schema = SCHEMA // arrives later — e.g. after an async fetch
    await el.updateComplete

    expect(el.querySelectorAll('ui-nav-rail-item')).toHaveLength(2)
    expect(el.querySelector('[data-part="panel"] ui-text-field')).not.toBeNull() // the resolved default section's field
  })

  it('reassigning `schema` to a DIFFERENT object rebuilds the rail — the old generated tree is disposed, not reused', async () => {
    const el = mount(new UISettingsElement())
    el.schema = SCHEMA
    await el.updateComplete
    const firstControl = el.querySelector('ui-text-field')
    expect(firstControl).not.toBeNull()

    const OTHER_SCHEMA: SettingsSchema = {
      version: 1,
      sections: [{ id: 'only', label: 'Only', fields: [{ key: 'flag', type: 'boolean', label: 'Flag', default: false }] }],
    }
    el.schema = OTHER_SCHEMA
    await el.updateComplete

    expect(el.querySelectorAll('ui-nav-rail-item')).toHaveLength(1)
    expect(el.querySelector('ui-nav-rail-item')?.textContent).toBe('Only')
    expect(el.querySelector('ui-text-field')).toBeNull() // the old schema's field is GONE, not just hidden
    expect(el.querySelector('ui-switch')).not.toBeNull()
    expect(el.section).toBe('only') // re-resolved — the old `section` ('general') no longer exists
  })
})

describe('UISettingsElement — residue-free disconnect', () => {
  it('disconnect disposes the section→panel/event effect', async () => {
    const el = mount(new UISettingsElement())
    el.schema = SCHEMA
    await el.updateComplete
    const spy = vi.fn()
    el.addEventListener('select', spy)
    el.remove()
    el.section = 'privacy' // a LEAKED effect's re-run is now queued; a disposed one has nothing left
    await whenFlushed()
    expect(spy).not.toHaveBeenCalled()
  })

  it('disconnect never throws even with generated validation effects live', () => {
    const el = mount(new UISettingsElement())
    el.schema = {
      version: 1,
      sections: [{ id: 's', label: 'S', fields: [{ key: 'k', type: 'boolean', label: 'K', default: false, validation: { required: true } }] }],
    }
    expect(() => el.remove()).not.toThrow()
  })
})

// ── descriptor — ADR-0004 (structural + contract↔props + contract↔source) ──────────────────────────────

const DIR = `${process.cwd()}/packages/agent-ui/app/src/controls/settings`
const settingsTs = readFileSync(`${DIR}/settings.ts`, 'utf8') as string
const settingsCss = readFileSync(`${DIR}/settings.css`, 'utf8') as string

describe('settings.md descriptor (ui-settings)', () => {
  const md = readFileSync(`${DIR}/settings.md`, 'utf8') as string
  const { fence, body } = splitFrontmatter(md)
  const parsed = parseDescriptor(fence)
  const ATTR_NAMES = ['schema', 'store', 'section']

  it('has a leading frontmatter fence and a /site prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-settings')
  })

  it('carries the ADR-0004 descriptor field set and is schema-valid', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
    expect(/^tag:\s*ui-settings\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('attributes[] is a faithful bijection with finalize(UISettingsElement).props', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UISettingsElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS (negative control)', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'section' ? { ...a, reflect: false } : a))
    expect(compareDescriptorToProps(flipReflect, UISettingsElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.section.reflect' }),
    )
  })

  it('customStates/slots agree with the source (no undeclared CSS-styled slot, no unused state)', () => {
    expect(compareDescriptorToSource(parsed, { ts: settingsTs, css: settingsCss })).toEqual([])
  })
})
