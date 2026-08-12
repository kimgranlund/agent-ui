// follow-the-change.test.ts — the reaction engine's jsdom truth-table (GH #695/#721, ADR-0181,
// follow-the-change.spec.md SPEC-R1/R3/R4/R6/R7/R8; LLD-C6). jsdom cannot paint (getClientRects is
// always empty) — which IS the narrow band under SPEC §1's pixel-truth Visible definition — so the
// wide-band paths stub the settings pane's own getClientRects (one rect ⇒ paints); the REAL
// scroll/paint/animationend proofs are agent-admin.browser.test.ts's (SPEC-R3 AC1 · SPEC-R5).
//
// Harness: the agent-admin-authoring.test.ts shape verbatim (mountAdmin's replayed surface runner, the
// real composer submit, personaStore's page-true seeding) — the reaction only ever fires downstream of
// the SAME consumption condition that file already proves at both polarities, so these tests drive real
// consumed patches through the real apply loop, never a direct #followChange call.

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UIAgentAdminElement } from './agent-admin.ts'
import { createMemoryStore } from '../settings/memory-store.ts'
import type { SettingsStore } from '../settings/store.ts'
import type { AdminSurfaceTurnEvent, AdminSurfaceTurnRequest } from './agent-admin-schema.ts'
import { ENTRY_KINDS, initialEntryValues } from './entries.ts'
import { entriesStoreKey } from '../entry-list/entry-data.ts'
import { DEFAULT_MODEL_ID, SUPPORTED_MODELS, initialValuesFor, defaultAgentConfigSchema, SURFACE_AUTHORING_KEY } from './agent-admin-schema.ts'

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
  localStorage.clear()
})

function personaStore(extra: Record<string, unknown> = {}): SettingsStore {
  return createMemoryStore({ initial: { model: DEFAULT_MODEL_ID, ...initialValuesFor(defaultAgentConfigSchema), ...initialEntryValues(), ...extra } })
}

function mountAdmin(options: { store: SettingsStore; authoringStore?: SettingsStore; events?: AdminSurfaceTurnEvent[] }): {
  el: UIAgentAdminElement
  requests: AdminSurfaceTurnRequest[]
} {
  const requests: AdminSurfaceTurnRequest[] = []
  const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
  el.store = options.store
  el.agentSurfaceTurn = async function* (req: AdminSurfaceTurnRequest) {
    requests.push(req)
    for (const event of options.events ?? []) yield event
  }
  document.body.append(el)
  mounted.push(el)
  if (options.authoringStore) el.authoringStore = options.authoringStore
  return { el, requests }
}

async function submitAuthoring(el: UIAgentAdminElement, text: string): Promise<void> {
  await whenFlushed()
  const composer = el.querySelector('[data-part="copilot-pane"] > ui-conversation-composer') as HTMLElement & { value: string }
  const editor = composer.querySelector('[data-part="editor"]') as HTMLElement
  composer.value = text
  editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  for (let round = 0; round < 3; round += 1) {
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0))
  }
  await whenFlushed()
}

/** Make the settings pane PAINT under jsdom (the wide band): one synthetic client rect. jsdom's default
 *  (an empty list) IS the narrow band — no stub needed for those paths. */
function stubWide(el: UIAgentAdminElement): void {
  const pane = el.querySelector('[data-part="settings-pane"]') as HTMLElement
  pane.getClientRects = () => [{ width: 400, height: 600 }] as unknown as DOMRectList
}

const settingsNavOf = (el: UIAgentAdminElement): { selected: string } =>
  el.querySelector('[data-part="settings-nav"]') as unknown as { selected: string }
const holderOf = (el: UIAgentAdminElement): HTMLElement => el.querySelector('[data-part="pane-holder"]') as HTMLElement
const washed = (el: UIAgentAdminElement): string[] =>
  Array.from(el.querySelectorAll('[data-part="settings-item"][data-attention]')).map((f) => f.getAttribute('data-item') ?? '')
const noteTextOf = (el: UIAgentAdminElement): string =>
  (el.querySelector('[data-part="copilot-pane"] [data-part="log"]') as HTMLElement).textContent ?? ''

const BUILDER = { [SURFACE_AUTHORING_KEY]: true, name: 'Builder' }

describe('SPEC-R1 — commit-time trigger, zero-reaction table', () => {
  it('AC1: a fully-dropped patch produces zero visibility writes, zero washes, zero receipt lines', async () => {
    const { el } = mountAdmin({
      store: personaStore(),
      authoringStore: personaStore(BUILDER),
      events: [{ kind: 'patch', patch: { values: { notARealKey: 1 } } }, { kind: 'note', note: 'ok' }],
    })
    await whenFlushed()
    stubWide(el)
    const holder = holderOf(el)
    const showBefore = holder.getAttribute('data-show')
    const primaryBefore = holder.getAttribute('data-primary')
    await submitAuthoring(el, 'drop everything')
    expect(washed(el)).toEqual([])
    expect(holder.getAttribute('data-show')).toBe(showBefore)
    expect(holder.getAttribute('data-primary')).toBe(primaryBefore)
    expect(noteTextOf(el)).not.toContain('Updated ')
  })

  it('AC2: a patch refused by the gate (patchIgnored) produces the same zero', async () => {
    const { el } = mountAdmin({
      store: personaStore(),
      authoringStore: personaStore({ name: 'Builder' }), // gate absent ⇒ OFF — the refusal path
      events: [{ kind: 'patch', patch: { values: { model: SUPPORTED_MODELS[0]!.id } } }, { kind: 'note', note: 'ok' }],
    })
    await whenFlushed()
    stubWide(el)
    await submitAuthoring(el, 'refused')
    expect(washed(el)).toEqual([])
    expect(noteTextOf(el)).not.toContain('Updated ')
  })

  it('SPEC-R8 AC2: a hand store.set (no patch event) fires nothing', async () => {
    const store = personaStore()
    const { el } = mountAdmin({ store, authoringStore: personaStore(BUILDER) })
    await whenFlushed()
    stubWide(el)
    store.set('model', SUPPORTED_MODELS[1]!.id)
    await whenFlushed()
    expect(washed(el)).toEqual([])
  })
})

describe('SPEC-R3 — the wide-band reaction (paint stubbed; real scroll is the browser probe)', () => {
  it('AC1 (jsdom half): a consumed `model` patch selects the Agent section and washes the model fold', async () => {
    const { el } = mountAdmin({
      store: personaStore(),
      authoringStore: personaStore(BUILDER),
      events: [{ kind: 'patch', patch: { values: { model: SUPPORTED_MODELS[1]!.id } } }, { kind: 'note', note: 'set' }],
    })
    await whenFlushed()
    stubWide(el)
    // start the user on Capabilities — the ticket's own scenario
    const nav = settingsNavOf(el)
    nav.selected = 'capabilities-content'
    ;(el as unknown as { applySettingsSectionSeam?: never })
    await whenFlushed()
    await submitAuthoring(el, 'use the second model')
    expect(nav.selected).toBe('agent-content')
    expect(washed(el)).toContain('model')
    const section = el.querySelector('div[data-role="agent-content"]') as HTMLElement
    expect(section.hidden).toBe(false)
  })

  it('AC2: settings already visible and the right section selected ⇒ data-show/data-primary byte-unchanged', async () => {
    const { el } = mountAdmin({
      store: personaStore(),
      authoringStore: personaStore(BUILDER),
      events: [{ kind: 'patch', patch: { values: { model: SUPPORTED_MODELS[1]!.id } } }, { kind: 'note', note: 'set' }],
    })
    await whenFlushed()
    stubWide(el)
    const holder = holderOf(el)
    const showBefore = holder.getAttribute('data-show')
    const primaryBefore = holder.getAttribute('data-primary')
    await submitAuthoring(el, 'model change, no visibility change owed')
    expect(holder.getAttribute('data-show')).toBe(showBefore)
    expect(holder.getAttribute('data-primary')).toBe(primaryBefore)
    expect(washed(el)).toContain('model')
  })

  it('SPEC-R6 AC1: one patch touching model + entries:skill ⇒ Agent selected, model washed now, skill queued for Capabilities', async () => {
    const { el } = mountAdmin({
      store: personaStore(),
      authoringStore: personaStore(BUILDER),
      events: [
        { kind: 'patch', patch: { values: { model: SUPPORTED_MODELS[1]!.id }, entries: { [entriesStoreKey(ENTRY_KINDS.skill)]: [{ label: 'Log a lift' }] } } },
        { kind: 'note', note: 'both' },
      ],
    })
    await whenFlushed()
    stubWide(el)
    await submitAuthoring(el, 'model and a skill')
    const nav = settingsNavOf(el)
    expect(nav.selected).toBe('agent-content') // the FIRST applied key's location wins
    expect(washed(el)).toContain('model')
    expect(washed(el)).not.toContain(ENTRY_KINDS.skill) // queued, not washed — its section is elsewhere
    // the queued attention fires on the user's own section flip (SPEC-R4.2 hook (a))
    nav.selected = 'capabilities-content'
    ;(el as unknown as { [k: string]: unknown }) // programmatic write emits no select — drive the apply directly
    const applySeam = (el as unknown as { applySettingsSectionSeam?: (key: string) => void }).applySettingsSectionSeam
    if (applySeam) applySeam.call(el, 'capabilities-content')
    else {
      // fall back to the tabs' own select event path
      const tabs = el.querySelector('[data-part="settings-nav"]') as HTMLElement
      tabs.dispatchEvent(new CustomEvent('select', { detail: { value: 'capabilities-content', index: 1 } }))
    }
    await whenFlushed()
    expect(washed(el)).toContain(ENTRY_KINDS.skill)
  })
})

describe('SPEC-R4 — suppression + the narrow degrade + pending attention', () => {
  it('AC1: focus inside the settings pane ⇒ section unchanged, no yank; receipt still rides the note', async () => {
    const { el } = mountAdmin({
      store: personaStore(),
      authoringStore: personaStore(BUILDER),
      events: [{ kind: 'patch', patch: { values: { model: SUPPORTED_MODELS[1]!.id } } }, { kind: 'note', note: 'set' }],
    })
    await whenFlushed()
    stubWide(el)
    const nav = settingsNavOf(el)
    nav.selected = 'capabilities-content'
    // seat focus inside the settings pane (any focusable child)
    const pane = el.querySelector('[data-part="settings-pane"]') as HTMLElement
    const focusable = document.createElement('button')
    pane.append(focusable)
    focusable.focus()
    expect(pane.contains(document.activeElement)).toBe(true)
    await submitAuthoring(el, 'suppressed')
    expect(nav.selected).toBe('capabilities-content') // no section yank
    expect(noteTextOf(el)).toContain('Updated Agent › Model') // the receipt is the affordance
    focusable.remove()
  })

  it('AC2 (narrow): visibility byte-unchanged at completion; the wash fires ONCE on the user’s own reveal', async () => {
    const { el } = mountAdmin({
      store: personaStore(),
      authoringStore: personaStore(BUILDER),
      events: [{ kind: 'patch', patch: { values: { model: SUPPORTED_MODELS[1]!.id } } }, { kind: 'note', note: 'set' }],
    })
    await whenFlushed()
    // NO stub — jsdom's empty getClientRects IS the narrow band
    const holder = holderOf(el)
    const showBefore = holder.getAttribute('data-show')
    const primaryBefore = holder.getAttribute('data-primary')
    await submitAuthoring(el, 'narrow')
    expect(holder.getAttribute('data-show')).toBe(showBefore) // net-zero at reaction completion
    expect(holder.getAttribute('data-primary')).toBe(primaryBefore)
    expect(washed(el)).toEqual([])
    // the user reveals settings themselves (a write-driven reveal — hook (b)); the pane now paints
    stubWide(el)
    const seam = el as unknown as { setPaneVisibilitySeam(s: readonly ('chat' | 'settings' | 'copilot')[], p: 'chat' | 'settings' | 'copilot'): void }
    seam.setPaneVisibilitySeam(['settings'], 'settings')
    await whenFlushed()
    expect(washed(el)).toContain('model') // fired exactly once, for the selected (Agent) section
    // a repeat reveal washes nothing (the queue cleared)
    ;(el.querySelector('[data-part="settings-item"][data-item="model"]') as HTMLElement).removeAttribute('data-attention')
    seam.setPaneVisibilitySeam(['chat'], 'chat')
    await whenFlushed()
    seam.setPaneVisibilitySeam(['settings'], 'settings')
    await whenFlushed()
    expect(washed(el)).toEqual([])
  })

  it('AC3: a persona switch clears pending attention (no ghost wash on the next draft)', async () => {
    const { el } = mountAdmin({
      store: personaStore(),
      authoringStore: personaStore(BUILDER),
      events: [{ kind: 'patch', patch: { values: { model: SUPPORTED_MODELS[1]!.id } } }, { kind: 'note', note: 'set' }],
    })
    await whenFlushed()
    await submitAuthoring(el, 'narrow — queues pending') // jsdom narrow: pending queued
    el.store = personaStore() // a REAL persona switch (store identity change)
    await whenFlushed()
    stubWide(el)
    const seam = el as unknown as { setPaneVisibilitySeam(s: readonly ('chat' | 'settings' | 'copilot')[], p: 'chat' | 'settings' | 'copilot'): void }
    seam.setPaneVisibilitySeam(['settings'], 'settings')
    await whenFlushed()
    expect(washed(el)).toEqual([]) // the queue died with the old draft
  })
})

describe('SPEC-R7 — the receipt line', () => {
  it('AC1: one line per changed location, the Agent-fold degeneracy collapsed, values never echoed', async () => {
    const { el } = mountAdmin({
      store: personaStore(),
      authoringStore: personaStore(BUILDER),
      events: [
        { kind: 'patch', patch: { values: { name: 'Coach', model: SUPPORTED_MODELS[1]!.id } } },
        { kind: 'note', note: 'Both set.' },
      ],
    })
    await whenFlushed()
    await submitAuthoring(el, 'name and model')
    const note = noteTextOf(el)
    expect(note).toContain('Updated Agent') // the `name` key's fold — collapsed, never `Agent › Agent`
    expect(note).not.toContain('Updated Agent › Agent')
    expect(note).toContain('Updated Agent › Model')
    expect(note).not.toContain('Coach') // values deliberately not echoed... (the note's own prose aside)
  })

  it('AC2: #logTurn’s patch record is byte-unchanged by the receipt', async () => {
    const { el } = mountAdmin({
      store: personaStore(),
      authoringStore: personaStore(BUILDER),
      events: [{ kind: 'patch', patch: { values: { model: SUPPORTED_MODELS[1]!.id } } }, { kind: 'note', note: 'set' }],
    })
    await whenFlushed()
    await submitAuthoring(el, 'model only')
    const newest = el.querySelector('[data-part="context-turn"] [data-part="context-json"]')
    const record = JSON.parse(newest?.textContent ?? '{}') as { response?: { patch?: { applied?: string[] } } }
    expect(record.response?.patch?.applied).toEqual(['model'])
  })
})

describe('SPEC-R8 AC1 — the per-fold truth-table (sampled key per fold)', () => {
  const CASES: ReadonlyArray<{ label: string; patch: { values?: Record<string, unknown>; entries?: Record<string, unknown[]> }; section: string; item: string }> = [
    { label: 'agent', patch: { values: { name: 'X' } }, section: 'agent-content', item: 'agent' },
    { label: 'model', patch: { values: { model: SUPPORTED_MODELS[1]!.id } }, section: 'agent-content', item: 'model' },
    { label: 'bankroll', patch: { values: { bankrollCapable: true } }, section: 'agent-content', item: 'bankroll' },
    { label: 'prompt-section', patch: { entries: { [entriesStoreKey(ENTRY_KINDS.promptSection)]: [{ label: 'Rule', content: 'Be terse.' }] } }, section: 'capabilities-content', item: ENTRY_KINDS.promptSection },
    { label: 'skill', patch: { entries: { [entriesStoreKey(ENTRY_KINDS.skill)]: [{ label: 'S' }] } }, section: 'capabilities-content', item: ENTRY_KINDS.skill },
    { label: 'workflow', patch: { entries: { [entriesStoreKey(ENTRY_KINDS.workflow)]: [{ label: 'W' }] } }, section: 'capabilities-content', item: ENTRY_KINDS.workflow },
    { label: 'resource', patch: { entries: { [entriesStoreKey(ENTRY_KINDS.resource)]: [{ label: 'R' }] } }, section: 'capabilities-content', item: ENTRY_KINDS.resource },
    { label: 'tool', patch: { entries: { [entriesStoreKey(ENTRY_KINDS.tool)]: [{ label: 'T' }] } }, section: 'capabilities-content', item: ENTRY_KINDS.tool },
    { label: 'surface', patch: { values: { surfaceGenui: true } }, section: 'surface-content', item: 'surface' },
    { label: 'pattern-source', patch: { entries: { [entriesStoreKey(ENTRY_KINDS.patternSource)]: [{ label: 'P' }] } }, section: 'surface-content', item: ENTRY_KINDS.patternSource },
  ]
  for (const c of CASES) {
    it(`a consumed ${c.label} patch navigates to ${c.section} › ${c.item}`, async () => {
      const { el } = mountAdmin({
        store: personaStore(),
        authoringStore: personaStore(BUILDER),
        events: [{ kind: 'patch', patch: c.patch }, { kind: 'note', note: 'ok' }],
      })
      await whenFlushed()
      stubWide(el)
      await submitAuthoring(el, `write ${c.label}`)
      expect(settingsNavOf(el).selected).toBe(c.section)
      expect(washed(el)).toContain(c.item)
    })
  }
})
