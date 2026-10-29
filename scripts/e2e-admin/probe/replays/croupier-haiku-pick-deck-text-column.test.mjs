// T-0586 (live round 20 cluster G, `.sdlc/evals/rounds/2026-10-29-r20-pattern/`, pick-croupier-game-deck-haiku-3, traces
// 2026-10-29.jsonl:145 and :146, converted with `npm run chat:probe -- --from-trace`): the blackjack `pick_game` press is
// answered by round 1 shrinking game-pick-1's OptionDeck to one option (OPTION_DECK_COUNT) and round 2 replacing it with
// a Column of two Texts, each while the reply says "Place your bet to deal", and no table opens. The CardTable composite
// row now sends both back (SURFACE_MISSING), so the verbatim replay ships round 2 tallied SEMANTIC_UNCORRECTED. The
// recovery leg AUTHORS round 3 as recorded round 2 plus a fresh table-1 holding the CardTable round 20 :116 opened.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'
import { shipped, trace } from './unclosed-array.mjs'
import { TABLE_1 } from './croupier-pick-table.mjs'

const fixture = parseProbeFixture(readFileSync(new URL('./croupier-haiku-pick-deck-text-column.json', import.meta.url), 'utf8'))
const [round1, round2] = fixture.turns[1].rounds

it('croupier-haiku-pick-deck-text-column: the recorded Text Column with no table draws SURFACE_MISSING and ships tallied SEMANTIC_UNCORRECTED', async () => {
  expect(round2.tools[0].input.reply).toContain('Place your bet to deal')
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[1]).failureCodes).toContain('SURFACE_MISSING')
  expect(trace(report.records[1]).failureCodes).toContain('SEMANTIC_UNCORRECTED')
  expect(shipped(report.records[1])).not.toContain('CardTable')
})

it('croupier-haiku-pick-deck-text-column: a repair that opens table-1 with the CardTable ships clean', async () => {
  const input = round2.tools[0].input
  const authored = { text: '', tools: [{ name: 'render_surface', input: { ...input, messages: [...input.messages, ...TABLE_1] } }] }
  const turn = { ...fixture.turns[1], rounds: [round1, round2, authored] }
  const report = await offlineReplay({ ...fixture, turns: [fixture.turns[0], turn] }, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[1])).toMatchObject({ rounds: 3 })
  expect(trace(report.records[1]).failureCodes).toContain('SURFACE_MISSING')
  expect(trace(report.records[1]).failureCodes).not.toContain('SEMANTIC_UNCORRECTED')
  expect(shipped(report.records[1])).toContain('CardTable')
})
