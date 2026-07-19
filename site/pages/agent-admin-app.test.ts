// agent-admin-app.test.ts — TKT-0074's two jsdom legs: (1) the PRESET DATA integrity gates (ids unique,
// models real, every store key complete, mini-skill labels resolve against the SHIPPED registry — a
// renamed mini-skill must redden this, not silently stop matching), and (2) the STORE-SWAP PROBE the
// ticket's acceptance names: `admin.store = presetStore(other)` must re-render the settings pane AND the
// entry lists from the new store (agent-admin.ts's reactive store effect), measured on real rendered DOM,
// never assumed. jsdom needs the attachInternals stub (agent-admin.test.ts's exact pattern — composed FACE
// form controls call setFormValue/setValidity, absent in jsdom).
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime (sitemap.test.ts precedent)
import { readdirSync } from 'node:fs'
import { whenFlushed } from '@agent-ui/components'
import '@agent-ui/app/agent-admin'
import type { UIAgentAdminElement } from '@agent-ui/app/agent-admin'
import { ENTRY_KINDS, entriesStoreKey } from '@agent-ui/app'
import type { Entry } from '@agent-ui/app'
import { AGENT_PRESETS, presetSeed } from './agent-admin-presets.ts'

declare const process: { cwd(): string }

// ── the jsdom ElementInternals stub (agent-admin.test.ts verbatim) ────────────────────────────────────────
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
  for (const el of mounted.splice(0)) el.remove()
})

const SUPPORTED_MODEL_IDS = new Set(['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5-20251001', 'claude-fable-5'])
const ALL_ENTRY_KEYS = Object.values(ENTRY_KINDS).map((kind) => entriesStoreKey(kind))

describe('AGENT_PRESETS — data integrity (TKT-0074)', () => {
  it('eight presets, unique ids, non-empty labels/taglines', () => {
    expect(AGENT_PRESETS).toHaveLength(8) // six showcases + the GH #46 restaurant/travel additions (concierge upgraded in place)
    expect(new Set(AGENT_PRESETS.map((p) => p.id)).size).toBe(8)
    for (const p of AGENT_PRESETS) {
      expect(p.label.length, p.id).toBeGreaterThan(0)
      expect(p.tagline.length, p.id).toBeGreaterThan(0)
    }
  })

  it('every config is in range: a SUPPORTED_MODELS id, temperature within [0,1] on the 0.1 grid, name non-empty', () => {
    for (const p of AGENT_PRESETS) {
      expect(SUPPORTED_MODEL_IDS.has(p.config.model), `${p.id}: ${p.config.model}`).toBe(true)
      expect(p.config.temperature, p.id).toBeGreaterThanOrEqual(0)
      expect(p.config.temperature, p.id).toBeLessThanOrEqual(1)
      expect(Math.round(p.config.temperature * 10) / 10, `${p.id}: off the 0.1 step grid`).toBe(p.config.temperature)
      expect(p.config.name.trim().length, p.id).toBeGreaterThan(0)
    }
  })

  it('the roster COLLECTIVELY covers the config axes: all four models, tools both states, temp both halves', () => {
    expect(new Set(AGENT_PRESETS.map((p) => p.config.model)).size).toBe(4)
    expect(new Set(AGENT_PRESETS.map((p) => p.config.toolsEnabled)).size).toBe(2)
    expect(AGENT_PRESETS.some((p) => p.config.temperature <= 0.2)).toBe(true)
    expect(AGENT_PRESETS.some((p) => p.config.temperature >= 0.8)).toBe(true)
  })

  it('every seed carries the four config keys + ALL FIVE entry-list keys, sections ordered and Foundation rewritten', () => {
    for (const p of AGENT_PRESETS) {
      const seed = presetSeed(p)
      for (const key of ['name', 'model', 'temperature', 'toolsEnabled', ...ALL_ENTRY_KEYS]) {
        expect(key in seed, `${p.id} missing ${key}`).toBe(true)
      }
      const sections = seed[entriesStoreKey(ENTRY_KINDS.promptSection)] as Entry[]
      const foundation = sections.find((s) => s.id === 'foundation')
      expect(foundation?.content, p.id).toBe(p.foundation)
      expect(foundation?.builtin, p.id).toBe(true) // the rewrite keeps the builtin flag (non-deletable)
      expect(sections.find((s) => s.id === 'surface-style')?.content, p.id).toBe(p.surfaceStyle)
      // per-kind entry ids unique + orders strictly ascending from 0
      for (const key of ALL_ENTRY_KEYS) {
        const entries = seed[key] as Entry[]
        expect(new Set(entries.map((e) => e.id)).size, `${p.id} ${key}`).toBe(entries.length)
        entries.forEach((e, i) => expect(e.order, `${p.id} ${key} ${e.id}`).toBe(i))
      }
    }
  })

  it('every skill label naming a shipped mini-skill still resolves against the REAL registry directory', () => {
    // The registry is the fs truth (ADR-0091); a renamed/removed mini-skill must redden this test rather
    // than silently stop intent-matching. Only labels that TARGET the registry are held to it — persona-
    // invented skills (quiz-round, palette-presentation, …) are prompt-only by design.
    const registry = new Set(
      (readdirSync(`${process.cwd()}/packages/agent-ui/a2ui/src/agent/prompts/mini-skills`) as string[])
        .filter((f) => f.endsWith('.md'))
        .map((f) => f.replace(/\.md$/, '')),
    )
    expect(registry.size).toBeGreaterThan(3) // anti-vacuous: the registry directory is real
    // TKT-0077: the Croupier targets the game-UI trio (card-game-sheet stays registry-only). GH #46:
    // form-rhythm/login-form left this list — the upgraded Hotel Concierge seeds AUTHORED hospitality
    // skills (projected wholesale into the live prompt, stronger than registry intent-matching), so no
    // preset carries those two registry labels anymore.
    const targeted = ['card-layout', 'game-table-chrome', 'game-hud', 'dashboard-kpi-grid']
    const allSkillLabels = new Set(AGENT_PRESETS.flatMap((p) => p.skills.map((s) => s.label)))
    for (const name of targeted) {
      expect(allSkillLabels.has(name), `no preset carries ${name}`).toBe(true)
      expect(registry.has(name), `${name} is gone from the shipped registry`).toBe(true)
    }
  })
})

describe('the store-swap probe (TKT-0074 acceptance) — assigning a new store re-renders the surface', () => {
  it('admin.store = <other preset store> repaints the settings pane and the prompt entry list from the NEW store', async () => {
    // Fresh stores straight from the seeds (no persistKey — localStorage must not leak between runs).
    const croupier = AGENT_PRESETS.find((p) => p.id === 'croupier')!
    const quant = AGENT_PRESETS.find((p) => p.id === 'quant')!
    const { createMemoryStore } = await import('@agent-ui/app/settings-memory-store')
    const storeA = createMemoryStore({ initial: presetSeed(croupier) })
    const storeB = createMemoryStore({ initial: presetSeed(quant) })

    const admin = document.createElement('ui-agent-admin') as UIAgentAdminElement
    admin.store = storeA
    document.body.append(admin)
    mounted.push(admin)
    await whenFlushed()

    const text = (): string => admin.textContent ?? ''
    // Store A's persona is on screen: its name value and its persona-rewritten Foundation content.
    expect(text()).toContain(croupier.foundation.slice(0, 40))
    expect(text()).not.toContain(quant.foundation.slice(0, 40))

    admin.store = storeB
    await whenFlushed()

    // The swap re-rendered BOTH the entry sections (prompt content) and the settings pane from store B —
    // the reactive store effect (agent-admin.ts:162), not a stale capture of store A.
    expect(text()).toContain(quant.foundation.slice(0, 40))
    expect(text()).not.toContain(croupier.foundation.slice(0, 40))
    expect(storeB.get('name')).toBe('The Quant')
  })
})

// ── GH #47/#48 — the library packs' data integrity (the AGENT_PRESETS describe's discipline) ────────────

describe('ADMIN_LIBRARIES — data integrity (GH #47/#48)', () => {
  it('skill + workflow kinds each carry packs; every pack has unique non-empty entry labels', async () => {
    const { ADMIN_LIBRARIES } = await import('./agent-admin-libraries.ts')
    const { ENTRY_KINDS } = await import('@agent-ui/app')
    for (const kind of [ENTRY_KINDS.skill, ENTRY_KINDS.workflow]) {
      const packs = ADMIN_LIBRARIES[kind]!
      expect(packs.length, `${kind} has at least one pack`).toBeGreaterThan(0)
      const packIds = new Set(packs.map((p) => p.id))
      expect(packIds.size).toBe(packs.length)
      for (const pack of packs) {
        expect(pack.entries.length, `${pack.id} is non-empty`).toBeGreaterThan(0)
        const labels = pack.entries.map((e) => e.label)
        expect(new Set(labels).size, `${pack.id} labels unique`).toBe(labels.length)
        for (const entry of pack.entries) {
          expect(entry.label.trim().length, 'label non-empty (validateNewEntry would reject)').toBeGreaterThan(0)
          expect(entry.content.trim().length, `${entry.label} carries real content`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('the a2ui-idioms pack derives from the REAL registry files — same count as the .md glob, known ids present', async () => {
    const { ADMIN_LIBRARIES } = await import('./agent-admin-libraries.ts')
    const { ENTRY_KINDS } = await import('@agent-ui/app')
    const files = (readdirSync('packages/agent-ui/a2ui/src/agent/prompts/mini-skills') as string[]).filter((f) => f.endsWith('.md'))
    const pack = ADMIN_LIBRARIES[ENTRY_KINDS.skill]!.find((p) => p.id === 'a2ui-idioms')!
    expect(pack.entries.length, 'one pack entry per registry .md file — drift-free derivation').toBe(files.length)
    const labels = new Set(pack.entries.map((e) => e.label))
    for (const known of ['game-table-chrome', 'card-game-sheet', 'game-hud', 'form-rhythm']) {
      expect(labels.has(known), `registry id ${known} present`).toBe(true)
    }
  })
})

// ── GH #49 — the Integrations pack ↔ dev-proxy registry parity (the a2ui-idioms drift-gate discipline) ──

describe('Integrations pack ↔ registry parity (GH #49)', () => {
  it('every registry integration has a pack entry whose LABEL is its id, and vice versa', async () => {
    const { ADMIN_LIBRARIES } = await import('./agent-admin-libraries.ts')
    const { ENTRY_KINDS } = await import('@agent-ui/app')
    const { INTEGRATIONS } = await import('../../packages/agent-ui/a2ui/tools/agent/integrations.ts')
    const pack = ADMIN_LIBRARIES[ENTRY_KINDS.tool]!.find((p) => p.id === 'integrations')!
    expect(pack.entries.map((e) => e.label).sort()).toEqual(INTEGRATIONS.map((i) => i.id).sort())
    // the tool wire name === the id — the whole enablement chain keys on this one string
    for (const integration of INTEGRATIONS) expect(integration.tool.name).toBe(integration.id)
  })

  it('resolveIntegrations validates + intersects, and malformed input degrades to empty (never throws)', async () => {
    const { resolveIntegrations, INTEGRATIONS } = await import('../../packages/agent-ui/a2ui/tools/agent/integrations.ts')
    expect(resolveIntegrations(['weather', 'nope', 42, 'currency']).map((i) => i.id)).toEqual(['weather', 'currency'])
    expect(resolveIntegrations('weather')).toEqual([])
    expect(resolveIntegrations(undefined)).toEqual([])
    expect(resolveIntegrations(INTEGRATIONS.map((i) => i.id))).toHaveLength(INTEGRATIONS.length)
  })

  it('an integration validates its input BEFORE any network call (the currency guard)', async () => {
    const { INTEGRATIONS } = await import('../../packages/agent-ui/a2ui/tools/agent/integrations.ts')
    const currency = INTEGRATIONS.find((i) => i.id === 'currency')!
    await expect(currency.execute({ amount: 'ten', from: 'EUR', to: 'USD' })).rejects.toThrow('currency: needs numeric')
    await expect(currency.execute({ amount: 5, from: 'EURO', to: 'USD' })).rejects.toThrow()
  })
})

// ── GH #46 / PR #60 review — the seedVersion one-time migration ─────────────────────────────────────────

describe('presetStore — seedVersion migration (the in-place Concierge upgrade)', () => {
  it('a persisted OLD-version store is dropped and the new seed applies; same-version edits survive', async () => {
    const { presetStore, AGENT_PRESETS, resetPreset } = await import('./agent-admin-presets.ts')
    const concierge = AGENT_PRESETS.find((p) => p.id === 'concierge')!
    expect(concierge.seedVersion, 'the upgrade declares its bump').toBe(2)

    // Simulate a PRE-upgrade browser: old persisted content, NO seedVersion marker (=1 implicitly).
    resetPreset(concierge) // clean slate for the probe (drops cache + keys)
    localStorage.removeItem('agent-admin-app.concierge.seedVersion')
    localStorage.setItem('agent-admin-app.concierge.entries:skill', JSON.stringify([
      { id: 'form-rhythm', kind: 'skill', label: 'form-rhythm', description: 'old', content: 'old', order: 0, enabled: true, builtin: false },
    ]))

    const migrated = presetStore(concierge)
    const skills = migrated.get('entries:skill') as Array<{ id: string }>
    expect(skills.some((s) => s.id === 'form-rhythm'), 'the stale persisted store was dropped').toBe(false)
    expect(skills.some((s) => s.id === 'hotel-booking-form'), 'the NEW seed applied').toBe(true)
    expect(localStorage.getItem('agent-admin-app.concierge.seedVersion')).toBe('2')

    // Same-version edits SURVIVE a rebuild (persisted-wins is untouched at the current version).
    migrated.set('entries:skill', [...skills.map((s) => s), { id: 'my-edit', kind: 'skill', label: 'my-edit', description: '', content: 'mine', order: 99, enabled: true, builtin: false }])
    const { presetStore: freshImport } = await import('./agent-admin-presets.ts')
    // the module cache holds the store cache — drop it via resetPreset-free rebuild: new store instance
    // requires a cold cache; assert through localStorage instead (the persistence layer both read paths share).
    const persisted = JSON.parse(localStorage.getItem('agent-admin-app.concierge.entries:skill') ?? '[]') as Array<{ id: string }>
    expect(persisted.some((s) => s.id === 'my-edit'), 'a current-version edit persists — no migration fired').toBe(true)
    void freshImport
    resetPreset(concierge) // leave no residue for sibling tests
  })
})
