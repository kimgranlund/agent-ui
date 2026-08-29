// agent-roster-source.test.ts — ADR-0227 wave 1 (GH #1542): the roster source's own laws.
// Three stakes: (1) PERSISTED-DATA COMPATIBILITY — the adapter-tier writes land on the EXACT raw keys
// (and value forms) the retired hand-rolled agent-admin-presets.ts bookkeeping used, including the one
// deliberate delta (the active id is JSON now, with an explicit tolerant read for the legacy RAW form);
// (2) the ported roster laws (order application, imported-only rename/delete fences, the trailing-dot
// sweep boundary); (3) the @agent-ui/data adoption mechanics — a `resource()` over the `view` sub-source
// serves a seeded store synchronously and refetches on a `mutation()`-shaped invalidation (headless, the
// SPEC-R3 grammar this wave exists to consume for real).
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createStore, mutation, resource } from '@agent-ui/data'
import {
  IMPORTED_PERSONAS_KEY,
  PERSONA_ROSTER_NAMESPACE,
  ROSTER_ORDER_KEY,
  applyRosterOrder,
  createAgentRosterSource,
  type AgentRecord,
  type AgentRosterView,
} from './agent-roster-source.ts'

const shipped: AgentRecord[] = [
  { id: 'alpha', label: 'Alpha', tagline: 'first', seed: { name: 'Alpha' } },
  { id: 'beta', label: 'Beta', tagline: 'second', seed: { name: 'Beta' } },
]

const imported = (id: string, label: string): AgentRecord => ({
  id,
  label,
  tagline: `${label} tagline`,
  seed: { name: label },
  imported: true,
})

function clearNamespace(): void {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(`${PERSONA_ROSTER_NAMESPACE}.`)) localStorage.removeItem(key)
  }
}

beforeEach(clearNamespace)
afterEach(clearNamespace)

/** The default-adapter source — the production construction, so writes hit the REAL raw keys. */
const source = (): ReturnType<typeof createAgentRosterSource<AgentRecord>> =>
  createAgentRosterSource<AgentRecord>({ shipped })

describe('persisted-data compatibility — the retired raw keys, byte-for-byte (ADR-0227 acceptance)', () => {
  it('the exported raw-key constants ARE the legacy key names', () => {
    expect(IMPORTED_PERSONAS_KEY).toBe('agent-admin-app.importedPersonas')
    expect(ROSTER_ORDER_KEY).toBe('agent-admin-app.rosterOrder')
  })

  it('a legacy imported-personas record (raw JSON array) reads back verbatim, and an upsert rewrites the SAME key', () => {
    localStorage.setItem(IMPORTED_PERSONAS_KEY, JSON.stringify([imported('cust', 'Custom')]))
    const s = source()
    expect(s.importedSync().map((p) => p.id)).toEqual(['cust'])
    s.upsertImportedSync(imported('cust-2', 'Custom Two'))
    expect(JSON.parse(localStorage.getItem(IMPORTED_PERSONAS_KEY)!).map((p: AgentRecord) => p.id)).toEqual(['cust', 'cust-2'])
  })

  it('a legacy order record reads back; saveOrderSync rewrites the SAME key in the SAME form', () => {
    localStorage.setItem(ROSTER_ORDER_KEY, JSON.stringify(['beta', 'alpha']))
    const s = source()
    expect(s.orderSync()).toEqual(['beta', 'alpha'])
    s.saveOrderSync(['alpha', 'beta'])
    expect(localStorage.getItem(ROSTER_ORDER_KEY)).toBe('["alpha","beta"]')
  })

  it('legacy seedVersion/modifiedAt markers (String(n) writes) read back as numbers, and new writes are byte-identical', () => {
    localStorage.setItem(`${PERSONA_ROSTER_NAMESPACE}.alpha.seedVersion`, '5') // the legacy String(wanted) form
    localStorage.setItem(`${PERSONA_ROSTER_NAMESPACE}.alpha.modifiedAt`, '1755000000000')
    const s = source()
    expect(s.seedVersionSync('alpha')).toBe(5)
    expect(s.modifiedAtSync('alpha')).toBe(1755000000000)
    s.writeSeedVersionSync('alpha', 6)
    expect(localStorage.getItem(`${PERSONA_ROSTER_NAMESPACE}.alpha.seedVersion`), 'JSON.stringify(6) === String(6)').toBe('6')
  })

  it('THE legacy delta, migrated: a pre-wave RAW active id reads back; the next write re-persists it as JSON', () => {
    localStorage.setItem(`${PERSONA_ROSTER_NAMESPACE}.activePreset`, 'beta') // raw, NOT JSON — the pre-ADR-0227 form
    const s = source()
    expect(s.activeIdSync(), 'the explicit legacy migration read keeps the selection').toBe('beta')
    s.writeActiveIdSync('alpha')
    expect(localStorage.getItem(`${PERSONA_ROSTER_NAMESPACE}.activePreset`), 'new writes are adapter-JSON').toBe('"alpha"')
    expect(s.activeIdSync()).toBe('alpha')
  })

  it('a corrupt (non-string JSON) active record fails closed to undefined — never a throw, never a junk id', () => {
    localStorage.setItem(`${PERSONA_ROSTER_NAMESPACE}.activePreset`, '42')
    expect(source().activeIdSync()).toBeUndefined()
  })
})

describe('the roster laws, ported (GH #845/#848 — order · rename · delete)', () => {
  it('listSync: shipped first, imports in import order, the persisted order applied on top, ghosts skipped', () => {
    const s = source()
    s.upsertImportedSync(imported('cust', 'Custom'))
    expect(s.listSync().map((p) => p.id), 'natural order with no record').toEqual(['alpha', 'beta', 'cust'])
    s.saveOrderSync(['cust', 'ghost', 'alpha', 'cust'])
    expect(s.listSync().map((p) => p.id), 'ordered; ghost skipped; repeat harmless; unlisted follow natural').toEqual(['cust', 'alpha', 'beta'])
  })

  it('applyRosterOrder is pure and exported — an empty order reproduces the natural order byte for byte', () => {
    expect(applyRosterOrder(shipped, []).map((p) => p.id)).toEqual(['alpha', 'beta'])
  })

  it('renameImportedSync: display-only, in-place (no reorder), imported-only, blank-refusing', () => {
    const s = source()
    s.upsertImportedSync(imported('c1', 'One'))
    s.upsertImportedSync(imported('c2', 'Two'))
    expect(s.renameImportedSync(shipped[0]!, 'Nope'), 'a shipped preset is rename-fenced').toBe(false)
    expect(s.renameImportedSync(s.importedSync()[0]!, '   '), 'blank refused').toBe(false)
    expect(s.renameImportedSync(imported('gone', 'Gone'), 'X'), 'no record answers — refused').toBe(false)
    expect(s.renameImportedSync(s.importedSync()[0]!, '  One Renamed  '), 'trimmed and accepted').toBe(true)
    expect(s.importedSync().map((p) => [p.id, p.label]), 'in place — c1 did not move to the end').toEqual([
      ['c1', 'One Renamed'],
      ['c2', 'Two'],
    ])
  })

  it('removeImportedSync: sweeps ONLY `${id}.` keys (trailing-dot boundary), drops the record + order slot, fires onRemove', () => {
    const evicted: string[] = []
    const s = createAgentRosterSource<AgentRecord>({ shipped, onRemove: (id) => evicted.push(id) })
    s.upsertImportedSync(imported('travel', 'Travel'))
    s.upsertImportedSync(imported('travel-imported', 'Travel Imported'))
    s.saveOrderSync(['travel', 'alpha'])
    localStorage.setItem(`${PERSONA_ROSTER_NAMESPACE}.travel.name`, '"Travel"')
    localStorage.setItem(`${PERSONA_ROSTER_NAMESPACE}.travel-imported.name`, '"Neighbour"')

    expect(s.removeImportedSync(shipped[0]!), 'a shipped preset is delete-fenced, nothing touched').toBe(false)
    expect(s.removeImportedSync(s.importedSync().find((p) => p.id === 'travel')!)).toBe(true)

    expect(localStorage.getItem(`${PERSONA_ROSTER_NAMESPACE}.travel.name`), 'its state keys swept').toBeNull()
    expect(localStorage.getItem(`${PERSONA_ROSTER_NAMESPACE}.travel-imported.name`), 'the leading-substring neighbour untouched').toBe('"Neighbour"')
    expect(s.importedSync().map((p) => p.id)).toEqual(['travel-imported'])
    expect(s.orderSync(), 'the order slot is gone').toEqual(['alpha'])
    expect(evicted, 'the composition root’s cache-eviction seam fired').toEqual(['travel'])
  })

  it('resetStateSync sweeps the persona namespace but never the roster records or the active id', () => {
    const s = source()
    s.upsertImportedSync(imported('cust', 'Custom'))
    s.writeActiveIdSync('cust')
    localStorage.setItem(`${PERSONA_ROSTER_NAMESPACE}.cust.name`, '"Edited"')
    s.resetStateSync('cust')
    expect(localStorage.getItem(`${PERSONA_ROSTER_NAMESPACE}.cust.name`)).toBeNull()
    expect(s.importedSync(), 'reset means "back to how it shipped", not "gone"').toHaveLength(1)
    expect(s.activeIdSync()).toBe('cust')
  })
})

describe('the DataSource verbs (ADR-0227 clause 4 — read · list · create · update · remove)', () => {
  const ctx = { signal: new AbortController().signal }

  it('read/list answer the assembled roster; read throws for an unknown id', async () => {
    const s = source()
    expect((await s.list(undefined, ctx)).map((p) => p.id)).toEqual(['alpha', 'beta'])
    expect((await s.read('beta', ctx)).label).toBe('Beta')
    await expect(s.read('ghost', ctx)).rejects.toThrow(/no roster entry/)
  })

  it('create upserts (stamping imported: true); update renames under the rename law; remove deletes under the delete law', async () => {
    const s = source()
    const created = await s.create({ ...imported('cust', 'Custom'), imported: undefined } as AgentRecord, ctx)
    expect(created.imported, 'stamped').toBe(true)
    const renamed = await s.update('cust', { label: 'Custom Renamed' }, ctx)
    expect(renamed.label).toBe('Custom Renamed')
    await expect(s.update('alpha', { label: 'X' }, ctx), 'shipped is rename-fenced — a refusal, never silence').rejects.toThrow()
    await s.remove('cust', ctx)
    expect(s.importedSync()).toEqual([])
    await expect(s.remove('alpha', ctx), 'shipped is delete-fenced').rejects.toThrow()
  })
})

describe('the adoption mechanics — resource()/mutation() over the view sub-source (headless)', () => {
  it('a store seeded from readViewSync serves the view SYNCHRONOUSLY (the same-tick boot path), and a mutation-shaped invalidation refetches', async () => {
    const s = source()
    s.upsertImportedSync(imported('cust', 'Custom'))
    s.writeActiveIdSync('cust')

    const store = createStore()
    const KEY = 'agent-admin/roster'
    store.commit(KEY, s.readViewSync())
    const r = resource<AgentRosterView<AgentRecord>>(KEY, s.view, { store })
    try {
      // SWR: the seeded value is served in the SAME tick — the page's first paint never waits.
      expect(r.status.peek()).toBe('success')
      expect(r.data.peek()?.personas.map((p) => p.id)).toEqual(['alpha', 'beta', 'cust'])
      expect(r.data.peek()?.activeId).toBe('cust')

      // The mutation grammar: the write runs through the source verb, then invalidates the view key —
      // the resource refetches and the fresh view lands (SPEC-R5's invalidate-on-settle contract).
      const rename = mutation(
        async (label: string, ctx) => s.update('cust', { label }, ctx),
        { store, invalidate: [KEY] },
      )
      const renamed = await rename.run('Custom Renamed')
      expect(renamed?.label).toBe('Custom Renamed')
      await r.refetch() // deterministic settle for the assertion (the invalidate already kicked one off)
      expect(r.data.peek()?.personas.find((p) => p.id === 'cust')?.label).toBe('Custom Renamed')
      rename.dispose()
    } finally {
      r.dispose()
    }
  })
})
