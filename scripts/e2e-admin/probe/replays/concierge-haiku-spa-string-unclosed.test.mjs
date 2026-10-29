// T-0469 (round `.sdlc/evals/rounds/2026-10-26-r14-pattern/`, long-concierge-spa-services-haiku-1, cluster S2,
// 2026-10-26.jsonl:33, converted with `npm run chat:probe -- --from-trace`): Haiku 5.5 answered "What spa services can I
// book during my stay?" with render_surface whose `messages` was one JSON string, byte for byte the same on all three
// rounds, whose last component closes with one `}` too many where the `]` of `components` belongs. Every round was
// PARSE after the exact T-0450 pinpoint, each repair showed the string back unchanged, and the turn degraded with no
// surface. The string is now closed in place from the brackets still open, so the payload validates past PARSE. Its one
// other defect was the ProductCard `actionLabel` bound to a path; T-0587 made that prop bindable, so the recorded
// round 1 now ships the spa menu with no repair. The fixture is the recorded run verbatim; the second leg AUTHORS
// round 1 with the label written as text, which ships the same menu.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'
import { shipped, trace } from './unclosed-array.mjs'

const fixture = parseProbeFixture(readFileSync(new URL('./concierge-haiku-spa-string-unclosed.json', import.meta.url), 'utf8'))
const sent = fixture.turns[0].rounds[0].tools[0].input.messages

it('concierge-haiku-spa-string-unclosed: the identical string is closed in place and round 1 ships past PARSE with its bound actionLabel', async () => {
  expect(fixture.turns[0].rounds.map((r) => r.tools[0].input.messages)).toEqual([sent, sent, sent])
  expect(sent).toContain('"actionLabel":{"path":"actionLabel"}')
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[0])).toMatchObject({ rounds: 1, failureCodes: ['MESSAGES_STRING_DECODED'] })
  expect(shipped(report.records[0])).toEqual(['Column', 'Text', 'Text', 'Grid', 'ProductCard'])
})

it('concierge-haiku-spa-string-unclosed: a round 1 that writes the label as text ships the same spa menu', async () => {
  const [round1] = fixture.turns[0].rounds
  const input = round1.tools[0].input
  const authored = { text: round1.text, tools: [{ name: 'render_surface', input: { ...input, messages: sent.replace('"actionLabel":{"path":"actionLabel"}', '"actionLabel":"Book"') } }] }
  const report = await offlineReplay({ ...fixture, turns: [{ ...fixture.turns[0], rounds: [authored] }] }, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[0])).toMatchObject({ rounds: 1, failureCodes: ['MESSAGES_STRING_DECODED'] })
  expect(shipped(report.records[0])).toEqual(['Column', 'Text', 'Text', 'Grid', 'ProductCard'])
})
