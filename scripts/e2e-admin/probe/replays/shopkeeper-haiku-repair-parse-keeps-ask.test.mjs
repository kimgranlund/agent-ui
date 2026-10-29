// T-0578 (live round 18 cluster R, `.sdlc/evals/rounds/2026-10-29-r18-pattern/`, smoke-shopkeeper-browse-and-add-haiku-2,
// traces 2026-10-29.jsonl:42 and :43, converted with `npm run chat:probe -- --from-trace`): turn 0 builds `storefront`. On
// "Add the first one to my order." round 1 answers a storefront meta line and a note claiming the add (CHANGE_CLAIMED, a
// forced repair). Round 2 calls render_surface with the right repair (the storefront plus an `order` ConfirmReceipt) as a
// `messages` string one closing brace short after the updateComponents message, so it was filed plain PARSE: round 3, the
// last, got the PARSE ask unforced, answered the same note, and the claim shipped tallied CHANGE_CLAIM_UNCORRECTED with no
// surface. A non-empty forced repair round that does not parse now keeps its repair ask beside PARSE and the parse location,
// still forced. The fixture is the recorded run verbatim (its round 3 answered the old unforced ask, so it still ships
// the note alone); the recovery leg AUTHORS round 3 as round 2's string with the brace put back.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'
import { repairRequests, shipped, trace } from './unclosed-array.mjs'

const fixture = parseProbeFixture(readFileSync(new URL('./shopkeeper-haiku-repair-parse-keeps-ask.json', import.meta.url), 'utf8'))
const [round1, round2] = fixture.turns[1].rounds
const sent = round2.tools[0].input.messages

it('shopkeeper-haiku-repair-parse-keeps-ask: the unparseable CHANGE_CLAIMED repair round keeps its ask, forced, with the parse location', async () => {
  expect(fixture.steps.map((s) => s.say)).toEqual(['What lamps do you have?', 'Add the first one to my order.'])
  expect(() => JSON.parse(sent)).toThrow(/position 2028/)
  const report = await offlineReplay(fixture, process.cwd())
  const requests = await repairRequests(fixture, report, 1, 'agent-ui')
  expect(requests).toHaveLength(3)
  expect(requests[1].messages.at(-1).content).toContain('CHANGE_CLAIMED at storefront')
  expect(requests[2].toolChoice).toEqual({ name: 'render_surface' })
  expect(requests[2].messages.at(-2).content).toContain(sent)
  expect(requests[2].messages.at(-1).content).toContain('CHANGE_CLAIMED at storefront')
  expect(requests[2].messages.at(-1).content).toContain('a closing } is missing in message 1 (its updateComponents)')
})

it('shopkeeper-haiku-repair-parse-keeps-ask: a round 3 that sends the string with the brace put back ships the order', async () => {
  const closed = sent.replace('{"action":"back"}}]},{"version"', '{"action":"back"}}]}},{"version"')
  const authored = { text: '', tools: [{ name: 'render_surface', input: { ...round2.tools[0].input, messages: closed } }] }
  const turn = { ...fixture.turns[1], rounds: [round1, round2, authored] }
  const report = await offlineReplay({ ...fixture, turns: [fixture.turns[0], turn] }, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[1])).toMatchObject({ rounds: 3 })
  expect(trace(report.records[1]).failureCodes).not.toContain('CHANGE_CLAIM_UNCORRECTED')
  expect(shipped(report.records[1])).toContain('ConfirmReceipt')
})
