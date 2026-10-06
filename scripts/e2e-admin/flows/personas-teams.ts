// scripts/e2e-admin/flows/personas-teams.ts: persona-switch session and team-validation flows.

import { openAdmin, pollUntil, type AdminPage } from '../admin-page.ts'
import type { AdminFlow, FlowContext } from '../runner.ts'
import { assertFlow } from '../scenario.ts'

const TEAMS_PREFIX = 'agent-ui-agent-teams.'

/** Each produce request's `input.session.turns` length (`undefined` when the request carries none). */
function produceSessionTurns(wire: FlowContext['wire']): (number | undefined)[] {
  return wire.entries
    .filter((e) => e.endpoint === 'produce')
    .map((e) => {
      const turns = (e.request as { input?: { session?: { turns?: unknown } } } | undefined)?.input?.session?.turns
      return Array.isArray(turns) ? turns.length : undefined
    })
}

/** Send one Test Chat turn and wait until it has landed. */
async function testChatTurn(admin: AdminPage, text: string): Promise<void> {
  const since = await admin.liveTurnCount()
  await admin.sendTestChat(text)
  await admin.waitForTurn(since)
}

/** One Test Chat turn on the default agent, then a persona switch: the turn count and the Test Chat
 *  transcript reset, and the next produce request starts a fresh session (the page re-arms one runner per
 *  persona). */
export const personaSwitchFreshSession: AdminFlow = {
  name: 'persona-switch-fresh-session',
  fixture: 'persona-switch-fresh-session.json',
  async run({ page, wire, scenario, base }) {
    const admin = await openAdmin(page, base, scenario)
    const start = await admin.activeAgentId()
    assertFlow(start === 'croupier', `active agent is "${start}", expected the shipped default "croupier"`)
    await testChatTurn(admin, 'first turn')
    const before = await admin.readTestTranscript()
    assertFlow(before.length === 2, `testChatTranscript() has ${before.length} entries after one turn, expected 2`)

    await admin.switchPersona('quant')
    const count = await admin.liveTurnCount()
    assertFlow(count === 0, `liveTurnCount() is ${count} after the switch, expected 0`)
    const cleared = await admin.readTestTranscript()
    assertFlow(cleared.length === 0, `testChatTranscript() has ${cleared.length} entries after the switch, expected none`)

    await testChatTurn(admin, 'second turn')
    const sessions = produceSessionTurns(wire)
    assertFlow(sessions.length === 2, `wire log holds ${sessions.length} produce entries, expected 2`)
    assertFlow(
      sessions[1] === 0,
      `the produce request after the switch carries input.session.turns of length ${sessions[1]}, expected 0 (sessions ${JSON.stringify(sessions)})`,
    )
    const after = await admin.readTestTranscript()
    assertFlow(
      after.length === 2 && after[1]?.content.includes('Scripted quant note'),
      `testChatTranscript() is ${JSON.stringify(after)} after the second turn, expected only the quant exchange`,
    )
  },
}

/** An armed Builder turn declares a team whose member has a blank `routingDescription`: no team record is
 *  stored and the header roster gains no member personas. */
export const teamsValidateIncomplete: AdminFlow = {
  name: 'teams-validate-incomplete',
  fixture: 'teams-validate-incomplete.json',
  async run({ page, scenario, base }) {
    const admin = await openAdmin(page, base, scenario)
    const before = await admin.activeAgentId()
    await admin.newAgent()
    await pollUntil(() => admin.isAuthoringArmed(), (armed) => armed, 'the Builder to arm (authoringStore set)')
    await pollUntil(() => admin.activeAgentId(), (id) => id !== '' && id !== before, `the active agent to move off "${before}"`)
    const rosterBefore = await admin.rosterIds()
    const teamsBefore = await admin.readStorageWithPrefix(TEAMS_PREFIX)
    assertFlow(Object.keys(teamsBefore).length === 0, `${TEAMS_PREFIX}* keys exist before the turn: ${JSON.stringify(Object.keys(teamsBefore))}`)

    const since = await admin.liveTurnCount()
    await admin.sendBuilderChat('set up a research crew')
    await admin.waitForTurn(since)
    const interview = await admin.readBuilderTranscript()
    assertFlow(
      interview.at(-1)?.content.includes('Scripted Builder note: I set up a crew.') === true,
      `the last interview entry is ${JSON.stringify(interview.at(-1))}, expected the scripted note`,
    )

    // A valid declaration persists after an async teams refetch, so hold a settle window rather than read once.
    const deadline = Date.now() + 1500
    while (Date.now() < deadline) {
      const teams = await admin.readStorageWithPrefix(TEAMS_PREFIX)
      assertFlow(Object.keys(teams).length === 0, `an incomplete team was stored: ${JSON.stringify(Object.keys(teams))}`)
      const roster = await admin.rosterIds()
      const added = roster.filter((id) => !rosterBefore.includes(id))
      assertFlow(added.length === 0, `the header roster gained ${JSON.stringify(added)} from an incomplete team`)
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  },
}
