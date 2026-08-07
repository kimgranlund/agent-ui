// agent-admin-persona-file.test.ts — GH #406 (M-B DoD box 3): the persona-library ROUND TRIP, proven
// deterministically in jsdom. The load-bearing leg is not "the two JSON blobs match" — it is that the
// REAL `ui-agent-admin` element, handed the IMPORTED persona's store, composes a BYTE-IDENTICAL live
// system prompt to the one it composed from the source persona's store. The prompt is captured off the
// component's own injected-runner seam (`agentTurn` receives `composeLiveSystemPrompt(sections,
// #capabilityGroups(store))` — agent-admin.ts's live arm), so this measures the real composition path,
// never a re-implementation of it in the test.
//
// The source persona is deliberately EDITED past its seed first (renamed, a rewritten builtin section, a
// hand-authored section, an added skill, a toggled-off entry, a whole capability kind's master switch
// off, Surface Options changed): a round trip that only carries the seed would pass a seed-only probe and
// still lose every byte an admin actually authored.
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import '@agent-ui/app/agent-admin'
import type { UIAgentAdminElement } from '@agent-ui/app/agent-admin'
import { ENTRY_KINDS, entriesStoreKey, createMemoryStore } from '@agent-ui/app'
import type { Entry, SettingsStore } from '@agent-ui/app'
import {
  A2UI_CATALOG_KEY,
  A2UI_LOCAL_PATTERNS_KEY,
  AGENT_ENABLED_KEY,
  BANKROLL_CAPABLE_KEY,
  BANKROLL_KEY,
  MODELS_INCLUDED_KEY,
  SURFACE_A2UI_KEY,
  SURFACE_GENUI_DOGFOOD_KEY,
  SURFACE_GENUI_KEY,
  SURFACE_MARKDOWN_KEY,
  kindEnabledKey,
} from '@agent-ui/app/agent-admin-schema'
import type { AdminAgentTurn, AdminTurnRequest } from '@agent-ui/app/agent-admin-schema'
import {
  AGENT_PRESETS,
  IMPORTED_PERSONAS_KEY,
  loadImportedPersonas,
  personaFromPreset,
  personaRoster,
  personaStore,
  presetSeed,
  resetPersona,
  saveImportedPersona,
  type Persona,
} from './agent-admin-presets.ts'
import {
  PERSONA_FILE_KIND,
  PERSONA_FILE_VERSION,
  PERSONA_STATE_KEYS,
  exportPersonaFile,
  importedPersonaFrom,
  personaFileName,
  personaFileText,
  readPersonaFile,
  readPersonaState,
} from './agent-admin-persona-file.ts'

// ── the jsdom ElementInternals stub (agent-admin-app.test.ts verbatim) ─────────────────────────────────
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
  localStorage.removeItem(IMPORTED_PERSONAS_KEY)
})

const SOURCE_PRESET = AGENT_PRESETS.find((p) => p.id === 'concierge')!

/** A source persona store, seeded from a shipped preset then EDITED the way an admin would — the store
 *  is `persistKey`-less so nothing leaks into localStorage between runs. */
function authoredStore(): SettingsStore {
  const store = createMemoryStore({ initial: presetSeed(SOURCE_PRESET) })
  store.set('name', 'Meridian Night Concierge')
  store.set('temperature', 0.2)
  store.set(SURFACE_GENUI_KEY, true) // an opt-in Surface Option (its default is OFF)
  store.set(kindEnabledKey(ENTRY_KINDS.workflow), false) // a whole kind gated off at the master switch

  const sections = store.get(entriesStoreKey(ENTRY_KINDS.promptSection)) as Entry[]
  store.set(entriesStoreKey(ENTRY_KINDS.promptSection), [
    // a rewritten BUILTIN (the shape `AgentPreset` cannot express — it only carries Foundation)
    ...sections.map((s) => (s.id === 'personality' ? { ...s, content: 'Speak in a low, unhurried night-desk register.' } : s)),
    // a hand-authored extra section
    {
      id: 'night-desk',
      kind: ENTRY_KINDS.promptSection,
      label: 'Night desk',
      description: 'After-hours rules.',
      content: 'Between 23:00 and 06:00 the kitchen is closed; offer the night menu and never wake the manager.',
      order: sections.length,
      enabled: true,
      builtin: false,
    },
  ])

  const skills = store.get(entriesStoreKey(ENTRY_KINDS.skill)) as Entry[]
  store.set(entriesStoreKey(ENTRY_KINDS.skill), [
    // one seeded skill switched OFF (a disabled entry must survive as disabled, never be dropped)
    ...skills.map((s, i) => (i === 0 ? { ...s, enabled: false } : s)),
    {
      id: 'night-turndown',
      kind: ENTRY_KINDS.skill,
      label: 'night-turndown',
      description: 'The turndown card idiom.',
      content: 'A compact Card: turndown time, breakfast hanger, and one Button to request a wake-up call.',
      order: skills.length,
      enabled: true,
      builtin: false,
    },
  ])
  return store
}

interface Recorder {
  fn: AdminAgentTurn
  calls: AdminTurnRequest[]
}
function recordingRunner(): Recorder {
  const calls: AdminTurnRequest[] = []
  const fn: AdminAgentTurn = async (req) => {
    calls.push(req)
    return 'ok'
  }
  return { fn, calls }
}

/** The COMPOSED LIVE PERSONA PROMPT the real component builds from `store` — captured off the injected
 *  `agentTurn` seam by driving a real turn through the real composer, never recomputed here. */
async function composedPromptFor(store: SettingsStore): Promise<string> {
  const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
  el.store = store
  document.body.append(el)
  mounted.push(el)
  await whenFlushed()
  const runner = recordingRunner()
  el.agentTurn = runner.fn
  const composer = el.querySelector('[data-part="canvas"] ui-conversation-composer') as HTMLElement & { value: string }
  composer.value = 'ping'
  ;(composer.querySelector('[data-part="send"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
  for (let i = 0; i < 100 && runner.calls.length === 0; i += 1) await Promise.resolve()
  expect(runner.calls, 'the injected runner must have received the turn').toHaveLength(1)
  el.remove()
  return runner.calls[0]!.system
}

describe('the persona file — export → import round trip (GH #406, M-B DoD box 3)', () => {
  it('the IMPORTED persona composes a byte-identical live system prompt and a deep-equal store snapshot', async () => {
    const source = personaFromPreset(SOURCE_PRESET)
    const storeA = authoredStore()
    const promptA = await composedPromptFor(storeA)

    // anti-vacuity: the source prompt really carries the authored edits (not a fallback/empty string)
    expect(promptA).toContain('## Foundation')
    expect(promptA).toContain('Speak in a low, unhurried night-desk register.') // the rewritten builtin
    expect(promptA).toContain('## Night desk') // the hand-authored section
    expect(promptA).toContain('### night-turndown') // the added capability entry
    expect(promptA).not.toContain('## Workflows available to you') // the master switch gated the kind out
    expect(promptA.length).toBeGreaterThan(500)

    // export → the exact bytes a download writes → parse → mint
    const text = personaFileText(exportPersonaFile(source, storeA))
    const parsed = readPersonaFile(text)
    expect(parsed.ok, parsed.ok ? '' : parsed.error).toBe(true)
    if (!parsed.ok) return
    const imported = importedPersonaFrom(parsed.file, [source])
    expect(imported.id).not.toBe(source.id) // library semantics: a NEW persona, never an overwrite
    expect(imported.imported).toBe(true)

    const storeB = createMemoryStore({ initial: imported.seed })
    const promptB = await composedPromptFor(storeB)

    expect(promptB).toBe(promptA) // ← the DoD: identical composed persona, byte for byte
    expect(readPersonaState(storeB)).toEqual(readPersonaState(storeA)) // ← and an equal store snapshot
  })

  it('the byte-equality is discriminating — a DIFFERENT persona composes a different prompt', async () => {
    // The guard against a vacuous pass above: composedPromptFor genuinely varies with the store.
    const other = AGENT_PRESETS.find((p) => p.id === 'quant')!
    const promptA = await composedPromptFor(authoredStore())
    const promptB = await composedPromptFor(createMemoryStore({ initial: presetSeed(other) }))
    expect(promptB).not.toBe(promptA)
  })

  it('the round trip carries the WHOLE persona state — every key the source store holds, verbatim', () => {
    const storeA = authoredStore()
    const file = exportPersonaFile(personaFromPreset(SOURCE_PRESET), storeA)
    const parsed = readPersonaFile(personaFileText(file))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const state = readPersonaState(storeA)
    expect(parsed.file.state).toEqual(state)
    // every key present is a KNOWN persona-state key, and the authored ones are all there
    for (const key of Object.keys(parsed.file.state)) expect(PERSONA_STATE_KEYS).toContain(key)
    for (const key of ['name', 'temperature', SURFACE_GENUI_KEY, kindEnabledKey(ENTRY_KINDS.workflow), entriesStoreKey(ENTRY_KINDS.promptSection), entriesStoreKey(ENTRY_KINDS.skill)]) {
      expect(Object.keys(parsed.file.state), `${key} must round-trip`).toContain(key)
    }
    // an UNSET key stays unset (an `undefined` written into the file would import as a real value)
    expect(Object.keys(parsed.file.state)).not.toContain('agentEnabled')
  })

  it('PERSONA_STATE_KEYS covers every key the surface actually stores — independent of the round trip itself', () => {
    // The deep-equal above compares two snapshots BOTH filtered through PERSONA_STATE_KEYS, so a key
    // silently dropped from the set vanishes from both sides and the comparison still passes. This
    // assertion is the independent gate: the set must cover every key a persona store really holds —
    // the seed's own keys plus every schema-declared master/surface key.
    const required = [
      ...Object.keys(presetSeed(SOURCE_PRESET)),
      MODELS_INCLUDED_KEY,
      AGENT_ENABLED_KEY,
      ...Object.values(ENTRY_KINDS).map((kind) => kindEnabledKey(kind)),
      ...Object.values(ENTRY_KINDS).map((kind) => entriesStoreKey(kind)),
      SURFACE_MARKDOWN_KEY,
      SURFACE_A2UI_KEY,
      SURFACE_GENUI_KEY,
      SURFACE_GENUI_DOGFOOD_KEY,
      A2UI_CATALOG_KEY,
      A2UI_LOCAL_PATTERNS_KEY,
    ]
    for (const key of required) {
      expect(PERSONA_STATE_KEYS, `${key} must be carried by the persona file`).toContain(key)
    }
    expect(new Set(PERSONA_STATE_KEYS).size, 'no duplicate keys (tool’s master switch IS toolsEnabled)').toBe(PERSONA_STATE_KEYS.length)
  })

  it('the envelope is the versioned contract: kind + version + persona metadata + state', () => {
    const file = exportPersonaFile(personaFromPreset(SOURCE_PRESET), authoredStore(), new Date('2026-08-04T10:00:00.000Z'))
    expect(file.kind).toBe(PERSONA_FILE_KIND)
    expect(file.version).toBe(PERSONA_FILE_VERSION)
    expect(file.exportedAt).toBe('2026-08-04T10:00:00.000Z')
    expect(file.persona).toEqual({ label: SOURCE_PRESET.label, tagline: SOURCE_PRESET.tagline, category: 'hospitality', sourceId: 'concierge' })
    expect(personaFileName(personaFromPreset(SOURCE_PRESET))).toBe('the-hotel-concierge-persona.json')
    expect(personaFileText(file).endsWith('\n')).toBe(true) // a real text file, newline-terminated
  })
})

// SPEC-R5 (`persona-catalog-composition.spec.md`, M-D) — the persona's local-pattern-set SELECTION
// (A2UI_LOCAL_PATTERNS_KEY) is exportable persona-file state, symmetrical to A2UI_CATALOG_KEY: only the
// SELECTION travels, never the pattern DEFINITIONS (package-shipped code, SPEC-R1 — no
// components/functions/ComponentDef bytes anywhere in the exported JSON).
describe('the persona file carries the local-pattern-set SELECTION, never its definitions (SPEC-R5 AC1)', () => {
  it('a non-default selection round-trips byte-identically through export -> import', () => {
    const storeA = authoredStore()
    storeA.set(A2UI_LOCAL_PATTERNS_KEY, 'fixture-demo')
    const file = exportPersonaFile(personaFromPreset(SOURCE_PRESET), storeA)
    const text = personaFileText(file)
    const parsed = readPersonaFile(text)
    expect(parsed.ok, parsed.ok ? '' : parsed.error).toBe(true)
    if (!parsed.ok) return
    expect(parsed.file.state[A2UI_LOCAL_PATTERNS_KEY]).toBe('fixture-demo')

    const imported = importedPersonaFrom(parsed.file, [personaFromPreset(SOURCE_PRESET)])
    expect(imported.seed[A2UI_LOCAL_PATTERNS_KEY]).toBe('fixture-demo')
    const storeB = createMemoryStore({ initial: imported.seed })
    expect(storeB.get(A2UI_LOCAL_PATTERNS_KEY)).toBe(storeA.get(A2UI_LOCAL_PATTERNS_KEY))
  })

  it('PERSONA_STATE_KEYS carries the selection key, symmetrical to A2UI_CATALOG_KEY', () => {
    expect(PERSONA_STATE_KEYS).toContain(A2UI_LOCAL_PATTERNS_KEY)
    expect(PERSONA_STATE_KEYS).toContain(A2UI_CATALOG_KEY)
  })

  it('the exported JSON never carries components/functions/ComponentDef bytes — a grep-level assertion the envelope stayed selection-only', () => {
    const storeA = authoredStore()
    storeA.set(A2UI_LOCAL_PATTERNS_KEY, 'fixture-demo')
    const text = personaFileText(exportPersonaFile(personaFromPreset(SOURCE_PRESET), storeA))
    // The selection is a bare persona-id STRING (`"fixture-demo"`), never an object carrying schema
    // content — these tokens would only ever appear if a fragment's own components/functions leaked in.
    expect(text).not.toContain('"components"')
    expect(text).not.toContain('"functions"')
    expect(text).not.toContain('ComponentDef')
    expect(text).not.toContain('mapsTo')
    expect(text).not.toContain('FixtureBanner') // the fixture's own component name — content, never selection
  })

  it('an unselected persona omits the key entirely (unset stays unset, never a written undefined/default)', () => {
    // GH #497 — `SOURCE_PRESET` (concierge) now SEEDS its own selection by design, so it is no longer a
    // valid "unselected" fixture for this probe; `quant` (no `localPatterns`) is the genuine unselected
    // case — the SAME "no preset seeds A2UI_CATALOG_KEY either" fail-closed default `presetSeed`'s own
    // header documents.
    const unselected = AGENT_PRESETS.find((p) => p.id === 'quant')!
    expect(unselected.localPatterns, 'quant must stay a genuine unselected fixture').toBeUndefined()
    const file = exportPersonaFile(personaFromPreset(unselected), createMemoryStore({ initial: presetSeed(unselected) }))
    expect(Object.keys(file.state)).not.toContain(A2UI_LOCAL_PATTERNS_KEY)
  })
})

// GH #525 (independent review MAJOR 2, 2026-08-07) — the persistent-bankroll capability flag + its own
// persisted figure are BOTH persona-scoped store keys `PERSONA_STATE_KEYS` now carries (agent-admin-
// persona-file.ts): an exported croupier persona must carry them, or a re-import would silently resume a
// fresh stake — exactly the defect this file's own header comment (byte-identical composed prompt) rules
// out for every OTHER persona-scoped key.
describe('the persona file carries the persistent-bankroll capability + figure (GH #525)', () => {
  it('PERSONA_STATE_KEYS carries both bankroll keys', () => {
    expect(PERSONA_STATE_KEYS).toContain(BANKROLL_CAPABLE_KEY)
    expect(PERSONA_STATE_KEYS).toContain(BANKROLL_KEY)
  })

  it('a capable persona with a stored figure round-trips BOTH keys byte-identically through export -> import', () => {
    const storeA = authoredStore()
    storeA.set(BANKROLL_CAPABLE_KEY, true)
    storeA.set(BANKROLL_KEY, 725)
    const file = exportPersonaFile(personaFromPreset(SOURCE_PRESET), storeA)
    const text = personaFileText(file)
    const parsed = readPersonaFile(text)
    expect(parsed.ok, parsed.ok ? '' : parsed.error).toBe(true)
    if (!parsed.ok) return
    expect(parsed.file.state[BANKROLL_CAPABLE_KEY]).toBe(true)
    expect(parsed.file.state[BANKROLL_KEY]).toBe(725)

    const imported = importedPersonaFrom(parsed.file, [personaFromPreset(SOURCE_PRESET)])
    expect(imported.seed[BANKROLL_CAPABLE_KEY]).toBe(true)
    expect(imported.seed[BANKROLL_KEY]).toBe(725)
    const storeB = createMemoryStore({ initial: imported.seed })
    expect(storeB.get(BANKROLL_CAPABLE_KEY)).toBe(storeA.get(BANKROLL_CAPABLE_KEY))
    expect(storeB.get(BANKROLL_KEY)).toBe(storeA.get(BANKROLL_KEY))
  })

  it('a persona that never opted in, and never stored a figure, omits BOTH keys entirely (unset stays unset)', () => {
    const file = exportPersonaFile(personaFromPreset(SOURCE_PRESET), authoredStore())
    expect(Object.keys(file.state)).not.toContain(BANKROLL_CAPABLE_KEY)
    expect(Object.keys(file.state)).not.toContain(BANKROLL_KEY)
  })

  it("mintIdentity's uniquify pass (id/label only) leaves the bankroll keys untouched", () => {
    const storeA = authoredStore()
    storeA.set(BANKROLL_CAPABLE_KEY, true)
    storeA.set(BANKROLL_KEY, 340)
    const file = exportPersonaFile(personaFromPreset(SOURCE_PRESET), storeA)
    const result = readPersonaFile(personaFileText(file))
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const roster: Persona[] = AGENT_PRESETS.map(personaFromPreset)
    const first = importedPersonaFrom(result.file, roster)
    const second = importedPersonaFrom(result.file, [...roster, first])
    // the ROSTER identity is uniquified (the SAME collision-safe minting the `importedPersonaFrom —
    // collision-safe minting` suite below already proves for id/label)...
    expect(first.id).not.toBe(second.id)
    expect(first.label).not.toBe(second.label)
    // ...but the STATE — including both bankroll keys — is byte-identical across both mints.
    expect(second.seed).toEqual(first.seed)
    expect(first.seed[BANKROLL_CAPABLE_KEY]).toBe(true)
    expect(first.seed[BANKROLL_KEY]).toBe(340)
    expect(second.seed[BANKROLL_CAPABLE_KEY]).toBe(true)
    expect(second.seed[BANKROLL_KEY]).toBe(340)
  })
})

describe('readPersonaFile — fail-closed validation', () => {
  const good = (): string => personaFileText(exportPersonaFile(personaFromPreset(SOURCE_PRESET), authoredStore()))

  it('accepts this build’s own output', () => {
    expect(readPersonaFile(good()).ok).toBe(true)
  })

  it('rejects unparseable JSON, a non-object body, and a foreign kind', () => {
    expect(readPersonaFile('{ not json')).toEqual({ ok: false, error: 'Not a valid JSON file.' })
    expect(readPersonaFile('[1,2,3]').ok).toBe(false)
    const foreign = JSON.stringify({ kind: 'something-else', version: 1, persona: { label: 'x' }, state: {} })
    const result = readPersonaFile(foreign)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('agent-ui-persona')
  })

  it('rejects a version this build cannot read, and a version-less file', () => {
    const parsed = JSON.parse(good()) as Record<string, unknown>
    const newer = readPersonaFile(JSON.stringify({ ...parsed, version: PERSONA_FILE_VERSION + 1 }))
    expect(newer.ok).toBe(false)
    if (!newer.ok) expect(newer.error).toContain(`version ${PERSONA_FILE_VERSION + 1}`)
    expect(readPersonaFile(JSON.stringify({ ...parsed, version: 'one' })).ok).toBe(false)
  })

  it('rejects a nameless persona, a missing state, and prompt sections that are absent or not a list', () => {
    const parsed = JSON.parse(good()) as Record<string, unknown>
    expect(readPersonaFile(JSON.stringify({ ...parsed, persona: { label: '   ' } })).ok).toBe(false)
    expect(readPersonaFile(JSON.stringify({ ...parsed, state: 'nope' })).ok).toBe(false)
    expect(readPersonaFile(JSON.stringify({ ...parsed, state: {} })).ok).toBe(false)
    const sectionsKey = entriesStoreKey(ENTRY_KINDS.promptSection)
    const bad = { ...parsed, state: { ...(parsed.state as Record<string, unknown>), [sectionsKey]: 'nope' } }
    expect(readPersonaFile(JSON.stringify(bad)).ok).toBe(false)
    const badSkills = { ...parsed, state: { ...(parsed.state as Record<string, unknown>), [entriesStoreKey(ENTRY_KINDS.skill)]: {} } }
    expect(readPersonaFile(JSON.stringify(badSkills)).ok).toBe(false)
  })

  // The deep check: an entry LIST that is an array of junk. Nothing downstream re-validates — `readEntries`
  // blind-casts (`raw as Entry[]`) and `composeSystemPrompt` dereferences `.enabled`/`.content` — and the
  // page PERSISTS an import before anything renders it, so a malformed item accepted here would wedge the
  // surface on every reload until localStorage was cleared by hand. Rejected whole, never sanitize-dropped:
  // a silently shortened persona is a persona that behaves differently than the one exported.
  it('rejects an entry list holding a non-entry item — null, a number, a bare string', () => {
    const parsed = JSON.parse(good()) as Record<string, unknown>
    const sectionsKey = entriesStoreKey(ENTRY_KINDS.promptSection)
    const withSections = (list: unknown): string =>
      JSON.stringify({ ...parsed, state: { ...(parsed.state as Record<string, unknown>), [sectionsKey]: list } })

    for (const junk of [[null], [42], ['a section'], [[]]]) {
      const result = readPersonaFile(withSections(junk))
      expect(result.ok, `${JSON.stringify(junk)} must be rejected`).toBe(false)
      if (!result.ok) expect(result.error).toContain('entry 0')
    }
    // A well-formed section FOLLOWED by a junk one is still rejected, and the message names the index.
    const sections = (parsed.state as Record<string, unknown>)[sectionsKey] as unknown[]
    const trailing = readPersonaFile(withSections([...sections, null]))
    expect(trailing.ok).toBe(false)
    if (!trailing.ok) expect(trailing.error).toContain(`entry ${sections.length}`)
  })

  it('rejects an entry item missing any Entry field — the whole shape, not just its presence', () => {
    const parsed = JSON.parse(good()) as Record<string, unknown>
    const skillsKey = entriesStoreKey(ENTRY_KINDS.skill)
    const [sample] = (parsed.state as Record<string, unknown>)[skillsKey] as Array<Record<string, unknown>>
    expect(sample, 'the fixture really carries a seeded skill to mangle').toBeDefined()
    const mangled = (patch: Record<string, unknown>): string =>
      JSON.stringify({ ...parsed, state: { ...(parsed.state as Record<string, unknown>), [skillsKey]: [{ ...sample, ...patch }] } })

    for (const patch of [
      { id: 7 },
      { kind: null },
      { label: undefined },
      { description: 3 },
      { content: {} },
      { order: 'first' },
      { order: Number.NaN },
      { enabled: 'yes' },
      { builtin: 1 },
    ]) {
      const result = readPersonaFile(mangled(patch))
      expect(result.ok, `${JSON.stringify(patch)} must be rejected`).toBe(false)
    }
    // the control: the unmangled sample passes, so the loop above is testing the FIELDS, not the fixture
    expect(readPersonaFile(mangled({})).ok).toBe(true)
  })

  it('drops unknown state keys rather than importing them (only PERSONA_STATE_KEYS may reach a store)', () => {
    const parsed = JSON.parse(good()) as Record<string, unknown>
    const smuggled = { ...parsed, state: { ...(parsed.state as Record<string, unknown>), evilKey: 'boom' } }
    const result = readPersonaFile(JSON.stringify(smuggled))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Object.keys(result.file.state)).not.toContain('evilKey')
  })
})

describe('importedPersonaFrom — collision-safe minting (library semantics)', () => {
  const parsedGood = (): { label: string; state: Record<string, unknown> } => {
    const result = readPersonaFile(personaFileText(exportPersonaFile(personaFromPreset(SOURCE_PRESET), authoredStore())))
    if (!result.ok) throw new Error(result.error)
    return { label: result.file.persona.label, state: result.file.state }
  }

  it('mints a fresh id/label per import — importing the SAME file twice never collides', () => {
    const result = readPersonaFile(personaFileText(exportPersonaFile(personaFromPreset(SOURCE_PRESET), authoredStore())))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const roster: Persona[] = AGENT_PRESETS.map(personaFromPreset)
    const first = importedPersonaFrom(result.file, roster)
    const second = importedPersonaFrom(result.file, [...roster, first])
    expect(first.id).not.toBe(second.id)
    expect(first.label).not.toBe(second.label)
    expect(roster.some((p) => p.id === first.id || p.id === second.id), 'never a shipped preset id').toBe(false)
    // the STATE is identical across both mints — only the roster identity is uniquified
    expect(second.seed).toEqual(first.seed)
  })

  it('leaves the persona’s own `name` untouched — only the ROSTER label carries the (imported) marker', () => {
    const { label, state } = parsedGood()
    const result = readPersonaFile(personaFileText(exportPersonaFile(personaFromPreset(SOURCE_PRESET), authoredStore())))
    if (!result.ok) return
    const minted = importedPersonaFrom(result.file, AGENT_PRESETS.map(personaFromPreset))
    expect(minted.label).toBe(`${label} (imported)`)
    expect(minted.seed.name).toBe(state.name) // the live agent identity is byte-identical
    expect(minted.seed.name).toBe('Meridian Night Concierge')
  })
})

describe('the imported library — persisted roster registration (survives reload)', () => {
  it('a saved persona joins personaRoster() and reads back from localStorage with its seed intact', () => {
    const result = readPersonaFile(personaFileText(exportPersonaFile(personaFromPreset(SOURCE_PRESET), authoredStore())))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const minted = importedPersonaFrom(result.file, personaRoster())
    saveImportedPersona(minted)

    // A fresh read of the PERSISTED record — what the page does at boot (loadImportedPersonas → roster).
    const reloaded = loadImportedPersonas()
    expect(reloaded.map((p) => p.id)).toEqual([minted.id])
    expect(reloaded[0]!.seed).toEqual(minted.seed)
    expect(personaRoster().map((p) => p.id)).toEqual([...AGENT_PRESETS.map((p) => p.id), minted.id])

    // Its store is persona-scoped like any preset's: writes land under its OWN persistKey.
    const store = personaStore(reloaded[0]!)
    expect(store.get('name')).toBe('Meridian Night Concierge')
    store.set('name', 'Edited after import')
    expect(localStorage.getItem(`agent-admin-app.${minted.id}.name`)).toBe(JSON.stringify('Edited after import'))
    resetPersona(reloaded[0]!) // leave no residue for sibling tests
    expect(personaStore(reloaded[0]!).get('name')).toBe('Meridian Night Concierge') // reset ⇒ back to the IMPORTED state
    resetPersona(reloaded[0]!)
  })

  it('a corrupt persisted library degrades to empty rather than taking the page down', () => {
    localStorage.setItem(IMPORTED_PERSONAS_KEY, '{ not json')
    expect(loadImportedPersonas()).toEqual([])
    localStorage.setItem(IMPORTED_PERSONAS_KEY, JSON.stringify([{ id: 'x' }, null, 42]))
    expect(loadImportedPersonas()).toEqual([])
  })
})

// ── GH #409: the persona-scoped half of the rehydration fix ────────────────────────────────────────────
// memory-store now rehydrates a store's WHOLE `${persistKey}.` namespace instead of just the seed's own
// keys. These are the three edges that decided that shape was safe HERE: a flipped Surface Option must
// come back on reload AND reach an export taken afterwards; one persona's namespace must never answer
// another's keys; and a freshly-minted import (whose id is the previous mint's id plus a suffix — the
// worst-case prefix overlap this surface actually produces) must start empty.

describe('a persona’s Surface Options / master toggles survive a reload, per persona (GH #409)', () => {
  const CONCIERGE = personaFromPreset(SOURCE_PRESET)
  const TRAVEL = personaFromPreset(AGENT_PRESETS.find((p) => p.id === 'travel')!)

  /** A FRESH store over the same persisted namespace — what a real page RELOAD builds. `personaStore`
   *  caches one live instance per id for the page's lifetime, so a reload cannot be observed through it. */
  const reloaded = (persona: Persona): SettingsStore =>
    createMemoryStore({ initial: persona.seed, persistKey: `agent-admin-app.${persona.id}` })

  const touched: Persona[] = []
  const live = (persona: Persona): SettingsStore => {
    touched.push(persona)
    return personaStore(persona)
  }
  afterEach(() => {
    for (const persona of touched.splice(0)) resetPersona(persona) // leave no residue for sibling tests
  })

  it('a flipped Surface Option + master switch rehydrate, and reach an export taken AFTER the reload', () => {
    const store = live(CONCIERGE)
    store.set(SURFACE_A2UI_KEY, false) // no preset seed carries either key — that WAS the bug
    store.set(AGENT_ENABLED_KEY, false)

    const afterReload = reloaded(CONCIERGE)
    expect(afterReload.get(SURFACE_A2UI_KEY)).toBe(false)
    expect(afterReload.get(AGENT_ENABLED_KEY)).toBe(false)
    expect(afterReload.get('name')).toBe(CONCIERGE.seed.name) // the seed still supplies the untouched keys

    // Export fidelity is the same bug's other face: `readPersonaState` reads THROUGH the store, so before
    // the fix a persona exported after a reload silently lost every surface/master flip it had been given.
    const state = readPersonaState(afterReload)
    expect(state[SURFACE_A2UI_KEY]).toBe(false)
    expect(state[AGENT_ENABLED_KEY]).toBe(false)
    // …and nothing NEW joins the file: the page parks its own per-persona `seedVersion` marker inside this
    // namespace, so the store now answers it as a key — but the file's key set is enumerated, never scanned.
    expect(afterReload.get('seedVersion')).toBe(SOURCE_PRESET.seedVersion)
    expect(Object.keys(state)).not.toContain('seedVersion')
    for (const key of Object.keys(state)) expect(PERSONA_STATE_KEYS).toContain(key)
  })

  it('one persona’s toggles never leak into another’s store', () => {
    live(CONCIERGE).set(SURFACE_A2UI_KEY, false)
    expect(reloaded(TRAVEL).get(SURFACE_A2UI_KEY), 'an untouched persona keeps its default-ON read').toBeUndefined()
    expect(reloaded(CONCIERGE).get(SURFACE_A2UI_KEY)).toBe(false)
  })

  it('a freshly MINTED import starts empty, even though its id extends the previous mint’s id', () => {
    const parsed = readPersonaFile(personaFileText(exportPersonaFile(CONCIERGE, authoredStore())))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const firstImport = importedPersonaFrom(parsed.file, [CONCIERGE])
    const secondImport = importedPersonaFrom(parsed.file, [CONCIERGE, firstImport])
    // `…-imported` vs `…-imported-2`: the first id is a leading substring of the second, which is exactly
    // the case a prefix scan gets wrong if it forgets the delimiting dot.
    expect(secondImport.id.startsWith(firstImport.id)).toBe(true)

    live(firstImport).set(SURFACE_A2UI_KEY, false)
    expect(reloaded(secondImport).get(SURFACE_A2UI_KEY)).toBeUndefined()
    expect(reloaded(firstImport).get(SURFACE_A2UI_KEY)).toBe(false)
    touched.push(secondImport)
  })
})
