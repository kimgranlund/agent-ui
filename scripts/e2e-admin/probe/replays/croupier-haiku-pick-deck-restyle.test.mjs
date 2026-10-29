// T-0586 (live round 20 cluster G, `.sdlc/evals/rounds/2026-10-29-r20-pattern/`, pick-croupier-game-deck-haiku-2, traces
// 2026-10-29.jsonl:130 and :131, converted with `npm run chat:probe -- --from-trace`): the blackjack `pick_game` press is
// answered by one round that relabels ask-1's OptionDeck "Blackjack selected" and disables it, while the reply says
// "Place your bet to deal", and no table opens. The CardTable composite row now sends that back (SURFACE_MISSING); the
// fixture holds one recorded round, so the verbatim replay ships it tallied SEMANTIC_UNCORRECTED. The recovery leg
// AUTHORS round 2 as the recorded round plus a fresh table-1 holding the CardTable round 20 :116 opened.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'
import { shipped, trace } from './unclosed-array.mjs'
import { TABLE_1 } from './croupier-pick-table.mjs'

const fixture = parseProbeFixture(readFileSync(new URL('./croupier-haiku-pick-deck-restyle.json', import.meta.url), 'utf8'))
const [round1] = fixture.turns[1].rounds

it('croupier-haiku-pick-deck-restyle: the recorded deck restyle with no table draws SURFACE_MISSING and ships tallied SEMANTIC_UNCORRECTED', async () => {
  expect(round1.tools[0].input.reply).toContain('Place your bet to deal')
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[1]).failureCodes).toEqual(['SURFACE_MISSING', 'SEMANTIC_UNCORRECTED'])
  expect(shipped(report.records[1])).not.toContain('CardTable')
})

it('croupier-haiku-pick-deck-restyle: a repair that opens table-1 with the CardTable ships clean', async () => {
  const input = round1.tools[0].input
  const authored = { text: '', tools: [{ name: 'render_surface', input: { ...input, messages: [...input.messages, ...TABLE_1] } }] }
  const turn = { ...fixture.turns[1], rounds: [round1, authored] }
  const report = await offlineReplay({ ...fixture, turns: [fixture.turns[0], turn] }, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[1])).toMatchObject({ rounds: 2, failureCodes: ['SURFACE_MISSING'] })
  expect(shipped(report.records[1])).toContain('CardTable')
})
