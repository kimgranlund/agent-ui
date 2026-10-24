// T-0450 (round `.sdlc/evals/rounds/2026-10-24-r13-pattern/`, regress-concierge-spa-booking-haiku-2, 2026-10-24.jsonl:48 to :50):
// Haiku 5.5 answered "Those details are right, please confirm the booking." (:50) with its ConfirmReceipt update written
// as a text line missing the `]` that closes `components` after the receipt's `rows` array (PARSE), then resent it as a
// `messages` string with the same missing `]` (PARSE), then claimed "Your booking receipt is up to date above" with
// nothing sent. The repair after round 1 now names the open array of the text line; the one after round 2 shows the
// string as sent and names it again. The fixture is the recorded run verbatim and still fails its expect; the recovery
// leg AUTHORS round 3 as round 2's messages with that one `]` put back, sent as an array. Live compliance waits for the
// next round.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'
import { closedLine, repairRequests, shipped, trace } from './unclosed-array.mjs'

const fixture = parseProbeFixture(readFileSync(new URL('./concierge-haiku-confirm-string-unclosed.json', import.meta.url), 'utf8'))

it('concierge-haiku-confirm-string-unclosed: the recorded confirm turn ships no receipt; each repair names the open components array', async () => {
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([['expect-component', 2]])
  expect(trace(report.records[2])).toMatchObject({ rounds: 3, failureCodes: ['PARSE', 'SEMANTIC_UNCORRECTED', 'TEXT_JSONL_ROUTED'] })

  const requests = await repairRequests(fixture, report, 2, 'agent-ui--hospitality')
  expect(requests).toHaveLength(3)
  expect(requests[1].messages.at(-1).content).toContain(
    'Your A2UI line was not valid JSON: a closing ] is missing in its updateComponents: its `components` array is still open at character 566, where a } comes instead.',
  )
  expect(requests[2].messages.at(-2).content).toContain(fixture.turns[2].rounds[1].tools[0].input.messages)
  expect(requests[2].messages.at(-1).content).toContain(
    'Your `messages` was not valid JSON: a closing ] is missing in message 1 (its updateComponents): its `components` array is still open at character 567, where a } comes instead.',
  )
})

it('concierge-haiku-confirm-string-unclosed: a round that puts the one `]` back ships the ConfirmReceipt', async () => {
  const [round1, round2] = fixture.turns[2].rounds
  const input = round2.tools[0].input
  const authored = { text: round2.text, tools: [{ name: 'render_surface', input: { ...input, messages: closedLine(input.messages) } }] }
  const turns = fixture.turns.map((t, i) => (i === 2 ? { ...t, rounds: [round1, round2, authored] } : t))
  const report = await offlineReplay({ ...fixture, turns }, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[2])).toMatchObject({ rounds: 3 })
  expect(trace(report.records[2]).failureCodes).toContain('PARSE')
  expect(shipped(report.records[2])).toContain('ConfirmReceipt')
})
