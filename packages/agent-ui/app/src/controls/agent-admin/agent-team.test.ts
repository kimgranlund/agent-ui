import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { StorageAdapter, StorageChange } from '@agent-ui/shared'
import {
  __testSetAdapter,
  deleteAgentTeam,
  loadAgentTeam,
  loadAgentTeams,
  saveAgentTeam,
  validateAgentTeam,
  type AgentTeam,
} from './agent-team.ts'

// agent-team.test.ts — GH #1191 (ADR-0203 clause 1): the validator (validation-closed against a live
// agent-id roster) + the round-trip persistence contract, proven against an in-memory fake `StorageAdapter`
// (the `resource-idb-store.ts` test-override pattern this module's own header cites) so nothing here
// depends on a real browser localStorage.

/** A minimal in-memory `StorageAdapter` fake — enough surface for this module's own reads/writes
 *  (`get`/`set`/`delete`/`keys`); `subscribe` is omitted (optional on the interface, unused here). */
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

const GM_ID = 'agent-gm'
const MEMBER_ID = 'agent-researcher'
const KNOWN_AGENT_IDS = [GM_ID, MEMBER_ID] as const

function makeTeam(overrides: Partial<AgentTeam> = {}): AgentTeam {
  return {
    id: 'team-support',
    label: 'Support Team',
    tagline: 'Handles inbound support tickets',
    gmAgentId: GM_ID,
    members: [{ agentId: MEMBER_ID, role: 'Researcher', routingDescription: 'Use for open questions needing lookup.' }],
    ...overrides,
  }
}

describe('validateAgentTeam — ADR-0203 clause 1 / R1: validation closed against the live agent roster', () => {
  it('a well-formed team resolving every id passes with zero issues', () => {
    const result = validateAgentTeam(makeTeam(), KNOWN_AGENT_IDS)
    expect(result.valid).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('a dangling gmAgentId fails closed, naming the field', () => {
    const result = validateAgentTeam(makeTeam({ gmAgentId: 'no-such-agent' }), KNOWN_AGENT_IDS)
    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ path: 'gmAgentId', message: expect.stringContaining('no-such-agent') }),
    )
  })

  it('a dangling member agentId fails closed, naming the member index', () => {
    const result = validateAgentTeam(
      makeTeam({ members: [{ agentId: 'ghost-agent', role: 'Ghost', routingDescription: 'Never resolves.' }] }),
      KNOWN_AGENT_IDS,
    )
    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ path: 'members[0].agentId', message: expect.stringContaining('ghost-agent') }),
    )
  })

  it('reports every issue at once rather than short-circuiting on the first', () => {
    const result = validateAgentTeam(
      makeTeam({
        id: '',
        label: '',
        gmAgentId: 'missing-gm',
        members: [{ agentId: 'missing-member', role: '', routingDescription: '' }],
      }),
      KNOWN_AGENT_IDS,
    )
    expect(result.valid).toBe(false)
    const paths = result.issues.map((issue) => issue.path).sort()
    expect(paths).toEqual(
      ['gmAgentId', 'id', 'label', 'members[0].agentId', 'members[0].role', 'members[0].routingDescription'].sort(),
    )
  })

  // ── ADR-0203 Amendment (GH #1277) — optional per-member `instructions` ────────────────────────────
  it('AMENDMENT: an absent instructions field passes verbatim (every pre-amendment record parses unchanged)', () => {
    const result = validateAgentTeam(makeTeam(), KNOWN_AGENT_IDS)
    expect(result.valid).toBe(true)
  })

  it('AMENDMENT: a present, non-empty instructions field passes', () => {
    const team = makeTeam({
      members: [{ agentId: MEMBER_ID, role: 'Researcher', routingDescription: 'Use for lookups.', instructions: 'Always confirm dates before consulting.' }],
    })
    expect(validateAgentTeam(team, KNOWN_AGENT_IDS).valid).toBe(true)
  })

  it('AMENDMENT: an empty/whitespace instructions field is rejected, naming the member field', () => {
    for (const instructions of ['', '   ']) {
      const team = makeTeam({
        members: [{ agentId: MEMBER_ID, role: 'Researcher', routingDescription: 'Use for lookups.', instructions }],
      })
      const result = validateAgentTeam(team, KNOWN_AGENT_IDS)
      expect(result.valid).toBe(false)
      expect(result.issues.some((issue) => issue.path === 'members[0].instructions')).toBe(true)
    }
  })

  it('an empty members roster is structurally valid (a GM with no members yet)', () => {
    const result = validateAgentTeam(makeTeam({ members: [] }), KNOWN_AGENT_IDS)
    expect(result.valid).toBe(true)
  })
})

describe('AgentTeam persistence — round-trip (create → persist → reload), ADR-0193 StorageAdapter seam', () => {
  let adapter: StorageAdapter

  beforeEach(() => {
    adapter = createFakeAdapter()
    __testSetAdapter(adapter)
  })

  afterEach(() => {
    __testSetAdapter(undefined)
  })

  it('a saved team round-trips byte-for-byte through loadAgentTeam', async () => {
    const team = makeTeam()
    const result = await saveAgentTeam(team, KNOWN_AGENT_IDS)
    expect(result.valid).toBe(true)

    // "reload" — read it back through the SAME module-level read path a fresh page load would use,
    // never the local `team` variable, so this actually proves persistence rather than object identity.
    const reloaded = await loadAgentTeam(team.id)
    expect(reloaded).toEqual(team)
  })

  it('AMENDMENT (GH #1277): a member instructions field round-trips through persistence byte-for-byte', async () => {
    const team = makeTeam({
      members: [{ agentId: MEMBER_ID, role: 'Researcher', routingDescription: 'Use for lookups.', instructions: 'Only for on-prem dining questions.' }],
    })
    await saveAgentTeam(team, KNOWN_AGENT_IDS)
    const loaded = await loadAgentTeam(team.id)
    expect(loaded).toEqual(team)
    expect(loaded!.members[0]!.instructions).toBe('Only for on-prem dining questions.')
  })

  it('loadAgentTeams lists every persisted team', async () => {
    await saveAgentTeam(makeTeam({ id: 'team-a', label: 'Team A' }), KNOWN_AGENT_IDS)
    await saveAgentTeam(makeTeam({ id: 'team-b', label: 'Team B' }), KNOWN_AGENT_IDS)

    const teams = await loadAgentTeams()
    expect(teams.map((t) => t.id).sort()).toEqual(['team-a', 'team-b'])
  })

  it('an invalid team is rejected closed — nothing is written', async () => {
    const invalid = makeTeam({ gmAgentId: 'no-such-agent' })
    const result = await saveAgentTeam(invalid, KNOWN_AGENT_IDS)
    expect(result.valid).toBe(false)

    const reloaded = await loadAgentTeam(invalid.id)
    expect(reloaded).toBeUndefined()
    expect(await loadAgentTeams()).toEqual([])
  })

  it('a same-id save overwrites (last-write-wins), matching the imported-persona dedupe law', async () => {
    await saveAgentTeam(makeTeam({ label: 'Original label' }), KNOWN_AGENT_IDS)
    await saveAgentTeam(makeTeam({ label: 'Renamed label' }), KNOWN_AGENT_IDS)

    const teams = await loadAgentTeams()
    expect(teams).toHaveLength(1)
    expect(teams[0]?.label).toBe('Renamed label')
  })

  it('deleteAgentTeam removes a persisted team; deleting an absent id is a no-op', async () => {
    const team = makeTeam()
    await saveAgentTeam(team, KNOWN_AGENT_IDS)
    await deleteAgentTeam(team.id)
    expect(await loadAgentTeam(team.id)).toBeUndefined()

    // never throws on an id that was never persisted
    await expect(deleteAgentTeam('never-existed')).resolves.toBeUndefined()
  })

  it('a corrupt/foreign value under this namespace is skipped, never thrown on (fail-closed read)', async () => {
    await adapter.set('poison', { not: 'a team' })
    await saveAgentTeam(makeTeam(), KNOWN_AGENT_IDS)

    const teams = await loadAgentTeams()
    expect(teams).toHaveLength(1)
    expect(teams[0]?.id).toBe('team-support')
  })
})
