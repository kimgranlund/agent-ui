// agent-team-pane.browser.test.ts — GH #1197 (ADR-0203 cl.1 / req-agent-teams.md R5): the Team pane's own
// CRUD proof, standalone (no `ui-agent-admin` involved — the `entry-list.browser.test.ts` precedent this
// pane's own header cites): create → persist → reload renders the roster; edit updates in place; delete
// removes; a validation-closed save (an unresolved `agentId`) refuses to persist and surfaces every issue
// inline; a member whose agent was deleted from the roster flags as dangling rather than being dropped.
//
// Real engine, not jsdom: `ui-select`'s option adoption/listbox popover and `ui-button`'s real click all
// need real layout/ARIA machinery jsdom cannot resolve (the same reason entry-list has no jsdom-side CRUD
// suite of its own, only this file's shape).

import { describe, it, expect, afterEach } from 'vitest'

import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css' // ui-button/ui-icon/ui-text-field/ui-field/ui-select's shipped CSS

import '@agent-ui/components/controls/button'
import '@agent-ui/components/controls/icon'
import '@agent-ui/components/controls/text-field'
import '@agent-ui/components/controls/field'
import '@agent-ui/components/controls/select'

import { buildAgentTeamPane, type KnownAgent } from './agent-team-pane.ts'
import { __testSetAdapter, loadAgentTeams } from './agent-team.ts'
import type { StorageAdapter, StorageChange } from '@agent-ui/shared'

/** The SAME in-memory fake `agent-team.test.ts` already uses — this file's own module-scope import means
 *  a fresh Map per test (via `beforeEach`-equivalent local re-creation), never real browser localStorage
 *  bleeding state across runs. */
function createFakeAdapter(): StorageAdapter {
  const values = new Map<string, unknown>()
  return {
    async get(key) {
      return values.get(key)
    },
    async set(key, value) {
      values.set(key, value)
    },
    async delete(key) {
      values.delete(key)
    },
    async keys() {
      return [...values.keys()]
    },
    subscribe(_listener: (change: StorageChange) => void) {
      return () => {}
    },
  }
}

const AGENTS: KnownAgent[] = [
  { id: 'agent-gm', label: 'GM Agent' },
  { id: 'agent-researcher', label: 'Rosa' },
]

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
  __testSetAdapter(undefined)
})

function mountPane(agents: readonly KnownAgent[] = AGENTS): ReturnType<typeof buildAgentTeamPane> {
  __testSetAdapter(createFakeAdapter())
  const pane = buildAgentTeamPane({ getKnownAgents: () => agents })
  document.body.append(pane.host)
  mounted.push(pane.host)
  return pane
}

function click(host: ParentNode, selector: string): void {
  ;(host.querySelector(selector) as HTMLElement).click()
}

function setValue(host: ParentNode, selector: string, value: string): void {
  ;(host.querySelector(selector) as HTMLElement & { value: string }).value = value
}

/** Poll a predicate — the repo's own `agent-admin.test.ts` `waitFor` shape, used here because the pane's
 *  save/delete handlers are `void (async () => {...})()` fire-and-forget: a fixed microtask-tick count is
 *  the exact brittleness this avoids (a differently-shaped await chain inside `saveAgentTeam`/
 *  `loadAgentTeams` needs a different tick count, and nothing here should have to know that number). */
async function waitFor(predicate: () => boolean, label: string): Promise<void> {
  for (let i = 0; i < 200; i += 1) {
    if (predicate()) return
    await Promise.resolve()
  }
  throw new Error(`waitFor timed out: ${label}`)
}

describe('buildAgentTeamPane — CRUD (GH #1197)', () => {
  it('renders empty with zero persisted teams', async () => {
    const pane = mountPane()
    await pane.refresh()
    expect(pane.host.querySelectorAll('[data-part="team-card"]')).toHaveLength(0)
  })

  it('create → persist → reload renders the roster (label, tagline, GM, member role/routing)', async () => {
    const pane = mountPane()
    await pane.refresh()

    click(pane.host, '[data-part="team-add-toggle"]')
    setValue(pane.host, '[data-part="team-form-label"]', 'Support Team')
    setValue(pane.host, '[data-part="team-form-tagline"]', 'Handles inbound tickets')
    setValue(pane.host, '[data-part="team-form-gm"]', 'agent-gm')
    click(pane.host, '[data-part="team-form-add-member"]')
    setValue(pane.host, '[data-part="team-form-member-agent"]', 'agent-researcher')
    setValue(pane.host, '[data-part="team-form-member-role"]', 'Researcher')
    setValue(pane.host, '[data-part="team-form-member-routing"]', 'Use for open questions needing lookup.')
    click(pane.host, '[data-part="team-form-save"]')
    await waitFor(() => pane.host.querySelector('[data-part="team-card"]') !== null, 'the saved team rendered')

    // Persisted for real (not just in the pane's own in-memory render list) — a fresh `loadAgentTeams()`
    // read, independent of this pane instance, sees the SAME record.
    const teams = await loadAgentTeams()
    expect(teams).toHaveLength(1)
    expect(teams[0]).toMatchObject({
      label: 'Support Team',
      tagline: 'Handles inbound tickets',
      gmAgentId: 'agent-gm',
      members: [{ agentId: 'agent-researcher', role: 'Researcher', routingDescription: 'Use for open questions needing lookup.' }],
    })

    const card = pane.host.querySelector('[data-part="team-card"]') as HTMLElement
    expect(card).not.toBeNull()
    expect(card.querySelector('[data-part="team-card-title"]')?.textContent).toBe('Support Team')
    expect(card.querySelector('[data-part="team-card-tagline"]')?.textContent).toBe('Handles inbound tickets')
    expect(card.querySelector('[data-part="team-card-gm"]')?.textContent).toBe('GM: GM Agent')
    expect(card.querySelector('[data-part="team-card-member-row"]')?.textContent).toBe(
      'Researcher: Rosa — Use for open questions needing lookup.',
    )
    // The form closed and reset on a successful save.
    expect((pane.host.querySelector('[data-part="team-form"]') as HTMLElement).hidden).toBe(true)
  })

  it('a validation-closed save (no GM picked) refuses to persist and surfaces the issue inline', async () => {
    const pane = mountPane()
    await pane.refresh()

    click(pane.host, '[data-part="team-add-toggle"]')
    setValue(pane.host, '[data-part="team-form-label"]', 'Broken Team')
    // No GM select — `gmSelect.value` stays '' (required, per `validateAgentTeam`).
    click(pane.host, '[data-part="team-form-save"]')
    const errorNote = pane.host.querySelector('[data-part="team-form-error"]') as HTMLElement
    await waitFor(() => !errorNote.hidden, 'the rejection surfaced its error note')

    expect(await loadAgentTeams(), 'nothing persisted on a rejected save').toHaveLength(0)
    expect(errorNote.hidden, 'the error list is now visible').toBe(false)
    expect(errorNote.textContent).toContain('gmAgentId')
    // The form stays OPEN with the typed label intact — the entry-list.ts `submitAdd` MAJOR-fix law.
    expect((pane.host.querySelector('[data-part="team-form"]') as HTMLElement).hidden).toBe(false)
    expect((pane.host.querySelector('[data-part="team-form-label"]') as HTMLElement & { value: string }).value).toBe('Broken Team')
  })

  it('edit updates the same team in place (no second record minted)', async () => {
    const pane = mountPane()
    await pane.refresh()
    click(pane.host, '[data-part="team-add-toggle"]')
    setValue(pane.host, '[data-part="team-form-label"]', 'Original Name')
    setValue(pane.host, '[data-part="team-form-gm"]', 'agent-gm')
    click(pane.host, '[data-part="team-form-save"]')
    await waitFor(() => pane.host.querySelector('[data-part="team-card-title"]')?.textContent === 'Original Name', 'the original save rendered')

    click(pane.host, '[data-part="team-card-edit"]')
    setValue(pane.host, '[data-part="team-form-label"]', 'Renamed Team')
    click(pane.host, '[data-part="team-form-save"]')
    await waitFor(() => pane.host.querySelector('[data-part="team-card-title"]')?.textContent === 'Renamed Team', 'the rename rendered')

    const teams = await loadAgentTeams()
    expect(teams, 'still exactly one record — the SAME id, relabeled').toHaveLength(1)
    expect(teams[0]!.label).toBe('Renamed Team')
    expect(pane.host.querySelector('[data-part="team-card-title"]')?.textContent).toBe('Renamed Team')
  })

  it('delete removes the persisted record and its rendered card', async () => {
    const pane = mountPane()
    await pane.refresh()
    click(pane.host, '[data-part="team-add-toggle"]')
    setValue(pane.host, '[data-part="team-form-label"]', 'Doomed Team')
    setValue(pane.host, '[data-part="team-form-gm"]', 'agent-gm')
    click(pane.host, '[data-part="team-form-save"]')
    await waitFor(() => pane.host.querySelector('[data-part="team-card"]') !== null, 'the saved team rendered')
    expect(await loadAgentTeams()).toHaveLength(1)

    click(pane.host, '[data-part="team-card-delete"]')
    await waitFor(() => pane.host.querySelector('[data-part="team-card"]') === null, 'the deleted card is gone')

    expect(await loadAgentTeams()).toHaveLength(0)
    expect(pane.host.querySelectorAll('[data-part="team-card"]')).toHaveLength(0)
  })

  it('R5 acceptance: a member whose agent left the roster flags as dangling, never silently drops', async () => {
    // A live-mutable roster array — `getKnownAgents` reads it AT INVOKE TIME (never captured once), the
    // same law the pane's own `#pendingRoster`-consuming caller (agent-admin.ts) follows.
    let agents: KnownAgent[] = AGENTS
    __testSetAdapter(createFakeAdapter())
    const pane = buildAgentTeamPane({ getKnownAgents: (): readonly KnownAgent[] => agents })
    document.body.append(pane.host)
    mounted.push(pane.host)
    await pane.refresh()

    click(pane.host, '[data-part="team-add-toggle"]')
    setValue(pane.host, '[data-part="team-form-label"]', 'Support Team')
    setValue(pane.host, '[data-part="team-form-gm"]', 'agent-gm')
    click(pane.host, '[data-part="team-form-add-member"]')
    setValue(pane.host, '[data-part="team-form-member-agent"]', 'agent-researcher')
    setValue(pane.host, '[data-part="team-form-member-role"]', 'Researcher')
    setValue(pane.host, '[data-part="team-form-member-routing"]', 'Ask about anything open.')
    click(pane.host, '[data-part="team-form-save"]')
    await waitFor(() => pane.host.querySelector('[data-part="team-card-member-row"]') !== null, 'the saved team + member rendered')

    // The researcher agent is removed from the KNOWN roster (deleted elsewhere) — nothing re-saves the
    // team itself (R5's own law: `loadAgentTeams` never re-validates on read); refresh the pane's render.
    agents = [{ id: 'agent-gm', label: 'GM Agent' }]
    await pane.refresh()

    const row = pane.host.querySelector('[data-part="team-card-member-row"]') as HTMLElement
    expect(row, 'the member row is STILL rendered, never dropped').not.toBeNull()
    expect(row.getAttribute('data-dangling')).toBe('true')
    expect(row.textContent).toContain('agent-researcher (missing agent)')
  })
})
