// agent-admin-app-team.test.ts — GH #1196 (ADR-0203 clause 4): the Builder's team-shaped generation
// path's own mint+validate+save logic, driven on the REAL page module (a side-effect import, the
// agent-admin-app-drawer.test.ts precedent — its own file, its own document, so this file's mount
// collides with nothing). `handleTeamDeclared`/`mintTeamId` are exported (unlike this page's other mint
// helpers, e.g. `createGeneratedAgent`) precisely because they carry real branching logic — structural
// pre-validation, multi-persona mint, collision-safe id minting, validate-before-save — that earns a
// direct unit test rather than only a browser-click wiring smoke (this page's OTHER handlers carry none
// of that logic, so a click proving the wiring exists is already the whole proof for them).
//
// This is R4's own acceptance (req-agent-teams.md), realized directly: a scripted interview transcript
// (here, one declared TeamDeclaration standing in for the whole gathered roster — the component-level
// proof that the WIRE actually reaches this callback lives in
// packages/…/agent-admin-authoring.test.ts's own `team` consumption suite) produces ≥2 member agents +
// 1 GM + 1 team record in the store, every member's routingDescription non-empty, and the single-agent
// flow is unaffected (nothing here runs, and no team ever exists, unless this function is called).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { installDialogPolyfill } from '@agent-ui/shared/testing/dialog-polyfill'
import { personaRoster } from './agent-admin-presets.ts'
import { __testSetAdapter, loadAgentTeams } from '@agent-ui/app/agent-admin-team'
// `mintTeamId`/`handleTeamDeclared` are deliberately NOT statically imported here: a static import of
// `./agent-admin-app.ts` (even just for one named export) hoists and evaluates that page module's own
// side effects — mounting the real `ui-agent-admin`, connecting every one of the active persona's entry
// rows — BEFORE this file's own `beforeAll` ever installs the jsdom stubs below, which is exactly what
// left every `ui-code-editor` row connecting through the UNPATCHED `attachInternals` (measured: 119
// uncaught `setFormValue is not a function` exceptions from a plain top-level `import {mintTeamId} from
// './agent-admin-app.ts'`). Both symbols are reached via the SAME dynamic `await import(...)` the
// agent-admin-app-drawer.test.ts precedent already uses, strictly AFTER the stubs are live.
let mintTeamId: (label: string, takenIds: ReadonlySet<string>) => string
let handleTeamDeclared: (team: { label: string; tagline?: string; members: { name: string; role: string; routingDescription: string }[] }) => Promise<void>
let pageModule: typeof import('./agent-admin-app.ts')

// ── the jsdom stubs (installed BEFORE the page module boots — it mounts at import time), the
// agent-admin-app-drawer.test.ts precedent verbatim ─────────────────────────────────────────────────────
let realAttachInternals: typeof HTMLElement.prototype.attachInternals

beforeAll(async () => {
  realAttachInternals = HTMLElement.prototype.attachInternals
  HTMLElement.prototype.attachInternals = function (this: HTMLElement): ElementInternals {
    const internals = realAttachInternals.call(this) as unknown as Record<string, unknown>
    if (typeof internals.setFormValue !== 'function') internals.setFormValue = () => {}
    if (typeof internals.setValidity !== 'function') internals.setValidity = () => {}
    return internals as unknown as ElementInternals
  }
  installDialogPolyfill() // jsdom has no native <dialog> modal surface at all

  // The Popover API (toast-region.test.ts's stub) — the page's `notify()` region calls showPopover on show.
  const popover = HTMLElement.prototype as unknown as { showPopover?: () => void; hidePopover?: () => void }
  if (typeof popover.showPopover !== 'function') {
    const shown = new WeakSet<HTMLElement>()
    popover.showPopover = function (this: HTMLElement): void {
      shown.add(this)
    }
    popover.hidePopover = function (this: HTMLElement): void {
      shown.delete(this)
    }
  }

  const mod = await import('./agent-admin-app.ts')
  pageModule = mod
  mintTeamId = mod.mintTeamId
  handleTeamDeclared = mod.handleTeamDeclared
  await mod.bootProbeSettled // GH #1767 — the page's boot probe settles inside the file, not during teardown
})

afterAll(() => {
  HTMLElement.prototype.attachInternals = realAttachInternals
})

const agentSelect = (): HTMLElement & { value: string } =>
  (document.querySelector('ui-agent-admin') as HTMLElement).querySelector('[data-part="agent-select"]') as HTMLElement & { value: string }
const rosterIds = (): string[] =>
  [...agentSelect().querySelectorAll('[role="option"]')].map((o) => o.getAttribute('value') ?? '').filter((v) => !v.startsWith('agent-admin:'))

describe('mintTeamId — a kebab id, suffixed only on a real collision', () => {
  it('slugs the label', () => {
    expect(mintTeamId('Hotel Concierge Team', new Set())).toBe('hotel-concierge-team')
  })

  it('suffixes on collision, never on the first mint', () => {
    expect(mintTeamId('Support Team', new Set(['support-team']))).toBe('support-team-2')
    expect(mintTeamId('Support Team', new Set(['support-team', 'support-team-2']))).toBe('support-team-3')
  })

  it('a blank/symbol-only label degrades to "team" rather than an empty id', () => {
    expect(mintTeamId('!!!', new Set())).toBe('team')
  })
})

describe('handleTeamDeclared — mint N members + designate the GM + save a validated AgentTeam (GH #1196, R4 acceptance)', () => {
  it('the single-agent flow leaves zero teams — nothing here fires unless a team is actually declared', async () => {
    expect(await loadAgentTeams()).toEqual([])
  })

  it('mints ≥2 member personas, designates the currently-active persona as GM, and persists a validated AgentTeam naming both', async () => {
    const gmIdBefore = agentSelect().value
    const beforeIds = rosterIds()

    await handleTeamDeclared({
      label: 'Hotel Concierge Team',
      tagline: 'Guest-facing crew',
      members: [
        { name: 'Amenities', role: 'Amenities specialist', routingDescription: 'Use for pool/gym/spa hour questions.' },
        { name: 'Food & Drink', role: 'Dining concierge', routingDescription: 'Use for restaurant bookings and room service.' },
      ],
    })

    // ≥2 member agents landed in the REAL roster picker (not just an internal array).
    const afterIds = rosterIds()
    const newIds = afterIds.filter((id) => !beforeIds.includes(id))
    expect(newIds.length, 'two new members minted').toBe(2)
    const roster = personaRoster()
    const minted = newIds.map((id) => roster.find((p) => p.id === id)!)
    expect(minted.every((p) => p !== undefined), 'every minted id resolves to a real persisted persona').toBe(true)
    expect(minted.map((p) => p.label).sort()).toEqual(['Amenities', 'Food & Drink'])

    // 1 team record, naming the GM (the persona active BEFORE the team-shaped ask) + both members, each
    // routingDescription non-empty (R4's own acceptance wording).
    const teams = await loadAgentTeams()
    const team = teams.find((t) => t.label === 'Hotel Concierge Team')
    expect(team, 'the AgentTeam record was saved').toBeDefined()
    expect(team!.tagline).toBe('Guest-facing crew')
    expect(team!.gmAgentId, 'the GM is the persona already active when the ask was recognized').toBe(gmIdBefore)
    expect(team!.members).toHaveLength(2)
    for (const member of team!.members) {
      expect(newIds, 'every member agentId resolves to one of the newly-minted personas').toContain(member.agentId)
      expect(member.routingDescription.length, 'every routingDescription is non-empty').toBeGreaterThan(0)
      expect(member.role.length).toBeGreaterThan(0)
    }
  })

  it('a structurally incomplete declaration (a blank routingDescription) mints and saves NOTHING — validated before any mint at all', async () => {
    const beforeIds = rosterIds()
    const beforeTeamCount = (await loadAgentTeams()).length

    await handleTeamDeclared({
      label: 'Broken Team',
      members: [{ name: 'Ghost', role: 'Nobody', routingDescription: '   ' }], // whitespace-only ⇒ blank
    })

    expect(rosterIds(), 'no persona was minted').toEqual(beforeIds)
    expect((await loadAgentTeams()).length, 'no team record was saved').toBe(beforeTeamCount)
  })

  it('a declaration with zero members mints and saves NOTHING', async () => {
    const beforeIds = rosterIds()
    const beforeTeamCount = (await loadAgentTeams()).length

    await handleTeamDeclared({ label: 'Empty Team', members: [] })

    expect(rosterIds()).toEqual(beforeIds)
    expect((await loadAgentTeams()).length).toBe(beforeTeamCount)
  })
})

// ── T-0161: the Team pane and the Builder write teams through the SAME mutation ───────────────────────
describe('one team write path: the Team pane and handleTeamDeclared share the teams resource mutations (T-0161)', () => {
  it('the page registers its team store on the admin; a save through it and a Builder declaration both run the one save mutation', async () => {
    const run = vi.spyOn(pageModule.teamMutations.save, 'run')
    const known = personaRoster().map((p) => p.id)
    const result = await pageModule.teamStore.save(
      { id: 'pane-team', label: 'Pane Team', gmAgentId: known[0]!, members: [{ agentId: known[1]!, role: 'Helper', routingDescription: 'Use for help.' }] },
      known,
    )
    expect(result.valid).toBe(true)
    expect(run).toHaveBeenCalledTimes(1)
    expect((await loadAgentTeams()).some((t) => t.id === 'pane-team')).toBe(true)
    // The admin's Team pane reads the same store: its list re-renders from the resource change.
    await vi.waitFor(() => {
      const titles = [...document.querySelectorAll('[data-part="team-card-title"]')].map((el) => el.textContent)
      expect(titles).toContain('Pane Team')
    })

    await handleTeamDeclared({ label: 'Builder Team', members: [{ name: 'Scout', role: 'Scout', routingDescription: 'Use to look around.' }] })
    expect(run, 'the Builder path rides the same mutation').toHaveBeenCalledTimes(2)

    const refused = await pageModule.teamStore.save({ id: 'bad', label: 'Bad', gmAgentId: 'nobody', members: [] }, known)
    expect(refused.valid, 'a refusal comes back as issues, nothing lands').toBe(false)
    expect((await loadAgentTeams()).some((t) => t.id === 'bad')).toBe(false)

    await pageModule.teamStore.remove('pane-team')
    expect((await loadAgentTeams()).some((t) => t.id === 'pane-team')).toBe(false)
    run.mockRestore()
  })
})

describe('the page team store fails closed and gives each save its own result (T-0161 review)', () => {
  it('concurrent saves each get their own validation result', async () => {
    const known = personaRoster().map((p) => p.id)
    const good = { id: 'good-concurrent', label: 'Good', gmAgentId: known[0]!, members: [{ agentId: known[1]!, role: 'R', routingDescription: 'Use it.' }] }
    const bad = { id: 'bad-concurrent', label: 'Bad', gmAgentId: 'nobody', members: [] }
    const results = await Promise.all([pageModule.teamStore.save(bad, known), pageModule.teamStore.save(good, known), pageModule.teamStore.save(bad, known)])
    expect(results.map((r) => r.valid)).toEqual([false, true, false])
    expect(results[0]!.issues.length).toBeGreaterThan(0)
    await pageModule.teamStore.remove('good-concurrent')
  })

  it('list() keeps the last good list and shows an error while the teams resource is in error, never a rejection', async () => {
    const before = await pageModule.teamStore.list()
    __testSetAdapter({
      get: async () => undefined,
      set: async () => {},
      delete: async () => {},
      keys: async () => Promise.reject(new Error('storage unavailable')),
    })
    try {
      await handleTeamDeclared({ label: 'Doomed Team', members: [{ name: 'X', role: 'X', routingDescription: 'Use X.' }] }) // its refetch puts the resource in error
      await expect(pageModule.teamStore.list()).resolves.toEqual(before)
      await vi.waitFor(() => expect(document.querySelector('ui-toast-region')?.textContent ?? '').toContain('showing the last list loaded'))
    } finally {
      __testSetAdapter(undefined)
    }
  })
})
