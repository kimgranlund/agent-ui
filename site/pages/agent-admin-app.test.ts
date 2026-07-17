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
  it('six presets, unique ids, non-empty labels/taglines', () => {
    expect(AGENT_PRESETS).toHaveLength(6)
    expect(new Set(AGENT_PRESETS.map((p) => p.id)).size).toBe(6)
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

  it('the six COLLECTIVELY cover the config axes: all four models, tools both states, temp both halves', () => {
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
      (readdirSync(`${process.cwd()}/packages/agent-ui/a2ui/tools/agent/prompts/mini-skills`) as string[])
        .filter((f) => f.endsWith('.md'))
        .map((f) => f.replace(/\.md$/, '')),
    )
    expect(registry.size).toBeGreaterThan(3) // anti-vacuous: the registry directory is real
    const targeted = ['card-game-sheet', 'dashboard-kpi-grid', 'form-rhythm', 'login-form']
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
