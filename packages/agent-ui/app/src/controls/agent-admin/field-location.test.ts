import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { locationFor, type FieldLocation } from './field-location.ts'
import { PERSONA_STATE_KEYS } from './persona-patch.ts'
import { UIAgentAdminElement } from './agent-admin.ts'
import { SERVER_TOOL_SETTING_KEYS } from './agent-admin-schema.ts'
import { PERSONA_FIELD_BY_KEY } from './content-fields.ts'

/** T-0391: the server tool keys are pane-edited, not patchable, but they render in the Model fold and its
 *  tool drawers, so the anchor gates walk them beside `PERSONA_STATE_KEYS`. */
const SERVER_TOOL_KEYS: readonly string[] = Object.values(SERVER_TOOL_SETTING_KEYS).flatMap((keys) => Object.values(keys).filter((k): k is string => k !== undefined))
const ANCHORED_KEYS: readonly string[] = [...PERSONA_STATE_KEYS, ...SERVER_TOOL_KEYS]

// field-location.test.ts — SPEC-R2's two parity gates (follow-the-change, GH #695/#721; LLD-C2). The map
// is a small hand-grouped listing over derived key spreads — these gates, not the listing, are what make
// that acceptable (LLD §3): AC1 reddens when a key joins `PERSONA_STATE_KEYS` without a location; AC2
// reddens when the composed DOM's sections/folds/labels move out from under the map's claims.

// jsdom reality (the agent-admin.test.ts precedent, verbatim): composing the real element connects real
// FACE form controls, and jsdom's ElementInternals lacks setFormValue/setValidity.
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

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

describe('field-location — totality over PERSONA_STATE_KEYS (SPEC-R2 AC1)', () => {
  it('every canonical persona key resolves to a defined location', () => {
    const unmapped = PERSONA_STATE_KEYS.filter((key) => locationFor(key) === undefined)
    expect(unmapped, `key(s) joined PERSONA_STATE_KEYS without a field-location entry: ${unmapped.join(', ')}`).toEqual([])
  })

  it('an unknown key returns undefined — fail-closed, never a throw (AC3)', () => {
    expect(locationFor('not-a-real-key')).toBeUndefined()
    expect(locationFor('')).toBeUndefined()
    // wire-origin strings that would resolve on a prototype-chain-walking object lookup (the Map rationale)
    expect(locationFor('constructor')).toBeUndefined()
    expect(locationFor('toString')).toBeUndefined()
  })
})

describe('field-location — anchor parity against the composed DOM (SPEC-R2 AC2)', () => {
  it('every distinct (section, item) the map emits matches a real composed anchor, labels included', async () => {
    const admin = document.createElement('ui-agent-admin') as UIAgentAdminElement
    document.body.append(admin)
    mounted.push(admin)
    await whenFlushed()

    const emitted = new Map<string, FieldLocation>()
    for (const key of ANCHORED_KEYS) {
      const location = locationFor(key)
      if (location !== undefined) emitted.set(`${location.section}/${location.item}`, location)
    }
    expect(emitted.size).toBeGreaterThan(0)

    for (const location of emitted.values()) {
      const section = admin.querySelector(`div[data-role="${location.section}"]`)
      expect(section, `section anchor ${location.section} must exist in the composed DOM`).not.toBeNull()
      expect(section!.getAttribute('data-segment'), `${location.section}'s human label`).toBe(location.sectionLabel)
      const fold = section!.querySelector(`[data-part="settings-item"][data-item="${location.item}"]`)
      expect(fold, `fold anchor ${location.section} › ${location.item} must exist inside its section`).not.toBeNull()
      expect(fold!.getAttribute('summary'), `${location.item}'s fold summary`).toBe(location.itemLabel)
    }
  })
})

describe('T-0391 layout: the Agent tab item mappings', () => {
  it('T-0391 layout: tagline and category map to Agent, the set-once model rows to Advanced, effort and thinking stay in Model, bankroll to Danger zone', () => {
    const at = (key: string): string | undefined => {
      const l = locationFor(key)
      return l && `${l.section}/${l.item}/${l.itemLabel}`
    }
    for (const key of ['tagline', 'category']) expect(at(key), key).toBe('agent-content/agent/Agent')
    for (const key of ['effort', 'thinking', 'model', 'modelsIncluded']) expect(at(key), key).toBe('agent-content/model/Model')
    for (const key of ['showReasoning', 'maxTokens', 'cacheTtl']) expect(at(key), key).toBe('agent-content/advanced/Advanced')
    for (const key of ['bankroll', 'bankrollCapable']) expect(at(key), key).toBe('agent-content/danger/Danger zone')
  })
})

// ── T-0391: the drawer level (fork 6, Kim 2026-10-21: a drawer field washes its trigger, never opens it) ──
describe('T-0391 drawer: the drawer level of the field→location map', () => {
  it('T-0391 drawer: modelsIncluded maps to the Manage models drawer, each tool\'s detail keys to its own drawer, the enabled keys stay drawer-less', () => {
    expect(locationFor('modelsIncluded')).toMatchObject({ section: 'agent-content', item: 'model', drawer: 'models', drawerLabel: 'Manage models' })
    for (const key of ['model', 'effort', 'thinking']) expect(locationFor(key)?.drawer, key).toBeUndefined()
    for (const [tool, { enabled, ...detail }] of Object.entries(SERVER_TOOL_SETTING_KEYS)) {
      expect(locationFor(enabled), enabled).toMatchObject({ section: 'agent-content', item: 'model' })
      expect(locationFor(enabled)?.drawer, `${enabled} stays on its open row`).toBeUndefined()
      const label = PERSONA_FIELD_BY_KEY.get(enabled)?.label
      expect(label, `${enabled} has a schema label`).toBeTruthy()
      for (const key of Object.values(detail)) {
        expect(locationFor(key!), key).toMatchObject({ section: 'agent-content', item: 'model', drawer: `tool-${tool}`, drawerLabel: label })
      }
    }
  })

  it('T-0391 drawer: every drawer a location names sits in its fold anchor with its heading and its trigger', async () => {
    const admin = document.createElement('ui-agent-admin') as UIAgentAdminElement
    document.body.append(admin)
    mounted.push(admin)
    await whenFlushed()

    const drawers = new Map<string, FieldLocation>()
    for (const key of ANCHORED_KEYS) {
      const location = locationFor(key)
      if (location?.drawer !== undefined) drawers.set(`${location.section}/${location.item}/${location.drawer}`, location)
    }
    expect([...drawers.values()].map((l) => l.drawer).sort()).toEqual(['models', ...Object.keys(SERVER_TOOL_SETTING_KEYS).map((tool) => `tool-${tool}`)].sort())

    for (const location of drawers.values()) {
      const fold = admin.querySelector(`div[data-role="${location.section}"] [data-part="settings-item"][data-item="${location.item}"]`)
      expect(fold, `fold anchor ${location.item}`).not.toBeNull()
      const drawer = fold!.querySelector(`ui-drawer[data-drawer="${location.drawer}"]`)
      expect(drawer, `drawer ${location.drawer} must sit inside the ${location.item} fold`).not.toBeNull()
      expect(drawer!.querySelector('[data-part="drawer-heading"]')?.textContent, `${location.drawer}'s heading`).toBe(location.drawerLabel)
      expect(fold!.querySelector(`[data-part="drawer-trigger"][data-opens="${location.drawer}"]`), `${location.drawer}'s trigger`).not.toBeNull()
    }
  })
})
