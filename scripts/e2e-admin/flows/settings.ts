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

/** A shipped persona persists its edits as one overlay record over its seed (T-0161): the key the store
 *  keeps under `agent-admin-app.<id>.overlay`, parsed; absent reads as no edits. */
interface StoredOverlay {
  values: Record<string, { value?: unknown }>
  lists: Record<string, { entries: Record<string, { op: string; entry?: { label?: unknown } }> }>
}
async function storedOverlay(admin: AdminPage, id: string): Promise<StoredOverlay> {
  const raw = await admin.readStorage(`agent-admin-app.${id}.overlay`)
  return raw === null ? { values: {}, lists: {} } : (JSON.parse(raw) as StoredOverlay)
}

/** One store key's persisted edit as the JSON text the old per-key record held, or null when unedited. */
async function storedValue(admin: AdminPage, id: string, key: string): Promise<string | null> {
  const op = (await storedOverlay(admin, id)).values[key]
  return op === undefined || !('value' in op) ? null : JSON.stringify(op.value)
}

/** The labels of the entries the user added to one entry list. */
async function addedLabels(admin: AdminPage, id: string, key: string): Promise<unknown[]> {
  const entries = (await storedOverlay(admin, id)).lists[key]?.entries ?? {}
  return Object.values(entries)
    .filter((op) => op.op === 'added')
    .map((op) => op.entry?.label)
}

/** Edit the Agent name, reload the page, and the persisted overlay and the field both hold the new value. */
export const settingsEditPersists: AdminFlow = {
  name: 'settings-edit-persists',
  fixture: 'settings-edit-persists.json',
  async run(ctx) {
    const { admin, id } = await openOnDefault(ctx)
    await admin.openSettingsTab('agent-content')
    const before = await pollUntil(() => admin.readAgentName(), (v) => v !== undefined, 'the Agent name field')
    assertFlow(before === DEFAULT_NAME, `the Agent name field reads ${JSON.stringify(before)} before the edit, expected "${DEFAULT_NAME}"`)

    const edited = 'Scripted Croupier'
    const key = `the ${id} overlay's name`
    await admin.editAgentName(edited)
    await pollUntil(() => storedValue(admin, id, 'name'), (raw) => raw === JSON.stringify(edited), `${key} to hold "${edited}"`)

    await ctx.page.reload()
    await admin.waitArmed()
    const after = await admin.activeAgentId()
    assertFlow(after === id, `active agent is "${after}" after the reload, expected "${id}"`)
    const stored = await storedValue(admin, id, 'name')
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
    const key = `the ${id} overlay's skillsEnabled`
    const raw = await storedValue(admin, id, 'skillsEnabled')
    // A master switch reads default ON: only an explicit stored false disables (`isEnabledFlag`).
    const wasOn = raw !== 'false'
    const switchOn = await admin.kindEnabled('skill')
    assertFlow(switchOn === wasOn, `the skill kind-enabled switch reads ${switchOn}, but ${key} holds ${JSON.stringify(raw)}`)

    await admin.toggleKind('skill')
    await pollUntil(
      () => storedValue(admin, id, 'skillsEnabled'),
      (value) => value === JSON.stringify(!wasOn),
      `${key} to flip to ${!wasOn}`,
    )
  },
}

/** Add a skill entry, then remove it: the overlay records the added entry, then drops it again. */
export const settingsEntryAddRemove: AdminFlow = {
  name: 'settings-entry-add-remove',
  fixture: 'settings-entry-add-remove.json',
  async run(ctx) {
    const { admin, id } = await openOnDefault(ctx)
    await admin.openSettingsTab('capabilities-content')
    // The overlay's list key is `entriesStoreKey('skill')`; only the user's changes are stored, never the seed.
    const listKey = 'entries:skill'
    const key = `the ${id} overlay's ${listKey}`
    const label = 'Scripted Skill'
    const rows = await pollUntil(() => admin.entryLabels('skill'), (labels) => labels.length > 0, 'the seeded skill rows')
    assertFlow(!rows.includes(label), `the skill list already holds "${label}" before the add`)
    const prior = await addedLabels(admin, id, listKey)
    assertFlow(!prior.includes(label), `${key} already records "${label}" as added`)

    await admin.addEntry('skill', label)
    await pollUntil(() => addedLabels(admin, id, listKey), (labels) => labels.includes(label), `${key} to record "${label}" as added`)
    await pollUntil(() => admin.entryLabels('skill'), (labels) => labels.length === rows.length + 1, `the skill list to grow to ${rows.length + 1} rows`)

    await admin.removeEntry('skill', label)
    await pollUntil(() => addedLabels(admin, id, listKey), (labels) => !labels.includes(label), `${key} to drop "${label}"`)
    await pollUntil(() => admin.entryLabels('skill'), (labels) => labels.length === rows.length, `the skill list to return to ${rows.length} rows`)
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
    const key = `the ${id} overlay's name`
    await admin.editAgentName(edited)
    await pollUntil(() => storedValue(admin, id, 'name'), (raw) => raw === JSON.stringify(edited), `${key} to hold "${edited}"`)
    await pollUntil(() => admin.readAgentName(), (v) => v === edited, `the Agent name field to read "${edited}"`)

    await admin.resetAgent()
    await pollUntil(() => admin.readAgentName(), (v) => v === DEFAULT_NAME, `the Agent name field to return to "${DEFAULT_NAME}"`)
    const stored = await storedValue(admin, id, 'name')
    assertFlow(stored !== JSON.stringify(edited), `${key} still holds the edited name after the reset`)
    const namespace = await admin.readStorageWithPrefix(`agent-admin-app.${id}.`)
    const leftover = Object.entries(namespace).filter(([, value]) => value.includes(edited))
    assertFlow(leftover.length === 0, `the edited name survives the reset in ${JSON.stringify(leftover.map(([k]) => k))}`)
  },
}
