// T-0450 (round `.sdlc/evals/rounds/2026-10-24-r13-pattern/`, regress-concierge-spa-booking-haiku-2, 2026-10-24.jsonl:48 to :50):
// Haiku 5.5 answered "Those details are right, please confirm the booking." (:50) with its ConfirmReceipt update written
// as a text line missing the `]` that closes `components` after the receipt's `rows` array (PARSE), then resent it as a
// `messages` string with the same missing `]` (PARSE), then claimed "Your booking receipt is up to date above" with
// nothing sent. The repair after round 1 now names the open array of the text line; the one after round 2 shows the
// string as sent and named it again. T-0469: round 2's string, whose only defect is that one unclosed array, is now
// closed in place, so the recorded turn ships the receipt in round 2.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'
import { repairRequests, shipped, trace } from './unclosed-array.mjs'

const fixture = parseProbeFixture(readFileSync(new URL('./concierge-haiku-confirm-string-unclosed.json', import.meta.url), 'utf8'))

it('concierge-haiku-confirm-string-unclosed: the repair names the open array of the text line; the string round is closed in place and ships the ConfirmReceipt', async () => {
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[2])).toMatchObject({ rounds: 2, failureCodes: ['PARSE', 'TEXT_JSONL_ROUTED', 'MESSAGES_STRING_DECODED'] })
  expect(shipped(report.records[2])).toContain('ConfirmReceipt')

  const requests = await repairRequests(fixture, report, 2, 'agent-ui--hospitality')
  expect(requests).toHaveLength(2)
  expect(requests[1].messages.at(-1).content).toContain(
    'Your A2UI line was not valid JSON: a closing ] is missing in its updateComponents: its `components` array is still open at character 566, where a } comes instead.',
  )
})
