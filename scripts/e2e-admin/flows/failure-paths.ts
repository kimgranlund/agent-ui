// scripts/e2e-admin/flows/failure-paths.ts: Test Chat error and abort flows. Each failed turn must land as
// a visible `⚠` transcript entry and a Context: Dialog error row, leave the composer usable, and let the
// next scripted turn complete.

import { openAdmin, pollUntil, type AdminPage } from '../admin-page.ts'
import type { AdminFlow } from '../runner.ts'
import { assertFlow } from '../scenario.ts'

const RECOVERY_NOTE = 'Scripted recovery note: back on track.'

/** Assert the state a failed Test Chat turn leaves: a `⚠` assistant entry naming `detail`, an enabled send
 *  control, and an error on the newest Context: Dialog row. */
async function assertFailedTurn(admin: AdminPage, detail: string): Promise<void> {
  const transcript = await admin.readTestTranscript()
  const last = transcript.at(-1)
  assertFlow(
    last?.role === 'assistant' && last.content.startsWith('⚠'),
    `the last testChatTranscript() entry is ${JSON.stringify(last)}, expected a ⚠ assistant entry`,
  )
  assertFlow(last.content.includes(detail), `the ⚠ entry ${JSON.stringify(last.content)} does not name "${detail}"`)
  await pollUntil(() => admin.composerSendEnabled('chat'), (enabled) => enabled, 'the Test Chat send control to re-enable')

  await admin.openSettingsTab('context-dialog-content')
  const rows = await admin.readDialogTurns()
  const error = (rows[0]?.record?.response as { error?: unknown } | undefined)?.error
  assertFlow(
    typeof error === 'string' && error.includes(detail),
    `the newest context-turn row's response.error is ${JSON.stringify(error)}, expected it to name "${detail}"`,
  )
}

/** The scripted turn after a failure completes with the recovery note. */
async function assertRecovers(admin: AdminPage): Promise<void> {
  const since = await admin.liveTurnCount()
  await admin.sendTestChat('try again')
  await admin.waitForTurn(since)
  const last = (await admin.readTestTranscript()).at(-1)
  assertFlow(
    last?.role === 'assistant' && last.content.includes(RECOVERY_NOTE),
    `the turn after the failure ended with ${JSON.stringify(last)}, expected the recovery note`,
  )
}

/** Send one Test Chat turn that the fixture fails; resolves once the failed turn has been logged. */
async function failingTurn(admin: AdminPage): Promise<void> {
  const since = await admin.liveTurnCount()
  await admin.sendTestChat('this one fails')
  await admin.waitForTurn(since)
}

/** Produce answers 503 with `{error}`. */
export const failureHttpError: AdminFlow = {
  name: 'failure-http-error',
  fixture: 'failure-http-error.json',
  async run({ page, scenario, base }) {
    const admin = await openAdmin(page, base, scenario)
    await failingTurn(admin)
    await assertFailedTurn(admin, '503')
    await assertRecovers(admin)
  },
}

/** Produce answers 200 with a terminal `{"a2uiMeta":{"error":...}}` line (the `formatErrorLine` shape). */
export const failureErrorLine: AdminFlow = {
  name: 'failure-error-line',
  fixture: 'failure-error-line.json',
  async run({ page, scenario, base }) {
    const admin = await openAdmin(page, base, scenario)
    await failingTurn(admin)
    await assertFailedTurn(admin, 'Scripted provider fault')
    await assertRecovers(admin)
  },
}

/** The produce request is held for 1.5 s and then aborted: the send control is disabled while it is
 *  pending and re-enabled by the fail path. This proves the abort path, not the 120 s client timeout. */
export const failureAbort: AdminFlow = {
  name: 'failure-abort',
  fixture: 'failure-abort.json',
  async run({ page, wire, scenario, base }) {
    const admin = await openAdmin(page, base, scenario)
    const since = await admin.liveTurnCount()
    assertFlow(await admin.composerSendEnabled('chat'), 'the Test Chat send control is disabled before any turn')
    await admin.sendTestChat('this one is aborted')
    await pollUntil(() => admin.composerSendEnabled('chat'), (enabled) => !enabled, 'the Test Chat send control to disable while pending', 1000)
    const pending = await admin.liveTurnCount()
    assertFlow(pending === since, `liveTurnCount() is ${pending} while the request is pending, expected ${since}`)
    await admin.waitForTurn(since)

    const produce = wire.entries.filter((e) => e.endpoint === 'produce')
    assertFlow(produce[0]?.outcome === 'aborted', `the first produce entry outcome is ${produce[0]?.outcome}, expected aborted`)
    const last = (await admin.readTestTranscript()).at(-1)
    assertFlow(
      last?.role === 'assistant' && last.content.startsWith('⚠'),
      `the last testChatTranscript() entry is ${JSON.stringify(last)}, expected a ⚠ assistant entry`,
    )
    await pollUntil(() => admin.composerSendEnabled('chat'), (enabled) => enabled, 'the Test Chat send control to re-enable')
    await assertRecovers(admin)
  },
}
