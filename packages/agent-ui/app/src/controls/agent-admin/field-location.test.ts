import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { locationFor, type FieldLocation } from './field-location.ts'
import { PERSONA_STATE_KEYS } from './persona-patch.ts'
import { UIAgentAdminElement } from './agent-admin.ts'

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
    for (const key of PERSONA_STATE_KEYS) {
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
