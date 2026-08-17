// agent-admin-ambient-budget.test.ts — GH #891 / capability-availability-tagging.spec.md SPEC-R14 AC2
// (slice S8): the AMBIENT BYTE BUDGET, measured on the SHIPPED library packs and asserted as a predicate.
//
// This lives site-side deliberately: the "realistic corpus" the ruling was measured against is
// `agent-admin-libraries.ts` — the packs a real operator actually adds from (A2UI idioms, hospitality,
// games, game rules, the integrations trio) — and those are PAGE-LOCAL data by the presets scope law, not a
// package export. So the projection unit lives in `entries.test.ts` (packages) and the corpus-scale
// measurement lives here, over the REAL `ui-agent-admin` element: the prompt is captured off the
// component's own injected-runner seam (`agentTurn` receives `composeLiveSystemPrompt(...)`), never
// recomputed by this test — the same technique `agent-admin-persona-file.test.ts` uses.
//
// The comparison is COMPUTED BOTH WAYS (the AC's own wording: a budget predicate, never a byte pin): the
// real index-shaped prompt vs. the PRE-#891 full-content grammar, spelled out below so the ratio is honest.
// If a future change makes the ambient shape heavier — a second full-content path, a pack full of runaway
// descriptions — this gate goes red with the measured numbers in the message.
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import '@agent-ui/app/agent-admin'
import type { UIAgentAdminElement } from '@agent-ui/app/agent-admin'
import { createMemoryStore } from '@agent-ui/app'
import type { SettingsStore } from '@agent-ui/app'
import { ENTRY_KINDS } from '@agent-ui/app/agent-admin-entries'
import { entriesStoreKey, validateNewEntry } from '@agent-ui/app/entry-data'
import type { Entry, EntryLibraryPack, NewEntryInput } from '@agent-ui/app/entry-data'
import type { AdminAgentTurn, AdminTurnRequest } from '@agent-ui/app/agent-admin-schema'
import { SURFACE_A2UI_KEY } from '@agent-ui/app/agent-admin-schema'
import { ADMIN_LIBRARIES } from './agent-admin-libraries.ts'
import { AGENT_PRESETS, personaFromPreset, presetSeed } from './agent-admin-presets.ts'

// ── the jsdom ElementInternals stub (agent-admin-persona-file.test.ts verbatim) ─────────────────────────
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

/** The four capability kinds an availability mode — and therefore this budget — is defined for (SPEC-R1). */
const CAPABILITY_KINDS = [ENTRY_KINDS.skill, ENTRY_KINDS.workflow, ENTRY_KINDS.resource, ENTRY_KINDS.tool] as const

/** Mint real `Entry` rows from a pack's `NewEntryInput`s exactly as the add-from-library menu does — through
 *  `validateNewEntry`, appended to whatever the preset already seeded (the real operator sequence: pick a
 *  persona, then add libraries on top), so ids/orders/flags are the ones a real store would hold. */
function entriesFrom(kind: string, seeded: readonly Entry[], packs: readonly EntryLibraryPack[]): Entry[] {
  const out: Entry[] = [...seeded]
  for (const pack of packs) {
    for (const input of pack.entries as readonly NewEntryInput[]) {
      const result = validateNewEntry(out, kind, input, { rejectOnCollision: false })
      if (result.ok) out.push(result.entry)
    }
  }
  return out
}

/** A persona store seeded from a shipped preset, then loaded with the shipped packs `pick` selects per kind
 *  (the operator gesture this measures: "add the library, keep everything enabled"). */
function storeWithPacks(presetId: string, pick: (kind: string, pack: EntryLibraryPack) => boolean): SettingsStore {
  const preset = AGENT_PRESETS.find((p) => p.id === presetId)!
  const store = createMemoryStore({ initial: presetSeed(preset) })
  store.set(SURFACE_A2UI_KEY, false) // the prose arm answers — one composed string per turn, nothing surface-side
  for (const kind of CAPABILITY_KINDS) {
    const packs = (ADMIN_LIBRARIES[kind] ?? []).filter((pack) => pick(kind, pack))
    const seeded = (store.get(entriesStoreKey(kind)) as Entry[] | undefined) ?? []
    store.set(entriesStoreKey(kind), entriesFrom(kind, seeded, packs))
  }
  void personaFromPreset(preset) // (the preset's own persona shape is exercised by the round-trip suite)
  return store
}

const ambientEntriesOf = (store: SettingsStore): Entry[] =>
  CAPABILITY_KINDS.flatMap((kind) => (store.get(entriesStoreKey(kind)) as Entry[] | undefined) ?? [])

interface Recorder {
  fn: AdminAgentTurn
  calls: AdminTurnRequest[]
}

/** The composed live prompt the REAL component builds from `store`, captured off the injected runner seam. */
async function composedPromptFor(store: SettingsStore): Promise<string> {
  const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
  el.store = store
  document.body.append(el)
  mounted.push(el)
  await whenFlushed()
  const recorder: Recorder = { calls: [], fn: async (req) => (recorder.calls.push(req), 'ok') }
  el.agentTurn = recorder.fn
  const composer = el.querySelector('[data-part="canvas"] ui-conversation-composer') as HTMLElement & { value: string }
  composer.value = 'ping'
  ;(composer.querySelector('[data-part="send"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
  for (let i = 0; i < 200 && recorder.calls.length === 0; i += 1) await Promise.resolve()
  expect(recorder.calls, 'the injected runner must have received the turn').toHaveLength(1)
  el.remove()
  return recorder.calls[0]!.system
}

/** The PRE-#891 ambient grammar, restated: `### {label}` + description + blank line + content, per entry.
 *  The only reason it is spelled out here is to make R14 AC2's ratio a real measurement of what the ruling
 *  replaced, rather than a number nobody can check. */
function fullContentBytes(entries: readonly Entry[]): number {
  return entries.reduce((total, e) => {
    const lines = [`### ${e.label}`]
    if (e.description.trim().length > 0) lines.push(e.description.trim())
    if (e.content.trim().length > 0) lines.push('', e.content.trim())
    return total + lines.join('\n').length + 2 // + the '\n\n' each block carries between siblings
  }, 0)
}

/** The ambient INDEX bytes the real prompt actually spends: every `- ` line plus the teaching block and the
 *  `## ` group headings — i.e. everything the capability projection added on top of the persona sections. */
function indexBytes(prompt: string, entries: readonly Entry[]): number {
  const lines = prompt.split('\n')
  const first = lines.findIndex((l) => l.startsWith('The capability lists below are an INDEX'))
  expect(first, 'the teaching block must open the capability section').toBeGreaterThan(-1)
  const bytes = lines.slice(first).join('\n').length
  // anti-vacuity: one index line per ambient entry, no more, no fewer.
  expect(lines.filter((l) => l.startsWith('- ')).length).toBe(entries.length)
  return bytes
}

describe('SPEC-R14 AC2 — the ambient byte budget over the SHIPPED library packs', () => {
  // The two corpora the SPEC §12 survey itself measured: one realistic persona, one everything-added stress
  // case. Both are asserted; the numbers print so a reviewer sees the measurement, not just a green tick.
  const CORPORA: { name: string; store: () => SettingsStore }[] = [
    {
      name: 'hospitality concierge (A2UI idioms + hospitality packs + the integrations trio)',
      store: () =>
        storeWithPacks('concierge', (kind, pack) =>
          kind === ENTRY_KINDS.tool ? true : ['a2ui-idioms', 'hospitality', 'playbooks-core', 'playbooks-hospitality'].includes(pack.id),
        ),
    },
    { name: 'everything-added stress case (every shipped pack of all four kinds)', store: () => storeWithPacks('concierge', () => true) },
  ]

  for (const corpus of CORPORA) {
    it(`${corpus.name}: index ≤ 30% of the full-content shape, and ≤ 200 B per entry`, async () => {
      const store = corpus.store()
      const entries = ambientEntriesOf(store)
      const prompt = await composedPromptFor(store)
      const index = indexBytes(prompt, entries)
      const full = fullContentBytes(entries)
      // The AC's own corpus floor: ≥ 20 entries and ≥ 10 KB of ambient content — measured the way the SPEC
      // §12 survey measured it (the composed full-content ambient weight, its 10,167–16,192 B column).
      expect(entries.length, 'the shipped packs really carry ≥ 20 entries').toBeGreaterThanOrEqual(20)
      expect(full, 'and ≥ 10 KB of full-content ambient weight between them').toBeGreaterThan(10_000)
      const reduction = (1 - index / full) * 100
      // The measurement, printed: this is the before/after the ruling was made on.
      console.info(
        `[SPEC-R14 AC2] ${corpus.name}: ${entries.length} entries · full-content ambient ${full} B → index ${index} B (−${reduction.toFixed(1)}%)`,
      )
      expect(index / full, `index ${index} B vs full-content ${full} B`).toBeLessThanOrEqual(0.3)

      // Per-entry ceiling — the runaway-description trip-wire (SPEC-N3: a red gate, never a silent cut).
      for (const line of prompt.split('\n').filter((l) => l.startsWith('- '))) {
        expect(line.length + 1, `"${line}" exceeds the 200 B per-entry budget`).toBeLessThanOrEqual(200)
      }

      // …and not one entry's BODY reached the prompt: sampled over every ambient entry with real content.
      for (const entry of entries) {
        const sentinel = entry.content.trim().split('\n')[0]?.trim() ?? ''
        if (sentinel.length < 24) continue // too short to be a distinctive substring — skip, never assert loosely
        expect(prompt, `${entry.kind}/${entry.id}'s content must not compose ambiently`).not.toContain(sentinel)
      }
    })
  }
})
