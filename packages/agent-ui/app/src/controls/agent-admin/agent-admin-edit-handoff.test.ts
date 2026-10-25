// agent-admin-edit-handoff.test.ts: T-0447 (agent authoring S5, Kim's F2 ruling), Chat `/edit <text>` hands
// off to Co-pilot. The remainder arms (or feeds the open session) and runs one Co-pilot turn; the `/edit`
// bubble stays in Chat and no Chat turn runs. A host with no Co-pilot path, and an empty remainder, run an
// ordinary Chat turn. Fixtures follow agent-admin-edit-session.test.ts.
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { installDialogPolyfill } from '@agent-ui/shared/testing/dialog-polyfill'
import { UIAgentAdminElement } from './agent-admin.ts'
import { createMemoryStore } from '../settings/memory-store.ts'
import type { SettingsStore } from '../settings/store.ts'
import { initialEntryValues } from './entries.ts'
import { DEFAULT_MODEL_ID, SURFACE_AUTHORING_KEY, defaultAgentConfigSchema, initialValuesFor } from './agent-admin-schema.ts'

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

const builderStore = (): SettingsStore => personaStore({ [SURFACE_AUTHORING_KEY]: true, name: 'Builder' })

/** Mount an admin whose surface runner records each turn's `session` (undefined is the Chat context). */
function mountAdmin(): { el: UIAgentAdminElement; sessions: (string | undefined)[] } {
  const sessions: (string | undefined)[] = []
  const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
  el.store = personaStore()
  el.agentSurfaceTurn = async function* (request) {
    sessions.push((request as { session?: string }).session)
    yield* []
  }
  document.body.append(el)
  mounted.push(el)
  return { el, sessions }
}

/** The page's edit arm: mode first, then the Builder store. */
function editArm(el: UIAgentAdminElement, counter: { arms: number }): () => void {
  return () => {
    counter.arms += 1
    el.authoringMode = 'edit'
    el.authoringStore = builderStore()
  }
}

async function settle(): Promise<void> {
  for (let round = 0; round < 3; round += 1) {
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0))
  }
  await whenFlushed()
}

async function submitIn(el: UIAgentAdminElement, pane: 'chat-pane' | 'copilot-pane', text: string): Promise<void> {
  await whenFlushed()
  const composer = el.querySelector(`[data-part="${pane}"] > ui-conversation-composer`) as HTMLElement & { value: string }
  composer.value = text
  const editor = composer.querySelector('[data-part="editor"]') as HTMLElement
  editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  await settle()
}

const userBubbles = (el: UIAgentAdminElement, pane: 'chat-pane' | 'copilot-pane'): string[] =>
  [...el.querySelectorAll(`[data-part="${pane}"] [data-part="log"] [data-part="bubble"][data-role="user"]`)].map((b) => (b.textContent ?? '').trim())
const primary = (el: UIAgentAdminElement): string | null => el.querySelector('[data-part="pane-holder"]')!.getAttribute('data-primary')

describe('Chat `/edit <text>` hands off to Co-pilot (F2)', () => {
  it('unarmed with onEditRequest: arms edit once, the remainder is the Co-pilot bubble, one Co-pilot turn, no Chat turn', async () => {
    const { el, sessions } = mountAdmin()
    const counter = { arms: 0 }
    el.onEditRequest(editArm(el, counter))
    await submitIn(el, 'chat-pane', '/edit make it friendlier')

    expect(counter.arms).toBe(1)
    expect(el.authoringMode).toBe('edit')
    expect(userBubbles(el, 'copilot-pane')).toEqual(['make it friendlier'])
    expect(sessions, 'one Co-pilot turn, never a Chat turn').toEqual(['authoring'])
    expect(userBubbles(el, 'chat-pane'), 'the /edit bubble stays in Chat').toEqual(['/edit make it friendlier'])
    expect(primary(el)).toBe('copilot')
  })

  it('already armed: the remainder submits into the open session without re-arming', async () => {
    const { el, sessions } = mountAdmin()
    const counter = { arms: 0 }
    el.onEditRequest(editArm(el, counter))
    await submitIn(el, 'copilot-pane', 'first ask')
    expect(counter.arms).toBe(1)
    const armedStore = el.authoringStore

    await submitIn(el, 'chat-pane', '/edit shorter replies')
    expect(counter.arms, 'no re-arm').toBe(1)
    expect(el.authoringStore).toBe(armedStore)
    expect(userBubbles(el, 'copilot-pane')).toEqual(['first ask', 'shorter replies'])
    expect(sessions).toEqual(['authoring', 'authoring'])
    expect(primary(el)).toBe('copilot')
  })

  it('a host with no Co-pilot callbacks runs `/edit x` as an ordinary Chat turn', async () => {
    const { el, sessions } = mountAdmin()
    await submitIn(el, 'chat-pane', '/edit x')
    expect(sessions).toEqual([undefined])
    expect(el.authoringStore).toBeUndefined()
    expect(userBubbles(el, 'copilot-pane')).toEqual([])
  })

  it('`/edit` with an empty remainder is an ordinary Chat turn', async () => {
    const { el, sessions } = mountAdmin()
    const counter = { arms: 0 }
    el.onEditRequest(editArm(el, counter))
    await submitIn(el, 'chat-pane', '/edit    ')
    expect(counter.arms).toBe(0)
    expect(sessions).toEqual([undefined])
  })
})
