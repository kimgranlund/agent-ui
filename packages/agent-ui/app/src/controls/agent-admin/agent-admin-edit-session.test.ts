// agent-admin-edit-session.test.ts: T-0447 (agent authoring S5), the Co-pilot edit session in
// ui-agent-admin. The first message arms an edit session through `onEditRequest` (F1a), a consumed patch
// applies live and its receipt carries an Undo bound to that turn's own record (F3), the records drop with
// the Co-pilot transcript (F4), a team declaration is log-only (F5), and `SURFACE_AUTHORING_KEY` is dropped
// from admission in edit mode only. Fixtures follow agent-admin-authoring.test.ts.
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { installDialogPolyfill } from '@agent-ui/shared/testing/dialog-polyfill'
import { UIAgentAdminElement } from './agent-admin.ts'
import { createMemoryStore } from '../settings/memory-store.ts'
import type { SettingsStore } from '../settings/store.ts'
import { initialEntryValues } from './entries.ts'
import {
  DEFAULT_MODEL_ID,
  SURFACE_AUTHORING_KEY,
  defaultAgentConfigSchema,
  initialValuesFor,
  type AdminSurfaceTurnEvent,
} from './agent-admin-schema.ts'

let realAttachInternals: typeof HTMLElement.prototype.attachInternals
beforeAll(() => {
  realAttachInternals = HTMLElement.prototype.attachInternals
  HTMLElement.prototype.attachInternals = function (this: HTMLElement): ElementInternals {
    const internals = realAttachInternals.call(this) as unknown as Record<string, unknown>
    if (typeof internals.setFormValue !== 'function') internals.setFormValue = () => {}
    if (typeof internals.setValidity !== 'function') internals.setValidity = () => {}
    return internals as unknown as ElementInternals
  }
  installDialogPolyfill()
})
afterAll(() => {
  HTMLElement.prototype.attachInternals = realAttachInternals
})

const mounted: Element[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
  localStorage.clear()
})

function personaStore(extra: Record<string, unknown> = {}): SettingsStore {
  return createMemoryStore({ initial: { model: DEFAULT_MODEL_ID, ...initialValuesFor(defaultAgentConfigSchema), ...initialEntryValues(), ...extra } })
}

/** The Builder store an edit session arms: gate ON, as `builderStore` seeds it. */
const builderStore = (): SettingsStore => personaStore({ [SURFACE_AUTHORING_KEY]: true, name: 'Builder' })

/** Mount an admin whose surface runner replays one event list per turn, in order (the last repeats). */
function mountAdmin(options: { store: SettingsStore; turns?: AdminSurfaceTurnEvent[][] }): UIAgentAdminElement {
  const turns = options.turns ?? []
  let turn = 0
  const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
  el.store = options.store
  el.agentSurfaceTurn = async function* () {
    const events = turns[Math.min(turn, turns.length - 1)] ?? []
    turn += 1
    for (const event of events) yield event
  }
  document.body.append(el)
  mounted.push(el)
  return el
}

/** Arm the way the page's edit path does: mode first, then the Builder store. */
async function arm(el: UIAgentAdminElement, mode: 'generate' | 'edit', builder: SettingsStore = builderStore()): Promise<void> {
  el.authoringMode = mode
  el.authoringStore = builder
  await whenFlushed()
}

async function settle(): Promise<void> {
  for (let round = 0; round < 3; round += 1) {
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0))
  }
  await whenFlushed()
}

/** Submit through the Co-pilot card's one composer (armed or not). */
async function submit(el: UIAgentAdminElement, text: string): Promise<void> {
  await whenFlushed()
  const composer = el.querySelector('[data-part="copilot-pane"] > ui-conversation-composer') as HTMLElement & { value: string }
  composer.value = text
  const editor = composer.querySelector('[data-part="editor"]') as HTMLElement
  editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  await settle()
}

const card = (el: UIAgentAdminElement): HTMLElement & { disabled: boolean } =>
  el.querySelector('[data-part="copilot-pane"]') as HTMLElement & { disabled: boolean }
const undoButtons = (el: UIAgentAdminElement): HTMLElement[] => [...el.querySelectorAll<HTMLElement>('[data-part="copilot-pane"] [data-part="receipt-undo"]')]
const kicker = (el: UIAgentAdminElement): string => card(el).querySelector('[data-part="region-kicker"]')!.textContent ?? ''
const turnLogOf = (el: UIAgentAdminElement): Record<string, unknown> => {
  const newest = el.querySelector('[data-part="context-turn"] [data-part="context-json"]')
  return JSON.parse(newest?.textContent ?? '{}') as Record<string, unknown>
}
const namePatch = (name: string): AdminSurfaceTurnEvent[] => [{ kind: 'patch', patch: { values: { name } } }]

describe('F1a: the unarmed card`s first message arms an edit session when the page registered one', () => {
  it('calls onEditRequest, not onGenerateRequest, with the pre-arm seed', async () => {
    const el = mountAdmin({ store: personaStore() })
    const calls: string[] = []
    el.onGenerateRequest(() => calls.push('generate'))
    el.onEditRequest((seed) => calls.push(`edit:${typeof seed}`))
    await submit(el, 'make it friendlier')
    expect(calls).toEqual(['edit:object'])
  })

  it('falls back to onGenerateRequest when only generate is registered (GH #666 unchanged)', async () => {
    const el = mountAdmin({ store: personaStore() })
    const calls: string[] = []
    el.onGenerateRequest(() => calls.push('generate'))
    await submit(el, 'a hotel concierge')
    expect(calls).toEqual(['generate'])
  })

  it('the card is enabled when only onEditRequest is registered, and disabled with neither', async () => {
    const el = mountAdmin({ store: personaStore() })
    await whenFlushed()
    expect(card(el).disabled).toBe(true)
    el.onEditRequest(() => {})
    expect(card(el).disabled).toBe(false)
  })
})

describe('edit-mode admission: SURFACE_AUTHORING_KEY drops in edit sessions only', () => {
  const gatePatch: AdminSurfaceTurnEvent[] = [{ kind: 'patch', patch: { values: { [SURFACE_AUTHORING_KEY]: true, name: 'Concierge' } } }]

  it('edit mode drops it into patch.dropped and writes nothing for it', async () => {
    const draft = personaStore()
    const el = mountAdmin({ store: draft, turns: [gatePatch] })
    await arm(el, 'edit')
    await submit(el, 'let it author agents')
    expect(draft.get(SURFACE_AUTHORING_KEY)).toBeUndefined()
    expect(draft.get('name')).toBe('Concierge')
    const patch = (turnLogOf(el).response as { patch: { applied: string[]; dropped: string[] } }).patch
    expect(patch.dropped).toEqual([SURFACE_AUTHORING_KEY])
    expect(patch.applied).toEqual(['name'])
  })

  it('generate mode still admits it, as shipped', async () => {
    const draft = personaStore()
    const el = mountAdmin({ store: draft, turns: [gatePatch] })
    await arm(el, 'generate')
    await submit(el, 'let it author agents')
    expect(draft.get(SURFACE_AUTHORING_KEY)).toBe(true)
    const patch = (turnLogOf(el).response as { patch: { applied: string[]; dropped: string[] } }).patch
    expect(patch.dropped).toEqual([])
  })
})

describe('F3: the receipt Undo', () => {
  it('an edit-mode consumed patch renders exactly one Undo after the receipt list; generate mode renders none', async () => {
    const editDraft = personaStore()
    const edit = mountAdmin({ store: editDraft, turns: [namePatch('Concierge')] })
    await arm(edit, 'edit')
    await submit(edit, 'rename it')
    const buttons = undoButtons(edit)
    expect(buttons).toHaveLength(1)
    expect(buttons[0]!.previousElementSibling?.getAttribute('data-part')).toBe('receipt-list')
    expect(buttons[0]!.textContent).toBe('Undo')
    expect(buttons[0]!.getAttribute('data-edit')).toMatch(/^\d+$/)

    const generate = mountAdmin({ store: personaStore(), turns: [namePatch('Concierge')] })
    await arm(generate, 'generate')
    await submit(generate, 'rename it')
    expect(generate.querySelector('[data-part="copilot-pane"] [data-part="receipt-list"]')).not.toBeNull()
    expect(undoButtons(generate)).toHaveLength(0)
  })

  it('Undo restores the pre-edit value, then reads Undone and is disabled; no chat turn runs', async () => {
    const draft = personaStore({ name: 'Original' })
    const el = mountAdmin({ store: draft, turns: [namePatch('Concierge')] })
    await arm(el, 'edit')
    await submit(el, 'rename it')
    expect(draft.get('name')).toBe('Concierge')
    const bubbles = el.querySelectorAll('[data-part="copilot-pane"] [data-part="log"] > *').length
    const [undo] = undoButtons(el)
    undo!.click()
    await whenFlushed()
    expect(draft.get('name')).toBe('Original')
    expect(undo!.textContent).toBe('Undone')
    expect(undo!.hasAttribute('disabled')).toBe(true)
    expect(el.querySelector('[data-part="receipt-undo-skipped"]')).toBeNull()
    expect(el.querySelectorAll('[data-part="copilot-pane"] [data-part="log"] > *').length, 'no new turn').toBe(bubbles)
  })

  it('two edit turns with byte-identical receipts each undo their own record', async () => {
    const draft = personaStore({ name: 'Original' })
    const el = mountAdmin({ store: draft, turns: [namePatch('First'), namePatch('Second')] })
    await arm(el, 'edit')
    await submit(el, 'rename it')
    await submit(el, 'no, rename it again')
    const [first, second] = undoButtons(el)
    expect(first!.getAttribute('data-edit')).not.toBe(second!.getAttribute('data-edit'))
    expect(first!.previousElementSibling?.textContent).toBe(second!.previousElementSibling?.textContent)

    // Turn 1's Undo: turn 2 changed the key since, so it is kept and named.
    first!.click()
    await whenFlushed()
    expect(draft.get('name')).toBe('Second')
    expect(first!.nextElementSibling?.getAttribute('data-part')).toBe('receipt-undo-skipped')
    expect(first!.nextElementSibling?.textContent).toBe('Kept, changed since: Agent')

    // Turn 2's Undo restores turn 2's own before value.
    second!.click()
    await whenFlushed()
    expect(draft.get('name')).toBe('First')
  })
})

describe('F4: undo records drop with the Co-pilot transcript', () => {
  it('a re-arm (a new authoringStore) empties the records: a kept Undo button reverts nothing', async () => {
    const draft = personaStore({ name: 'Original' })
    const el = mountAdmin({ store: draft, turns: [namePatch('Concierge')] })
    await arm(el, 'edit')
    await submit(el, 'rename it')
    const [undo] = undoButtons(el)
    await arm(el, 'edit', builderStore())
    expect(undoButtons(el), 'the transcript reset with the re-arm').toHaveLength(0)
    undo!.click()
    await whenFlushed()
    expect(draft.get('name')).toBe('Concierge')
  })
})

describe('F5: a team declaration in an edit session is log-only', () => {
  const TEAM = { label: 'Support Team', tagline: 'Front-line help', members: [{ name: 'Tier 1', role: 'Triage', routingDescription: 'First message.' }] }

  it('never calls onTeamDeclared and logs teamIgnored', async () => {
    const el = mountAdmin({ store: personaStore(), turns: [[{ kind: 'team', team: TEAM }]] })
    const received: unknown[] = []
    el.onTeamDeclared((team) => received.push(team))
    await arm(el, 'edit')
    await submit(el, 'I want a support team')
    expect(received).toEqual([])
    expect((turnLogOf(el).response as { teamIgnored?: boolean }).teamIgnored).toBe(true)
  })

  it('generate mode still forwards it and logs no teamIgnored', async () => {
    const el = mountAdmin({ store: personaStore(), turns: [[{ kind: 'team', team: TEAM }]] })
    const received: unknown[] = []
    el.onTeamDeclared((team) => received.push(team))
    await arm(el, 'generate')
    await submit(el, 'I want a support team')
    expect(received).toEqual([TEAM])
    expect((turnLogOf(el).response as { teamIgnored?: boolean }).teamIgnored).toBeUndefined()
  })
})

describe('the Co-pilot kicker names the edit target', () => {
  it('reads Editing <name> in edit mode, Builder interview in generate mode and unarmed', async () => {
    const el = mountAdmin({ store: personaStore({ name: '  Concierge  ' }) })
    await whenFlushed()
    expect(kicker(el)).toBe('Builder interview')
    await arm(el, 'edit')
    expect(kicker(el)).toBe('Editing Concierge')
    el.authoringStore = undefined
    await whenFlushed()
    expect(kicker(el)).toBe('Builder interview')
    await arm(el, 'generate')
    expect(kicker(el)).toBe('Builder interview')
  })

  it('reads Editing agent when the active agent has no name', async () => {
    const el = mountAdmin({ store: personaStore({ name: '' }) })
    await arm(el, 'edit')
    expect(kicker(el)).toBe('Editing agent')
  })
})
