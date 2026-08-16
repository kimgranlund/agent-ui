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
import {
  DEFAULT_MODEL_ID,
  SUPPORTED_MODELS,
  initialValuesFor,
  defaultAgentConfigSchema,
  AUTHORING_DEFAULT_MODEL_ID,
  sanitizeAuthoringModel,
  modelRoster,
} from './agent-admin-schema.ts'

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

// GH #949 — the SECOND jsdom-reality stub this file needs (the agent-admin.test.ts precedent, verbatim):
// Instructions now routes its per-entry CRUD through a `ui-drawer`, and jsdom carries no native `<dialog>`
// modal surface at all (`showModal`/`close` undefined, no `open` IDL accessor). drawer.test.ts's own
// sanctioned stub, re-applied in shape — enough for `drawer.open = true` (this file's own Edit-drawer
// round trip below) to actually reach the DOM here, never a claim about real top-layer/focus-trap behavior
// (proven in the browser legs instead).
const dialogOpen = new WeakMap<HTMLDialogElement, boolean>()
beforeAll(() => {
  const proto = HTMLDialogElement.prototype as unknown as { showModal?: () => void; close?: () => void }
  if (typeof proto.showModal === 'function') return // a real engine — leave the platform alone
  Object.defineProperty(HTMLDialogElement.prototype, 'open', {
    configurable: true,
    get(this: HTMLDialogElement): boolean {
      return dialogOpen.get(this) ?? false
    },
    set(this: HTMLDialogElement, v: boolean): void {
      dialogOpen.set(this, Boolean(v))
    },
  })
  proto.showModal = function (this: HTMLDialogElement): void {
    dialogOpen.set(this, true)
  }
  proto.close = function (this: HTMLDialogElement): void {
    if (!(dialogOpen.get(this) ?? false)) return // already closed — a no-op, no event (platform parity)
    dialogOpen.set(this, false)
    this.dispatchEvent(new Event('close'))
  }
})

const mounted: Element[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
  localStorage.clear()
})

/** Go to a PLACE from a probe (ADR-0179 — this replaces the retired `flipMode`/`setModeSeam` pair; GH
 *  #686's Amendment retires the pane-nav-driven `setPaneSeam` in turn, LLD §16.2). `setPaneVisibilitySeam`
 *  is `protected` — a compile-time construct only — so a cast reaches it without widening the element's
 *  public API. Deliberately NOT a probe SUBCLASS (the split.ts precedent): agent-admin.css is
 *  `@scope (ui-agent-admin)`, so a probe tag would render unstyled and quietly void every geometry
 *  assertion. `'author'` stays this helper's own PARAMETER name (the majority of this file's call sites
 *  predate the Co-pilot rename and the routing claims they prove are unaffected by it) — it maps onto the
 *  real `'copilot'` pane internally, solo-shown-and-primary (the old single-active-place shape, restated
 *  in the new set×primary vocabulary). */
const goToPane = (el: UIAgentAdminElement, pane: 'chat' | 'author' | 'settings'): void => {
  const real = pane === 'author' ? 'copilot' : pane
  ;(el as unknown as { setPaneVisibilitySeam(s: readonly ('chat' | 'settings' | 'copilot')[], p: 'chat' | 'settings' | 'copilot'): void }).setPaneVisibilitySeam(
    [real],
    real,
  )
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
      ? (el.querySelector('[data-part="copilot-pane"]') as HTMLElement)
      : (el.querySelector('[data-part="chat-pane"]') as HTMLElement)
  const composer = host.querySelector('ui-conversation-composer') as HTMLElement & { value: string }
  composer.value = text
  const editor = composer.querySelector('[data-part="editor"]') as HTMLElement
  editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  await whenFlushed()
  await new Promise((r) => setTimeout(r, 0))
  await whenFlushed()
}

/** GH #684 — the Author card's log while unarmed carries no dedicated empty-state node any more (Kim's
 *  live pixel-truth ruling removed the headline + copy GH #666 REOPENED had seated there): "unarmed" now
 *  reads directly off the log's own child count — zero children until the first turn lands. */
const authorLog = (el: UIAgentAdminElement): HTMLElement =>
  el.querySelector('[data-part="copilot-pane"] > [data-part="log"]') as HTMLElement
const authorLogEmpty = (el: UIAgentAdminElement): boolean => authorLog(el).children.length === 0

/** The Author card's ONE composer — the interview's own, the only one in the column at any moment. */
const authorComposer = (el: UIAgentAdminElement): HTMLElement & { value: string; busy: boolean } =>
  el.querySelector('[data-part="copilot-pane"] > ui-conversation-composer') as HTMLElement & { value: string; busy: boolean }

/** GH #880 REOPENED — which Models rows a pane's picker has MARKED selected, in menu order. `data-selected`
 *  is the marker the composer's own picker rebuild sets (conversation-composer.ts), so this reads the
 *  RENDERED menu, not a prop — the half of Kim's filing a `model` prop read alone would have missed. */
const selectedModelRows = (el: UIAgentAdminElement, pane: 'chat' | 'copilot' = 'copilot'): (string | undefined)[] =>
  [...el.querySelectorAll(`[data-part="${pane}-pane"] [data-part="models-menu"] [role="menuitem"][data-selected]`)].map(
    (row) => (row as HTMLElement).dataset.value,
  )

/** Submit through the UNARMED card's composer — which is the SAME element `submit` above drives once the
 *  flow is armed (that is the point of GH #666's reopen: one composer, one card). The extra flush round is
 *  not padding: arming rides a signal effect, so the entry awaits it before the opening turn can land.
 *  (File-scope since GH #670, which drives the same entry from its own describe — one arming driver.) */
async function submitFirst(el: UIAgentAdminElement, text: string): Promise<void> {
  // A registration that just opened the card reaches the composer through `disabled` → the conversation's
  // own forwarding effect, which is microtask-batched: a probe that typed in the same tick would be
  // testing the busy guard, not the entry.
  await whenFlushed()
  const composer = authorComposer(el)
  const editor = composer.querySelector('[data-part="editor"]') as HTMLElement
  composer.value = text
  editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  for (let round = 0; round < 3; round += 1) {
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0))
  }
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
    goToPane(el, 'chat')
    await submit(el, 'hello draft', 'test')

    expect(draft.get('name')).toBe('Untitled agent')
    expect((turnLogOf(el).response as { patchIgnored?: boolean }).patchIgnored).toBe(true)
  })

  it('THE SUBSET-VISIBILITY POLARITY (GH #662, generalized by GH #686\'s Amendment) — the Chat composer cannot reach the draft even while Co-pilot is shown/primary', async () => {
    // This is the probe the triple dock originally forced, restated for a shown-SET rather than a fixed
    // triple: with subsets the norm (LLD §16.2), BOTH composers are routinely on screen and typable at
    // once — so a user can type into CHAT's composer while the visibility model still names Co-pilot
    // primary, and under a PANE-keyed selector that turn would have resolved the AUTHORING quadruple:
    // landing in the interview transcript and, gate ON, patching the draft. Origin-keying is what makes
    // cl.4's "Chat stays pure test by construction" true regardless of what the visibility model shows.
    const draft = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const builder = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const { el } = mountAdmin({ store: draft, authoringStore: builder, events: [{ kind: 'patch', patch: PATCH }] })
    await whenFlushed()

    // Co-pilot is primary — the arming already put it there — and stays there for the whole turn.
    expect((el.querySelector('[data-part="pane-holder"]') as HTMLElement).getAttribute('data-primary')).toBe('copilot')
    await submit(el, 'rename yourself', 'test') // …but the TEST composer is what the user typed into

    expect(draft.get('name'), 'the draft is untouched — the Chat composer is fenced out by ORIGIN').toBe('Untitled agent')
    expect(readEntries(draft, ENTRY_KINDS.skill)).toEqual([])
    expect((turnLogOf(el).response as { patchIgnored?: boolean }).patchIgnored).toBe(true)

    // …and the turn landed where it came from: the test transcript, never the interview's.
    const authoring = el.querySelector('[data-part="copilot-pane"]') as HTMLElement
    const test = el.querySelector('[data-part="chat-pane"]') as HTMLElement
    expect(test.textContent, 'the turn is in the test transcript').toContain('rename yourself')
    expect(authoring.textContent, 'and nowhere near the interview').not.toContain('rename yourself')
  })

  it('THE TRIPLE-DOCK POLARITY, the other way (GH #662) — the Author composer still drives the Builder while the nav stands on Chat', async () => {
    // The symmetric half: origin-keying must not merely refuse, it must ROUTE. In the triple the interview
    // is on screen and typable while the nav names Chat, and a turn from it is an authoring turn — gate ON,
    // the patch lands on the draft, exactly as it does when the nav agrees.
    const draft = personaStore()
    const builder = personaStore({ [SURFACE_AUTHORING_KEY]: true, name: 'Builder' })
    const { el } = mountAdmin({ store: draft, authoringStore: builder, events: [{ kind: 'patch', patch: PATCH }] })
    await whenFlushed()
    goToPane(el, 'chat')
    await submit(el, 'a hotel concierge please', 'authoring')

    expect(draft.get('name'), 'the interview reached the draft from its own composer').toBe('Concierge')
    expect(builder.get('name'), 'and never the interviewer’s own store').toBe('Builder')
    const authoring = el.querySelector('[data-part="copilot-pane"]') as HTMLElement
    expect(authoring.textContent).toContain('a hotel concierge please')
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
    const authoring = el.querySelector('[data-part="copilot-pane"]') as HTMLElement
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

  // ── ADR-0178's ratified amendment (GH #696 / GH #821 item 6) — the UPDATE verb, end to end ────────────
  // The whole reason the verb exists: an authored identity at `order: 0` with ZERO "helpful assistant"
  // boilerplate. Per-part assertions on the gate module cannot prove that — only the whole composed prompt
  // and the real rendered card can, so both are asserted here on ONE update-only turn.
  it('an UPDATE-only patch turn rewrites the Foundation card IN PLACE, and the composed prompt loses the boilerplate', async () => {
    const draft = personaStore()
    const builder = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const IDENTITY = 'You are Casey, a restaurant concierge for the guests of one hotel.'
    const { el, requests } = mountAdmin({
      store: draft,
      authoringStore: builder,
      events: [{ kind: 'patch', patch: { entries: { [entriesStoreKey(ENTRY_KINDS.promptSection)]: [{ id: 'foundation', content: IDENTITY }] } } }],
    })
    await whenFlushed()
    await submit(el, 'a restaurant concierge called Casey')
    await whenFlushed()

    // 1 — the store: replaced in place, still three sections, still the leading one
    const sections = readEntries(draft, ENTRY_KINDS.promptSection)
    expect(sections.map((e) => e.id)).toEqual(['foundation', 'personality', 'critical-items'])
    expect(sections[0]).toMatchObject({ label: 'Foundation', order: 0, builtin: true, content: IDENTITY })

    // 2 — the turn log carries `updated` (this is what an update-only patch reports: `applied`/`added` empty)
    const response = turnLogOf(el).response as { patch: { applied: string[]; added: Record<string, number>; updated: Record<string, string[]> } }
    expect(response.patch.updated).toEqual({ [entriesStoreKey(ENTRY_KINDS.promptSection)]: ['foundation'] })
    expect(response.patch.applied).toEqual([])
    expect(response.patch.added).toEqual({})

    // 3 — the receipt line still narrates: an update-only patch is not a silent one (SPEC-R7)
    const authoring = el.querySelector('[data-part="copilot-pane"]') as HTMLElement
    expect(authoring.textContent).toContain('Updated Capabilities › Instructions')

    // 4 — the real rendered card: the Instructions section's rows are the three builtins in order, and the
    // FIRST row's own content editor carries the authored text with the placeholder gone. Asserted over the
    // whole section (every row's label + editor value), not one lucky node — a per-part read here would pass
    // just as happily on a fourth section appended below three untouched placeholders, which is the exact
    // shape this amendment exists to make impossible.
    // GH #949 — Instructions is drawered now: its rows carry no content editor of their own (the row
    // collapses to `[switch | label | spacer | Edit]`), so reading a row's content means opening its own
    // Edit drawer first (`entry-form.ts`'s form is built fresh from the STORE on every open — never stale).
    const instructions = el.querySelector('[data-part="entry-section"][data-kind="prompt-section"]') as HTMLElement
    const rows = [...instructions.querySelectorAll<HTMLElement>('[data-part="entry"]')].map((row) => {
      ;(row.querySelector('[data-part="entry-edit"]') as HTMLElement).click()
      return {
        label: row.querySelector('[data-part="entry-header"]')?.textContent?.trim() ?? row.textContent?.trim() ?? '',
        content: (instructions.querySelector('[data-part="entry-content"]') as (HTMLElement & { value?: string }) | null)?.value ?? '',
      }
    })
    expect(rows, 'in place: three rows, never a fourth').toHaveLength(3)
    expect(rows[0]?.label).toContain('Foundation')
    expect(rows[0]?.content, 'the leading card IS the authored identity now').toBe(IDENTITY)
    expect(rows.map((r) => r.content), 'no row anywhere still holds the text nobody authored').not.toContain('You are a helpful assistant.')

    // 5 — and the DRAFT's own composed prompt, read off the next test-chat turn's real request: the authored
    // identity leads it, with zero boilerplate ahead of the persona (the amendment's whole Consequence)
    goToPane(el, 'chat')
    await submit(el, 'hello Casey', 'test')
    const composed = requests.at(-1)!.personaSystem
    expect(composed).toContain(IDENTITY)
    expect(composed, 'no content nobody authored ships ahead of the persona').not.toContain('You are a helpful assistant.')
    expect(composed.indexOf(IDENTITY), 'the identity leads — order 0').toBeLessThan(composed.indexOf('Be concise and direct.'))
  })

  it('an update REFUSED by the fence or the gate writes nothing and reports nothing — both polarities hold for the new verb', async () => {
    const UPDATE = { entries: { [entriesStoreKey(ENTRY_KINDS.promptSection)]: [{ id: 'foundation', content: 'Never lands.' }] } }
    // gate OFF inside the authoring context
    const draftA = personaStore()
    const { el: elA } = mountAdmin({ store: draftA, authoringStore: personaStore(), events: [{ kind: 'patch', patch: UPDATE }] })
    await whenFlushed()
    await submit(elA, 'go')
    expect(readEntries(draftA, ENTRY_KINDS.promptSection)[0]?.content).toBe('You are a helpful assistant.')
    expect((turnLogOf(elA).response as { patchIgnored?: boolean; patch?: unknown }).patchIgnored).toBe(true)
    expect((turnLogOf(elA).response as { patch?: unknown }).patch).toBeUndefined()

    // gate ON but outside the authoring context
    const draftB = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const { el: elB } = mountAdmin({ store: draftB, events: [{ kind: 'patch', patch: UPDATE }] })
    await whenFlushed()
    await submit(elB, 'rewrite yourself', 'test')
    expect(readEntries(draftB, ENTRY_KINDS.promptSection)[0]?.content).toBe('You are a helpful assistant.')
    expect((turnLogOf(elB).response as { patchIgnored?: boolean }).patchIgnored).toBe(true)
  })
})

describe('the dual-context scaffold — one draft, two transcripts, zero store swaps (ADR-0178 cl.5 / GH #145)', () => {
  // GH #666 REOPENED (Kim's 2026-08-10 pixel ruling) — this probe used to pin the OPPOSITE: the interview
  // mounted lazily, never before the flow armed (ADR-0178 cl.5's cost argument). The ruling overrides it
  // with a shape requirement — the Author place must BE this card unarmed — and arming is now a FILL of the
  // same element, which is the property worth pinning: one node identity across the transition, so nothing
  // can quietly go back to swapping one box for another.
  it('the interview card exists from first paint; arming FILLS it — the same element, never a second box', async () => {
    const { el } = mountAdmin({ store: personaStore() })
    await whenFlushed()
    const card = el.querySelector('[data-part="copilot-pane"]') as HTMLElement
    expect(card, 'the Author place is a conversation card before the flow arms').not.toBeNull()
    el.authoringStore = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    await whenFlushed()
    expect(el.querySelector('[data-part="copilot-pane"]'), 'armed, it is the SAME element').toBe(card)
  })

  it('a mode flip never reassigns `store` and both transcripts survive the round trip', async () => {
    const draft = personaStore()
    const builder = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const { el } = mountAdmin({ store: draft, authoringStore: builder, events: [{ kind: 'note', note: 'ok' }] })
    await whenFlushed()
    const storeBefore = el.store

    await submit(el, 'interview turn', 'authoring')
    goToPane(el, 'chat')
    await submit(el, 'test turn', 'test')
    goToPane(el, 'author')
    await whenFlushed()

    // GH #145's probe, INVERTED: the reset must NOT have fired.
    expect(el.store).toBe(storeBefore)
    expect(el.store).toBe(draft)
    const authoring = el.querySelector('[data-part="copilot-pane"]') as HTMLElement
    const test = el.querySelector('[data-part="chat-pane"]') as HTMLElement
    expect(authoring.textContent).toContain('interview turn')
    expect(test.textContent).toContain('test turn')
    // …and the visibility state followed the round trip back. GH #686's Amendment — the shown-set/primary
    // is what the seam writes (the holder's `data-primary`); which regions then paint is the sheet's band
    // reading, proven in the browser shard. The interview's own `hidden` is armed-state only now, and the
    // flow is armed throughout.
    expect((el.querySelector('[data-part="pane-holder"]') as HTMLElement).getAttribute('data-primary')).toBe('copilot')
    expect(authoring.hasAttribute('hidden'), 'the flow is armed, so the interview is not hidden').toBe(false)
    expect(test.hasAttribute('hidden'), 'and no region is attribute-hidden any more').toBe(false)
  })

  it('a REAL persona switch still resets BOTH transcripts (GH #145, extended)', async () => {
    const draft = personaStore()
    const builder = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const { el } = mountAdmin({ store: draft, authoringStore: builder, events: [{ kind: 'note', note: 'ok' }] })
    await whenFlushed()
    await submit(el, 'interview turn', 'authoring')
    goToPane(el, 'chat')
    await submit(el, 'test turn', 'test')

    el.store = personaStore() // a different persona
    await whenFlushed()
    const authoring = el.querySelector('[data-part="copilot-pane"]') as HTMLElement
    const test = el.querySelector('[data-part="chat-pane"]') as HTMLElement
    expect(authoring.textContent).not.toContain('interview turn')
    expect(test.textContent).not.toContain('test turn')
  })

  it('clearing `authoringStore` exits the flow: the test conversation is visible again and the next entry opens on the interview', async () => {
    const draft = personaStore()
    const { el } = mountAdmin({ store: draft, authoringStore: personaStore({ [SURFACE_AUTHORING_KEY]: true }) })
    await whenFlushed()
    goToPane(el, 'chat')
    el.authoringStore = undefined
    await whenFlushed()
    const test = el.querySelector('[data-part="chat-pane"]') as HTMLElement
    expect(test.hasAttribute('hidden')).toBe(false)
    el.authoringStore = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    await whenFlushed()
    expect((el.querySelector('[data-part="copilot-pane"]') as HTMLElement).hasAttribute('hidden')).toBe(false)
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
    goToPane(el, 'chat')
    await submit(el, 'test one', 'test')
    goToPane(el, 'author')
    await submit(el, 'interview two', 'authoring')
    goToPane(el, 'chat')
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

    goToPane(el, 'chat')
    await submit(el, 'test turn', 'test')
    goToPane(el, 'author')
    await submit(el, 'interview with A', 'authoring')

    // A DIFFERENT interviewer store — a real identity change (`#rewireAuthoringContext`'s `changed` arm).
    el.authoringStore = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    await whenFlushed()
    await submit(el, 'interview with B', 'authoring')
    goToPane(el, 'chat')
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
    goToPane(el, 'chat')
    await submit(el, 'test turn', 'test')

    el.store = personaStore() // a genuinely different persona (the draft itself was replaced)
    await whenFlushed()
    goToPane(el, 'author')
    await submit(el, 'fresh interview', 'authoring')

    const freshInterview = calls[2]!
    expect(freshInterview.history, 'the new persona\'s first authoring turn must carry no prior interview').toEqual([])
  })
})

// ── ADR-0179 cl.1/cl.4 — the PANE NAV: the REAL affordance, not the `setPaneSeam` stand-in above ────────
// (This describe replaces the retired try-it bar's, GH #646/LLD-C9: the flip it voiced is a PLACE change
// now, and its `ui-tabs` composition method survives one level up. These probes pin the same `ui-tabs`
// selection contract — `selected`/`select`, ADR-0019/tabs.md — the try-it probes did, plus the two things
// only the pane world can state: per-pane composers, and the fence's survival across a place change.)
describe('the visibility model — the shown-set/primary machine (GH #686\'s Amendment, LLD §16.2), retiring the pane nav', () => {
  it('the three regions exist whether or not the flow is armed — Co-pilot never vanishes (OQ4, carried over)', async () => {
    const { el } = mountAdmin({ store: personaStore() })
    await whenFlushed()
    expect([...el.querySelectorAll('[data-part="pane-holder"] > [data-part$="-pane"]')].map((c) => c.getAttribute('data-part'))).toEqual([
      'chat-pane', 'settings-pane', 'copilot-pane',
    ])
    // GH #666 — armed-ness is the LOG's content now, not a visibility flip between two boxes. GH #684 — and
    // that log carries no dedicated empty-state node any more (Kim's live pixel-truth ruling removed the
    // headline + copy): unarmed it is simply EMPTY, and stays that way until the first turn lands.
    expect(authorLogEmpty(el), 'unarmed ⇒ the log carries no content of its own').toBe(true)
    el.authoringStore = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    await whenFlushed()
    expect([...el.querySelectorAll('[data-part="pane-holder"] > [data-part$="-pane"]')]).toHaveLength(3)
  })

  it('arming the flow lands Co-pilot visible AND primary (LLD §16.2\'s "ensure copilot ∈ shown + primary = \'copilot\'" line)', async () => {
    const { el } = mountAdmin({ store: personaStore(), authoringStore: personaStore({ [SURFACE_AUTHORING_KEY]: true }) })
    await whenFlushed()
    const authoring = el.querySelector('[data-part="copilot-pane"]') as HTMLElement
    const test = el.querySelector('[data-part="chat-pane"]') as HTMLElement
    const holder = el.querySelector('[data-part="pane-holder"]') as HTMLElement

    // the IA-entry re-point (LLD §16.2): arming lands Co-pilot primary, at the one choke point every arm
    // path crosses.
    expect(holder.getAttribute('data-primary'), 'the arm lands Co-pilot primary').toBe('copilot')
    expect(holder.getAttribute('data-show')?.split(' ')).toContain('copilot')

    // both conversations stay mounted and un-hidden either way — a visibility-set flip never forces
    // navigation away from either, and neither region carries `hidden` (the sheet's own job, CSS-only).
    expect([authoring.hasAttribute('hidden'), test.hasAttribute('hidden')], 'no region is attribute-hidden by a visibility-set change').toEqual([false, false])
  })

  it('a seam-driven round trip: both transcripts survive, `store` stays reference-identical, `admin.store` is never touched (GH #145 inverted)', async () => {
    const draft = personaStore()
    const builder = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const { el } = mountAdmin({ store: draft, authoringStore: builder, events: [{ kind: 'note', note: 'ok' }] })
    await whenFlushed()
    const storeBefore = el.store

    await submit(el, 'interview turn', 'authoring')
    goToPane(el, 'chat')
    await submit(el, 'test turn', 'test')
    goToPane(el, 'author')
    await whenFlushed()

    expect(el.store).toBe(storeBefore)
    expect(el.store).toBe(draft)
    const authoring = el.querySelector('[data-part="copilot-pane"]') as HTMLElement
    const test = el.querySelector('[data-part="chat-pane"]') as HTMLElement
    expect(authoring.textContent).toContain('interview turn')
    expect(test.textContent).toContain('test turn')
  })

  it('cl.4 — per-pane composers: the Chat place`s composer STRUCTURALLY cannot drive the authoring store', async () => {
    const draft = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const builder = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const { el, requests } = mountAdmin({ store: draft, authoringStore: builder, events: [{ kind: 'patch', patch: PATCH }] })
    await whenFlushed()
    await submit(el, 'hello draft', 'test')

    // the driving store is the DRAFT, so the fence refuses the patch — gate-ON notwithstanding. Origin
    // routing (LLD §16.2: "#contextFor stays ORIGIN-keyed") makes this true independent of which region the
    // visibility model currently shows or names primary.
    expect(requests.at(-1)!.session, 'a Chat-composer turn is never an authoring session').toBeUndefined()
    expect(draft.get('name')).toBe('Untitled agent')
    expect(readEntries(draft, ENTRY_KINDS.skill)).toEqual([])
    expect((turnLogOf(el).response as { patchIgnored?: boolean }).patchIgnored).toBe(true)
  })

  it('DOM order: three sibling regions, PANE_ORDER (chat · settings · copilot); Co-pilot holds ONE card, armed or not (LLD §16.1, GH #666)', async () => {
    const { el } = mountAdmin({ store: personaStore(), authoringStore: personaStore({ [SURFACE_AUTHORING_KEY]: true }) })
    await whenFlushed()
    const holder = el.querySelector('[data-part="pane-holder"]') as HTMLElement
    expect([...holder.children].map((c) => c.getAttribute('data-part'))).toEqual(['chat-pane', 'settings-pane', 'copilot-pane'])
    // GH #666 REOPENED — the empty state left this level: the region IS the card (`data-part="copilot-pane"`
    // lives directly on the `ui-conversation`, no wrapper), and the copy lives in the card's log.
    const copilotPane = el.querySelector('[data-part="copilot-pane"]') as HTMLElement
    expect(copilotPane.tagName.toLowerCase()).toBe('ui-conversation')
  })
})

// ── GH #666 — the unarmed Author place is the flow's ENTRY, and it is a CHAT CARD ──────────────────────
// Kim's 2026-08-10 live report ("where am I supposed to describe it?") ruled the entry composer-first, and
// his REOPEN the same day ruled its shape: "the center pane should be a CHAT, just like Test chat". So the
// unarmed column is the interview's own `ui-conversation` — one card, one composer, an EMPTY log until the
// first turn (GH #684 — Kim's later live pixel-truth ruling removed the headline + copy that used to
// occupy that log). These probes pin the plumbing (arming, equivalence, never-swallowed); the card's
// TREATMENT parity with Test chat is a rendered-geometry claim and lives in the browser suite.
describe('GH #666 — the unarmed Author card: a live composer, and the arming it drives', () => {
  /** The page's `createGeneratedAgent`, in miniature: mint the interviewer and assign it. This IS the arm
   *  path — the probes below register it exactly once per element and let BOTH entries run it. */
  const mintPath = (el: UIAgentAdminElement, builder: SettingsStore): (() => void) => () => { el.authoringStore = builder }

  /** Everything about an ARMED admin that arming is supposed to establish — the equivalence probe's subject. */
  const armedShape = (el: UIAgentAdminElement): Record<string, unknown> => {
    const interview = el.querySelector('[data-part="copilot-pane"]') as HTMLElement & { disabled: boolean }
    const holder = el.querySelector('[data-part="pane-holder"]')!
    return {
      armed: el.authoringStore !== undefined,
      show: holder.getAttribute('data-show'),
      primary: holder.getAttribute('data-primary'),
      interviewMounted: interview !== null,
      interviewAvailable: !interview.disabled,
    }
  }

  it('defect 1 — a registration BEFORE the element connects reveals the entry (the live page`s own order)', async () => {
    // agent-admin-app.ts registers on a DETACHED element and appends it 150 lines later. The reveal used
    // to be a push onto an empty state that did not exist yet, so the live column painted copy with no
    // verb at all — exactly Kim's screenshot. Both orders must reveal.
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = personaStore()
    el.onGenerateRequest(() => {})
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    const card = el.querySelector('[data-part="copilot-pane"]') as HTMLElement & { disabled: boolean }
    expect(card.disabled, 'registered pre-connect ⇒ the entry still opens').toBe(false)
  })

  it('the unarmed card`s anatomy is kicker, EMPTY log, then the card`s own bottom composer (the empty-conversation idiom)', async () => {
    // GH #684 (Kim's live pixel-truth ruling) removed the headline + copy that used to occupy this log —
    // the anatomy claim that survives is conversation → log (now empty) → composer, with the composer as
    // the card's LAST child. A headline floating beside a card would have satisfied neither the old ruling
    // nor this one.
    const { el } = mountAdmin({ store: personaStore() })
    await whenFlushed()
    el.onGenerateRequest(() => {})
    const card = el.querySelector('[data-part="copilot-pane"]') as HTMLElement
    expect(authorLogEmpty(el), 'the log carries no content while unarmed').toBe(true)
    expect(
      [...card.children].map((c) => c.getAttribute('data-part') ?? c.tagName.toLowerCase()),
      'kicker, then the empty log, then the composer pinned last — Test chat`s own anatomy',
    ).toEqual(['region-kicker', 'log', 'ui-conversation-composer'])
    expect(card.querySelector('[data-part="region-kicker"]')!.textContent).toBe('Builder interview')
  })

  it('the unarmed Co-pilot card is USABLE while Chat is primary — the shown set`s Co-pilot column is the entry, not dead copy', async () => {
    // The band itself is the sheet's job (`data-show`/`data-primary` + a container query, browser-probed);
    // what this pins is the thing GH #666 called a near-orphan: with the flow unarmed and Chat primary, the
    // Co-pilot region is available (the entry default shows it too, LLD §16.2's OQ-D rec) and the
    // affordance inside it is real.
    const { el } = mountAdmin({ store: personaStore() })
    await whenFlushed()
    el.onGenerateRequest(() => {})
    await whenFlushed()
    const composer = authorComposer(el)
    expect(el.querySelector('[data-part="pane-holder"]')!.getAttribute('data-primary')).toBe('chat')
    expect(composer.busy, 'the entry accepts typing from the unarmed place').toBe(false)
    expect(composer.querySelector('[data-part="editor"]'), 'a real editable surface, not a link to one').not.toBeNull()
  })

  it('the first message ARMS the flow and reaches the Builder as the interview`s opening turn — nothing swallowed', async () => {
    const draft = personaStore()
    const builder = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const { el, requests } = mountAdmin({ store: draft, events: [{ kind: 'patch', patch: PATCH }] })
    await whenFlushed()
    let mints = 0
    el.onGenerateRequest(() => { mints += 1; mintPath(el, builder)() })

    const cardBefore = el.querySelector('[data-part="copilot-pane"]')
    await submitFirst(el, 'a hotel concierge please')

    expect(mints, 'the arm ran once, through the page`s own mint path').toBe(1)
    expect(el.authoringStore).toBe(builder)
    const interview = el.querySelector('[data-part="copilot-pane"]') as HTMLElement
    expect(interview, 'the transition FILLS the card the user typed into — no swap').toBe(cardBefore)
    expect(interview.textContent, 'the description the user typed IS the opening turn').toContain('a hotel concierge please')
    expect(
      interview.querySelectorAll('[data-part="log"] [data-part="bubble"][data-role="user"]'),
      'exactly one user bubble — the optimistic one the arm`s reset cleared is not doubled',
    ).toHaveLength(1)
    expect(requests.at(-1)!.session, 'and it runs as an authoring turn').toBe('authoring')
    // The fence is untouched by construction: the driving store IS the authoring store, so the patch
    // consumes — into the DRAFT, never the interviewer.
    expect(draft.get('name')).toBe('Concierge')
    expect(readEntries(draft, ENTRY_KINDS.skill).map((e) => e.label)).toEqual(['Book a table'])
    expect(builder.get('name')).toBe('Untitled agent')
  })

  it('the two entries CONVERGE: arming by first message leaves the same state as arming by the roster action', async () => {
    // GH #681 — the in-card "New agent → Generate" button is gone; the roster (...) menu's item is the
    // survivor for "arm without typing anything". In production it reaches this element NOT through the
    // callback — it calls `createGeneratedAgent` directly, page-side, and assigns `authoringStore` itself —
    // but this element's own test harness has no roster menu to click, so `mintPath` (the same stand-in
    // this describe block already uses) is registered onto `onGenerateRequest` purely as a vehicle to
    // reproduce that same end state: `authoringStore` set, with no seed carried.
    const byAction = mountAdmin({ store: personaStore() })
    const actionBuilder = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const armFromRoster = mintPath(byAction.el, actionBuilder)
    byAction.el.onGenerateRequest(armFromRoster)
    const byMessage = mountAdmin({ store: personaStore() })
    const messageBuilder = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    byMessage.el.onGenerateRequest(mintPath(byMessage.el, messageBuilder))
    await whenFlushed()

    armFromRoster() // stands in for a click on the roster menu's own item
    await whenFlushed()
    await submitFirst(byMessage.el, 'a hotel concierge please')

    expect(armedShape(byMessage.el)).toEqual(armedShape(byAction.el))
    // The ONE intended difference, stated rather than left implicit: the message entry opens the
    // interview with the user's description; the roster entry hands over an empty transcript.
    const transcript = (r: { el: UIAgentAdminElement }): string =>
      r.el.querySelector('[data-part="copilot-pane"]')!.textContent ?? ''
    expect(transcript(byMessage)).toContain('a hotel concierge please')
    expect(transcript(byAction)).not.toContain('a hotel concierge please')
  })

  it('a first message with NO mint path registered is never swallowed — the disabled card keeps the text', async () => {
    const { el, requests } = mountAdmin({ store: personaStore() })
    await whenFlushed()
    // The degrade leaves the card `disabled`, so the composer's own busy guard refuses the send BEFORE it
    // reads the value (TKT-0034) — the text is retained by construction rather than handed back after the
    // fact, and no bubble is painted for a turn that will never run.
    await submitFirst(el, 'a hotel concierge please')
    expect(el.authoringStore).toBeUndefined()
    expect(authorComposer(el).value).toBe('a hotel concierge please')
    expect(el.querySelectorAll('[data-part="copilot-pane"] [data-part="bubble"]')).toHaveLength(0)
    expect(requests).toEqual([])
  })

  it('leaving the flow returns the card to its empty-log state — the same node, cleared', async () => {
    const builder = personaStore({ [SURFACE_AUTHORING_KEY]: true })
    const { el } = mountAdmin({ store: personaStore(), authoringStore: builder, events: [{ kind: 'note', note: 'ok' }] })
    el.onGenerateRequest(() => {})
    await whenFlushed()
    await submit(el, 'interview turn', 'authoring')
    expect(authorLogEmpty(el), 'armed and a turn ran ⇒ the log is no longer empty').toBe(false)

    el.authoringStore = undefined
    await whenFlushed()
    // GH #684 — no dedicated empty-state node comes back; the log is simply empty again, same as any
    // fresh unarmed card.
    expect(authorLogEmpty(el), 'the log returns to empty').toBe(true)
    expect(el.querySelectorAll('[data-part="copilot-pane"] [data-part="bubble"]'), 'and the interview is cleared').toHaveLength(0)
  })
})

// ── GH #670 — the Author card's Model/Effort pickers, at BOTH arming states ─────────────────────────────
// The filing's measured table: unarmed, the card's `models`/`efforts` were both `undefined`, which the
// composer's own guard reads as "no picker to render", so the first-touch surface offered no choice at all.
// A one-line fix (set the props) would have been WORSE than the gap: `onModelChange` wrote
// `this.authoringStore?.set(...)`, and unarmed that store does not exist — a picker that visibly accepts a
// choice and drops it. Kim's 2026-08-10 ruling closed all three forks: a LOCAL field holds the pre-arm pick,
// the arm passes it INTO the mint so the new store is seeded with it (the user's pick wins by construction,
// never by a later overwrite), and Effort takes the identical path with no special-casing.
describe('GH #670 — the unarmed Author card’s Model/Effort pickers: picked before the arm, SEEDED into it', () => {
  const INCLUDED = SUPPORTED_MODELS.filter((m) => m.includedByDefault)
  /** A pickable model that is NOT the mint path's own default — the discriminator every seed probe turns
   *  on. A pick equal to the default would pass whether it was honoured or silently discarded. */
  const PICK = INCLUDED.find((m) => m.id !== DEFAULT_MODEL_ID)!.id
  const labelOf = (id: string): string => SUPPORTED_MODELS.find((m) => m.id === id)!.label

  /** The page's `createGeneratedAgent`, in miniature and SEED-AWARE — the real one folds `seed.model` into
   *  `builderStore()`'s INITIAL state (agent-admin-presets.ts), never a `set()` afterwards, which is the
   *  whole point of fork 1's mechanism. Records every seed it is handed so a probe can read the SEAM itself
   *  and not only its downstream effect. Its own default is Haiku, so a Sonnet pick discriminates. */
  function seedingMintPath(el: UIAgentAdminElement): { seeds: ({ model?: string } | undefined)[]; builder: () => SettingsStore } {
    const seeds: ({ model?: string } | undefined)[] = []
    let builder: SettingsStore | undefined
    el.onGenerateRequest((seed) => {
      seeds.push(seed)
      builder = personaStore({ [SURFACE_AUTHORING_KEY]: true, name: 'Builder', ...(seed?.model === undefined ? {} : { model: seed.model }) })
      el.authoringStore = builder
    })
    return { seeds, builder: () => builder! }
  }

  /** Commit a picker choice the way a real menu commit does — a click on the option row, through ui-menu's
   *  own delegation into the composer's `select` listener (agent-admin.test.ts's Models-picker idiom).
   *  Scoped to the AUTHOR card: the Chat place's composer carries the same two pickers. */
  function pick(el: UIAgentAdminElement, picker: 'models' | 'effort', value: string): void {
    const card = el.querySelector('[data-part="copilot-pane"]') as HTMLElement
    const item = card.querySelector(`[data-part="${picker}-menu"] [data-value="${value}"]`) as HTMLElement
    item.dispatchEvent(new Event('click', { bubbles: true }))
  }

  /** What a picker TRIGGER currently says — the user-visible half of "the pick stuck". */
  const trigger = (el: UIAgentAdminElement, picker: 'models' | 'effort'): HTMLElement =>
    el.querySelector(`[data-part="copilot-pane"] [data-picker="${picker}"]`) as HTMLElement

  /** The four props the composer actually renders the pickers from. */
  const pickerProps = (el: UIAgentAdminElement): Record<string, unknown> => {
    const composer = authorComposer(el) as HTMLElement & {
      models?: readonly { id: string }[]
      efforts?: readonly { id: string }[]
      model?: string
      effort?: string
    }
    return {
      models: composer.models?.map((m) => m.id),
      efforts: composer.efforts?.map((e) => e.id),
      model: composer.model,
      effort: composer.effort,
    }
  }

  it('the UNARMED card offers both pickers — the same roster and the same levels the ARMED interview offers', async () => {
    const unarmed = mountAdmin({ store: personaStore() })
    const armed = mountAdmin({ store: personaStore(), authoringStore: personaStore({ [SURFACE_AUTHORING_KEY]: true }) })
    unarmed.el.onGenerateRequest(() => {})
    await whenFlushed()

    // Compared against the ARMED card rather than literals (GH #666's cross-state idiom): whatever roster
    // the interview offers, the entry that hands off to it must offer the same one — a claim that survives a
    // roster change, which a hard-coded id list would not.
    const offered = (el: UIAgentAdminElement): unknown[] => [pickerProps(el).models, pickerProps(el).efforts]
    expect(offered(unarmed.el)).toEqual(offered(armed.el))
    expect(pickerProps(unarmed.el).models, 'anti-vacuous: a real, non-empty roster, not two matching undefineds').toEqual(INCLUDED.map((m) => m.id))
    expect(pickerProps(unarmed.el).efforts).toEqual(['low', 'medium', 'high', 'xhigh'])

    // …and the picker DOM exists in the unarmed card — the filing's table read no menu parts at all here.
    const menus = [...authorComposer(unarmed.el).querySelectorAll('[data-part$="-menu"]')].map((m) => m.getAttribute('data-part'))
    expect(menus, 'both menus are built into the unarmed card’s own composer').toEqual(['models-menu', 'effort-menu'])

    // GH #880 REOPENED (Kim's second 2026-08-14 ruling) — both triggers NAME a model, and the unarmed one
    // names the AUTHORING default. This assertion used to pin the opposite (the unarmed trigger's neutral
    // "Models" label, on the reasoning that no store owns a committed value yet); the owner's pixel-truth
    // ruling overruled that, so the pin now reads the ruled shape. The two labels differ here, which is what
    // keeps the claim non-vacuous: the ARMED store is `personaStore()`, an EXPLICIT Haiku choice.
    expect(trigger(unarmed.el, 'models').textContent).toContain(labelOf(AUTHORING_DEFAULT_MODEL_ID))
    expect(trigger(armed.el, 'models').textContent).toContain(labelOf(DEFAULT_MODEL_ID))
    expect(labelOf(AUTHORING_DEFAULT_MODEL_ID), 'anti-vacuous: two genuinely different labels').not.toBe(labelOf(DEFAULT_MODEL_ID))
    // …and the MENU agrees with the trigger on both cards — one row marked, and it is that model's own row
    // (the second half of the ruling: "the menu row carries the selected marker").
    expect(selectedModelRows(unarmed.el)).toEqual([AUTHORING_DEFAULT_MODEL_ID])
    expect(selectedModelRows(armed.el)).toEqual([DEFAULT_MODEL_ID])
    // Effort IS knowable unarmed — it is this element's own dial — so it names the value the arm carries over.
    expect([trigger(unarmed.el, 'effort').textContent, trigger(armed.el, 'effort').textContent]).toEqual(['Medium', 'Medium'])
  })

  it('a pre-arm MODEL pick SEEDS the mint — the interviewer opens on the user’s choice, with no overwrite step', async () => {
    const { el } = mountAdmin({ store: personaStore() })
    await whenFlushed()
    const mint = seedingMintPath(el)
    await whenFlushed()

    pick(el, 'models', PICK)
    await whenFlushed()
    // GH #880 REOPENED — this label claim no longer discriminates on its own (`PICK` is the one included
    // non-Haiku model, which is exactly the id the unarmed card now shows by DEFAULT), so the seam + store
    // reads below carry the "the pick stuck" weight here, and the probe under this one is the label's own
    // discriminating arm (a pick the visible default is NOT).
    expect(trigger(el, 'models').textContent, 'the unarmed pick STICKS — the write that used to evaporate').toContain(labelOf(PICK))

    await submitFirst(el, 'a hotel concierge please')

    expect(mint.seeds, 'the pick crossed the mint seam exactly once, as the seed').toEqual([{ model: PICK }])
    expect(mint.builder().get('model'), 'and the store was MINTED with it — its first read is already the user’s').toBe(PICK)
    expect(pickerProps(el).model, 'which is what the armed composer reads back — nothing overwrote it').toBe(PICK)
    expect(el.store!.get('model'), 'the DRAFT’s own model is untouched: the pick chose the INTERVIEWER’s').toBe(DEFAULT_MODEL_ID)
  })

  it('GH #880 REOPENED — an explicit pre-arm pick still WINS over the now-visible authoring default, at trigger, marker and seam', async () => {
    // The discriminator the ruling needs: the default is SHOWN, so "an explicit pick wins" must be proven
    // with a pick the default is not. `DEFAULT_MODEL_ID` (Haiku) is offered, is not `AUTHORING_DEFAULT_MODEL_ID`,
    // and — because an untouched card seeds NOTHING — is still visible at the mint SEAM, which is what makes
    // this a real write of the user's choice rather than the mint path's own coincidental default.
    const { el } = mountAdmin({ store: personaStore() })
    await whenFlushed()
    const mint = seedingMintPath(el)
    await whenFlushed()
    expect([trigger(el, 'models').textContent?.trim(), ...selectedModelRows(el)], 'the card opens on the ruled default').toEqual([
      labelOf(AUTHORING_DEFAULT_MODEL_ID),
      AUTHORING_DEFAULT_MODEL_ID,
    ])

    pick(el, 'models', DEFAULT_MODEL_ID)
    await whenFlushed()
    expect([trigger(el, 'models').textContent?.trim(), ...selectedModelRows(el)], 'and the pick REPLACES it — label and marker together').toEqual([
      labelOf(DEFAULT_MODEL_ID),
      DEFAULT_MODEL_ID,
    ])

    await submitFirst(el, 'a hotel concierge please')
    expect(mint.seeds, 'the pick still crosses the seam — the visible default is a READ, never a seed').toEqual([{ model: DEFAULT_MODEL_ID }])
  })

  it('a pre-arm EFFORT pick gets the IDENTICAL treatment — it is the interview’s effort from its opening turn', async () => {
    const { el, requests } = mountAdmin({ store: personaStore(), events: [{ kind: 'note', note: 'ok' }] })
    await whenFlushed()
    seedingMintPath(el)
    await whenFlushed()

    pick(el, 'effort', 'high')
    await whenFlushed()
    expect(trigger(el, 'effort').textContent, 'the unarmed pick sticks here too').toBe('High')

    await submitFirst(el, 'a hotel concierge please')

    // The end of the wire, not a field read: the opening turn RUNS at the picked effort.
    expect(requests.at(-1)!.effort).toBe('high')
    expect(pickerProps(el).effort, 'and the armed composer still shows it').toBe('high')
  })

  it('an UNTOUCHED picker seeds nothing — the minted store’s own default stands (fork 2’s other arm)', async () => {
    const { el, requests } = mountAdmin({ store: personaStore(), events: [{ kind: 'note', note: 'ok' }] })
    await whenFlushed()
    const mint = seedingMintPath(el)
    await submitFirst(el, 'a hotel concierge please')

    expect(mint.seeds[0]?.model, 'no pick ⇒ nothing to seed').toBeUndefined()
    expect(mint.builder().get('model'), 'so the mint path’s own default is what the interview opens on').toBe(DEFAULT_MODEL_ID)
    expect(requests.at(-1)!.effort, 'and effort keeps the element’s own resting dial').toBe('medium')
  })

  it('a real persona switch CLEARS the pre-arm pick — it never leaks into the next unarmed session (GH #145/#644)', async () => {
    const { el, requests } = mountAdmin({ store: personaStore(), events: [{ kind: 'note', note: 'ok' }] })
    await whenFlushed()
    const mint = seedingMintPath(el)
    await whenFlushed()
    // The model half picks HAIKU deliberately (not `PICK`): GH #880 REOPENED made the authoring default
    // visible, so a pick equal to that default could not show a repaint at all.
    pick(el, 'models', DEFAULT_MODEL_ID)
    pick(el, 'effort', 'high')
    await whenFlushed()
    expect([trigger(el, 'models').textContent?.trim(), trigger(el, 'effort').textContent], 'both picks are showing first').toEqual([
      labelOf(DEFAULT_MODEL_ID),
      'High',
    ])

    el.store = personaStore() // a DIFFERENT store object — the GH #145 reset's own trigger
    await whenFlushed()

    expect(
      [trigger(el, 'models').textContent?.trim(), trigger(el, 'effort').textContent, ...selectedModelRows(el)],
      'the card repaints to its DEFAULTS: this persona was never described with those choices',
    ).toEqual([labelOf(AUTHORING_DEFAULT_MODEL_ID), 'Medium', AUTHORING_DEFAULT_MODEL_ID])
    await submitFirst(el, 'a hotel concierge please')
    expect(mint.seeds[0]?.model, 'and the arm carries nothing stale across the switch').toBeUndefined()
    expect(requests.at(-1)!.effort).toBe('medium')
  })

  it('arming EMPTIES the bridge — leaving the flow returns DEFAULT pickers, and a re-arm carries no stale pick', async () => {
    // GH #681 — the in-card button that used to drive both arms here is gone; the card's own composer-first
    // entry (`submitFirst`) is the surviving in-card path that carries the pre-arm pick, so it drives both
    // the first arm and the re-arm below.
    const { el } = mountAdmin({ store: personaStore() })
    await whenFlushed()
    const mint = seedingMintPath(el)
    await whenFlushed()
    // HAIKU again, not `PICK` (see the probe above): the post-arm repaint is only observable against a pick
    // the visible authoring default is not.
    pick(el, 'models', DEFAULT_MODEL_ID)
    await whenFlushed()
    await submitFirst(el, 'a hotel concierge please')
    expect(mint.seeds, 'the pick crossed the seam as the seed').toEqual([{ model: DEFAULT_MODEL_ID }])
    expect(mint.builder().get('model')).toBe(DEFAULT_MODEL_ID)

    el.authoringStore = undefined // leave the flow — the card returns to its empty-log state
    await whenFlushed()
    expect(
      [trigger(el, 'models').textContent?.trim(), ...selectedModelRows(el)],
      'the bridge is spent: the card is back on its own default, not the spent pick',
    ).toEqual([labelOf(AUTHORING_DEFAULT_MODEL_ID), AUTHORING_DEFAULT_MODEL_ID])

    await submitFirst(el, 'a second concierge please')
    expect(mint.seeds[1]?.model, 'so the second arm seeds nothing it was not freshly told').toBeUndefined()
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

// ── GH #880 — the Builder Interview's own model default: Sonnet 5 (Kim's ruling, 2026-08-14) ─────────────
// Every model read went through `sanitizeModel(store?.get('model'), roster)`, whose fallback is the
// ROSTER-WIDE `DEFAULT_MODEL_ID` — Haiku, the cheap/fast tier that is the right default for a TEST chat and
// the wrong one for the model conducting the interview that authors an agent. The fix is an ABSENT-VALUE
// read-side default (`sanitizeAuthoringModel`, reached through the element's one `#modelFor` read law):
// nothing is written, nothing migrates, and the test context is not touched.
//
// GH #880 REOPENED (Kim's second 2026-08-14 ruling, on his live screenshot) — the first build fixed the read
// but left the PRE-ARM card (`#reflectPreArmPickers`) with no `model` prop at all, which the composer renders
// as its neutral "Models" trigger with no row marked. That card is what the docs page paints at BOOT (the
// interview arms only from "New agent → Generate"), so the default was invisible on the one surface the
// filing was about. The ruling: the default is VISIBLE wherever this composer renders, pre-arm included —
// trigger label AND selected menu row. Both halves are pinned here and in `agent-admin.browser.test.ts`.
describe('GH #880 — a fresh Builder Interview opens on Sonnet 5; the test chat keeps Haiku', () => {
  const labelOf = (id: string): string => SUPPORTED_MODELS.find((m) => m.id === id)!.label

  /** A Builder store the way a bring-your-own consumer mints one: the gate, a name, and NO `model` key —
   *  the exact absent-value state this ruling is about. (`personaStore` above seeds `DEFAULT_MODEL_ID`, so
   *  it is this file's STORED-CHOICE fixture, never its fresh-context one.) */
  function modellessBuilder(extra: Record<string, unknown> = {}): SettingsStore {
    return createMemoryStore({ initial: { [SURFACE_AUTHORING_KEY]: true, name: 'Builder', ...initialEntryValues(), ...extra } })
  }

  /** The DRAFT with no model of its own either — so "the test chat keeps Haiku" is proven against the same
   *  absent-value state, not against a seeded value that would pass whatever the fallback did. */
  function modellessDraft(): SettingsStore {
    return createMemoryStore({ initial: { ...initialValuesFor(defaultAgentConfigSchema), ...initialEntryValues() } })
  }

  /** What a pane's Models trigger SAYS — the user-visible half of the claim (the GH #670 idiom, widened to
   *  take the pane, because this block's whole point is the two panes answering differently at once). */
  const trigger = (el: UIAgentAdminElement, pane: 'chat' | 'copilot'): HTMLElement =>
    el.querySelector(`[data-part="${pane}-pane"] [data-picker="models"]`) as HTMLElement

  /** …and the committed value the composer renders it from. */
  const committed = (el: UIAgentAdminElement, pane: 'chat' | 'copilot'): string | undefined =>
    (el.querySelector(`[data-part="${pane}-pane"] ui-conversation-composer`) as HTMLElement & { model?: string }).model

  it('the two defaults are genuinely different ids — the anti-vacuous premise every arm below rests on', () => {
    expect(AUTHORING_DEFAULT_MODEL_ID).toBe('claude-sonnet-5')
    expect(DEFAULT_MODEL_ID).toBe('claude-haiku-4-5-20251001')
    expect(AUTHORING_DEFAULT_MODEL_ID).not.toBe(DEFAULT_MODEL_ID)
    // …and the interview's default is an OFFERED model, not a label the picker cannot commit to.
    expect(SUPPORTED_MODELS.find((m) => m.id === AUTHORING_DEFAULT_MODEL_ID)?.includedByDefault).toBe(true)
  })

  it('sanitizeAuthoringModel: absent/garbage read as Sonnet 5, a roster id still WINS, and an absent Sonnet degrades', () => {
    const roster = modelRoster()
    expect(sanitizeAuthoringModel(undefined, roster)).toBe(AUTHORING_DEFAULT_MODEL_ID)
    expect(sanitizeAuthoringModel(null, roster)).toBe(AUTHORING_DEFAULT_MODEL_ID)
    expect(sanitizeAuthoringModel('', roster)).toBe(AUTHORING_DEFAULT_MODEL_ID)
    expect(sanitizeAuthoringModel(7, roster)).toBe(AUTHORING_DEFAULT_MODEL_ID)
    expect(sanitizeAuthoringModel('not-a-model', roster)).toBe(AUTHORING_DEFAULT_MODEL_ID)
    // An explicit choice wins — INCLUDING one that happens to equal the roster-wide default: the read must
    // not "correct" a deliberate Haiku interview into Sonnet.
    expect(sanitizeAuthoringModel(DEFAULT_MODEL_ID, roster)).toBe(DEFAULT_MODEL_ID)
    expect(sanitizeAuthoringModel('gpt-4.1', roster)).toBe('gpt-4.1')
    // The roster-membership guard: a roster without Sonnet never returns an id the picker cannot offer.
    expect(sanitizeAuthoringModel(undefined, [{ id: DEFAULT_MODEL_ID, label: 'Haiku 4.5', provider: 'Anthropic', includedByDefault: true }])).toBe(
      DEFAULT_MODEL_ID,
    )
  })

  it('a FRESH authoring context shows Sonnet 5 while the SAME element’s test chat shows Haiku — and writes nothing', async () => {
    const draft = modellessDraft()
    const builder = modellessBuilder()
    const { el } = mountAdmin({ store: draft, authoringStore: builder })
    await whenFlushed()

    // The whole rendered shape, both panes at once: two contexts, two defaults, one element.
    expect([trigger(el, 'copilot').textContent?.trim(), trigger(el, 'chat').textContent?.trim()]).toEqual([
      labelOf(AUTHORING_DEFAULT_MODEL_ID),
      labelOf(DEFAULT_MODEL_ID),
    ])
    expect([committed(el, 'copilot'), committed(el, 'chat')]).toEqual([AUTHORING_DEFAULT_MODEL_ID, DEFAULT_MODEL_ID])
    // GH #880 REOPENED — the MENUS agree with their triggers: exactly one marked row per pane, each naming
    // its own context's default. The reopen was reported as "neither menu row selected", so the marker is a
    // first-class part of the claim, not an implementation detail behind the label.
    expect([selectedModelRows(el, 'copilot'), selectedModelRows(el, 'chat')]).toEqual([[AUTHORING_DEFAULT_MODEL_ID], [DEFAULT_MODEL_ID]])

    // The load-bearing half of "an ABSENT-value READ": neither store was migrated to make the default true.
    expect(builder.get('model'), 'the Builder store still carries NO model — a read-time default, never a write').toBeUndefined()
    expect(draft.get('model'), 'and the draft was not written either').toBeUndefined()
  })

  it('an authoring TURN runs on Sonnet 5 — the wire, not just the trigger label', async () => {
    const { el, requests } = mountAdmin({ store: modellessDraft(), authoringStore: modellessBuilder() })
    await whenFlushed()
    await submit(el, 'a hotel concierge please')
    expect(requests.at(-1)!.model, 'the request the runner is handed carries the interview’s own default').toBe(AUTHORING_DEFAULT_MODEL_ID)

    // …and a TEST-chat turn from the same element, with the flow still armed, is unmoved.
    await submit(el, 'hello', 'test')
    expect(requests.at(-1)!.model, 'the test context never inherits the interview’s default').toBe(DEFAULT_MODEL_ID)
  })

  it('an explicitly STORED Builder choice still wins — even when it is the roster-wide default', async () => {
    // The discriminator: a stored Haiku is indistinguishable from "unset" only if the read is broken, so
    // this is the arm that proves the default is a FALLBACK and not an override.
    const builder = modellessBuilder({ model: DEFAULT_MODEL_ID })
    const { el, requests } = mountAdmin({ store: modellessDraft(), authoringStore: builder })
    await whenFlushed()
    expect(committed(el, 'copilot')).toBe(DEFAULT_MODEL_ID)
    expect(trigger(el, 'copilot').textContent?.trim()).toBe(labelOf(DEFAULT_MODEL_ID))
    await submit(el, 'go')
    expect(requests.at(-1)!.model).toBe(DEFAULT_MODEL_ID)

    // A LIVE write keeps winning too (props down, callbacks up — the store is the truth from the arm
    // onward, GH #670), including to an id the ruling's default is nowhere near.
    builder.set('model', 'gpt-4.1')
    await whenFlushed()
    expect(committed(el, 'copilot')).toBe('gpt-4.1')
    await submit(el, 'again')
    expect(requests.at(-1)!.model, 'the wire follows the stored choice, never the authoring default').toBe('gpt-4.1')
    // (Its TRIGGER reads the neutral label here — `gpt-4.1` ships switched OFF in the Model grid, so the
    // picker does not OFFER it and has no label to name. Pre-existing inclusion behaviour, untouched by this
    // ruling: the committed value and the wire above are what the default question is about.)
    expect(trigger(el, 'copilot').textContent?.trim()).toBe('Models')
  })

  it('THE REOPEN’S OWN SURFACE — never armed at all, the Co-pilot card still SHOWS Sonnet 5 (label + marked row) while the test chat keeps Haiku', async () => {
    // This is the state the docs page paints at boot, and the state Kim screenshotted: `authoringStore` is
    // undefined, so the card is the PRE-ARM one (`#reflectPreArmPickers`) and nothing in `#modelFor`'s read
    // law is reached at all. The previous build pinned the OPPOSITE here (a neutral "Models" trigger, on the
    // GH #670 reasoning that no store owns a committed value yet) — the owner's ruling overruled it.
    const { el, requests } = mountAdmin({ store: modellessDraft() })
    await whenFlushed()
    expect([trigger(el, 'copilot').textContent?.trim(), ...selectedModelRows(el, 'copilot')], 'the pre-arm card names the interview’s default').toEqual([
      labelOf(AUTHORING_DEFAULT_MODEL_ID),
      AUTHORING_DEFAULT_MODEL_ID,
    ])
    // …and the TEST chat beside it is untouched by that — still the global default, at label, marker and wire.
    expect([committed(el, 'chat'), trigger(el, 'chat').textContent?.trim(), ...selectedModelRows(el, 'chat')]).toEqual([
      DEFAULT_MODEL_ID,
      labelOf(DEFAULT_MODEL_ID),
      DEFAULT_MODEL_ID,
    ])
    await submit(el, 'hello', 'test')
    expect(requests.at(-1)!.model).toBe(DEFAULT_MODEL_ID)
  })

  it('the default holds across a REWIRE — a second fresh interviewer opens on Sonnet 5 again', async () => {
    const { el } = mountAdmin({ store: modellessDraft(), authoringStore: modellessBuilder() })
    await whenFlushed()
    expect(committed(el, 'copilot')).toBe(AUTHORING_DEFAULT_MODEL_ID)

    // Leave the flow, then re-arm with a DIFFERENT modelless store — the authoring re-read path.
    el.authoringStore = undefined
    await whenFlushed()
    el.authoringStore = modellessBuilder()
    await whenFlushed()
    expect(committed(el, 'copilot'), 'the re-armed interview reads the same default, not the spent one').toBe(AUTHORING_DEFAULT_MODEL_ID)
  })

  it('the GH #670 fence survives — an unarmed pick is cleared by a persona switch, and the next interview opens on Sonnet 5', async () => {
    const { el } = mountAdmin({ store: modellessDraft() })
    await whenFlushed()
    // The page's seed-aware mint, in miniature (the GH #670 idiom): a seed's model rides the MINT, never a
    // later write, and an absent seed mints a modelless store — exactly the fresh-context state.
    const seeds: ({ model?: string } | undefined)[] = []
    el.onGenerateRequest((seed) => {
      seeds.push(seed)
      el.authoringStore = modellessBuilder(seed?.model === undefined ? {} : { model: seed.model })
    })
    await whenFlushed()

    // Pick a model on the UNARMED card, then switch persona — GH #145's reset empties the pre-arm bridge.
    const menuItem = el.querySelector(`[data-part="copilot-pane"] [data-part="models-menu"] [data-value="${DEFAULT_MODEL_ID}"]`) as HTMLElement
    menuItem.dispatchEvent(new Event('click', { bubbles: true }))
    await whenFlushed()
    expect(trigger(el, 'copilot').textContent?.trim(), 'the unarmed pick sticks while it is still this persona’s').toBe(labelOf(DEFAULT_MODEL_ID))

    el.store = modellessDraft() // a DIFFERENT store object — a real persona switch
    await whenFlushed()
    expect(
      [trigger(el, 'copilot').textContent?.trim(), ...selectedModelRows(el, 'copilot')],
      'the card repaints to its DEFAULT: the pick did not survive the switch (GH #880 REOPENED — a default, not a neutral label)',
    ).toEqual([labelOf(AUTHORING_DEFAULT_MODEL_ID), AUTHORING_DEFAULT_MODEL_ID])

    await submitFirst(el, 'a hotel concierge please')
    expect(seeds.map((s) => s?.model), 'the fence held — the stale pick seeded nothing').toEqual([undefined])
    expect(committed(el, 'copilot'), 'so the next persona’s interview opens on the authoring default, not the stale pick').toBe(
      AUTHORING_DEFAULT_MODEL_ID,
    )
  })
})
