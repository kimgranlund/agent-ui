// T-0450 (round `.sdlc/evals/rounds/2026-10-24-r13-pattern/`, regress-concierge-spa-booking-haiku-1, 2026-10-24.jsonl:11 to :13):
// Haiku 5.5 answered "Those details are right, please confirm the booking." (:13) with its ConfirmReceipt update written
// as a text line missing the `]` that closes `components` after the receipt's `rows` array. That round was PARSE with the
// bare array reminder; round 2 answered in prose (SURFACE_MISSING) and round 3 sent a `messages` string with the same
// missing `]`, so the turn shipped no receipt. The repair after round 1 now names the open array of the text line.
// The fixture is the recorded run verbatim and still fails its expect; the recovery leg AUTHORS round 2 as round 1's line
// with that one `]` put back, sent through render_surface. Live compliance waits for the next round.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'
import { closedLine, repairRequests, shipped, trace } from './unclosed-array.mjs'

const fixture = parseProbeFixture(readFileSync(new URL('./concierge-haiku-confirm-text-unclosed.json', import.meta.url), 'utf8'))

it('concierge-haiku-confirm-text-unclosed: the recorded confirm turn ships no receipt; the repair names the open components array', async () => {
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([['expect-component', 2]])
  expect(trace(report.records[2])).toMatchObject({ rounds: 3, failureCodes: ['PARSE', 'TEXT_JSONL_ROUTED', 'SURFACE_DEGRADED'] })

  const requests = await repairRequests(fixture, report, 2, 'agent-ui--hospitality')
  expect(requests).toHaveLength(3)
  expect(requests[1].messages.at(-1).content).toContain(
    'Your A2UI line was not valid JSON: a closing ] is missing in its updateComponents: its `components` array is still open at character 647, where a } comes instead.',
  )
})

it('concierge-haiku-confirm-text-unclosed: a round that puts the one `]` back ships the ConfirmReceipt', async () => {
  const [round1] = fixture.turns[2].rounds
  const [meta, line] = round1.text.split('\n')
  const authored = { text: meta, tools: [{ name: 'render_surface', input: { reply: JSON.parse(meta).a2uiMeta.note, target: 'spa-booking-2', messages: [closedLine(line)] } }] }
  const turns = fixture.turns.map((t, i) => (i === 2 ? { ...t, rounds: [round1, authored] } : t))
  const report = await offlineReplay({ ...fixture, turns }, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[2])).toMatchObject({ rounds: 2 })
  expect(trace(report.records[2]).failureCodes).toContain('PARSE')
  expect(shipped(report.records[2])).toContain('ConfirmReceipt')
})
