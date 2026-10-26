// T-0469 (round `.sdlc/evals/rounds/2026-10-26-r14-pattern/`, long-concierge-spa-services-haiku-1, cluster S2,
// 2026-10-26.jsonl:33, converted with `npm run chat:probe -- --from-trace`): Haiku 5.5 answered "What spa services can I
// book during my stay?" with render_surface whose `messages` was one JSON string, byte for byte the same on all three
// rounds, whose last component closes with one `}` too many where the `]` of `components` belongs. Every round was
// PARSE after the exact T-0450 pinpoint, each repair showed the string back unchanged, and the turn degraded with no
// surface. The string is now closed in place from the brackets still open, so the payload validates past PARSE: the
// repair shows the closed payload and names the one defect left, the ProductCard `actionLabel` bound to a path where
// the catalog takes a string. The fixture is the recorded run verbatim (its later rounds resend the same string, so it
// still degrades on that CATALOG); the recovery leg AUTHORS round 2 as that string with the label written as text.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'
import { repairRequests, shipped, trace } from './unclosed-array.mjs'

const fixture = parseProbeFixture(readFileSync(new URL('./concierge-haiku-spa-string-unclosed.json', import.meta.url), 'utf8'))
const sent = fixture.turns[0].rounds[0].tools[0].input.messages

it('concierge-haiku-spa-string-unclosed: the identical string is closed in place, never sent back unchanged, and repaired past PARSE', async () => {
  expect(fixture.turns[0].rounds.map((r) => r.tools[0].input.messages)).toEqual([sent, sent, sent])
  const report = await offlineReplay(fixture, process.cwd())
  expect(trace(report.records[0])).toMatchObject({ rounds: 3, failureCodes: ['CATALOG', 'MESSAGES_STRING_DECODED', 'SURFACE_DEGRADED'] })

  const requests = await repairRequests(fixture, report, 0, 'agent-ui--hospitality')
  expect(requests).toHaveLength(3)
  for (const req of requests.slice(1)) {
    expect(req.messages.at(-2).content).not.toContain(sent)
    expect(req.messages.at(-2).content).toContain('"components":[{"id":"root","component":"Column"')
    expect(req.messages.at(-1).content).toContain('CATALOG at treatment.actionLabel')
    expect(req.messages.at(-1).content).not.toContain('not valid JSON')
  }
})

it('concierge-haiku-spa-string-unclosed: a round 2 that writes the label as text ships the spa menu', async () => {
  const [round1] = fixture.turns[0].rounds
  const input = round1.tools[0].input
  const authored = { text: round1.text, tools: [{ name: 'render_surface', input: { ...input, messages: sent.replace('"actionLabel":{"path":"actionLabel"}', '"actionLabel":"Book"') } }] }
  const report = await offlineReplay({ ...fixture, turns: [{ ...fixture.turns[0], rounds: [round1, authored] }] }, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[0])).toMatchObject({ rounds: 2, failureCodes: ['CATALOG', 'MESSAGES_STRING_DECODED'] })
  expect(shipped(report.records[0])).toEqual(['Column', 'Text', 'Text', 'Grid', 'ProductCard'])
})
