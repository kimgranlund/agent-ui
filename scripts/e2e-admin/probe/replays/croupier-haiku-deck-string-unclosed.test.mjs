// T-0450 (round `.sdlc/evals/rounds/2026-10-24-r13-pattern/`, pick-croupier-game-deck-haiku-3, 2026-10-24.jsonl:145):
// Haiku 5.5 answered "What games can we play?" with render_surface whose `messages` was one JSON string on all three
// rounds, each missing the `]` that closes `components` after the OptionDeck's `options` array, so every round was PARSE
// and the turn shipped no surface. T-0469: a string whose only defect is one named unclosed array is closed in place
// from the brackets still open, so the recorded round 1 ships the OptionDeck with no repair.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'
import { shipped, trace } from './unclosed-array.mjs'

const fixture = parseProbeFixture(readFileSync(new URL('./croupier-haiku-deck-string-unclosed.json', import.meta.url), 'utf8'))

it('croupier-haiku-deck-string-unclosed: the recorded string is closed in place and round 1 ships the OptionDeck', async () => {
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[0])).toMatchObject({ rounds: 1, failureCodes: ['MESSAGES_STRING_DECODED'] })
  expect(shipped(report.records[0])).toContain('OptionDeck')
})
