// scripts/e2e-admin/flows/settings.ts: Settings pane flows. No model turn runs in any of them.

import { openAdmin, pollUntil, type AdminPage } from '../admin-page.ts'
import type { AdminFlow } from '../runner.ts'
import { assertFlow } from '../scenario.ts'

const ACTIVE_KEY = 'agent-admin-app.activePreset'
/** The shipped default persona (the first preset) and its seeded name. */
const DEFAULT_ID = 'croupier'
const DEFAULT_NAME = 'The Croupier'

/** Open the app on the shipped default persona and show the Agent settings section. */
async function openOnDefault(ctx: Parameters<AdminFlow['run']>[0]): Promise<{ admin: AdminPage; id: string }> {
  const admin = await openAdmin(ctx.page, ctx.base, ctx.scenario)
  const id = await admin.activeAgentId()
  assertFlow(id === DEFAULT_ID, `active agent is "${id}", expected the shipped default "${DEFAULT_ID}"`)
  return { admin, id }
}

/** Parse a stored entry list; absent reads as empty. */
function storedListLength(raw: string | null): number {
  if (raw === null) return 0
  const value = JSON.parse(raw) as unknown
  if (!Array.isArray(value)) throw new Error(`stored entry list is not an array: ${raw}`)
  return value.length
}

/** Edit the Agent name, reload the page, and the persisted key and the field both hold the new value
 *  (the seed marker keeps the reload from re-seeding). */
export const settingsEditPersists: AdminFlow = {
  name: 'settings-edit-persists',
  fixture: 'settings-edit-persists.json',
  async run(ctx) {
    const { admin, id } = await openOnDefault(ctx)
    await admin.openSettingsTab('agent-content')
    const before = await pollUntil(() => admin.readAgentName(), (v) => v !== undefined, 'the Agent name field')
    assertFlow(before === DEFAULT_NAME, `the Agent name field reads ${JSON.stringify(before)} before the edit, expected "${DEFAULT_NAME}"`)

    const edited = 'Scripted Croupier'
    const key = `agent-admin-app.${id}.name`
    await admin.editAgentName(edited)
    await pollUntil(() => admin.readStorage(key), (raw) => raw === JSON.stringify(edited), `${key} to hold "${edited}"`)

    await ctx.page.reload()
    await admin.waitArmed()
    const after = await admin.activeAgentId()
    assertFlow(after === id, `active agent is "${after}" after the reload, expected "${id}"`)
    const stored = await admin.readStorage(key)
    assertFlow(stored === JSON.stringify(edited), `${key} holds ${JSON.stringify(stored)} after the reload, expected "${edited}"`)
    await pollUntil(() => admin.readAgentName(), (v) => v === edited, `the Agent name field to read "${edited}" after the reload`)
  },
}

/** Flip the skill kind's master switch: the persisted `skillsEnabled` flag flips with it. */
export const settingsKindToggle: AdminFlow = {
  name: 'settings-kind-toggle',
  fixture: 'settings-kind-toggle.json',
  async run(ctx) {
    const { admin, id } = await openOnDefault(ctx)
    await admin.openSettingsTab('capabilities-content')
    const key = `agent-admin-app.${id}.skillsEnabled`
    const raw = await admin.readStorage(key)
    // A master switch reads default ON: only an explicit stored false disables (`isEnabledFlag`).
    const wasOn = raw !== 'false'
    const switchOn = await admin.kindEnabled('skill')
    assertFlow(switchOn === wasOn, `the skill kind-enabled switch reads ${switchOn}, but ${key} holds ${JSON.stringify(raw)}`)

    await admin.toggleKind('skill')
    await pollUntil(
      () => admin.readStorage(key),
      (value) => value === JSON.stringify(!wasOn),
      `${key} to flip to ${!wasOn}`,
    )
  },
}

/** Add a skill entry, then remove it: the persisted list grows by one, then returns to its prior length. */
export const settingsEntryAddRemove: AdminFlow = {
  name: 'settings-entry-add-remove',
  fixture: 'settings-entry-add-remove.json',
  async run(ctx) {
    const { admin, id } = await openOnDefault(ctx)
    await admin.openSettingsTab('capabilities-content')
    // The key is the persona store's persist prefix plus `entriesStoreKey('skill')`.
    const key = `agent-admin-app.${id}.entries:skill`
    const label = 'Scripted Skill'
    // The seed is not persisted until the store's first write, so an absent key means the rendered list.
    const rows = await pollUntil(() => admin.entryLabels('skill'), (labels) => labels.length > 0, 'the seeded skill rows')
    assertFlow(!rows.includes(label), `the skill list already holds "${label}" before the add`)
    const raw = await admin.readStorage(key)
    const prior = raw === null ? rows.length : storedListLength(raw)
    assertFlow(prior === rows.length, `${key} holds ${prior} entries but the skill list renders ${rows.length}`)

    await admin.addEntry('skill', label)
    const grown = await pollUntil(
      async () => storedListLength(await admin.readStorage(key)),
      (n) => n === prior + 1,
      `${key} to grow from ${prior} to ${prior + 1} entries`,
    )
    const stored = JSON.parse((await admin.readStorage(key)) ?? '[]') as { label?: unknown }[]
    assertFlow(
      stored.some((e) => e.label === label),
      `${key} holds ${grown} entries but none labelled "${label}"`,
    )

    await admin.removeEntry('skill', label)
    await pollUntil(
      async () => storedListLength(await admin.readStorage(key)),
      (n) => n === prior,
      `${key} to return to ${prior} entries`,
    )
    const after = JSON.parse((await admin.readStorage(key)) ?? '[]') as { label?: unknown }[]
    assertFlow(!after.some((e) => e.label === label), `${key} still holds "${label}" after the remove`)
  },
}

/** Pick another preset in the agent select: the persisted active id and the Agent name field follow. */
export const settingsPersonaPicker: AdminFlow = {
  name: 'settings-persona-picker',
  fixture: 'settings-persona-picker.json',
  async run(ctx) {
    const { admin } = await openOnDefault(ctx)
    await admin.openSettingsTab('agent-content')
    await pollUntil(() => admin.readAgentName(), (v) => v === DEFAULT_NAME, `the Agent name field to read "${DEFAULT_NAME}"`)

    await admin.switchPersona('quant')
    await pollUntil(() => admin.readStorage(ACTIVE_KEY), (raw) => raw === JSON.stringify('quant'), `${ACTIVE_KEY} to name "quant"`)
    await pollUntil(() => admin.readAgentName(), (v) => v === 'The Quant', 'the Agent name field to follow the pick to "The Quant"')
  },
}

/** Edit the name, then Reset Agent: the field returns to the preset's seed and the edit leaves storage. */
export const settingsResetAgent: AdminFlow = {
  name: 'settings-reset-agent',
  fixture: 'settings-reset-agent.json',
  async run(ctx) {
    const { admin, id } = await openOnDefault(ctx)
    await admin.openSettingsTab('agent-content')
    const edited = 'Scripted Reset Target'
    const key = `agent-admin-app.${id}.name`
    await admin.editAgentName(edited)
    await pollUntil(() => admin.readStorage(key), (raw) => raw === JSON.stringify(edited), `${key} to hold "${edited}"`)
    await pollUntil(() => admin.readAgentName(), (v) => v === edited, `the Agent name field to read "${edited}"`)

    await admin.resetAgent()
    await pollUntil(() => admin.readAgentName(), (v) => v === DEFAULT_NAME, `the Agent name field to return to "${DEFAULT_NAME}"`)
    const stored = await admin.readStorage(key)
    assertFlow(stored !== JSON.stringify(edited), `${key} still holds the edited name after the reset`)
    const namespace = await admin.readStorageWithPrefix(`agent-admin-app.${id}.`)
    const leftover = Object.entries(namespace).filter(([, value]) => value.includes(edited))
    assertFlow(leftover.length === 0, `the edited name survives the reset in ${JSON.stringify(leftover.map(([k]) => k))}`)
  },
}
