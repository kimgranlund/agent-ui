// agent-admin-app.test.ts — TKT-0074's two jsdom legs: (1) the PRESET DATA integrity gates (ids unique,
// models real, every store key complete, mini-skill labels resolve against the SHIPPED registry — a
// renamed mini-skill must redden this, not silently stop matching), and (2) the STORE-SWAP PROBE the
// ticket's acceptance names: `admin.store = presetStore(other)` must re-render the settings pane AND the
// entry lists from the new store (agent-admin.ts's reactive store effect), measured on real rendered DOM,
// never assumed. jsdom needs the attachInternals stub (agent-admin.test.ts's exact pattern — composed FACE
// form controls call setFormValue/setValidity, absent in jsdom).
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime (sitemap.test.ts precedent)
import { readdirSync, readFileSync } from 'node:fs'
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
  it('skill + workflow + resource kinds each carry packs; every pack has unique non-empty entry labels', async () => {
    const { ADMIN_LIBRARIES } = await import('./agent-admin-libraries.ts')
    const { ENTRY_KINDS } = await import('@agent-ui/app')
    for (const kind of [ENTRY_KINDS.skill, ENTRY_KINDS.workflow, ENTRY_KINDS.resource]) {
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
    const { DEFAULT_A2UI_CATALOG_ID } = await import('@agent-ui/app/agent-admin-schema')
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
    // GH #564 — the Default row is ENSURED present from the very first render (`readCatalogEntries`), so
    // the picker already disables it: adding it again would mint the exact phantom-duplicate the fix
    // closes. Every other option is untouched.
    expect([...menu.querySelectorAll('[data-value]')].map((r) => r.textContent)).toEqual(
      A2UI_CATALOG_OPTIONS.map((o) =>
        o.id === DEFAULT_A2UI_CATALOG_ID ? `${o.label} — Registered catalogs (already added)` : `${o.label} — Registered catalogs`,
      ),
    )
    const defaultRow = menu.querySelector(`[data-value="registered-catalogs:${A2UI_CATALOG_OPTIONS.findIndex((o) => o.id === DEFAULT_A2UI_CATALOG_ID)}"]`)
    expect(defaultRow?.getAttribute('aria-disabled')).toBe('true')
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
  // ADR-0182 cl.1 — `builderMission` is sent UNCONDITIONALLY (never the absent-⇒-omit shape the other
  // gates use), since its derivation (`session === 'authoring'`) is never itself absent.
  const EXPECTED_KEYS = ['a2ui', 'builderMission', 'catalogId', 'effort', 'genui', 'input', 'integrations', 'model', 'personaSystem', 'progressDetail', 'provider']

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

// ── GH #49/#567 S6 — the Integrations pack ↔ SERVED trios parity (the a2ui-idioms drift-gate discipline) ─
// SPEC-R28 AC2 (LLD-C6) — the ONE sanctioned reshape: the pack now reads a LIVE source
// (`setLiveIntegrations`, agent-admin-libraries.ts) instead of hand-mirroring the registry, so this
// suite grades `pack.entries` against "the served trios" rather than a single fixed reference. What
// "served" means depends on the case: with no live override (production, and every OTHER test in this
// file) it is `listIntegrations()`'s own trio projection — exactly what `dev-proxy-plugin.ts`'s
// `GET /integrations` route serves (`projectIntegrationTrios`, proven leak-proof + wired to the SAME
// `listIntegrations()` call in `mcp-boot.test.ts`) — so grading against it here, in-process, is
// grading against the real served set without a network round trip, the SAME discipline every other
// slice in this arc uses (S1-S5 never spin up a real server either). With a live override SET, "served"
// is whatever the dev proxy's GET actually answered — proven by feeding the seam a FABRICATED trio set
// (incl. an `mcp:*` id) and asserting the pack reflects it byte-for-byte. Both directions stay honest
// either way: `assertTrioParity` fails if EITHER side drops or drifts an entry (SPEC-R28 AC2's mutation
// probe) — the hand-authored half is unweakened, only reframed onto the shared helper.
describe('Integrations pack ↔ registry parity (GH #49/#567 S6)', () => {
  // SPEC-R16 AC2 / ADR-0168 cl.2 (LLD-C7) — widened from "every pack entry's LABEL is a registry id" to
  // the full `{id, label, description}` TRIO. The old assertion could only ever hold while the three
  // facts were one string; now a registry edit that renames a label, retitles a description, or re-keys
  // an id and forgets this pack goes red on the exact field that drifted.
  const trio = (e: { id?: string; label: string; description: string }) => ({ id: e.id, label: e.label, description: e.description })
  const byId = (a: { id?: string }, b: { id?: string }) => (a.id ?? '').localeCompare(b.id ?? '')

  /** The both-directions comparison itself, extracted so BOTH the hand-authored case (below) and the
   *  live-injected case (S6) run the identical check: every pack entry must match a served trio and
   *  vice versa — either side dropping or drifting an entry reddens this (SPEC-R28 AC2). */
  function assertTrioParity(entries: readonly { id?: string; label: string; description: string }[], served: readonly { id: string; label: string; description: string }[]): void {
    expect([...entries].map(trio).sort(byId)).toEqual([...served].map(trio).sort(byId))
    for (const row of served) {
      const entry = entries.find((e) => e.id === row.id)
      expect(entry, `served integration "${row.id}" has no pack entry`).toBeDefined()
      expect(entry!.label, `"${row.id}" label parity`).toBe(row.label)
      expect(entry!.description, `"${row.id}" description parity`).toBe(row.description)
    }
  }

  afterEach(async () => {
    // The live override is module state (agent-admin-libraries.ts) — reset it so a live-injected case
    // never leaks into this describe block's other tests or another file sharing the module registry.
    const { setLiveIntegrations } = await import('./agent-admin-libraries.ts')
    setLiveIntegrations(undefined)
  })

  it('every pack entry matches the SERVED trios (no live override — the hand-authored fallback, byte-compat with today)', async () => {
    const { ADMIN_LIBRARIES } = await import('./agent-admin-libraries.ts')
    const { ENTRY_KINDS } = await import('@agent-ui/app')
    const { listIntegrations } = await import('../../packages/agent-ui/a2ui/tools/agent/integrations/index.ts')
    const INTEGRATIONS = listIntegrations()
    const pack = ADMIN_LIBRARIES[ENTRY_KINDS.tool]!.find((p) => p.id === 'integrations')!

    assertTrioParity(pack.entries, INTEGRATIONS.map(trio) as { id: string; label: string; description: string }[])

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

  it('S6: a LIVE override (a fabricated served set, incl. an mcp:* id) reaches the pack — the live-read seam, not a hand-mirrored copy', async () => {
    const { ADMIN_LIBRARIES, setLiveIntegrations } = await import('./agent-admin-libraries.ts')
    const { ENTRY_KINDS } = await import('@agent-ui/app')
    const served = [
      { id: 'weather', label: 'Weather (Open-Meteo)', description: 'Current conditions. Keyless.' },
      { id: 'mcp:acme:lookup', label: 'Acme: lookup', description: 'A discovered MCP tool — never hand-mirrored here.' },
    ]
    setLiveIntegrations(served)
    const pack = ADMIN_LIBRARIES[ENTRY_KINDS.tool]!.find((p) => p.id === 'integrations')!
    assertTrioParity(pack.entries, served)
    // Reverting the override reverts the pack — no residue, no partial merge with the static fallback.
    setLiveIntegrations(undefined)
    const { listIntegrations } = await import('../../packages/agent-ui/a2ui/tools/agent/integrations/index.ts')
    assertTrioParity(pack.entries, listIntegrations().map(trio) as { id: string; label: string; description: string }[])
  })

  // GH #847 — the reported symptom: the live overlay (any `vite dev` session, unconditional once the
  // proxy answers `GET /integrations`) used to REPLACE the whole pack, including Weather's own
  // hand-authored row, with `content: ''` — discarding the served `description` and leaving the
  // Tools-panel box empty even for an entry whose static fallback carries real prose. ADR-0189 cl.4
  // fixes it by seeding `content` from the SAME `description` field the wire already serves.
  it("GH #847: the live override's `content` is seeded from `description`, never a hardcoded '' — the Tools-panel box is never emptied by turning the live overlay on", async () => {
    const { ADMIN_LIBRARIES, setLiveIntegrations } = await import('./agent-admin-libraries.ts')
    const { ENTRY_KINDS } = await import('@agent-ui/app')
    const served = [
      { id: 'weather', label: 'Weather (Open-Meteo)', description: 'Current conditions + short forecast for a named place. Keyless.' },
      { id: 'mcp:acme:lookup', label: 'Acme: lookup', description: 'A discovered MCP tool — never hand-mirrored here.' },
    ]
    setLiveIntegrations(served)
    const pack = ADMIN_LIBRARIES[ENTRY_KINDS.tool]!.find((p) => p.id === 'integrations')!
    for (const row of served) {
      const entry = pack.entries.find((e) => e.id === row.id)!
      expect(entry.content, `"${row.id}" box content is non-empty and matches its served description`).toBe(row.description)
    }
    setLiveIntegrations(undefined)
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

  // GH #793/#783/#791 — the Integrations pack flips the SAME `rejectOnCollision` flag the MCP-services
  // pack carries (SPEC-R5's sibling test, "the MCP-services pack" describe block below, AC2), because a
  // registered integration id ALSO keys an EXTERNAL registry (the dev proxy's live ids) — re-adding one
  // already in the list must reject, never mint a wire-inert `weather-2` phantom (the GH #564 law
  // generalized to every foreign-key-keyed tool pack, per Kim's ruling).
  it('re-adding an already-registered integration is rejected VISIBLY (`Already in the list.`), the store unchanged, and its picker row disabled — end-to-end on the rendered ui-agent-admin', async () => {
    const { ADMIN_LIBRARIES, librariesForCategory } = await import('./agent-admin-libraries.ts')
    const { ENTRY_KINDS, entriesStoreKey } = await import('@agent-ui/app')
    const { createMemoryStore } = await import('@agent-ui/app/settings-memory-store')

    const pack = ADMIN_LIBRARIES[ENTRY_KINDS.tool]!.find((p) => p.id === 'integrations')!
    expect(pack.rejectOnCollision, 'the per-pack foreign-key flag (LLD-C5) is set on Integrations too').toBe(true)

    const admin = document.createElement('ui-agent-admin') as UIAgentAdminElement
    admin.libraries = librariesForCategory(undefined) // generic — the tool key carries [integrations]
    // The agent already holds "weather" (INTEGRATION_TOOLS[0]) as a tool entry.
    admin.store = createMemoryStore({
      initial: {
        [entriesStoreKey(ENTRY_KINDS.tool)]: [
          { id: 'weather', kind: ENTRY_KINDS.tool, label: 'Weather (Open-Meteo)', description: '', content: '', order: 0, enabled: true, builtin: false },
        ],
        toolsEnabled: true,
      },
    })
    document.body.append(admin)
    mounted.push(admin)
    await whenFlushed()

    const section = admin.querySelector(`[data-part="entry-section"][data-kind="${ENTRY_KINDS.tool}"]`) as HTMLElement
    const menu = section.querySelector('[data-part="entry-library-menu"]') as HTMLElement
    expect(menu, 'the tool section carries the add-from-library menu').not.toBeNull()

    // The picker-disable affordance (GH #564 pairing, S3's per-pack widening): the already-added
    // integration's row is DISABLED, not hidden.
    const row = menu.querySelector('[data-value="integrations:0"]')
    expect(row?.textContent, 'the row shows WHY it is unreachable').toBe('Weather (Open-Meteo) — Integrations (already added)')
    expect(row?.getAttribute('aria-disabled')).toBe('true')

    // The reject-on-commit half: dispatch the menu's own commit for that integration anyway (the real
    // path entry-list.ts listens for) and prove the visible rejection + unchanged store — no suffixed
    // `weather-2` phantom.
    menu.dispatchEvent(new CustomEvent('select', { detail: { value: 'integrations:0', index: 0 } }))
    await whenFlushed()

    const stored = admin.store!.get(entriesStoreKey(ENTRY_KINDS.tool)) as Array<{ id: string }>
    expect(stored.map((e) => e.id), 'no suffixed `weather-2` phantom — the store is unchanged').toEqual(['weather'])
    const error = section.querySelector('[data-part="entry-add-error"]') as HTMLElement
    expect(error.textContent, 'the SPEC-R5-pattern rejection copy, generalized to Integrations').toBe('Already in the list.')
    expect(error.hidden, 'the rejection is visible, not silently swallowed').toBe(false)

    // The OTHER direction, confirmed post-flip: a NON-colliding integration ("currency", pack-local index
    // 2) still commits normally through the SAME end-to-end path — the flip rejects a duplicate, it does
    // not disable adding.
    menu.dispatchEvent(new CustomEvent('select', { detail: { value: 'integrations:2', index: 2 } }))
    await whenFlushed()
    const storedAfter = admin.store!.get(entriesStoreKey(ENTRY_KINDS.tool)) as Array<{ id: string }>
    expect(storedAfter.map((e) => e.id), 'the non-colliding add commits, unaffected by the flip').toEqual(['weather', 'currency'])
  })
})

// ── GH #783 S4 (LLD-C6/SPEC-R5, ADR-0185) — the live-derived MCP-services pack ──────────────────────────
// SPEC-R5: a second `tool`-kind pack, populated exclusively from the GET's `services` rows via
// `setLiveServices`, each entry keyed by the service ref as its explicit `id`; the pack is GENERIC, and
// ABSENT entirely when the services read degrades (`undefined`). Adding a service already in the list is
// rejected visibly (`Already in the list.`) with the store unchanged — the GH #564 foreign-key law rode in
// per-pack (LLD-C5), so a `tool`-kind pack reaches it even though the kind flag is `false`.
describe('the MCP-services pack (GH #783 S4 — SPEC-R5)', () => {
  afterEach(async () => {
    // Module state (agent-admin-libraries.ts) — reset so a services-injected case never leaks into a
    // sibling test (e.g. the librariesForCategory block below, which asserts the tool key is ['integrations']).
    const { setLiveServices } = await import('./agent-admin-libraries.ts')
    setLiveServices(undefined)
  })

  it('AC1: a set `services` payload adds one pack entry per service (ref as explicit id, empty content); reset to `undefined` drops the pack for every category', async () => {
    const { ADMIN_LIBRARIES, setLiveServices, librariesForCategory } = await import('./agent-admin-libraries.ts')
    const { ENTRY_KINDS } = await import('@agent-ui/app')
    const services = [
      { id: 'mcp:calc:*', label: 'Calc server', description: '2 tools discovered at boot' },
      { id: 'mcp:notes:*', label: 'Notes server', description: '1 tool discovered at boot' },
    ]
    setLiveServices(services)

    const packs = ADMIN_LIBRARIES[ENTRY_KINDS.tool]!
    expect(packs.map((p) => p.id), 'the MCP-services pack joins the Integrations pack, in order').toEqual(['integrations', 'mcp-services'])
    const mcp = packs.find((p) => p.id === 'mcp-services')!
    expect(mcp.rejectOnCollision, 'the per-pack foreign-key flag (LLD-C5) is set').toBe(true)
    expect(mcp.entries.map((e) => e.id), 'the service ref rides the id EXPLICIT, never slugged').toEqual(['mcp:calc:*', 'mcp:notes:*'])
    expect(mcp.entries.map((e) => e.label)).toEqual(['Calc server', 'Notes server'])
    for (const e of mcp.entries) expect(e.content, 'external-registry posture — no authored body').toBe('')

    // GENERIC — present for every preset category (services have no persona affinity).
    for (const category of ['hospitality', 'games', undefined] as const) {
      expect(librariesForCategory(category)[ENTRY_KINDS.tool]!.map((p) => p.id), `category ${String(category)}`).toEqual([
        'integrations',
        'mcp-services',
      ])
    }

    // The OTHER direction: reset to undefined ⇒ the pack is ABSENT (no stale, no empty-error pack) for
    // every category AND on the direct reader — the getter's own degrade law.
    setLiveServices(undefined)
    expect(ADMIN_LIBRARIES[ENTRY_KINDS.tool]!.map((p) => p.id)).toEqual(['integrations'])
    for (const category of ['hospitality', 'games', undefined] as const) {
      expect(librariesForCategory(category)[ENTRY_KINDS.tool]!.map((p) => p.id), `absent for ${String(category)}`).toEqual(['integrations'])
    }
  })

  it('AC1: a library add mints a store entry keyed to the service ref (the real validateNewEntry path, ref as id)', async () => {
    const { ADMIN_LIBRARIES, setLiveServices } = await import('./agent-admin-libraries.ts')
    const { validateNewEntry, ENTRY_KINDS } = await import('@agent-ui/app')
    setLiveServices([{ id: 'mcp:calc:*', label: 'Calc server', description: '2 tools discovered at boot' }])
    const pack = ADMIN_LIBRARIES[ENTRY_KINDS.tool]!.find((p) => p.id === 'mcp-services')!
    const result = validateNewEntry([], ENTRY_KINDS.tool, pack.entries[0]!, { rejectOnCollision: pack.rejectOnCollision })
    expect(result.ok).toBe(true)
    const entry = (result as { ok: true; entry: { id: string; label: string; content: string } }).entry
    expect(entry.id, 'keyed to the wire vocabulary, not slugify(label)').toBe('mcp:calc:*')
    expect(entry.label).toBe('Calc server')
    expect(entry.content).toBe('')
  })

  it('AC2: re-adding a service already in the list is rejected VISIBLY (`Already in the list.`), the store unchanged, and its picker row disabled — end-to-end on the rendered ui-agent-admin', async () => {
    const { setLiveServices, librariesForCategory } = await import('./agent-admin-libraries.ts')
    const { ENTRY_KINDS, entriesStoreKey } = await import('@agent-ui/app')
    const { createMemoryStore } = await import('@agent-ui/app/settings-memory-store')

    setLiveServices([{ id: 'mcp:calc:*', label: 'Calc server', description: '2 tools discovered at boot' }])

    const admin = document.createElement('ui-agent-admin') as UIAgentAdminElement
    admin.libraries = librariesForCategory(undefined) // generic — the tool key carries [integrations, mcp-services]
    // The agent already holds the Calc server service ref as a tool entry.
    admin.store = createMemoryStore({
      initial: {
        [entriesStoreKey(ENTRY_KINDS.tool)]: [
          { id: 'mcp:calc:*', kind: ENTRY_KINDS.tool, label: 'Calc server', description: '', content: '', order: 0, enabled: true, builtin: false },
        ],
        toolsEnabled: true,
      },
    })
    document.body.append(admin)
    mounted.push(admin)
    await whenFlushed()

    const section = admin.querySelector(`[data-part="entry-section"][data-kind="${ENTRY_KINDS.tool}"]`) as HTMLElement
    const menu = section.querySelector('[data-part="entry-library-menu"]') as HTMLElement
    expect(menu, 'the tool section carries the add-from-library menu').not.toBeNull()

    // The picker-disable affordance (SPEC-R5 / GH #564 pairing): the already-added service's row is
    // DISABLED, not hidden — never clickable-but-silently-rejected. It rides the PACK flag (the kind flag
    // is false for `tool`), the S3 per-pack widening.
    const row = menu.querySelector('[data-value="mcp-services:0"]')
    expect(row?.textContent, 'the row shows WHY it is unreachable').toBe('Calc server — MCP services (already added)')
    expect(row?.getAttribute('aria-disabled')).toBe('true')

    // The reject-on-commit half: dispatch the menu's own commit for that service anyway (the real path
    // entry-list.ts listens for) and prove the visible rejection + unchanged store.
    menu.dispatchEvent(new CustomEvent('select', { detail: { value: 'mcp-services:0', index: 3 } }))
    await whenFlushed()

    const stored = admin.store!.get(entriesStoreKey(ENTRY_KINDS.tool)) as Array<{ id: string }>
    expect(stored.map((e) => e.id), 'no suffixed `mcp:calc:*-2` phantom — the store is unchanged').toEqual(['mcp:calc:*'])
    const error = section.querySelector('[data-part="entry-add-error"]') as HTMLElement
    expect(error.textContent, 'the SPEC-R5 AC2 literal rejection copy').toBe('Already in the list.')
    expect(error.hidden, 'the rejection is visible, not silently swallowed').toBe(false)
  })
})

// ── GH #783 S5 (LLD-C7 / SPEC-R1 AC2, ADR-0185) — the master switch gates an MCP service ref on the wire ─
// SPEC-R1 AC2 is "the existing master-switch test pattern extended with one MCP-id case." LLD §5.3's
// PLACEMENT TRAP pins WHERE that case lives: the literal `mcp:calc:*` MUST sit here at the SITE layer and
// NEVER in `packages/agent-ui/app/src` — an MCP identifier in the app package (tests included) would redden
// SPEC-R6 AC1's `grep -ri mcp packages/agent-ui/app/src` empty-fence. `#enabledToolIds` (the app package,
// which learns nothing about MCP — SPEC-R6) forwards the ref as an OPAQUE string it never parses: master
// OFF ⇒ `[]` on the wire (SPEC-R1 AC2); master ON ⇒ the ref rides verbatim (GH #402's ids-not-labels law,
// widened by ADR-0185 to service refs). Driven end to end on the real `ui-agent-admin` + the real
// `createAdminSurfaceTurn` runner with one stubbed fetch — the picker-wiring lesson: a projection updating
// its own state is not evidence the value reached the network call.
describe('the master switch gates an MCP service ref on the wire (GH #783 S5 — SPEC-R1 AC2)', () => {
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

  it('master OFF ⇒ integrations [] on the wire; master ON ⇒ the mcp:calc:* ref rides the wire opaquely', async () => {
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

    // The agent holds one enabled MCP service-ref row under the ordinary `tool` kind (SPEC-R1: no new key,
    // no new schema field) — but the master `toolsEnabled` gate is OFF.
    const store = createMemoryStore({
      initial: {
        [entriesStoreKey(ENTRY_KINDS.tool)]: [
          { id: 'mcp:calc:*', kind: ENTRY_KINDS.tool, label: 'Calc server', description: '', content: '', order: 0, enabled: true, builtin: false },
        ],
        toolsEnabled: false,
      },
    })
    const admin = document.createElement('ui-agent-admin') as UIAgentAdminElement
    admin.store = store
    admin.agentSurfaceTurn = createAdminSurfaceTurn()
    document.body.append(admin)
    mounted.push(admin)
    await whenFlushed()

    submit(admin, 'add two and two')
    await settle()
    expect(bodies, 'the turn reached the produce endpoint').toHaveLength(1)
    expect(bodies[0]!['integrations'], 'master off ⇒ #enabledToolIds returns [] ⇒ no MCP item on the wire').toEqual([])

    // Flip the master ON. `#enabledToolIds` is a FRESH per-turn store read, so the next turn reflects it.
    store.set('toolsEnabled', true)
    await whenFlushed()

    submit(admin, 'again')
    await settle()
    expect(bodies).toHaveLength(2)
    expect(bodies[1]!['integrations'], 'master on ⇒ the service ref rides the wire verbatim, unparsed by the browser').toEqual(['mcp:calc:*'])
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
    expect(skills.some((s) => s.id === 'gallery-swiper'), 'the NEW seed applied').toBe(true)
    // GH #497 — 'hotel-booking-form' retired from the concierge's OWN seed: BookingForm/BookingConfirmation
    // (the `concierge` local pattern set) now close that idiom structurally; a fresh/migrated concierge
    // session must never carry BOTH the structural type and the stale hand-authored duplicate.
    expect(skills.some((s) => s.id === 'hotel-booking-form'), 'the retired duplicate never re-seeds').toBe(false)
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
    expect(scoped[ENTRY_KINDS.resource]!.map((p) => p.id)).toEqual([])
    expect(scoped[ENTRY_KINDS.tool]!.map((p) => p.id)).toEqual(['integrations'])
  })

  it('a games preset sees the Games packs, never Hospitality, plus every generic pack', async () => {
    const { librariesForCategory } = await import('./agent-admin-libraries.ts')
    const { ENTRY_KINDS } = await import('@agent-ui/app')
    const scoped = librariesForCategory('games')
    expect(scoped[ENTRY_KINDS.skill]!.map((p) => p.id).sort()).toEqual(['a2ui-idioms', 'games'])
    expect(scoped[ENTRY_KINDS.workflow]!.map((p) => p.id).sort()).toEqual(['playbooks-core', 'playbooks-games'])
    expect(scoped[ENTRY_KINDS.resource]!.map((p) => p.id)).toEqual(['game-rules'])
    expect(scoped[ENTRY_KINDS.tool]!.map((p) => p.id)).toEqual(['integrations'])
  })

  it('no category (undefined) drops BOTH flavored pairs — generic packs only', async () => {
    const { librariesForCategory } = await import('./agent-admin-libraries.ts')
    const { ENTRY_KINDS } = await import('@agent-ui/app')
    const scoped = librariesForCategory(undefined)
    expect(scoped[ENTRY_KINDS.skill]!.map((p) => p.id)).toEqual(['a2ui-idioms'])
    expect(scoped[ENTRY_KINDS.workflow]!.map((p) => p.id)).toEqual(['playbooks-core'])
    expect(scoped[ENTRY_KINDS.resource]!.map((p) => p.id)).toEqual([])
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

// ── the Builder + the guided IA entry (ADR-0178 cl.4 / LLD-C7, C8; GH #633) ────────────────────────────
describe('the Builder persona (ADR-0178 cl.4 — hidden-until-invoked)', () => {
  it('is NOT on the roster: the showcase stays a showcase, the Builder is machinery the flow arms', async () => {
    const { builderPersona, personaRoster } = await import('./agent-admin-presets.ts')
    expect(AGENT_PRESETS.map((p) => p.id)).not.toContain('builder')
    expect(personaRoster().map((p) => p.id)).not.toContain(builderPersona().id)
  })

  it('seeds the authoring gate ON and A2UI ON — the two capabilities the interview actually needs', async () => {
    const { builderStore } = await import('./agent-admin-presets.ts')
    const { SURFACE_AUTHORING_KEY, SURFACE_A2UI_KEY } = await import('@agent-ui/app/agent-admin-schema')
    const store = builderStore()
    expect(store.get(SURFACE_AUTHORING_KEY)).toBe(true)
    expect(store.get(SURFACE_A2UI_KEY)).toBe(true)
  })

  it('mints a FRESH, unpersisted store per flow entry (nothing user-editable reaches it, so persisting could only drift)', async () => {
    const { builderStore } = await import('./agent-admin-presets.ts')
    const first = builderStore()
    first.set('name', 'Scribbled over')
    const second = builderStore()
    expect(second).not.toBe(first)
    expect(second.get('name')).toBe('Builder') // a fresh entry never inherits the last one's state
    // no persistKey ⇒ nothing under a builder namespace survives in localStorage
    expect(Object.keys(localStorage).some((k) => k.includes('builder'))).toBe(false)
  })

  it('runs a sonnet-class model — the interview quality IS the product here', async () => {
    const { builderStore } = await import('./agent-admin-presets.ts')
    expect(builderStore().get('model')).toBe('claude-sonnet-5')
  })

  it('its GENERATED vocabulary section names EVERY patchable key — the drift trip-wire', async () => {
    // Hand-listing this vocabulary would rot the first time a key changed, teaching the model to send
    // something the apply gate then drops. It is composed from the gate's own canonical exports, and
    // this asserts the composition really covers them.
    const { builderStore } = await import('./agent-admin-presets.ts')
    const { PERSONA_VALUE_KEYS, PERSONA_ENTRY_LIST_KEYS } = await import('@agent-ui/app/agent-admin-persona-patch')
    const sections = builderStore().get(entriesStoreKey(ENTRY_KINDS.promptSection)) as Entry[]
    const vocabulary = sections.find((s) => s.id === 'patchable-keys')
    expect(vocabulary, 'the generated section must be seeded').not.toBeUndefined()
    for (const key of [...PERSONA_VALUE_KEYS, ...PERSONA_ENTRY_LIST_KEYS]) {
      expect(vocabulary!.content, `${key} must reach the model`).toContain(key)
    }
    // the model roster is interpolated live, never a stale hand-typed list
    expect(vocabulary!.content).toContain('claude-sonnet-5')
    expect(vocabulary!.content).not.toContain('{roster}')
  })

  // ADR-0178's ratified amendment (GH #696) — the generated block naming WHICH sections are replaceable.
  // Generated from `DEFAULT_PROMPT_SECTIONS`, so the same drift trip-wire the value keys get: ALL and ONLY.
  it('its GENERATED vocabulary names ALL and ONLY the seeded builtin sections as replaceable', async () => {
    const { builderStore } = await import('./agent-admin-presets.ts')
    const { DEFAULT_PROMPT_SECTIONS } = await import('@agent-ui/app')
    const sections = builderStore().get(entriesStoreKey(ENTRY_KINDS.promptSection)) as Entry[]
    const vocabulary = sections.find((s) => s.id === 'patchable-keys')!
    const block = vocabulary.content.slice(vocabulary.content.indexOf('## Built-in sections you may REPLACE'))
    expect(block, 'the replaceable-sections block must be composed').not.toBe('')
    const listed = [...block.matchAll(/^- `([a-z0-9-]+)`/gm)].map((m) => m[1]!)
    expect(listed, 'a seed change must move this block, never leave it stale').toEqual(DEFAULT_PROMPT_SECTIONS.map((s) => s.id))
    // each row carries the section's real label + description, so the model knows what each one is FOR
    for (const section of DEFAULT_PROMPT_SECTIONS) {
      expect(block).toContain(section.label)
      expect(block).toContain(section.description)
    }
    // the worked example is CONCRETE (PR #692's live-proven lesson): the real list key + a real builtin id
    expect(block).toContain(`{"entries":{"${entriesStoreKey(ENTRY_KINDS.promptSection)}":[{"id":"${DEFAULT_PROMPT_SECTIONS[0]!.id}"`)
    // and the protection sentence says what was always true, per the amendment's Consequences
    expect(block).toMatch(/authored entries are safe from you by construction/)
    expect(block).toMatch(/never remove anything or empty a built-in section/)
  })

  it('teaches interview CRAFT and key VOCABULARY, never the personaPatch wire mechanics (ADR-0178 cl.1 rule 5)', async () => {
    // The mechanics compose from S2's byte-pinned authoring-teaching.md under the gate. Restating them
    // in persona config is the drift this boundary exists to prevent — garbled vocabulary degrades to
    // dropped keys, garbled mechanics would be unrecoverable.
    const { builderStore } = await import('./agent-admin-presets.ts')
    const sections = builderStore().get(entriesStoreKey(ENTRY_KINDS.promptSection)) as Entry[]
    const prose = sections.map((s) => s.content).join('\n')
    for (const mechanism of ['a2uiMeta', 'personaPatch', 'meta-line', 'JSONL']) {
      expect(prose, `persona copy must not restate the wire mechanic "${mechanism}"`).not.toContain(mechanism)
    }
  })
})

describe('the "New agent → Generate" IA entry (LLD-C8) / GH #686 S7-d — the header seam registrations', () => {
  it('GH #686 S7-d — the retired canvas-header/overflow-menu code leaves no residue (checked by SYMBOL, not by a bare word a doc comment may legitimately still name)', async () => {
    const source = readFileSync('site/pages/agent-admin-app.ts', 'utf8')
    for (const retiredSymbol of [
      'const NEW_AGENT_ACTIONS',
      "className = 'canvas-header'",
      'const agentMenu = document.createElement',
      'const overflowMenu = document.createElement',
      'function createBlankAgent',
      'function addPersonaRow',
    ]) {
      expect(source, `"${retiredSymbol}" must leave no residue`).not.toContain(retiredSymbol)
    }
  })

  // NOTE: this is a presence smoke, not delivery proof — "a callback registered is not evidence a real
  // click reaches it" (the picker-wiring trap). The REAL proof for every one of these six seams is the
  // real-click, real-effect suite in agent-admin-app.browser.test.ts (agent-select commit, Export Blob
  // capture + round-trip, Import click-spy + file round-trip, New Agent → Generate mint+arm, and Reset
  // Agent's own store-re-seed proof) — this test only pins that the WIRING SITE exists, in case a future
  // edit deletes a registration call without deleting its browser-test twin (which would otherwise redden
  // silently only in the slower gate).
  it('registers all six header seams, routing New Agent to Generate (OQ-A)', async () => {
    const source = readFileSync('site/pages/agent-admin-app.ts', 'utf8')
    expect(source).toContain('admin.setAgentRoster' /* via pushRoster */)
    expect(source).toContain('admin.onAgentSelect(')
    expect(source).toContain('admin.onNewAgentRequest(() => createGeneratedAgent())')
    expect(source).toContain('admin.onImportRequest(() => fileInput.click())')
    expect(source).toContain('admin.onExportRequest(() => exportActivePersona())')
    expect(source).toContain('admin.onResetRequest(')
  })

  it('applyPersona clears `authoringStore` BEFORE swapping `store` — the one choke point that exits the flow', async () => {
    // Ordering is the contract (LLD §2's IA row): exit the flow, THEN let GH #145's reset fire, so a
    // persona switch can never leave a previous draft's interview armed over a new draft.
    const source = readFileSync('site/pages/agent-admin-app.ts', 'utf8')
    const body = source.slice(source.indexOf('function applyPersona'))
    expect(body.indexOf('admin.authoringStore = undefined')).toBeLessThan(body.indexOf('admin.store = personaStore(persona)'))
  })
})
