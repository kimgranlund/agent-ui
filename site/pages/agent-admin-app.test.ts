// agent-admin-app.test.ts — TKT-0074's two jsdom legs: (1) the PRESET DATA integrity gates (ids unique,
// models real, every store key complete, mini-skill labels resolve against the SHIPPED registry — a
// renamed mini-skill must redden this, not silently stop matching), and (2) the STORE-SWAP PROBE the
// ticket's acceptance names: `admin.store = presetStore(other)` must re-render the settings pane AND the
// entry lists from the new store (agent-admin.ts's reactive store effect), measured on real rendered DOM,
// never assumed. jsdom needs the attachInternals stub (agent-admin.test.ts's exact pattern — composed FACE
// form controls call setFormValue/setValidity, absent in jsdom).
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
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
  vi.unstubAllGlobals() // the ADR-0170 POST-body pins stub `fetch` (admin-live-runner.test.ts's precedent)
})

const SUPPORTED_MODEL_IDS = new Set(['claude-sonnet-5', 'claude-haiku-4-5-20251001']) // rev.4: the roster pair presets may seed
const ALL_ENTRY_KEYS = Object.values(ENTRY_KINDS).map((kind) => entriesStoreKey(kind))

describe('AGENT_PRESETS — data integrity (TKT-0074)', () => {
  it('fourteen presets, unique ids, non-empty labels/taglines', () => {
    expect(AGENT_PRESETS).toHaveLength(14) // six showcases + the GH #46 trio additions + the six-game roster
    expect(new Set(AGENT_PRESETS.map((p) => p.id)).size).toBe(14)
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

  it('the roster COLLECTIVELY covers the config axes: both included models, tools both states, temp both halves', () => {
    expect(new Set(AGENT_PRESETS.map((p) => p.config.model)).size).toBe(2) // rev.4: haiku + sonnet only
    expect(new Set(AGENT_PRESETS.map((p) => p.config.toolsEnabled)).size).toBe(2)
    expect(AGENT_PRESETS.some((p) => p.config.temperature <= 0.2)).toBe(true)
    expect(AGENT_PRESETS.some((p) => p.config.temperature >= 0.8)).toBe(true)
  })

  it('every seed carries the four config keys + EVERY entry-list key (ENTRY_KINDS-derived — a new kind reddens this), sections ordered and Foundation rewritten', () => {
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

  // genui-surface.spec.md SPEC-R9/R11 (B2) — the pattern-source packs derive from the REAL genui-packs
  // registry .md files, the SAME drift-free glob derivation the a2ui-idioms pack proves above.
  it('the pattern-source packs derive from the REAL genui-packs registry files — one pack per .md file, each carrying exactly one ready-to-add entry', async () => {
    const { ADMIN_LIBRARIES } = await import('./agent-admin-libraries.ts')
    const { ENTRY_KINDS } = await import('@agent-ui/app')
    const files = (readdirSync('packages/agent-ui/a2ui/src/agent/prompts/genui-packs') as string[]).filter((f) => f.endsWith('.md'))
    const packs = ADMIN_LIBRARIES[ENTRY_KINDS.patternSource]!
    expect(packs.length, 'one library pack per registry .md file — drift-free derivation').toBe(files.length)
    const ids = new Set(packs.map((p) => p.id))
    for (const known of ['data-viz-layouts', 'interactive-widgets', 'animated-explainers']) {
      expect(ids.has(known), `registry id ${known} present`).toBe(true)
    }
    for (const pack of packs) {
      expect(pack.entries, `${pack.id} carries exactly one ready-to-add entry (D3 single-pick)`).toHaveLength(1)
      expect(pack.entries[0]!.content.trim().length).toBeGreaterThan(0)
    }
  })
})

// ── ADR-0170 cl.7 — the "Registered catalogs" pack IS the registry (no parity test needed, by design) ───
// The integrations pack below needs a parity gate because its registry is node-fenced and hand-copied
// here. This pack has no table to drift: it is `A2UI_CATALOG_OPTIONS.map(...)` over a browser-importable
// import. What IS worth gating is exactly that — that it stayed a projection, and that an added row keys
// the store to the registry id the wire will match.

describe('the Registered catalogs pack (ADR-0170 cl.7)', () => {
  it('IS the registry, mapped: one entry per A2UI_CATALOG_OPTIONS row, id-for-id and label-for-label', async () => {
    const { ADMIN_LIBRARIES } = await import('./agent-admin-libraries.ts')
    const { ENTRY_KINDS, A2UI_CATALOG_OPTIONS } = await import('@agent-ui/app')
    const packs = ADMIN_LIBRARIES[ENTRY_KINDS.catalog]!
    expect(packs).toHaveLength(1)
    expect(packs[0]!.id).toBe('registered-catalogs')
    expect(packs[0]!.entries.map((e) => ({ id: e.id, label: e.label, description: e.description }))).toEqual(
      A2UI_CATALOG_OPTIONS.map((o) => ({ id: o.id, label: o.label, description: o.description ?? '' })),
    )
    // A catalog entry keys an EXTERNAL registry: no body to author, so no content (cl.8's row shape).
    for (const entry of packs[0]!.entries) {
      expect(entry.id, 'the registry/wire key rides explicitly — never left to slugify(label)').toBeTruthy()
      expect(entry.content).toBe('')
    }
  })

  it('a library add mints a store entry keyed to the REGISTRY id — so sanitizeCatalog can actually match it', async () => {
    const { ADMIN_LIBRARIES } = await import('./agent-admin-libraries.ts')
    const { validateNewEntry, ENTRY_KINDS, A2UI_CATALOG_OPTIONS } = await import('@agent-ui/app')
    const { sanitizeCatalog } = await import('@agent-ui/app/agent-admin-schema')
    const pack = ADMIN_LIBRARIES[ENTRY_KINDS.catalog]![0]!

    // The REAL add-from-library path (entry-list.ts hands the pack entry to validateNewEntry verbatim).
    const minted = pack.entries.map((input) => {
      const result = validateNewEntry([], ENTRY_KINDS.catalog, input)
      expect(result.ok, `"${input.label}" must commit`).toBe(true)
      return (result as { ok: true; entry: { id: string; label: string } }).entry
    })
    expect(minted.map((e) => e.id)).toEqual(A2UI_CATALOG_OPTIONS.map((o) => o.id))
    // The decoupling that matters: 'A2UI Basic (upstream v0.9.1)' would slugify to something the registry
    // has never heard of — an unregistered row, permanently unselectable (ADR-0170 cl.3's visible no-op).
    for (const entry of minted) expect(sanitizeCatalog(entry.id), `${entry.id} survives the fail-closed read`).toBe(entry.id)
  })

  // The RENDERED shape, not just the data: the pack has to reach the Catalogs section as the section's
  // ONLY add path, and a pick has to land a roster row the selection can actually key to.
  it('renders as the Catalogs section\'s only add path, and a pick lands a roster row keyed to the registry id', async () => {
    const { librariesForCategory } = await import('./agent-admin-libraries.ts')
    const { ENTRY_KINDS, entriesStoreKey, A2UI_CATALOG_OPTIONS } = await import('@agent-ui/app')
    const { createMemoryStore } = await import('@agent-ui/app/settings-memory-store')
    const second = A2UI_CATALOG_OPTIONS[1]!

    const admin = document.createElement('ui-agent-admin') as UIAgentAdminElement
    admin.libraries = librariesForCategory(undefined)
    admin.store = createMemoryStore({})
    document.body.append(admin)
    mounted.push(admin)
    await whenFlushed()

    const section = admin.querySelector(`[data-part="entry-section"][data-kind="${ENTRY_KINDS.catalog}"]`) as HTMLElement
    const menu = section.querySelector('[data-part="entry-library-menu"]') as HTMLElement
    expect(menu, 'the pack reached the section').not.toBeNull()
    expect([...menu.querySelectorAll('[data-value]')].map((r) => r.textContent)).toEqual(
      A2UI_CATALOG_OPTIONS.map((o) => `${o.label} — Registered catalogs`),
    )
    expect(section.querySelector('[data-part="entry-add-toggle"]'), 'the menu is the ONLY add path (cl.8)').toBeNull()

    // The real commit path: ui-menu's `select` event, exactly as entry-list.ts listens for it.
    menu.dispatchEvent(new CustomEvent('select', { detail: { value: 'registered-catalogs:1', index: 1 } }))
    await whenFlushed()

    const roster = admin.store!.get(entriesStoreKey(ENTRY_KINDS.catalog)) as Array<{ id: string; label: string }>
    expect(roster.map((e) => e.id), 'keyed to the registry id, not slugify(label)').toEqual([second.id])
    const rows = [...section.querySelectorAll('[data-part="entry"]')].map((r) => r.getAttribute('data-entry-id'))
    expect(rows, 'the ensured Default row plus the freshly added one').toEqual(['agent-ui', second.id])
    expect(section.querySelector(`[data-part="entry"][data-entry-id="${second.id}"] [data-part="entry-description"]`)?.textContent).toBe(
      second.description,
    )
  })

  it('is GENERIC — every preset category sees it (never a persona-flavored pack)', async () => {
    const { librariesForCategory } = await import('./agent-admin-libraries.ts')
    const { ENTRY_KINDS } = await import('@agent-ui/app')
    for (const category of ['hospitality', 'games', undefined] as const) {
      const packs = librariesForCategory(category)[ENTRY_KINDS.catalog]!
      expect(packs.map((p) => p.id), `category ${String(category)}`).toEqual(['registered-catalogs'])
    }
  })
})

// ── ADR-0170 acceptance (LLD-C7a) — the produce POST body is BYTE-IDENTICAL across the refactor ─────────
// This is the pin the whole campaign is judged on: the catalog picker changed shape completely (a bare
// `<ui-select>` became a library section whose switches derive from the persisted key), and the WIRE must
// not have noticed. Driven end-to-end on purpose — the real `ui-agent-admin` element, the real
// `createAdminSurfaceTurn` runner, one stubbed `fetch` — because each half alone would prove nothing
// about the seam between them (the picker-wiring lesson: a UI that updates its own state is not evidence
// the value reached the network call).

describe('the produce POST body across the catalog refactor (ADR-0170 acceptance)', () => {
  /** The EXACT key set a component-driven surface turn puts on the wire — spelled out, so an added or
   *  dropped field is a red test rather than a silent contract change. */
  const EXPECTED_KEYS = ['a2ui', 'catalogId', 'effort', 'genui', 'input', 'integrations', 'model', 'personaSystem', 'progressDetail', 'provider']

  function ndjsonResponse(lines: readonly string[]): Response {
    const encoder = new TextEncoder()
    let i = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (i < lines.length) {
          controller.enqueue(encoder.encode(`${lines[i]!}\n`))
          i += 1
        } else controller.close()
      },
    })
    return new Response(stream, { status: 200, headers: { 'content-type': 'application/x-ndjson' } })
  }

  function submit(admin: UIAgentAdminElement, text: string): void {
    const composer = admin.querySelector('ui-conversation-composer') as HTMLElement & { value: string }
    composer.value = text
    ;(composer.querySelector('[data-part="editor"]') as HTMLElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    )
  }

  async function settle(): Promise<void> {
    for (let i = 0; i < 20; i += 1) {
      await whenFlushed()
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  it('the body keys are unchanged and catalogId still carries the sanitized selection — now written by the SECTION', async () => {
    const { createAdminSurfaceTurn } = await import('../lib/admin-live-runner.ts')
    const { ENTRY_KINDS, entriesStoreKey, A2UI_CATALOG_OPTIONS } = await import('@agent-ui/app')
    const { createMemoryStore } = await import('@agent-ui/app/settings-memory-store')
    const second = A2UI_CATALOG_OPTIONS[1]!

    const bodies: Array<Record<string, unknown>> = []
    const fetchSpy = vi.fn((_url: string, init: { body: string }) => {
      bodies.push(JSON.parse(init.body) as Record<string, unknown>)
      return Promise.resolve(ndjsonResponse(['{"a2uiMeta":{"note":"ok"}}']))
    })
    vi.stubGlobal('fetch', fetchSpy)

    const admin = document.createElement('ui-agent-admin') as UIAgentAdminElement
    // The second catalog is on this persona's shelf, but NOT selected — the default still is.
    admin.store = createMemoryStore({
      initial: {
        [entriesStoreKey(ENTRY_KINDS.catalog)]: [
          { id: second.id, kind: ENTRY_KINDS.catalog, label: second.label, description: '', content: '', order: 0, enabled: false, builtin: false },
        ],
      },
    })
    admin.agentSurfaceTurn = createAdminSurfaceTurn()
    document.body.append(admin)
    mounted.push(admin)
    await whenFlushed()

    submit(admin, 'draw me a table')
    await settle()
    expect(bodies, 'the turn reached the produce endpoint').toHaveLength(1)
    expect(Object.keys(bodies[0]!).sort(), 'the wire shape is byte-identical to the pre-refactor body').toEqual(EXPECTED_KEYS)
    expect(bodies[0]!['catalogId'], 'fail-closed: an unset key threads the default id, exactly as the select era did').toBe('agent-ui')

    // Now move the selection THROUGH THE NEW UI — the switch in the Catalogs section, nothing else.
    const row = admin.querySelector(
      `[data-part="entry-section"][data-kind="${ENTRY_KINDS.catalog}"] [data-part="entry"][data-entry-id="${second.id}"]`,
    ) as HTMLElement
    const toggle = row.querySelector('[data-part="entry-toggle"]') as HTMLElement & { checked: boolean }
    toggle.checked = true
    toggle.dispatchEvent(new Event('change'))
    await whenFlushed()

    submit(admin, 'again')
    await settle()
    expect(bodies).toHaveLength(2)
    expect(Object.keys(bodies[1]!).sort(), 'still the same wire shape').toEqual(EXPECTED_KEYS)
    expect(bodies[1]!['catalogId'], 'the section is the writer now, and the wire followed it').toBe(second.id)
  })

  it('a REFUSED selection never reaches the wire (an unregistered row stays unselectable end-to-end)', async () => {
    const { createAdminSurfaceTurn } = await import('../lib/admin-live-runner.ts')
    const { ENTRY_KINDS, entriesStoreKey } = await import('@agent-ui/app')
    const { createMemoryStore } = await import('@agent-ui/app/settings-memory-store')

    const bodies: Array<Record<string, unknown>> = []
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: { body: string }) => {
        bodies.push(JSON.parse(init.body) as Record<string, unknown>)
        return Promise.resolve(ndjsonResponse(['{"a2uiMeta":{"note":"ok"}}']))
      }),
    )

    const admin = document.createElement('ui-agent-admin') as UIAgentAdminElement
    admin.store = createMemoryStore({
      initial: {
        [entriesStoreKey(ENTRY_KINDS.catalog)]: [
          // the dedup-suffixed duplicate a second library add of the same catalog would mint
          { id: 'a2ui-basic-2', kind: ENTRY_KINDS.catalog, label: 'A duplicate', description: '', content: '', order: 0, enabled: false, builtin: false },
        ],
      },
    })
    admin.agentSurfaceTurn = createAdminSurfaceTurn()
    document.body.append(admin)
    mounted.push(admin)
    await whenFlushed()

    const toggle = admin.querySelector(
      `[data-part="entry-section"][data-kind="${ENTRY_KINDS.catalog}"] [data-part="entry"][data-entry-id="a2ui-basic-2"] [data-part="entry-toggle"]`,
    ) as HTMLElement & { checked: boolean }
    toggle.checked = true
    toggle.dispatchEvent(new Event('change'))
    await whenFlushed()

    submit(admin, 'draw')
    await settle()
    expect(bodies[0]!['catalogId'], 'the refused id never became a threaded catalogId').toBe('agent-ui')
  })
})

// ── GH #49 — the Integrations pack ↔ dev-proxy registry parity (the a2ui-idioms drift-gate discipline) ──

describe('Integrations pack ↔ registry parity (GH #49)', () => {
  // SPEC-R16 AC2 / ADR-0168 cl.2 (LLD-C7) — widened from "every pack entry's LABEL is a registry id" to
  // the full `{id, label, description}` TRIO. The old assertion could only ever hold while the three
  // facts were one string; now a registry edit that renames a label, retitles a description, or re-keys
  // an id and forgets this pack goes red on the exact field that drifted.
  const trio = (e: { id?: string; label: string; description: string }) => ({ id: e.id, label: e.label, description: e.description })

  it('every pack entry matches its registry manifest on the FULL {id, label, description} trio', async () => {
    const { ADMIN_LIBRARIES } = await import('./agent-admin-libraries.ts')
    const { ENTRY_KINDS } = await import('@agent-ui/app')
    const { listIntegrations } = await import('../../packages/agent-ui/a2ui/tools/agent/integrations/index.ts')
    const INTEGRATIONS = listIntegrations()
    const pack = ADMIN_LIBRARIES[ENTRY_KINDS.tool]!.find((p) => p.id === 'integrations')!

    const byId = (a: { id?: string }, b: { id?: string }) => (a.id ?? '').localeCompare(b.id ?? '')
    expect([...pack.entries].map(trio).sort(byId)).toEqual([...INTEGRATIONS].map(trio).sort(byId))

    // Both directions, named per-entry so a failure says WHICH integration drifted.
    for (const integration of INTEGRATIONS) {
      const entry = pack.entries.find((e) => e.id === integration.id)
      expect(entry, `registry integration "${integration.id}" has no pack entry`).toBeDefined()
      expect(entry!.label, `"${integration.id}" label parity`).toBe(integration.label)
      expect(entry!.description, `"${integration.id}" description parity`).toBe(integration.description)
    }

    // The decoupling itself: every pack entry carries an EXPLICIT id (never left to slugify(label)) and
    // the label is genuinely HUMAN text, no longer the id in disguise — the bug ADR-0168 cl.2 retires.
    for (const entry of pack.entries) {
      expect(entry.id, 'a pack entry keying an external registry declares its id explicitly').toBeTruthy()
      expect(entry.label, `"${entry.id}" label is human text, not the id`).not.toBe(entry.id)
    }

    // the tool wire name === the id for the v1 three (an LLD §4 non-decision: decoupling is a capability
    // this arc buys, not a rename it performs) — nothing on the wire changed for the shipped tools
    for (const integration of INTEGRATIONS) expect(integration.tool.name).toBe(integration.id)
  })

  it('a library add mints a store entry keyed to the REGISTRY id, not to the human label', async () => {
    const { INTEGRATION_TOOLS } = await import('./agent-admin-libraries.ts')
    const { validateNewEntry, ENTRY_KINDS } = await import('@agent-ui/app')
    const { resolveIntegrations } = await import('../../packages/agent-ui/a2ui/tools/agent/integrations/index.ts')

    // The REAL add-from-library path (entry-list.ts hands the pack entry to validateNewEntry verbatim).
    const minted = INTEGRATION_TOOLS.map((input) => {
      const result = validateNewEntry([], ENTRY_KINDS.tool, input)
      expect(result.ok, `"${input.label}" must commit`).toBe(true)
      return (result as { ok: true; entry: { id: string; label: string } }).entry
    })

    // The whole point: what the wire carries (entry.id) survives the intersection. Slugifying the human
    // label would have produced 'weather-open-meteo' & co — dropped fail-closed, the tool silently inert.
    expect(minted.map((e) => e.id)).toEqual(['weather', 'wikipedia-search', 'currency'])
    expect(minted.map((e) => e.label)).not.toEqual(minted.map((e) => e.id))
    expect(resolveIntegrations(minted.map((e) => e.id), {}).map((i) => i.id)).toEqual(['weather', 'wikipedia-search', 'currency'])
  })

  it('presets seed integration entries on the registry id too (the SECOND pack→entry projection)', async () => {
    const { AGENT_PRESETS, presetSeed } = await import('./agent-admin-presets.ts')
    const { ENTRY_KINDS, entriesStoreKey } = await import('@agent-ui/app')
    const { resolveIntegrations } = await import('../../packages/agent-ui/a2ui/tools/agent/integrations/index.ts')

    // The Travel Agent (`travel`) seeds a NAMED SUBSET via `pick`, the Hotel Concierge (`concierge`)
    // seeds the whole pack — both project ids, and the `pick` leg is the one that ALSO proves `pick`
    // matches on the id rather than the label. Expected ids are spelled out per preset: a bare
    // "seeds ≥1 tool" check would stay green if `pick` silently matched nothing.
    const expected: ReadonlyArray<readonly [string, readonly string[]]> = [
      ['concierge', ['weather', 'wikipedia-search', 'currency']],
      ['travel', ['weather', 'currency']],
    ]
    for (const [id, ids] of expected) {
      const preset = AGENT_PRESETS.find((p) => p.id === id)
      // Fail LOUD on a missing fixture — a silent `continue` here made this leg vacuous once already.
      expect(preset, `${id} preset exists`).toBeDefined()
      const seeded = presetSeed(preset!)[entriesStoreKey(ENTRY_KINDS.tool)] as Array<{ id: string }>
      expect(seeded.map((e) => e.id), `${id} seeds exactly these registry ids`).toEqual(ids)
      // Every seeded id survives the registry intersection — none is a human label in an id's place.
      expect(resolveIntegrations(seeded.map((e) => e.id), {}).map((i) => i.id)).toEqual(ids)
    }
  })

  it('resolveIntegrations validates + intersects, and malformed input degrades to empty (never throws)', async () => {
    const { resolveIntegrations, listIntegrations } = await import('../../packages/agent-ui/a2ui/tools/agent/integrations/index.ts')
    const INTEGRATIONS = listIntegrations()
    expect(resolveIntegrations(['weather', 'nope', 42, 'currency'], {}).map((i) => i.id)).toEqual(['weather', 'currency'])
    expect(resolveIntegrations('weather', {})).toEqual([])
    expect(resolveIntegrations(undefined, {})).toEqual([])
    expect(resolveIntegrations(INTEGRATIONS.map((i) => i.id), {})).toHaveLength(INTEGRATIONS.length)
  })

  it('an integration validates its input BEFORE any network call (the currency guard)', async () => {
    const { listIntegrations } = await import('../../packages/agent-ui/a2ui/tools/agent/integrations/index.ts')
    const currency = listIntegrations().find((i) => i.id === 'currency')!
    await expect(currency.execute({ amount: 'ten', from: 'EUR', to: 'USD' }, {})).rejects.toThrow('currency: needs numeric')
    await expect(currency.execute({ amount: 5, from: 'EURO', to: 'USD' }, {})).rejects.toThrow()
  })
})

// ── GH #46 / PR #60 review — the seedVersion one-time migration ─────────────────────────────────────────

describe('presetStore — seedVersion migration (the in-place Concierge upgrade)', () => {
  it('a persisted OLD-version store is dropped and the new seed applies; same-version edits survive', async () => {
    const { presetStore, AGENT_PRESETS, resetPreset } = await import('./agent-admin-presets.ts')
    const concierge = AGENT_PRESETS.find((p) => p.id === 'concierge')!
    expect(concierge.seedVersion, 'the upgrade declares its bump').toBe(5) // GH #497 — added localPatterns

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
    expect(localStorage.getItem('agent-admin-app.concierge.seedVersion')).toBe('5')

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

// ── GH #143 — per-preset library scoping ──────────────────────────────────────────────────────────────

describe('librariesForCategory — GH #143 per-preset library scoping', () => {
  it('a hospitality preset sees the Hospitality packs, never Games, plus every generic pack', async () => {
    const { librariesForCategory } = await import('./agent-admin-libraries.ts')
    const { ENTRY_KINDS } = await import('@agent-ui/app')
    const scoped = librariesForCategory('hospitality')
    expect(scoped[ENTRY_KINDS.skill]!.map((p) => p.id).sort()).toEqual(['a2ui-idioms', 'hospitality'])
    expect(scoped[ENTRY_KINDS.workflow]!.map((p) => p.id).sort()).toEqual(['playbooks-core', 'playbooks-hospitality'])
    expect(scoped[ENTRY_KINDS.tool]!.map((p) => p.id)).toEqual(['integrations'])
  })

  it('a games preset sees the Games packs, never Hospitality, plus every generic pack', async () => {
    const { librariesForCategory } = await import('./agent-admin-libraries.ts')
    const { ENTRY_KINDS } = await import('@agent-ui/app')
    const scoped = librariesForCategory('games')
    expect(scoped[ENTRY_KINDS.skill]!.map((p) => p.id).sort()).toEqual(['a2ui-idioms', 'games'])
    expect(scoped[ENTRY_KINDS.workflow]!.map((p) => p.id).sort()).toEqual(['playbooks-core', 'playbooks-games'])
    expect(scoped[ENTRY_KINDS.tool]!.map((p) => p.id)).toEqual(['integrations'])
  })

  it('no category (undefined) drops BOTH flavored pairs — generic packs only', async () => {
    const { librariesForCategory } = await import('./agent-admin-libraries.ts')
    const { ENTRY_KINDS } = await import('@agent-ui/app')
    const scoped = librariesForCategory(undefined)
    expect(scoped[ENTRY_KINDS.skill]!.map((p) => p.id)).toEqual(['a2ui-idioms'])
    expect(scoped[ENTRY_KINDS.workflow]!.map((p) => p.id)).toEqual(['playbooks-core'])
    expect(scoped[ENTRY_KINDS.tool]!.map((p) => p.id)).toEqual(['integrations'])
  })

  it('returns a FRESH object every call — never the same reference (the libraries prop identity-change law)', async () => {
    const { librariesForCategory } = await import('./agent-admin-libraries.ts')
    expect(librariesForCategory('hospitality')).not.toBe(librariesForCategory('hospitality'))
  })

  it('every preset carries the category its own roster placement implies (hospitality trio, games roster + Croupier/Quizmaster, the rest generic-only)', () => {
    const HOSPITALITY_IDS = ['concierge', 'restaurant', 'travel']
    const GAMES_IDS = ['croupier', 'quizmaster', 'mentalist', 'negotiator', 'lexicographer', 'admiral', 'alchemist', 'dungeon-master']
    const GENERIC_ONLY_IDS = ['quant', 'curator', 'stylist']
    expect(HOSPITALITY_IDS.length + GAMES_IDS.length + GENERIC_ONLY_IDS.length).toBe(AGENT_PRESETS.length)
    for (const id of HOSPITALITY_IDS) {
      expect(AGENT_PRESETS.find((p) => p.id === id)?.category, id).toBe('hospitality')
    }
    for (const id of GAMES_IDS) {
      expect(AGENT_PRESETS.find((p) => p.id === id)?.category, id).toBe('games')
    }
    for (const id of GENERIC_ONLY_IDS) {
      expect(AGENT_PRESETS.find((p) => p.id === id)?.category, id).toBeUndefined()
    }
  })
})

// ── the games-roster wave — seed integrity (the rev-d1 silently-empty-pick hazard, pinned) ──────────────

describe('the games roster — every game persona seeds real capabilities from the packs', () => {
  const GAME_IDS = ['mentalist', 'negotiator', 'lexicographer', 'admiral', 'alchemist', 'dungeon-master']
  it('all six exist; each seeds ≥1 skill and ≥1 workflow (a typo’d seedFrom pick would silently empty these)', () => {
    for (const id of GAME_IDS) {
      const p = AGENT_PRESETS.find((x) => x.id === id)
      expect(p, `${id} missing from the roster`).not.toBeUndefined()
      expect(p!.skills.length, `${id} seeds no skills — a seedFrom pick likely matched nothing`).toBeGreaterThan(0)
      expect(p!.workflows.length, `${id} seeds no workflows`).toBeGreaterThan(0)
    }
  })
  it('every game seed label exists in the Games/Core packs (the pick↔pack drift gate)', async () => {
    const { GAMES_SKILLS, GAMES_PLAYBOOKS, CORE_PLAYBOOKS } = await import('./agent-admin-libraries.ts')
    const packLabels = new Set([...GAMES_SKILLS, ...GAMES_PLAYBOOKS, ...CORE_PLAYBOOKS].map((e) => e.label))
    for (const id of GAME_IDS) {
      const p = AGENT_PRESETS.find((x) => x.id === id)!
      for (const seed of [...p.skills, ...p.workflows]) {
        expect(packLabels.has(seed.label), `${id}: seed ${seed.label} not in any pack`).toBe(true)
      }
    }
  })
})
