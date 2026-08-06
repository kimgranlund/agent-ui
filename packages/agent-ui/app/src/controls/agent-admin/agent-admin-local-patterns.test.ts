// agent-admin-local-patterns.test.ts — SPEC-R5 (`persona-catalog-composition.spec.md`): the persona's
// local-pattern-set SELECTION (A2UI_LOCAL_PATTERNS_KEY) and the effective-catalogId resolution it feeds
// (resolveEffectiveCatalogId). AC1's export/import round-trip lives in
// `site/pages/agent-admin-persona-file.test.ts` (the file that owns PERSONA_STATE_KEYS' own suite);
// this file covers the schema-level unit (sanitizeLocalPatterns/resolveEffectiveCatalogId) plus AC2/AC3
// driven end-to-end through the real `ui-agent-admin` component.

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import '@agent-ui/app/agent-admin'
import type { UIAgentAdminElement } from '@agent-ui/app/agent-admin'
import { createMemoryStore } from '@agent-ui/app'
import { SHIPPED_PERSONA_CATALOGS } from '@agent-ui/a2ui'
import {
  A2UI_CATALOG_KEY,
  A2UI_LOCAL_PATTERNS_KEY,
  DEFAULT_A2UI_CATALOG_ID,
  SURFACE_A2UI_KEY,
  sanitizeLocalPatterns,
  resolveEffectiveCatalogId,
} from './agent-admin-schema.ts'

// The jsdom ElementInternals stub (agent-admin.test.ts / agent-admin-persona-file.test.ts verbatim) —
// jsdom's real attachInternals doesn't implement setFormValue/setValidity, and the real ui-agent-admin
// mounts real FACE form controls (ui-switch/ui-text-field/ui-slider) that call them on connect.
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

const FIXTURE = SHIPPED_PERSONA_CATALOGS.find((p) => p.personaId === 'fixture-demo')!

describe('sanitizeLocalPatterns — fail-closed unset/malformed/unknown coerce to undefined', () => {
  it('a known shipped persona id passes through', () => {
    expect(sanitizeLocalPatterns(FIXTURE.personaId)).toBe(FIXTURE.personaId)
  })
  it('unset/malformed/unknown all coerce to undefined ("no selection")', () => {
    expect(sanitizeLocalPatterns(undefined)).toBeUndefined()
    expect(sanitizeLocalPatterns(42)).toBeUndefined()
    expect(sanitizeLocalPatterns('nobody-shipped-this')).toBeUndefined()
  })
})

describe('resolveEffectiveCatalogId — SPEC-R5 AC2/AC3', () => {
  it('AC2 — no selection resolves to the base catalog alone (the identity case)', () => {
    expect(resolveEffectiveCatalogId('agent-ui', undefined)).toBe('agent-ui')
    expect(resolveEffectiveCatalogId('a2ui-basic', undefined)).toBe('a2ui-basic')
  })

  it('a selection targeting the SAME base resolves to that pairing\'s derived id', () => {
    expect(resolveEffectiveCatalogId('agent-ui', FIXTURE.personaId)).toBe(`agent-ui--${FIXTURE.personaId}`)
    expect(resolveEffectiveCatalogId('a2ui-basic', FIXTURE.personaId)).toBe(`a2ui-basic--${FIXTURE.personaId}`)
  })

  it('AC3 — a selection targeting a base OTHER than the currently-selected base degrades to the base alone', () => {
    // fixture-demo targets both shipped bases; simulate a persona whose selection names a base it does
    // NOT target by asking for a base no shipped fragment targets at all — the not-actually-registered
    // pairing must degrade, never throw and never resolve to a wrong id.
    expect(resolveEffectiveCatalogId('not-a-real-base', FIXTURE.personaId)).toBe('not-a-real-base')
  })

  it('an unknown persona selection degrades to the base alone (never a hard error)', () => {
    expect(resolveEffectiveCatalogId('agent-ui', 'nobody-shipped-this')).toBe('agent-ui')
  })
})

describe('ui-agent-admin surface turn — SPEC-R5 AC2/AC3 end-to-end (the real component)', () => {
  const mounted: Element[] = []
  afterEach(() => {
    for (const el of mounted.splice(0)) el.remove()
  })

  function composerSubmit(el: UIAgentAdminElement, text: string): void {
    const composer = el.querySelector('ui-conversation-composer') as HTMLElement & { value: string }
    composer.value = text
    const editor = composer.querySelector('[data-part="editor"]') as HTMLElement
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  }

  it('AC2 — no local-pattern-set selection threads the base catalogId, byte-identical to pre-SPEC-R5 behavior', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set(SURFACE_A2UI_KEY, true)
    const seen: { catalogId?: string }[] = []
    el.agentSurfaceTurn = async function* (req) {
      seen.push(req)
      yield { kind: 'note' as const, note: 'ok' }
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    composerSubmit(el, 'draw')
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0))
    expect(seen).toHaveLength(1)
    expect(seen[0]!.catalogId).toBe(DEFAULT_A2UI_CATALOG_ID)
  })

  it('a selection targeting the CURRENT base threads the derived catalogId', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set(SURFACE_A2UI_KEY, true)
    el.store!.set(A2UI_LOCAL_PATTERNS_KEY, FIXTURE.personaId)
    const seen: { catalogId?: string }[] = []
    el.agentSurfaceTurn = async function* (req) {
      seen.push(req)
      yield { kind: 'note' as const, note: 'ok' }
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    composerSubmit(el, 'draw')
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0))
    expect(seen).toHaveLength(1)
    expect(seen[0]!.catalogId).toBe(`${DEFAULT_A2UI_CATALOG_ID}--${FIXTURE.personaId}`)
  })

  it('AC3 — a selection whose fragment does NOT target the current base degrades to the base alone, never a hard error', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set(SURFACE_A2UI_KEY, true)
    el.store!.set(A2UI_CATALOG_KEY, 'a2ui-basic')
    el.store!.set(A2UI_LOCAL_PATTERNS_KEY, 'nobody-shipped-this') // unknown selection — the fail-closed edge
    const seen: { catalogId?: string }[] = []
    el.agentSurfaceTurn = async function* (req) {
      seen.push(req)
      yield { kind: 'note' as const, note: 'ok' }
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    composerSubmit(el, 'draw')
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0))
    expect(seen).toHaveLength(1)
    expect(seen[0]!.catalogId).toBe('a2ui-basic') // degraded to the base, not agent-ui, not a throw
  })
})
