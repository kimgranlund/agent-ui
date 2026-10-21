// provenance.browser.test.ts: T-0162 (agent-content SPEC ACS-R8, ACS-R10) in real engines (chromium and
// webkit, the packages project). The settings pane renders one control per pane-edited field of the
// persona kind schema and no control without a row; each control and entry row carries its provenance;
// a place that differs from its seed shows who changed it, a Modified marker, the seed value and Reset;
// a place the seed moved under shows Seed changed and Take seed. Reset returns the place to the seed.
import { describe, it, expect, afterEach } from 'vitest'

import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/code/editor.css'
import '../settings/settings.css'
import '../entry-list/entry-list.css'
import './agent-admin.css'
import './agent-admin.ts'
import type { UIAgentAdminElement } from './agent-admin.ts'
import '@agent-ui/icons/phosphor'
import { BANKROLL_CAPABLE_KEY, BANKROLL_KEY, SURFACE_AUTHORING_KEY } from './agent-admin-schema.ts'
import { PANE_HOMES, PERSONA_FIELDS, PERSONA_FIELD_BY_KEY } from './content-fields.ts'
import { createOverlayStore, emptyOverlay, rebaseOverlay, setOverlayKey, type OverlayStore, type Provenance } from './agent-overlay.ts'
import { createMemoryStore } from '../settings/memory-store.ts'
import { entriesStoreKey, readEntries, type Entry } from '../entry-list/entry-data.ts'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
  localStorage.clear()
})

const frames = async (n = 3): Promise<void> => {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r))
}

const SKILL_KEY = entriesStoreKey('skill')
const SEED_SKILL: Entry = { id: 'menu-card', kind: 'skill', label: 'menu-card', description: 'A menu.', content: 'Show the menu.', order: 0, enabled: true, builtin: false }
const SEED: Record<string, unknown> = { name: 'Seed Name', model: 'claude-haiku-5-5', [SKILL_KEY]: [SEED_SKILL] }

async function mount(store: UIAgentAdminElement['store'], setup?: (el: UIAgentAdminElement) => void): Promise<UIAgentAdminElement> {
  const wrapper = document.createElement('div')
  wrapper.style.width = '1280px'
  wrapper.style.height = '800px'
  wrapper.style.display = 'flex'
  const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
  el.style.flex = '1 1 auto'
  el.store = store
  setup?.(el)
  wrapper.append(el)
  document.body.append(wrapper)
  mounted.push(wrapper)
  await el.updateComplete
  await frames()
  return el
}

const overlayStore = (seed: Record<string, unknown> = SEED): OverlayStore => createOverlayStore({ seed, overlay: emptyOverlay('agent', 1, seed) })

/** The strip under the control for `key` (`ui-field` for a settings row), or null. */
function stripFor(el: UIAgentAdminElement, key: string): HTMLElement | null {
  const anchor = el.querySelector(`[data-part="settings-pane"] [data-field~="${key}"]`)
  const next = anchor?.nextElementSibling
  return next?.getAttribute('data-part') === 'field-provenance' ? (next as HTMLElement) : null
}

const provenanceOf = (el: UIAgentAdminElement, key: string): string | null =>
  el.querySelector(`[data-part="settings-pane"] [data-field~="${key}"]`)?.getAttribute('data-provenance') ?? null

async function until(predicate: () => boolean, label: string): Promise<void> {
  for (let i = 0; i < 60 && !predicate(); i++) await new Promise((r) => setTimeout(r, 25))
  expect(predicate(), label).toBe(true)
}

describe('ACS-R10: the pane renders exactly the schema', () => {
  it('every pane-edited schema field has a [data-field] control, and every control names a pane-edited row', async () => {
    // Haiku 5.5's capability row offers every Model section field; bankrollCapable mounts nothing extra.
    const el = await mount(createMemoryStore({ initial: { model: 'claude-haiku-5-5', name: 'Coverage', [BANKROLL_CAPABLE_KEY]: true } }))
    const pane = el.querySelector('[data-part="settings-pane"]')!
    const rendered = new Set([...pane.querySelectorAll('[data-field]')].flatMap((node) => (node.getAttribute('data-field') ?? '').split(' ')))
    const expected = new Set(PERSONA_FIELDS.filter((f) => f.key !== undefined && PANE_HOMES.includes(f.home)).map((f) => f.key!))
    for (const key of expected) expect(rendered.has(key), `no control for schema field ${key}`).toBe(true)
    for (const key of rendered) expect(expected.has(key), `control ${key} has no pane-homed schema row`).toBe(true)
    // The label a row shows is its schema row's label, never a second copy: each surface, detail, response
    // type and bankroll row, each kind fold's switch and the settings form's own fields.
    const labelOf = (key: string): string => PERSONA_FIELD_BY_KEY.get(key)!.label
    for (const row of pane.querySelectorAll<HTMLElement>('[data-part="surface-row"][data-field], [data-part="surface-detail-row"][data-field], [data-part="prefers-row"], [data-part="bankroll-row"]')) {
      const label = row.querySelector('[data-part="surface-label"], [data-part="surface-detail-label"], [data-part="bankroll-label"]')
      expect(label?.textContent, row.getAttribute('data-field')!).toBe(labelOf(row.getAttribute('data-field')!))
    }
    for (const toggle of pane.querySelectorAll<HTMLElement>('[data-part="kind-enabled"][data-field]')) {
      expect(toggle.getAttribute('aria-label')).toBe(`${labelOf(toggle.getAttribute('data-field')!)} enabled`)
    }
    // T-0391 (Kim 2026-10-21): inside a server tool's drawer, whose heading names the tool, a field shows its
    // schema label without the tool name ("Web search max uses" reads "Max uses").
    for (const field of pane.querySelectorAll<HTMLElement & { label: string }>('ui-field[data-field]')) {
      const full = labelOf(field.getAttribute('data-field')!)
      const toolKey = field.closest('[data-part="server-tool-row"]')?.getAttribute('data-field')
      const prefix = toolKey ? `${labelOf(toolKey)} ` : undefined
      const rest = prefix && full.startsWith(prefix) ? full.slice(prefix.length) : undefined
      expect(field.label).toBe(rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : full)
    }
  })
})

describe('ACS-R8: provenance, the modified marker, the diff and reset', () => {
  it('a seed row reads seed with no strip; a user edit shows Edited, Modified and the seed; Reset returns it', async () => {
    const store = overlayStore()
    const el = await mount(store)
    expect(provenanceOf(el, 'name')).toBe('seed')
    expect(stripFor(el, 'name')).toBeNull()

    store.set('name', 'Mine')
    await until(() => stripFor(el, 'name') !== null, 'the name strip appears')
    const strip = stripFor(el, 'name')!
    expect(provenanceOf(el, 'name')).toBe('user')
    expect(strip.querySelector('[data-part="provenance-source"]')?.textContent).toBe('Edited')
    expect(strip.querySelector('[data-part="provenance-marker"]')?.textContent).toBe('Modified')
    expect(strip.querySelector('[data-part="provenance-diff"]')?.textContent).toBe('Seed: "Seed Name"')
    // The strip is laid out, not just present: a real box under the field.
    expect(strip.getBoundingClientRect().height).toBeGreaterThan(0)

    ;(strip.querySelector('[data-part="provenance-reset"]') as HTMLElement).click()
    await until(() => stripFor(el, 'name') === null, 'the strip leaves after Reset')
    expect(store.get('name')).toBe('Seed Name')
    expect(store.overlay().values).toEqual({})
    expect(provenanceOf(el, 'name')).toBe('seed')
  })

  it('a Builder patch applied through the real consumption site reads Builder', async () => {
    const store = overlayStore()
    const el = await mount(store)
    el.agentSurfaceTurn = async function* () {
      yield { kind: 'patch' as const, patch: { values: { effort: 'low' } } }
      yield { kind: 'note' as const, note: 'Done.' }
    }
    el.authoringStore = createMemoryStore({ initial: { [SURFACE_AUTHORING_KEY]: true, name: 'Builder' } })
    await el.updateComplete
    await frames()
    const copilot = el.querySelector('[data-part="copilot-pane"]') as HTMLElement
    const composer = copilot.querySelector('ui-conversation-composer') as HTMLElement & { value: string; busy: boolean }
    composer.value = 'make it quick'
    ;(composer.querySelector('[data-part="send"]') as HTMLElement).click()
    await until(() => store.get('effort') === 'low', 'the patch applies')
    await until(() => stripFor(el, 'effort') !== null, 'the effort strip appears')
    expect(provenanceOf(el, 'effort')).toBe('builder')
    expect(stripFor(el, 'effort')!.querySelector('[data-part="provenance-source"]')?.textContent).toBe('Builder')
  })

  it('an entry added from a library pack reads Pack on its row; its Reset removes it', async () => {
    const store = overlayStore()
    const el = await mount(store, (admin) => {
      admin.libraries = { skill: [{ id: 'shelf', label: 'Shelf', description: 'A pack.', entries: [{ label: 'Wine list', description: 'Wines.', content: 'List the wines.' }] }] }
    })
    const section = el.querySelector(`[data-field="${SKILL_KEY}"]`) as HTMLElement
    const menu = section.querySelector('[data-part="entry-library-menu"]') as HTMLElement
    menu.dispatchEvent(new CustomEvent('select', { detail: { value: 'shelf:0', index: 0 } }))
    await until(() => readEntries(store, 'skill').length === 2, 'the pack entry is added')
    const added = readEntries(store, 'skill')[1]!
    const rowOf = (id: string): HTMLElement | null => section.querySelector(`[data-part="entry"][data-entry-id="${id}"]`)
    await until(() => rowOf(added.id)?.querySelector('[data-part="field-provenance"]') != null, 'the pack row strip appears')
    expect(rowOf(added.id)!.getAttribute('data-provenance')).toBe('pack')
    expect(rowOf(SEED_SKILL.id)!.getAttribute('data-provenance')).toBe('seed')
    const strip = rowOf(added.id)!.querySelector('[data-part="field-provenance"]')!
    expect(strip.querySelector('[data-part="provenance-source"]')?.textContent).toBe('Pack')
    expect(strip.querySelector('[data-part="provenance-diff"]')?.textContent).toBe('Added')

    ;(strip.querySelector('[data-part="provenance-reset"]') as HTMLElement).click()
    await until(() => readEntries(store, 'skill').length === 1, 'Reset removes the pack entry')
    expect(store.overlay().lists).toEqual({})
  })

  it('a field the seed moved under shows Seed changed and Take seed; Take seed reads the new seed', async () => {
    const old = { ...SEED, name: 'Old seed' }
    const next = { ...SEED, name: 'New seed' }
    const overlay = rebaseOverlay(setOverlayKey(old, emptyOverlay('agent', 1, old), 'name', 'Mine'), next, 'agent', 2)
    const store = createOverlayStore({ seed: next, overlay })
    const el = await mount(store)
    await until(() => stripFor(el, 'name') !== null, 'the conflict strip appears')
    const strip = stripFor(el, 'name')!
    expect(strip.querySelector('[data-part="provenance-marker"]')?.textContent).toBe('Seed changed')
    expect(strip.querySelector('[data-part="provenance-diff"]')?.textContent).toBe('Seed now: "New seed"')
    const take = strip.querySelector('[data-part="provenance-reset"]') as HTMLElement
    expect(take.textContent).toBe('Take seed')
    take.click()
    await until(() => stripFor(el, 'name') === null, 'the strip leaves after Take seed')
    expect(store.get('name')).toBe('New seed')
  })

  it('runtime state (the bankroll a game writes, and its own reset) carries no provenance and no strip', async () => {
    const store = overlayStore({ ...SEED, [BANKROLL_CAPABLE_KEY]: true })
    const el = await mount(store)
    store.set(BANKROLL_KEY, 120)
    await frames()
    await new Promise((r) => setTimeout(r, 50))
    expect(store.overlay().values[BANKROLL_KEY]).toBeDefined()
    expect(stripFor(el, BANKROLL_KEY)).toBeNull()
    expect(provenanceOf(el, BANKROLL_KEY)).toBeNull()
    ;(el.querySelector('[data-part="bankroll-reset"]') as HTMLElement).click()
    await frames()
    expect(stripFor(el, BANKROLL_KEY)).toBeNull()
  })

  it('a control whose places two surfaces wrote reads Mixed, never one of them', async () => {
    // T-0391 split the model grid's two keys (the Default model select carries `model`), so the two-place
    // control here is a list: the Builder removes a seed entry, the user reorders the rest.
    const seedEntry = (id: string, order: number): Entry => ({ ...SEED_SKILL, id, label: id, order })
    const store = overlayStore({ ...SEED, [SKILL_KEY]: [seedEntry('a', 0), seedEntry('b', 1), seedEntry('c', 2)] })
    const el = await mount(store)
    store.setFrom(SKILL_KEY, [seedEntry('b', 1), seedEntry('c', 2)], 'builder')
    store.set(SKILL_KEY, [seedEntry('c', 0), seedEntry('b', 1)])
    await until(() => provenanceOf(el, SKILL_KEY) === 'mixed', 'the skill list reads mixed')
    expect(stripFor(el, SKILL_KEY)?.querySelector('[data-part="provenance-source"]')?.textContent).toBe('Mixed')
  })

  it('a whole-record store (an import) stamps its provenance on every control and offers no reset', async () => {
    const record = Object.assign(createMemoryStore({ initial: { ...SEED, name: 'Imported one' } }), { provenance: (): Provenance => 'imported' })
    const el = await mount(record)
    record.set('name', 'Changed')
    await frames()
    await new Promise((r) => setTimeout(r, 50))
    expect(provenanceOf(el, 'name')).toBe('imported')
    expect(provenanceOf(el, 'agentEnabled')).toBe('imported')
    expect(stripFor(el, 'name')).toBeNull()
  })
})
