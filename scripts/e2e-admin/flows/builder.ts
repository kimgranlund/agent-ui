// scripts/e2e-admin/flows/builder.ts: Builder (Co-pilot) flows.

import { openAdmin, pollUntil, type AdminPage } from '../admin-page.ts'
import type { AdminFlow } from '../runner.ts'
import { assertFlow } from '../scenario.ts'

const ACTIVE_KEY = 'agent-admin-app.activePreset'
const BUILDER_NOTE = 'Scripted Builder note: tell me what this agent should do.'

/** Read the persisted active-agent id (the roster source writes it JSON-encoded). */
async function persistedActiveId(admin: AdminPage): Promise<string | undefined> {
  const raw = await admin.readStorage(ACTIVE_KEY)
  if (raw === null) return undefined
  try {
    const value = JSON.parse(raw) as unknown
    return typeof value === 'string' ? value : undefined
  } catch {
    return raw
  }
}

/** Click New Agent and wait until the Builder is armed over a freshly minted, persisted draft. */
async function armBuilder(admin: AdminPage): Promise<string> {
  const before = await admin.activeAgentId()
  await admin.newAgent()
  await pollUntil(() => admin.isAuthoringArmed(), (armed) => armed, 'the Builder to arm (authoringStore set)')
  const draft = await pollUntil(
    () => admin.activeAgentId(),
    (id) => id !== '' && id !== before,
    `the active agent to move off "${before}" to the new draft`,
  )
  await pollUntil(
    () => persistedActiveId(admin),
    (id) => id === draft,
    `${ACTIVE_KEY} to name the new draft "${draft}"`,
  )
  return draft
}

/** Send one Builder turn and wait for it to land in the interview transcript. */
async function oneBuilderTurn(admin: AdminPage): Promise<void> {
  const since = await admin.liveTurnCount()
  await admin.sendBuilderChat('a concierge for a small hotel')
  await admin.waitForTurn(since)
  const interview = await admin.readBuilderTranscript()
  assertFlow(interview.length === 2, `builderInterviewTranscript() has ${interview.length} entries, expected one exchange`)
  assertFlow(
    interview[1]?.role === 'assistant' && interview[1].content.includes(BUILDER_NOTE),
    `the Builder reply is ${JSON.stringify(interview[1])}, expected the scripted note`,
  )
}

/** New Agent arms the Builder over a persisted draft; one Builder turn lands in the interview transcript
 *  only, and its produce request carries `builderMission: true`. */
export const builderArmNewAgent: AdminFlow = {
  name: 'builder-arm-new-agent',
  fixture: 'builder-arm-new-agent.json',
  async run({ page, wire, scenario, base }) {
    const admin = await openAdmin(page, base, scenario)
    assertFlow(!(await admin.isAuthoringArmed()), 'the Builder is armed before New Agent was clicked')
    await armBuilder(admin)
    await oneBuilderTurn(admin)

    const test = await admin.readTestTranscript()
    assertFlow(test.length === 0, `testChatTranscript() has ${test.length} entries, expected none`)

    const produce = wire.entries.filter((e) => e.endpoint === 'produce')
    assertFlow(produce.length === 1, `wire log holds ${produce.length} produce entries, expected 1`)
    const mission = (produce[0]?.request as { builderMission?: unknown } | undefined)?.builderMission
    assertFlow(mission === true, `produce request builderMission is ${JSON.stringify(mission)}, expected true`)
  },
}

/** Arm the Builder and run one interview turn, then switch persona: the switch is the one place that
 *  clears `authoringStore`, and it resets the interview transcript and the turn count with it. */
export const builderExitClears: AdminFlow = {
  name: 'builder-exit-clears',
  fixture: 'builder-exit-clears.json',
  async run({ page, scenario, base }) {
    const admin = await openAdmin(page, base, scenario)
    await armBuilder(admin)
    await oneBuilderTurn(admin)
    const before = await admin.liveTurnCount()
    assertFlow(before === 1, `liveTurnCount() is ${before} after one Builder turn, expected 1`)

    await admin.switchPersona('quant')
    await pollUntil(() => admin.isAuthoringArmed(), (armed) => !armed, 'the Builder to disarm (authoringStore unset)')
    const interview = await admin.readBuilderTranscript()
    assertFlow(interview.length === 0, `builderInterviewTranscript() has ${interview.length} entries after the switch`)
    const count = await admin.liveTurnCount()
    assertFlow(count === 0, `liveTurnCount() is ${count} after the switch, expected 0`)
  },
}

const TEAMS_PREFIX = 'agent-ui-agent-teams.'

/** Send one Builder turn over an armed Builder and wait until it has fully landed. */
async function builderTurn(admin: AdminPage, text: string): Promise<void> {
  const since = await admin.liveTurnCount()
  await admin.sendBuilderChat(text)
  await admin.waitForTurn(since)
}

/** Parse a JSON-encoded storage value; `undefined` when absent or not JSON. */
function parseStored(raw: string | null | undefined): unknown {
  if (raw === null || raw === undefined) return undefined
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return undefined
  }
}

/** An armed Builder turn's `personaPatch` writes the draft's name to its persisted store, over a
 *  `builderMission: true` request, and the turn's Context: Dialog row carries the patch report. */
export const builderPatchApplies: AdminFlow = {
  name: 'builder-patch-applies',
  fixture: 'builder-patch-applies.json',
  async run({ page, wire, scenario, base }) {
    const admin = await openAdmin(page, base, scenario)
    const draft = await armBuilder(admin)
    await builderTurn(admin, 'call it Scripted Draft')

    const nameKey = `agent-admin-app.${draft}.name`
    const stored = await admin.readStorage(nameKey)
    assertFlow(stored === JSON.stringify('Scripted Draft'), `${nameKey} holds ${JSON.stringify(stored)}, expected the JSON string "Scripted Draft"`)

    const produce = wire.entries.filter((e) => e.endpoint === 'produce')
    assertFlow(produce.length === 1, `wire log holds ${produce.length} produce entries, expected 1`)
    const mission = (produce[0]?.request as { builderMission?: unknown } | undefined)?.builderMission
    assertFlow(mission === true, `produce request builderMission is ${JSON.stringify(mission)}, expected true`)

    await admin.openSettingsTab('context-dialog-content')
    const rows = await admin.readDialogTurns()
    const newest = rows[0]
    assertFlow(newest !== undefined, 'Context: Dialog shows no context-turn row')
    const patch = (newest.record?.response as { patch?: { applied?: unknown } } | undefined)?.patch
    assertFlow(
      Array.isArray(patch?.applied) && patch.applied.includes('name'),
      `the newest context-turn row's patch report is ${JSON.stringify(patch)}, expected applied to include "name"`,
    )
  },
}

/** A Builder `plan` meta-line's two steps both appear in the interview transcript's last entry. */
export const builderPlanRenders: AdminFlow = {
  name: 'builder-plan-renders',
  fixture: 'builder-plan-renders.json',
  async run({ page, scenario, base }) {
    const admin = await openAdmin(page, base, scenario)
    await armBuilder(admin)
    await builderTurn(admin, 'what is still open?')
    const interview = await admin.readBuilderTranscript()
    const last = interview.at(-1)
    assertFlow(last?.role === 'assistant', `the last interview entry is ${JSON.stringify(last)}, expected the assistant reply`)
    for (const step of ['Scripted step one: name the agent', 'Scripted step two: pick its skills']) {
      assertFlow(last.content.includes(step), `the last interview entry ${JSON.stringify(last.content)} lacks the plan step "${step}"`)
    }
  },
}

/** A Builder `team` meta-line persists an AgentTeam with the draft as GM and two freshly minted members
 *  that the header roster lists. */
export const builderTeamDeclared: AdminFlow = {
  name: 'builder-team-declared',
  fixture: 'builder-team-declared.json',
  async run({ page, scenario, base }) {
    const admin = await openAdmin(page, base, scenario)
    const draft = await armBuilder(admin)
    await builderTurn(admin, 'set up a research crew')

    type TeamRecord = { label?: unknown; gmAgentId?: unknown; members?: { agentId?: unknown }[] }
    const teams = await pollUntil(
      async () => {
        const stored = await admin.readStorageWithPrefix(TEAMS_PREFIX)
        return Object.entries(stored)
          .map(([key, raw]) => ({ key, record: parseStored(raw) as TeamRecord | undefined }))
          .filter((t) => t.record?.label === 'Scripted Crew')
      },
      (found) => found.length > 0,
      `an ${TEAMS_PREFIX}<teamId> record labelled "Scripted Crew"`,
    )
    assertFlow(teams.length === 1, `${teams.length} stored teams are labelled "Scripted Crew", expected 1`)
    const { key, record } = teams[0]!
    assertFlow(record?.gmAgentId === draft, `${key} gmAgentId is ${JSON.stringify(record?.gmAgentId)}, expected the draft "${draft}"`)
    const members = Array.isArray(record?.members) ? record.members : []
    assertFlow(members.length === 2, `${key} has ${members.length} members, expected 2`)
    const ids = members.map((m) => m.agentId)
    assertFlow(
      ids.every((id) => typeof id === 'string' && id !== draft),
      `${key} member agentIds are ${JSON.stringify(ids)}, expected two minted ids other than the draft`,
    )
    await pollUntil(
      () => admin.rosterIds(),
      (roster) => ids.every((id) => roster.includes(id as string)),
      `the header roster to list the members ${JSON.stringify(ids)}`,
    )
  },
}

/** Follow-the-change: with the settings nav on the Agent section, a Builder patch to `skillsEnabled`
 *  moves the selection to the Capabilities section it lives in. */
export const builderSectionRouting: AdminFlow = {
  name: 'builder-section-routing',
  fixture: 'builder-section-routing.json',
  async run({ page, scenario, base }) {
    const admin = await openAdmin(page, base, scenario)
    const draft = await armBuilder(admin)
    await admin.openSettingsTab('agent-content')
    const before = await admin.settingsSection()
    assertFlow(before === 'agent-content', `settings-nav selects "${before}" before the turn, expected "agent-content"`)

    await builderTurn(admin, 'turn skills off')
    const stored = await admin.readStorage(`agent-admin-app.${draft}.skillsEnabled`)
    assertFlow(stored === 'false', `agent-admin-app.${draft}.skillsEnabled holds ${JSON.stringify(stored)}, expected false`)
    await pollUntil(
      () => admin.settingsSection(),
      (section) => section === 'capabilities-content',
      'settings-nav to follow the change to "capabilities-content"',
      3000,
    )
  },
}

/** With the Builder armed, a Test Chat send rides `builderMission: false` and a Builder send rides `true`,
 *  and each lands only in its own transcript. */
export const builderSessionIsolation: AdminFlow = {
  name: 'builder-session-isolation',
  fixture: 'builder-session-isolation.json',
  async run({ page, wire, scenario, base }) {
    const admin = await openAdmin(page, base, scenario)
    await armBuilder(admin)

    const sinceTest = await admin.liveTurnCount()
    await admin.sendTestChat('test side')
    await admin.waitForTurn(sinceTest)
    await builderTurn(admin, 'builder side')

    const produce = wire.entries.filter((e) => e.endpoint === 'produce')
    const missions = produce.map((e) => (e.request as { builderMission?: unknown } | undefined)?.builderMission)
    assertFlow(
      missions.length === 2 && missions[0] === false && missions[1] === true,
      `produce builderMission values are ${JSON.stringify(missions)}, expected [false, true] (Test Chat, then Builder)`,
    )

    const test = await admin.readTestTranscript()
    const interview = await admin.readBuilderTranscript()
    assertFlow(test.length === 2, `testChatTranscript() has ${test.length} entries, expected 2`)
    assertFlow(interview.length === 2, `builderInterviewTranscript() has ${interview.length} entries, expected 2`)
    const testText = test.map((t) => t.content).join('\n')
    const interviewText = interview.map((t) => t.content).join('\n')
    assertFlow(
      testText.includes('test side') && testText.includes('Scripted Test Chat note') && !testText.includes('builder side') && !testText.includes('interview side'),
      `testChatTranscript() is ${JSON.stringify(test)}, expected only the Test Chat exchange`,
    )
    assertFlow(
      interviewText.includes('builder side') && interviewText.includes('interview side') && !interviewText.includes('test side') && !interviewText.includes('Test Chat note'),
      `builderInterviewTranscript() is ${JSON.stringify(interview)}, expected only the Builder exchange`,
    )
  },
}
