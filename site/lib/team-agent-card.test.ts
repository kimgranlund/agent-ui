// site/lib/team-agent-card.test.ts — the R3 acceptance gate (req-agent-teams.md, GH #1195): mapped
// cards pass the existing `@agent-ui/a2a` validators, proven against the SAME sample
// `site/pages/agent-schema.ts`'s own `AGENT_CONFIG_SNAPSHOT_SAMPLE` names. That constant is a
// page-local const (not exported — it feeds a live DOM table on module load), so this suite
// reproduces its literal field values rather than importing the page module itself; both sites are
// independently typed against the SAME `AgentConfigSnapshot` interface, so a field the interface
// gains or drops fails `npm run check:site` at BOTH sites, not silently at one.
import { describe, it, expect } from 'vitest'
import { DEFAULT_MODEL_ID, type AgentConfigSnapshot } from '@agent-ui/app/agent-admin-schema'
import { validateA2a, PROTOCOL_VERSION } from '@agent-ui/a2a'
import { teamMemberToAgentCard } from './team-agent-card.ts'

const AGENT_CONFIG_SNAPSHOT_SAMPLE: AgentConfigSnapshot = {
  name: 'Ada',
  model: DEFAULT_MODEL_ID,
  temperature: 0.7,
  toolsEnabled: true,
  systemPrompt: 'You are a careful, concise research assistant.',
  skills: ['Summarizing'],
  workflows: ['Weekly report'],
  resources: ['Style guide'],
  tools: ['Web search'],
}

describe('teamMemberToAgentCard — R3 mapping (ADR-0203 clause 3)', () => {
  it('maps AGENT_CONFIG_SNAPSHOT_SAMPLE to a card that passes the @agent-ui/a2a validator (R3 acceptance)', () => {
    const card = teamMemberToAgentCard(AGENT_CONFIG_SNAPSHOT_SAMPLE)
    expect(validateA2a(card, { protocolVersion: PROTOCOL_VERSION, expect: 'card' })).toEqual([])
  })

  it('pins protocolVersion to the shipped 0.3.0 pin (ADR-0203 Non-goals: no version bump in this arc)', () => {
    expect(teamMemberToAgentCard(AGENT_CONFIG_SNAPSHOT_SAMPLE).protocolVersion).toBe('0.3.0')
    expect(PROTOCOL_VERSION).toBe('0.3.0')
  })

  it('carries name/description straight from the agent record (R3: "name/description from the agent record")', () => {
    const card = teamMemberToAgentCard(AGENT_CONFIG_SNAPSHOT_SAMPLE)
    expect(card.name).toBe('Ada')
    expect(card.description).toBe('You are a careful, concise research assistant.')
  })

  it('maps enabled skill + workflow labels to skills[], tagged by kind (R3: "A2aAgentSkill.tags from kind")', () => {
    const card = teamMemberToAgentCard(AGENT_CONFIG_SNAPSHOT_SAMPLE)
    expect(card.skills.map((s) => s.name)).toEqual(['Summarizing', 'Weekly report'])
    expect(card.skills.map((s) => s.tags)).toEqual([['skill'], ['workflow']])
  })

  it('does not map resources/tools into skills[] — turn-time capabilities, not A2A-discoverable skills', () => {
    const names = teamMemberToAgentCard(AGENT_CONFIG_SNAPSHOT_SAMPLE).skills.map((s) => s.name)
    expect(names).not.toContain('Style guide')
    expect(names).not.toContain('Web search')
  })

  it('every skill id is unique and non-empty across both the skill and workflow kinds', () => {
    const ids = teamMemberToAgentCard(AGENT_CONFIG_SNAPSHOT_SAMPLE).skills.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id.length).toBeGreaterThan(0)
  })

  it('negative control: a snapshot with no skills/workflows maps to an empty skills[] — still a valid card', () => {
    const empty: AgentConfigSnapshot = { ...AGENT_CONFIG_SNAPSHOT_SAMPLE, skills: [], workflows: [] }
    const card = teamMemberToAgentCard(empty)
    expect(card.skills).toEqual([])
    expect(validateA2a(card, { protocolVersion: PROTOCOL_VERSION, expect: 'card' })).toEqual([])
  })

  it('negative control: a same-named skill and workflow label produce two DISTINCT skill ids, not a collision', () => {
    const collision: AgentConfigSnapshot = { ...AGENT_CONFIG_SNAPSHOT_SAMPLE, skills: ['Reporting'], workflows: ['Reporting'] }
    const card = teamMemberToAgentCard(collision)
    const ids = card.skills.map((s) => s.id)
    expect(new Set(ids).size).toBe(2)
  })
})
