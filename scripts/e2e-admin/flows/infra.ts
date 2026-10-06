// scripts/e2e-admin/flows/infra.ts: flows that prove the harness's own network edge.

import { openAdmin } from '../admin-page.ts'
import type { AdminFlow } from '../runner.ts'
import { assertFlow } from '../scenario.ts'

const PROBE_URL = 'https://example.com/e2e-admin-probe'

/** Zero turns: an in-page fetch off the vite origin rejects and is logged as an aborted external
 *  request, and the page's `/status` probe was answered by the intercept. */
export const infraNetworkBlocked: AdminFlow = {
  name: 'infra-network-blocked',
  fixture: 'infra-network-blocked.json',
  async run({ page, wire, scenario, base }) {
    await openAdmin(page, base, scenario)
    const result = await page.evaluate(async (url) => {
      try {
        await fetch(url)
        return 'resolved'
      } catch {
        return 'rejected'
      }
    }, PROBE_URL)
    assertFlow(result === 'rejected', `the in-page fetch to ${PROBE_URL} ${result}, expected it to reject`)

    const external = wire.entries.find((e) => e.url === PROBE_URL)
    assertFlow(external !== undefined, `the wire log has no entry for ${PROBE_URL}`)
    assertFlow(
      external.endpoint === 'external' && external.outcome === 'aborted',
      `the probe entry is ${external.endpoint}/${external.outcome}, expected external/aborted`,
    )

    const status = wire.entries.find((e) => e.endpoint === 'status')
    assertFlow(status !== undefined, 'the wire log has no /status entry')
    assertFlow(status.outcome === 'fulfilled', `the /status entry outcome is ${status.outcome}, expected fulfilled`)
  },
}
