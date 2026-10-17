// agent-compile.test.ts: T-0163 (agent-content SPEC ACS-R11, ACS-R12). The one compiler wraps the composition
// laws unchanged (`bundle.system` is `composeLiveSystemPrompt`'s output for the same store), its digest is
// stable for the same agent and overlay and moves with an edit, and its resolution names every composed item
// with its seed version and marks what the overlay changed as `user`.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import '@agent-ui/app/agent-admin'
import type { UIAgentAdminElement } from '@agent-ui/app/agent-admin'
import { bundleDigest, bundleFromWire, canonicalBundle, readBundleStamp } from '@agent-ui/a2ui/agent/agent-bundle'
import { entriesStoreKey, type Entry } from '../entry-list/entry-data.ts'
import { ENTRY_KINDS, DEFAULT_PROMPT_SECTIONS, composeLiveSystemPrompt } from './entries.ts'
import { BANKROLL_CAPABLE_KEY, SURFACE_A2UI_KEY, kindEnabledKey } from './agent-admin-schema.ts'
import { createOverlayStore, emptyOverlay, setOverlayKey } from './agent-overlay.ts'
import { bankrollForPrompt, compile, compileStore, liveCapabilityGroups, type AgentManifest } from './agent-compile.ts'

const skill = (id: string, order: number, extra: Partial<Entry> = {}): Entry => ({
  id,
  kind: ENTRY_KINDS.skill,
  label: id,
  description: `The ${id} idiom.`,
  content: `How to ${id}.`,
  order,
  enabled: true,
  builtin: false,
  ...extra,
})

const SEED: Record<string, unknown> = {
  model: 'claude-haiku-5-5',
  [SURFACE_A2UI_KEY]: true,
  [BANKROLL_CAPABLE_KEY]: true,
  [kindEnabledKey(ENTRY_KINDS.skill)]: true,
  [entriesStoreKey(ENTRY_KINDS.promptSection)]: DEFAULT_PROMPT_SECTIONS.map((s) => (s.id === 'foundation' ? { ...s, content: 'You deal cards.' } : s)),
  [entriesStoreKey(ENTRY_KINDS.skill)]: [skill('card-layout', 0), skill('game-hud', 1), skill('side-bet', 2, { availability: 'invocable' })],
}

const MANIFEST: AgentManifest = { id: 'croupier', version: 15, source: 'seed', items: { skill: { 'card-layout': 1, 'game-hud': 2 } }, seed: SEED }

const reader = (values: Record<string, unknown>) => ({ get: (key: string): unknown => values[key] })

describe('compileStore wraps the composition laws unchanged (ACS-R11)', () => {
  it('bundle.system is composeLiveSystemPrompt over the same store, byte for byte', () => {
    const store = reader(SEED)
    const sections = SEED[entriesStoreKey(ENTRY_KINDS.promptSection)] as Entry[]
    expect(compileStore(store).system).toBe(composeLiveSystemPrompt(sections, liveCapabilityGroups(store), bankrollForPrompt(store)))
    expect(compileStore(store).system).toContain('## Skills available to you')
    expect(compileStore(store).system).not.toContain('side-bet') // an invocable entry is not ambient
  })

  it('an absent store compiles to the fallback prompt without throwing', () => {
    const bundle = compileStore(undefined)
    expect(bundle.system).toBe('You are a helpful assistant.')
    expect(bundle.integrations).toEqual([])
  })

  it('invoked tool ids join after the ambient ones, deduped', () => {
    expect(compileStore(reader(SEED), { invokedToolIds: ['weather', 'weather'] }).integrations).toEqual(['weather'])
  })
})

describe('compile(manifest, overlay): digest and resolution (ACS-R11, ACS-R12)', () => {
  it('the same agent and overlay digest the same; an edit moves the digest', async () => {
    const a = await compile(MANIFEST)
    const b = await compile(MANIFEST, emptyOverlay('croupier', 15, SEED))
    expect(a.digest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(b.digest).toBe(a.digest)
    expect(await bundleDigest(a.bundle)).toBe(a.digest)
    const skills = (SEED[entriesStoreKey(ENTRY_KINDS.skill)] as Entry[]).map((e) => (e.id === 'game-hud' ? { ...e, description: 'Chips and score.' } : e))
    const edited = await compile(MANIFEST, setOverlayKey(SEED, emptyOverlay('croupier', 15, SEED), entriesStoreKey(ENTRY_KINDS.skill), skills))
    expect(edited.digest).not.toBe(a.digest)
  })

  it('the resolution names the agent, every composed item with its seed version, and marks overlay edits user', async () => {
    const plain = await compile(MANIFEST)
    expect(plain.resolution[0]).toMatchObject({ id: 'croupier', kind: 'persona', version: 15, source: 'seed' })
    const hud = plain.resolution.find((r) => r.id === 'game-hud')
    expect(hud).toMatchObject({ kind: 'skill', version: 2, source: 'seed' })
    expect(plain.resolution.find((r) => r.id === 'foundation')).toMatchObject({ kind: 'prompt-section', version: 15, source: 'seed' })
    expect(plain.resolution.find((r) => r.id === 'side-bet')).toBeUndefined() // not composed, not resolved
    expect(plain.resolution.every((r) => r.source === 'seed')).toBe(true)

    let overlay = emptyOverlay('croupier', 15, SEED)
    const skills = (SEED[entriesStoreKey(ENTRY_KINDS.skill)] as Entry[]).map((e) => (e.id === 'game-hud' ? { ...e, description: 'Chips and score.' } : e))
    overlay = setOverlayKey(SEED, overlay, entriesStoreKey(ENTRY_KINDS.skill), [...skills, skill('my-own', 3)])
    overlay = setOverlayKey(SEED, overlay, 'model', 'claude-sonnet-5-5')
    const edited = await compile(MANIFEST, overlay)
    expect(edited.resolution.find((r) => r.id === 'game-hud')).toMatchObject({ version: 2, source: 'user' })
    expect(edited.resolution.find((r) => r.id === 'game-hud')!.digest).not.toBe(hud!.digest)
    expect(edited.resolution.find((r) => r.id === 'my-own')).toMatchObject({ kind: 'skill', version: null, source: 'user' })
    expect(edited.resolution.find((r) => r.id === 'card-layout')).toMatchObject({ source: 'seed' })
    expect(edited.resolution.find((r) => r.id === 'model')).toMatchObject({ kind: 'setting', source: 'user' })
    expect(edited.bundle.model).toBe('claude-sonnet-5-5')
  })

  it('a full-record agent reads its own source throughout', async () => {
    const imported = await compile({ id: 'mine', version: null, source: 'imported', seed: SEED })
    expect(new Set(imported.resolution.map((r) => r.source))).toEqual(new Set(['imported']))
  })
})

describe('the bundle canonical form and the wire stamp (agent-bundle.ts)', () => {
  it('an empty model settings object reads as absent; key order never matters', () => {
    expect(canonicalBundle({ system: 's', model: 'm', modelSettings: {}, integrations: [] })).toBe(canonicalBundle({ system: 's', model: 'm', integrations: [] }))
    expect(canonicalBundle({ system: 's', model: 'm', modelSettings: { a: 1, b: 2 }, integrations: [] })).toBe(canonicalBundle({ integrations: [], modelSettings: { b: 2, a: 1 }, model: 'm', system: 's' }))
  })

  it('a malformed stamp degrades field by field, never throws', () => {
    expect(readBundleStamp('nope', 'nope')).toEqual({})
    const good = { id: 'a', kind: 'skill', version: 1, digest: `sha256:${'0'.repeat(64)}`, source: 'seed' }
    expect(readBundleStamp(`sha256:${'a'.repeat(64)}`, [good, { ...good, source: 'nobody' }, 7])).toEqual({ digest: `sha256:${'a'.repeat(64)}`, resolution: [good] })
  })
})

describe('a list reorder never changes entry provenance (review finding 4)', () => {
  it('a reordered list keeps every untouched entry at its seed source', async () => {
    const skills = SEED[entriesStoreKey(ENTRY_KINDS.skill)] as Entry[]
    const reordered = [skills[1]!, skills[0]!, skills[2]!].map((e, i) => ({ ...e, order: i }))
    const overlay = setOverlayKey(SEED, emptyOverlay('croupier', 15, SEED), entriesStoreKey(ENTRY_KINDS.skill), reordered)
    const { resolution: rows } = await compile(MANIFEST, overlay)
    const skillRows = rows.filter((r) => r.kind === 'skill')
    expect(skillRows.length).toBe(2)
    expect(skillRows.every((r) => r.source === 'seed')).toBe(true)
  })
})

describe('the Context view stamps what the turn sends (review findings 2 and 3)', () => {
  let realAttachInternals: typeof HTMLElement.prototype.attachInternals
  const mounted: Element[] = []
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
  afterEach(() => {
    for (const el of mounted.splice(0)) el.remove()
    vi.unstubAllGlobals()
  })

  const contextContent = (el: UIAgentAdminElement): { digest: string } | undefined => {
    const pre = el.querySelector('[data-part="context-item"][data-item="agent"] [data-part="context-json"]')
    return pre === null ? undefined : (JSON.parse(pre.textContent ?? '{}') as { content?: { digest: string } }).content
  }

  it('after an effort change the Context digest equals the digest of the request the turn sends', async () => {
    // Thinking off is legal on Haiku up to effort high and dropped at xhigh, so the effort moves the bundle.
    const seed = { ...SEED, thinking: 'disabled' }
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createOverlayStore({ seed, overlay: emptyOverlay('croupier', 15, seed) })
    el.contentManifest = MANIFEST
    const seen: { personaSystem: string; model: string; modelSettings?: object; integrations?: readonly string[] }[] = []
    el.agentSurfaceTurn = async function* (req) {
      seen.push(req)
      yield { kind: 'note' as const, note: 'ok' }
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    await vi.waitFor(() => expect(contextContent(el)?.digest).toMatch(/^sha256:/))
    const before = contextContent(el)!.digest
    const menu = el.querySelector('[data-part="effort-menu"]') as HTMLElement
    ;(menu.querySelector('[data-value="xhigh"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
    const composer = el.querySelector('ui-conversation-composer') as HTMLElement & { value: string }
    composer.value = 'deal'
    ;(composer.querySelector('[data-part="editor"]') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await vi.waitFor(() => expect(seen).toHaveLength(1))
    const req = seen[0]!
    const sent = await bundleDigest(bundleFromWire({ system: req.personaSystem, model: req.model, modelSettings: req.modelSettings, integrations: req.integrations }))
    await vi.waitFor(() => expect(contextContent(el)?.digest).toBe(sent))
    expect(sent, 'the effort change moved the bundle, so the equality is not vacuous').not.toBe(before)
  })

  it('without Web Crypto (an insecure origin) the Context view shows no stamp and nothing rejects unhandled', async () => {
    vi.stubGlobal('crypto', {})
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason)
    }
    const proc = (globalThis as unknown as { process: { on(e: string, f: (r: unknown) => void): void; off(e: string, f: (r: unknown) => void): void } }).process
    proc.on('unhandledRejection', onUnhandled)
    try {
      const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
      el.store = createOverlayStore({ seed: SEED, overlay: emptyOverlay('croupier', 15, SEED) })
      el.contentManifest = MANIFEST
      document.body.append(el)
      mounted.push(el)
      await whenFlushed()
      await new Promise((r) => setTimeout(r, 20))
      expect(contextContent(el)).toBeUndefined()
      expect(unhandled).toEqual([])
    } finally {
      proc.off('unhandledRejection', onUnhandled)
    }
  })
})
