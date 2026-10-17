// agent-team-pane.test.ts: T-0161 review, the Team pane fails closed when its injected store fails. A
// thrown save shows inline on the form, a thrown list or remove shows on the pane, and nothing escapes as
// an unhandled rejection. jsdom: the pane only creates `ui-*` tags and reads their properties, so the
// controls need not be defined for these paths (the rendered behaviour is agent-team-pane.browser.test.ts).
import { describe, it, expect, afterEach, vi } from 'vitest'
import { buildAgentTeamPane } from './agent-team-pane.ts'
import type { AgentTeam, AgentTeamStore } from './agent-team.ts'

const team: AgentTeam = { id: 'team-a', label: 'Team A', gmAgentId: 'gm', members: [{ agentId: 'm', role: 'Helper', routingDescription: 'Use for help.' }] }

function failingStore(overrides: Partial<AgentTeamStore>): AgentTeamStore {
  return {
    list: async () => [team],
    save: async () => ({ valid: true, issues: [] }),
    remove: async () => {},
    ...overrides,
  }
}

function mount(store: AgentTeamStore): HTMLElement {
  const pane = buildAgentTeamPane({ getKnownAgents: () => [{ id: 'gm', label: 'GM' }, { id: 'm', label: 'M' }], getTeamStore: () => store })
  document.body.append(pane.host)
  void pane.refresh()
  return pane.host
}

const unhandled: unknown[] = []
const onUnhandled = (reason: unknown): void => {
  unhandled.push(reason)
}

afterEach(() => {
  document.body.replaceChildren()
  process.off('unhandledRejection', onUnhandled)
  unhandled.length = 0
})

declare const process: { on(event: string, fn: (reason: unknown) => void): void; off(event: string, fn: (reason: unknown) => void): void }

const click = (root: HTMLElement, part: string): void => {
  ;(root.querySelector(`[data-part="${part}"]`) as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('the Team pane fails closed on a failing store (T-0161 review)', () => {
  it('a thrown save shows inline on the open form, which stays open', async () => {
    process.on('unhandledRejection', onUnhandled)
    const host = mount(failingStore({ save: async () => Promise.reject(new Error('quota exceeded')) }))
    await vi.waitFor(() => expect(host.querySelector('[data-part="team-card"]')).not.toBeNull())
    click(host, 'team-card-edit')
    click(host, 'team-form-save')
    await vi.waitFor(() => expect(host.querySelector('[data-part="team-form-error"]')?.textContent).toContain('quota exceeded'))
    expect((host.querySelector('[data-part="team-form-error"]') as HTMLElement).hidden).toBe(false)
    expect((host.querySelector('[data-part="team-form"]') as HTMLElement | null)?.hidden ?? false).toBe(false)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(unhandled).toEqual([])
  })

  it('a thrown list shows on the pane, and a thrown remove does too', async () => {
    process.on('unhandledRejection', onUnhandled)
    let listFails = true
    const host = mount(
      failingStore({
        list: async () => (listFails ? Promise.reject(new Error('read failed')) : [team]),
        remove: async () => Promise.reject(new Error('delete failed')),
      }),
    )
    await vi.waitFor(() => expect(host.querySelector('[data-part="team-list-error"]')?.textContent).toContain('read failed'))
    listFails = false
    const pane = buildAgentTeamPane({ getKnownAgents: () => [], getTeamStore: () => failingStore({ remove: async () => Promise.reject(new Error('delete failed')) }) })
    document.body.append(pane.host)
    await pane.refresh()
    expect((pane.host.querySelector('[data-part="team-list-error"]') as HTMLElement).hidden).toBe(true)
    click(pane.host, 'team-card-delete')
    await vi.waitFor(() => expect(pane.host.querySelector('[data-part="team-list-error"]')?.textContent).toContain('delete failed'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(unhandled).toEqual([])
  })
})
