// agent-admin-authoring.test.ts — ADR-0178 cl.3 / SPEC-R30: schema-level unit coverage for the
// persona-authoring opt-in gate constant (`SURFACE_AUTHORING_KEY`/`isAuthoringSurfaceEnabled`). The SAME
// inverse-default fail-closed shape `isGenuiSurfaceEnabled`/`isPlannerSurfaceEnabled` already carry — only
// an explicit stored `true` turns the modality on, so a persona that does not author agents is
// byte-identical to before this capability existed.
//
// This file is the schema-level unit coverage only. The gate's other two halves live where they belong:
// the persona-file round trip (the key joining `PERSONA_STATE_KEYS`) in
// `site/pages/agent-admin-persona-file.test.ts`, and the producer-side teaching gate (the composed prompt
// composing zero bytes while off) in `system-prompt-grammar.test.ts`. The gate's admin ROW and the
// host-side apply loop it feeds are ADR-0178 cl.2's, built at S3 with its own LLD.

import { describe, it, expect } from 'vitest'
import { SURFACE_AUTHORING_KEY, isAuthoringSurfaceEnabled } from './agent-admin-schema.ts'
import { SURFACE_A2UI_KEY, SURFACE_GENUI_KEY, SURFACE_GENUI_DOGFOOD_KEY, SURFACE_MARKDOWN_KEY, SURFACE_PLANNER_KEY } from './agent-admin-schema.ts'

describe('SURFACE_AUTHORING_KEY / isAuthoringSurfaceEnabled — fail-closed, absent/non-`true` reads as OFF', () => {
  it('the store key is a stable, distinct string (the SURFACE_A2UI_KEY/SURFACE_PLANNER_KEY precedent)', () => {
    expect(SURFACE_AUTHORING_KEY).toBe('surfaceAuthoring')
  })

  it('it collides with no other Surface Option key — one key, one modality', () => {
    const others = [SURFACE_MARKDOWN_KEY, SURFACE_A2UI_KEY, SURFACE_GENUI_KEY, SURFACE_GENUI_DOGFOOD_KEY, SURFACE_PLANNER_KEY]
    expect(others).not.toContain(SURFACE_AUTHORING_KEY)
  })

  it('only a stored `true` reads as enabled', () => {
    expect(isAuthoringSurfaceEnabled(true)).toBe(true)
  })

  it('undefined/false/a truthy non-boolean all read as OFF (fail-closed, the isGenuiSurfaceEnabled shape)', () => {
    expect(isAuthoringSurfaceEnabled(undefined)).toBe(false)
    expect(isAuthoringSurfaceEnabled(false)).toBe(false)
    expect(isAuthoringSurfaceEnabled('true')).toBe(false)
    expect(isAuthoringSurfaceEnabled(1)).toBe(false)
    expect(isAuthoringSurfaceEnabled(null)).toBe(false)
    expect(isAuthoringSurfaceEnabled({})).toBe(false)
  })
})

// ── LLD-C6 (agent-authoring-flow.lld.md §11) — the dual-context flow and its apply loop ────────────────
// Everything above is the gate CONSTANT. Everything below is what S3 built on it: the second conversation,
// the context routing, and — the load-bearing one — the ruled CONSUMPTION CONDITION. That condition is
// conjunctive (Kim's §15 option-(b) ruling), so it is probed at BOTH exclusion polarities: gate-OFF inside
// the authoring context, and gate-ON outside it. A one-sided proof would pass with either conjunct
// silently dropped, which is exactly the regression class the fence exists to prevent.
import { beforeAll, afterAll, afterEach } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UIAgentAdminElement } from './agent-admin.ts'
import { createMemoryStore } from '../settings/memory-store.ts'
import type { SettingsStore } from '../settings/store.ts'
import type { AdminSurfaceTurnEvent, AdminSurfaceTurnRequest } from './agent-admin-schema.ts'
import { ENTRY_KINDS, initialEntryValues } from './entries.ts'
import { entriesStoreKey, readEntries } from '../entry-list/entry-data.ts'
import { DEFAULT_MODEL_ID, initialValuesFor, defaultAgentConfigSchema } from './agent-admin-schema.ts'

// jsdom reality (the agent-admin.test.ts precedent, verbatim): jsdom's ElementInternals carries no real
// setFormValue/setValidity, so every composed FACE form control would throw on connect without this stub.
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

/** Drive the mode flip from a probe. `setModeSeam` is `protected` — a compile-time construct only — so a
 *  cast reaches it without widening the element's public API. Deliberately NOT a probe SUBCLASS (the
 *  split.ts precedent): agent-admin.css is `@scope (ui-agent-admin)`, so a probe tag would render
 *  unstyled and quietly void every geometry assertion. S4-a's try-it bar replaces this call site. */
const flipMode = (el: UIAgentAdminElement, mode: 'authoring' | 'test'): void => {
  ;(el as unknown as { setModeSeam(m: 'authoring' | 'test'): void }).setModeSeam(mode)
}

const PATCH = { values: { name: 'Concierge', temperature: 0.3 }, entries: { [entriesStoreKey(ENTRY_KINDS.skill)]: [{ label: 'Book a table' }] } }

/** A persona store seeded the way the page seeds one — the real defaults, so pane reads are honest. */
function personaStore(extra: Record<string, unknown> = {}): SettingsStore {
  return createMemoryStore({ initial: { model: DEFAULT_MODEL_ID, ...initialValuesFor(defaultAgentConfigSchema), ...initialEntryValues(), ...extra } })
}

/** Mount an admin whose surface runner replays `events`, recording every request it is handed. */
function mountAdmin(options: {
  store: SettingsStore
  authoringStore?: SettingsStore
  events?: AdminSurfaceTurnEvent[]
}): { el: UIAgentAdminElement; requests: AdminSurfaceTurnRequest[] } {
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

/** Submit through a REAL composer — whichever conversation currently owns the visible one. */
async function submit(el: UIAgentAdminElement, text: string, context: 'authoring' | 'test' = 'authoring'): Promise<void> {
  const host =
    context === 'authoring'
      ? (el.querySelector('[data-part="authoring-conversation"]') as HTMLElement)
      : (el.querySelector('[data-part="chat-stack"] > ui-conversation:not([data-part="authoring-conversation"])') as HTMLElement)
  const composer = host.querySelector('ui-conversation-composer') as HTMLElement & { value: string }
  composer.value = text
  const editor = composer.querySelector('[data-part="editor"]') as HTMLElement
  editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  await whenFlushed()
  await new Promise((r) => setTimeout(r, 0))
  await whenFlushed()
}

const turnLogOf = (el: UIAgentAdminElement): Record<string, unknown> => {
  const newest = el.querySelector('[data-part="context-turn"] [data-part="context-json"]')
  return JSON.parse(newest?.textContent ?? '{}') as Record<string, unknown>
}

describe('the apply loop’s CONSUMPTION CONDITION — the fence AND the gate, both polarities (LLD-C6)', () => {
  it('CONSUMES a patch on an authoring-context turn whose gate reads ON, writing to the DRAFT store', async () => {
    const draft = personaStore()
    const builder = personaStore({ [SURFACE_AUTHORING_KEY]: true, name: 'Builder' })
    const { el } = mountAdmin({ store: draft, authoringStore: builder, events: [{ kind: 'patch', patch: PATCH }] })
    await whenFlushed()
    await submit(el, 'a hotel concierge please')

    expect(draft.get('name')).toBe('Concierge')
    expect(draft.get('temperature')).toBe(0.3)
    expect(readEntries(draft, ENTRY_KINDS.skill).map((e) => e.label)).toEqual(['Book a table'])
    // the interviewer's OWN store is never the target — only the draft is
    expect(builder.get('name')).toBe('Builder')
    // the report rides the turn log, never an error surface
    const response = turnLogOf(el).response as { patch?: { applied?: string[] } }
    expect(response.patch?.applied).toEqual(['name', 'temperature'])
  })

  it('POLARITY 1 — gate OFF INSIDE the authoring context: ignored, zero writes', async () => {
    // The fence alone must not be sufficient. A persona that has not opted in is never patched, even by
    // the dedicated interviewer.
    const draft = personaStore()
    const builder = personaStore({ name: 'Builder' }) // gate absent ⇒ OFF (inverse default)
    const { el } = mountAdmin({ store: draft, authoringStore: builder, events: [{ kind: 'patch', patch: PATCH }] })
    await whenFlushed()
    await submit(el, 'a hotel concierge please')

    expect(draft.get('name')).toBe('Untitled agent') // the seeded default, untouched
    expect(readEntries(draft, ENTRY_KINDS.skill)).toEqual([])
    const response = turnLogOf(el).response as { patchIgnored?: boolean; patch?: unknown }
    expect(response.patchIgnored).toBe(true)
    expect(response.patch).toBeUndefined()
  })

  it('POLARITY 2 — gate ON but OUTSIDE the authoring context: ignored, zero writes', async () => {
    // The gate alone must not be sufficient either. This is Kim's §15 ruling in one probe: an ordinary
    // chat with a gate-ON persona volunteers a patch, and the host refuses it — which is what stops a
    // consumed self-patch from widening the model's own write authority.
    const draft = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const { el } = mountAdmin({ store: draft, events: [{ kind: 'patch', patch: PATCH }] })
    await whenFlushed()
    await submit(el, 'rename yourself', 'test')

    expect(draft.get('name')).toBe('Untitled agent')
    expect(readEntries(draft, ENTRY_KINDS.skill)).toEqual([])
    const response = turnLogOf(el).response as { patchIgnored?: boolean }
    expect(response.patchIgnored).toBe(true)
  })

  it('POLARITY 2, the harder arm — the flow is ARMED but the TEST context drives the turn', async () => {
    // Same refusal with the authoring context alive and its gate on: it is the DRIVING store that is
    // fenced on, not merely the existence of an authoring store somewhere.
    const draft = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const builder = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const { el } = mountAdmin({ store: draft, authoringStore: builder, events: [{ kind: 'patch', patch: PATCH }] })
    await whenFlushed()
    flipMode(el, 'test')
    await submit(el, 'hello draft', 'test')

    expect(draft.get('name')).toBe('Untitled agent')
    expect((turnLogOf(el).response as { patchIgnored?: boolean }).patchIgnored).toBe(true)
  })

  it('a POISONED key never costs the turn — the drop-the-item law, proven at the turn level', async () => {
    // The regression this pins (review MAJOR): a prototype-chain key used to THROW inside the apply gate,
    // and the throw escaped into this method's own catch → `handle.fail()`, killing a turn whose real
    // content was perfectly good. §3 says a drop removes the ITEM, never the patch and never the turn, and
    // SPEC-R30's degrade law says the same — so this asserts the turn still finalizes normally, its note
    // still paints, and its good keys still land, with only the bad key recorded as dropped.
    const draft = personaStore()
    const builder = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const poisoned = JSON.parse('{"values":{"__proto__":"evil","name":"Survived","toString":"y"}}') as { values: Record<string, unknown> }
    const { el } = mountAdmin({
      store: draft,
      authoringStore: builder,
      events: [{ kind: 'patch', patch: poisoned }, { kind: 'note', note: 'Still here.' }],
    })
    await whenFlushed()
    await submit(el, 'go')

    expect(draft.get('name'), 'the turn’s good content still applied').toBe('Survived')
    const authoring = el.querySelector('[data-part="authoring-conversation"]') as HTMLElement
    expect(authoring.textContent, 'the reply painted — the turn was not failed').toContain('Still here.')
    expect(authoring.querySelector('[data-role="system"]')?.textContent ?? '', 'no ⚠ failure bubble').not.toContain('⚠')
    const response = turnLogOf(el).response as { patch: { applied: string[]; dropped: string[] }; error?: string }
    expect(response.error, 'the turn recorded no error at all').toBeUndefined()
    expect(response.patch.applied).toEqual(['name'])
    expect(response.patch.dropped).toEqual(['__proto__', 'toString'])
  })

  it('a consumed patch still DROPS what the gate refuses — the three filters are not bypassed by consumption', async () => {
    const draft = personaStore()
    const builder = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const { el } = mountAdmin({
      store: draft,
      authoringStore: builder,
      events: [{ kind: 'patch', patch: { values: { name: 'Fine', model: 'not-a-model' } } }],
    })
    await whenFlushed()
    await submit(el, 'go')
    expect(draft.get('name')).toBe('Fine')
    expect(draft.get('model')).toBe(DEFAULT_MODEL_ID) // dropped, NOT coerced to something else
    expect((turnLogOf(el).response as { patch: { dropped: string[] } }).patch.dropped).toEqual(['model'])
  })
})

describe('live pane hydration — the written values reach the real DOM (LLD-C6 panes proof)', () => {
  it('after a patch turn the settings field and the entry section render the patched state', async () => {
    // This exercises §7's cited law end to end rather than trusting the citation: the apply loop adds no
    // re-render machinery of its own, so if the shipped per-field/per-kind subscriptions did not carry a
    // patch write the way they carry a hand edit, the panes would silently stay stale.
    const draft = personaStore()
    const builder = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const { el } = mountAdmin({ store: draft, authoringStore: builder, events: [{ kind: 'patch', patch: PATCH }] })
    await whenFlushed()
    await submit(el, 'a hotel concierge please')
    await whenFlushed()

    // the generated field carries `name = field.key` (settings/generate.ts) and re-reads the store
    // through TKT-0021's per-field external-sync subscription — the exact channel a hand edit uses
    const nameField = el.querySelector('ui-settings [name="name"]') as HTMLElement & { value: string }
    expect(nameField.value).toBe('Concierge')
    // the entry section is the unambiguous one — a real row, rendered by the shipped per-kind subscription
    const skills = el.querySelector('[data-part="entry-section"][data-kind="skill"]') as HTMLElement
    expect(skills.textContent).toContain('Book a table')
  })
})

describe('the dual-context scaffold — one draft, two transcripts, zero store swaps (ADR-0178 cl.5 / GH #145)', () => {
  it('mounts the authoring conversation lazily: never before the flow is armed', async () => {
    const { el } = mountAdmin({ store: personaStore() })
    await whenFlushed()
    expect(el.querySelector('[data-part="authoring-conversation"]')).toBeNull()
    el.authoringStore = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    await whenFlushed()
    expect(el.querySelector('[data-part="authoring-conversation"]')).not.toBeNull()
  })

  it('a mode flip never reassigns `store` and both transcripts survive the round trip', async () => {
    const draft = personaStore()
    const builder = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const { el } = mountAdmin({ store: draft, authoringStore: builder, events: [{ kind: 'note', note: 'ok' }] })
    await whenFlushed()
    const storeBefore = el.store

    await submit(el, 'interview turn', 'authoring')
    flipMode(el, 'test')
    await submit(el, 'test turn', 'test')
    flipMode(el, 'authoring')
    await whenFlushed()

    // GH #145's probe, INVERTED: the reset must NOT have fired.
    expect(el.store).toBe(storeBefore)
    expect(el.store).toBe(draft)
    const authoring = el.querySelector('[data-part="authoring-conversation"]') as HTMLElement
    const test = el.querySelector('[data-part="chat-stack"] > ui-conversation:not([data-part="authoring-conversation"])') as HTMLElement
    expect(authoring.textContent).toContain('interview turn')
    expect(test.textContent).toContain('test turn')
    // and visibility followed the mode back
    expect(authoring.hasAttribute('hidden')).toBe(false)
    expect(test.hasAttribute('hidden')).toBe(true)
  })

  it('a REAL persona switch still resets BOTH transcripts (GH #145, extended)', async () => {
    const draft = personaStore()
    const builder = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const { el } = mountAdmin({ store: draft, authoringStore: builder, events: [{ kind: 'note', note: 'ok' }] })
    await whenFlushed()
    await submit(el, 'interview turn', 'authoring')
    flipMode(el, 'test')
    await submit(el, 'test turn', 'test')

    el.store = personaStore() // a different persona
    await whenFlushed()
    const authoring = el.querySelector('[data-part="authoring-conversation"]') as HTMLElement
    const test = el.querySelector('[data-part="chat-stack"] > ui-conversation:not([data-part="authoring-conversation"])') as HTMLElement
    expect(authoring.textContent).not.toContain('interview turn')
    expect(test.textContent).not.toContain('test turn')
  })

  it('clearing `authoringStore` exits the flow: the test conversation is visible again and the next entry opens on the interview', async () => {
    const draft = personaStore()
    const { el } = mountAdmin({ store: draft, authoringStore: personaStore({ [SURFACE_AUTHORING_KEY]: true }) })
    await whenFlushed()
    flipMode(el, 'test')
    el.authoringStore = undefined
    await whenFlushed()
    const test = el.querySelector('[data-part="chat-stack"] > ui-conversation:not([data-part="authoring-conversation"])') as HTMLElement
    expect(test.hasAttribute('hidden')).toBe(false)
    el.authoringStore = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    await whenFlushed()
    expect((el.querySelector('[data-part="authoring-conversation"]') as HTMLElement).hasAttribute('hidden')).toBe(false)
  })
})

// GH #644 — the S3-b review finding: with `agentTurn` live but `agentSurfaceTurn` UNARMED (the LLD §8
// degrade config — no structured modality reachable, so `#handleSubmit` always falls to the PROSE arm),
// the two dual-context transcripts must feed the model two SEPARATE histories, exactly like the surface
// arm's per-context `Session` map (`admin-live-runner.ts`'s `sessions` keyed by `req.session`) already
// does. Before the fix, both contexts appended onto one shared `#history` array, so an interleaved
// interview/test-chat exchange leaked into the OTHER context's next request.
describe('the PROSE arm keeps per-context history — agentSurfaceTurn unarmed, agentTurn live (GH #644)', () => {
  /** A live prose-arm mount with `agentSurfaceTurn` left `undefined` (the S3 degrade config) and
   *  `agentTurn` wired to record every request it is handed. */
  function mountProse(options: { store: SettingsStore; authoringStore?: SettingsStore }): {
    el: UIAgentAdminElement
    calls: import('./agent-admin-schema.ts').AdminTurnRequest[]
  } {
    const calls: import('./agent-admin-schema.ts').AdminTurnRequest[] = []
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = options.store
    el.agentTurn = async (req) => {
      calls.push(req)
      return `ack:${req.text}`
    }
    document.body.append(el)
    mounted.push(el)
    if (options.authoringStore) el.authoringStore = options.authoringStore
    return { el, calls }
  }

  it('interleaved interview/test-chat turns each see ONLY their own history, never the other context\'s', async () => {
    const draft = personaStore()
    const builder = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const { el, calls } = mountProse({ store: draft, authoringStore: builder })
    await whenFlushed()

    await submit(el, 'interview one', 'authoring')
    flipMode(el, 'test')
    await submit(el, 'test one', 'test')
    flipMode(el, 'authoring')
    await submit(el, 'interview two', 'authoring')
    flipMode(el, 'test')
    await submit(el, 'test two', 'test')

    expect(calls).toHaveLength(4)
    const [interviewOne, testOne, interviewTwo, testTwo] = calls
    // Turn 1 in each context carries no prior history — the two contexts never seeded each other.
    expect(interviewOne!.history).toEqual([])
    expect(testOne!.history).toEqual([])
    // The authoring context's SECOND turn replays only ITS OWN first exchange — never the test chat's.
    expect(interviewTwo!.history).toEqual([
      { role: 'user', content: 'interview one' },
      { role: 'assistant', content: 'ack:interview one' },
    ])
    // Symmetrically, the test context's second turn carries only its own first exchange.
    expect(testTwo!.history).toEqual([
      { role: 'user', content: 'test one' },
      { role: 'assistant', content: 'ack:test one' },
    ])
  })

  it('a real `authoringStore` identity change clears the authoring history but leaves the test history untouched', async () => {
    const draft = personaStore()
    const builderA = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const { el, calls } = mountProse({ store: draft, authoringStore: builderA })
    await whenFlushed()

    flipMode(el, 'test')
    await submit(el, 'test turn', 'test')
    flipMode(el, 'authoring')
    await submit(el, 'interview with A', 'authoring')

    // A DIFFERENT interviewer store — a real identity change (`#rewireAuthoringContext`'s `changed` arm).
    el.authoringStore = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    await whenFlushed()
    await submit(el, 'interview with B', 'authoring')
    flipMode(el, 'test')
    await submit(el, 'test turn two', 'test')

    const interviewWithB = calls[2]!
    const testTurnTwo = calls[3]!
    // The new interviewer's first turn carries no trace of interviewer A's exchange.
    expect(interviewWithB.history).toEqual([])
    // The test chat's own history survived the authoring-store swap untouched (it belongs to the draft).
    expect(testTurnTwo.history).toEqual([
      { role: 'user', content: 'test turn' },
      { role: 'assistant', content: 'ack:test turn' },
    ])
  })

  it('a real persona switch (GH #145) clears BOTH histories, not just the test one', async () => {
    const draft = personaStore()
    const builder = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const { el, calls } = mountProse({ store: draft, authoringStore: builder })
    await whenFlushed()

    await submit(el, 'interview turn', 'authoring')
    flipMode(el, 'test')
    await submit(el, 'test turn', 'test')

    el.store = personaStore() // a genuinely different persona (the draft itself was replaced)
    await whenFlushed()
    flipMode(el, 'authoring')
    await submit(el, 'fresh interview', 'authoring')

    const freshInterview = calls[2]!
    expect(freshInterview.history, 'the new persona\'s first authoring turn must carry no prior interview').toEqual([])
  })
})

// ── LLD-C9 (S4-a, GH #646) — the try-it bar: the REAL affordance, not the `setModeSeam` stand-in above ──
// GH #646 REOPENED (pixel-truth, 2026-08-09, Kim's reopen comment): the bar is the fleet `ui-tabs`
// control now — Authoring/Try it are `ui-tab`s, not `ui-button`s. These probes pin the `ui-tabs`
// selection contract (`selected`/`select` — ADR-0019, tabs.md) the same way `agent-admin.test.ts`'s
// pane-tabs probe already pins the section strip's, not button anatomy (`aria-pressed`).
describe('the try-it bar — the visible flip, driving the SAME seam the round trip above already proved (LLD-C9, GH #646)', () => {
  function bar(el: UIAgentAdminElement): { bar: HTMLElement & { selected: string }; authoringTab: HTMLElement; testTab: HTMLElement } {
    const barEl = el.querySelector('[data-part="try-it"]') as HTMLElement & { selected: string }
    return {
      bar: barEl,
      authoringTab: barEl.querySelector('[data-part="try-it-authoring"]') as HTMLElement,
      testTab: barEl.querySelector('[data-part="try-it-test"]') as HTMLElement,
    }
  }

  it('renders hidden while the flow is unarmed, and visible the moment it arms — never reassigning `store`', async () => {
    const { el } = mountAdmin({ store: personaStore() })
    await whenFlushed()
    expect(bar(el).bar.hasAttribute('hidden')).toBe(true)
    el.authoringStore = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    await whenFlushed()
    expect(bar(el).bar.hasAttribute('hidden')).toBe(false)
  })

  it('`selected` opens on Authoring and clicking Try it / Authoring flips both the strip selection and which conversation is hidden', async () => {
    const { el } = mountAdmin({ store: personaStore(), authoringStore: personaStore({ [SURFACE_AUTHORING_KEY]: true }) })
    await whenFlushed()
    const { bar: strip, authoringTab, testTab } = bar(el)
    const authoring = el.querySelector('[data-part="authoring-conversation"]') as HTMLElement
    const test = el.querySelector('[data-part="chat-stack"] > ui-conversation:not([data-part="authoring-conversation"])') as HTMLElement

    expect(strip.selected).toBe('authoring')
    expect(authoring.hasAttribute('hidden')).toBe(false)
    expect(test.hasAttribute('hidden')).toBe(true)

    testTab.click()
    expect(strip.selected).toBe('test')
    expect(authoring.hasAttribute('hidden')).toBe(true)
    expect(test.hasAttribute('hidden')).toBe(false)

    authoringTab.click()
    expect(strip.selected).toBe('authoring')
    expect(authoring.hasAttribute('hidden')).toBe(false)
    expect(test.hasAttribute('hidden')).toBe(true)
  })

  it('a real click-driven round trip: both transcripts survive, `store` stays reference-identical, `admin.store` is never touched (GH #145 inverted)', async () => {
    const draft = personaStore()
    const builder = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const { el } = mountAdmin({ store: draft, authoringStore: builder, events: [{ kind: 'note', note: 'ok' }] })
    await whenFlushed()
    const storeBefore = el.store
    const { authoringTab, testTab } = bar(el)

    await submit(el, 'interview turn', 'authoring')
    testTab.click()
    await submit(el, 'test turn', 'test')
    authoringTab.click()
    await whenFlushed()

    expect(el.store).toBe(storeBefore)
    expect(el.store).toBe(draft)
    const authoring = el.querySelector('[data-part="authoring-conversation"]') as HTMLElement
    const test = el.querySelector('[data-part="chat-stack"] > ui-conversation:not([data-part="authoring-conversation"])') as HTMLElement
    expect(authoring.textContent).toContain('interview turn')
    expect(test.textContent).toContain('test turn')
  })

  it('regression probe — flipping to the test chat via the bar and sending a gate-ON turn still logs patchIgnored, zero writes (the fence, unchanged by S4)', async () => {
    const draft = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const builder = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const { el } = mountAdmin({ store: draft, authoringStore: builder, events: [{ kind: 'patch', patch: PATCH }] })
    await whenFlushed()
    bar(el).testTab.click()
    await submit(el, 'hello draft', 'test')

    expect(draft.get('name')).toBe('Untitled agent')
    expect(readEntries(draft, ENTRY_KINDS.skill)).toEqual([])
    expect((turnLogOf(el).response as { patchIgnored?: boolean }).patchIgnored).toBe(true)
  })

  it('DOM order: bar, then the authoring conversation, then the test conversation (§5\'s frozen anatomy)', async () => {
    const { el } = mountAdmin({ store: personaStore(), authoringStore: personaStore({ [SURFACE_AUTHORING_KEY]: true }) })
    await whenFlushed()
    const stack = el.querySelector('[data-part="chat-stack"]') as HTMLElement
    const parts = [...stack.children].map((c) => c.getAttribute('data-part'))
    expect(parts).toEqual(['try-it', 'authoring-conversation', null])
  })
})

describe('the authoring request, and the zero-regression invariant it must not disturb (LLD-C6)', () => {
  it('an authoring turn carries session:"authoring", the fresh gate read, and the draft-state block', async () => {
    const draft = personaStore({ name: 'Half-built' })
    const builder = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const { el, requests } = mountAdmin({ store: draft, authoringStore: builder })
    await whenFlushed()
    await submit(el, 'go')

    const req = requests[0]!
    expect(req.session).toBe('authoring')
    expect(req.authoring).toBe(true)
    // the interviewer sees the draft as it stands RIGHT NOW — including a concurrent hand edit
    expect(req.personaSystem).toContain('The draft agent')
    expect(req.personaSystem).toContain('Half-built')
  })

  it('the gate read is FRESH per turn — flipping it off between turns flips the field', async () => {
    const builder = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const { el, requests } = mountAdmin({ store: personaStore(), authoringStore: builder })
    await whenFlushed()
    await submit(el, 'one')
    builder.set(SURFACE_AUTHORING_KEY, false)
    await submit(el, 'two')
    expect(requests.map((r) => r.authoring)).toEqual([true, false])
  })

  it('ZERO REGRESSION — with the flow inactive the request carries NEITHER field, byte-matching a pre-S3 turn', async () => {
    const { el, requests } = mountAdmin({ store: personaStore() })
    await whenFlushed()
    await submit(el, 'hello', 'test')
    const req = requests[0]!
    expect('session' in req).toBe(false)
    expect('authoring' in req).toBe(false)
    expect(req.personaSystem).not.toContain('The draft agent')
  })
})

describe('the Authoring row in Surface Options (ADR-0178 cl.3)', () => {
  it('renders after Planner, bare and OFF by default, and writes the persona-scoped gate key', async () => {
    const store = personaStore()
    const { el } = mountAdmin({ store })
    await whenFlushed()
    const row = el.querySelector('[data-part="surface-row"][data-surface="authoring"]') as HTMLElement
    expect(row).not.toBeNull()
    // a BARE row — the gate has no sub-options, so it mints no nested detail zone
    expect(el.querySelector('[data-part="surface-group"][data-surface="authoring"]')).toBeNull()
    const toggle = row.querySelector('[data-part="surface-toggle"]') as HTMLElement & { checked: boolean }
    expect(toggle.checked, 'the inverse default — OFF until a persona opts in').toBe(false)

    toggle.checked = true
    toggle.dispatchEvent(new Event('change', { bubbles: true }))
    expect(store.get(SURFACE_AUTHORING_KEY)).toBe(true)
  })

  it('reflects an EXTERNAL write to the gate key (the live-apply law every sibling row follows)', async () => {
    const store = personaStore()
    const { el } = mountAdmin({ store })
    await whenFlushed()
    store.set(SURFACE_AUTHORING_KEY, true)
    await whenFlushed()
    const toggle = el.querySelector('[data-part="surface-row"][data-surface="authoring"] [data-part="surface-toggle"]') as HTMLElement & {
      checked: boolean
    }
    expect(toggle.checked).toBe(true)
  })
})
