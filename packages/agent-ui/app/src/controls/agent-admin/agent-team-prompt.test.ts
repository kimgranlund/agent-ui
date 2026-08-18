// agent-team-prompt.test.ts — GH #1194 (ADR-0203 clause 2, req-agent-teams.md R2): `composeTeamPromptSection`'s
// own byte-stable snapshot for a pinned 3-member team, plus its member-missing degrade and its empty-roster
// gated-equivalence. The `composeSystemPrompt` WIRING gate (`isTeamGm`, the no-team byte-identical property)
// is covered in `entries.test.ts` alongside every other `composeSystemPrompt` property — this file owns only
// the new module's own pure-function contract.

import { describe, it, expect } from 'vitest'
import { composeTeamPromptSection, isTeamGm, type TeamMemberSnapshot, type TeamPromptContext } from './agent-team-prompt.ts'
import type { AgentTeam } from './agent-team.ts'

const PINNED_TEAM: AgentTeam = {
  id: 'support-team',
  label: 'Support Team',
  gmAgentId: 'gm-agent',
  members: [
    { agentId: 'billing-agent', role: 'Billing specialist', routingDescription: 'Route billing, invoice, and refund questions here.' },
    { agentId: 'tech-agent', role: 'Technical support', routingDescription: 'Route bug reports and how-to technical questions here.' },
    { agentId: 'sales-agent', role: 'Sales specialist', routingDescription: 'Route pricing and upgrade questions here.' },
  ],
}

const PINNED_SNAPSHOTS: TeamMemberSnapshot[] = [
  { agentId: 'billing-agent', name: 'Billie' },
  { agentId: 'tech-agent', name: 'Techie' },
  { agentId: 'sales-agent', name: 'Sasha' },
]

const PINNED_OUTPUT =
  '## Your team\n' +
  "You lead the team below. When a request matches a teammate's routing rule, you may say you are consulting " +
  'them, but nothing here dispatches automatically — continue the conversation yourself, drawing on their role ' +
  'and routing rule as guidance for what to say and when.\n\n' +
  '- **Billie** (Billing specialist): Route billing, invoice, and refund questions here.\n' +
  '- **Techie** (Technical support): Route bug reports and how-to technical questions here.\n' +
  '- **Sasha** (Sales specialist): Route pricing and upgrade questions here.'

describe('composeTeamPromptSection (ADR-0203 cl.2 / req-agent-teams.md R2)', () => {
  it('BYTE-STABLE for a pinned 3-member team + full memberSnapshots — the acceptance-criterion snapshot', () => {
    expect(composeTeamPromptSection(PINNED_TEAM, PINNED_SNAPSHOTS)).toBe(PINNED_OUTPUT)
  })

  it('is deterministic across repeated calls with the same input (no hidden mutable state)', () => {
    const first = composeTeamPromptSection(PINNED_TEAM, PINNED_SNAPSHOTS)
    const second = composeTeamPromptSection(PINNED_TEAM, PINNED_SNAPSHOTS)
    expect(first).toBe(second)
  })

  it('member order follows the team\'s own declared roster order, never re-sorted', () => {
    const out = composeTeamPromptSection(PINNED_TEAM, PINNED_SNAPSHOTS)
    expect(out.indexOf('Billie')).toBeLessThan(out.indexOf('Techie'))
    expect(out.indexOf('Techie')).toBeLessThan(out.indexOf('Sasha'))
  })

  it('MEMBER-MISSING: a member with no matching memberSnapshots entry falls back to its bare agentId, never thrown, never dropped', () => {
    const team: AgentTeam = {
      id: 'partial-team',
      label: 'Partial Team',
      gmAgentId: 'gm-agent',
      members: [
        { agentId: 'known-agent', role: 'Known role', routingDescription: 'Known routing rule.' },
        { agentId: 'ghost-agent', role: 'Unknown role', routingDescription: 'Unknown routing rule.' },
      ],
    }
    const snapshots: TeamMemberSnapshot[] = [{ agentId: 'known-agent', name: 'Known Name' }]
    expect(() => composeTeamPromptSection(team, snapshots)).not.toThrow()
    const out = composeTeamPromptSection(team, snapshots)
    expect(out).toContain('- **Known Name** (Known role): Known routing rule.')
    // the missing member is never silently dropped — it renders using its bare agentId as a fallback name
    expect(out).toContain('- **ghost-agent** (Unknown role): Unknown routing rule.')
  })

  it('an entirely empty memberSnapshots array degrades every member to its bare agentId, never throwing', () => {
    expect(() => composeTeamPromptSection(PINNED_TEAM, [])).not.toThrow()
    const out = composeTeamPromptSection(PINNED_TEAM, [])
    expect(out).toContain('- **billing-agent** (Billing specialist)')
    expect(out).toContain('- **tech-agent** (Technical support)')
    expect(out).toContain('- **sales-agent** (Sales specialist)')
  })

  it('EMPTY ROSTER (gated equivalence): a team with zero members composes to the empty string', () => {
    const emptyTeam: AgentTeam = { id: 'empty-team', label: 'Empty Team', gmAgentId: 'gm-agent', members: [] }
    expect(composeTeamPromptSection(emptyTeam, [])).toBe('')
  })
})

describe('isTeamGm (ADR-0203 cl.2 — the composeSystemPrompt wiring gate)', () => {
  const context = (activeAgentId: string): TeamPromptContext => ({
    team: PINNED_TEAM,
    activeAgentId,
    memberSnapshots: PINNED_SNAPSHOTS,
  })

  it('true iff the active agent IS the team\'s own gmAgentId', () => {
    expect(isTeamGm(context('gm-agent'))).toBe(true)
  })

  it('false for any non-GM agent, including a member of the SAME team', () => {
    expect(isTeamGm(context('billing-agent'))).toBe(false)
    expect(isTeamGm(context('some-unrelated-agent'))).toBe(false)
  })
})
