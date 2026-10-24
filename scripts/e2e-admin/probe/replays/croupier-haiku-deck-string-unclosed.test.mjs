// T-0450 (round `.sdlc/evals/rounds/2026-10-24-r13-pattern/`, pick-croupier-game-deck-haiku-3, 2026-10-24.jsonl:145):
// Haiku 5.5 answered "What games can we play?" with render_surface whose `messages` was one JSON string on all three
// rounds, each missing the `]` that closes `components` after the OptionDeck's `options` array, so every round was PARSE
// and the turn shipped no surface. The repair turn showed no `messages` at all (an unparsed string never reached
// `lastRaw`; round 2's reasoning says it "never actually called render_surface") and quoted 60 characters at the break.
// The harness never edits the string (Kim 2026-10-16): the repair now shows the string as sent and names the open array.
// The fixture is the recorded turn verbatim and still degrades; the recovery leg AUTHORS round 2 as round 1's messages
// with that one `]` put back, sent as an array. Live compliance waits for the next round.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'
import { closedLine, repairRequests, shipped, trace } from './unclosed-array.mjs'

const fixture = parseProbeFixture(readFileSync(new URL('./croupier-haiku-deck-string-unclosed.json', import.meta.url), 'utf8'))

it('croupier-haiku-deck-string-unclosed: the recorded turn degrades; the repair shows the string and names the open components array', async () => {
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([['expect-component', 0]])
  expect(trace(report.records[0])).toMatchObject({ rounds: 3, failureCodes: ['PARSE', 'SURFACE_DEGRADED'] })

  const sent = fixture.turns[0].rounds[0].tools[0].input.messages
  const requests = await repairRequests(fixture, report, 0, 'agent-ui--croupier')
  expect(requests).toHaveLength(3)
  expect(requests[1].messages.at(-2).content).toContain(sent)
  expect(requests[1].messages.at(-1).content).toContain(
    'Your `messages` was not valid JSON: a closing ] is missing in message 2 (its updateComponents): its `components` array is still open at character 1312, where a } comes instead.',
  )
})

it('croupier-haiku-deck-string-unclosed: a round that puts the one `]` back ships the OptionDeck', async () => {
  const [round1] = fixture.turns[0].rounds
  const input = round1.tools[0].input
  const authored = { text: round1.text, tools: [{ name: 'render_surface', input: { ...input, messages: closedLine(input.messages) } }] }
  const report = await offlineReplay({ ...fixture, turns: [{ ...fixture.turns[0], rounds: [round1, authored] }] }, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[0])).toMatchObject({ rounds: 2, failureCodes: ['PARSE'] })
  expect(shipped(report.records[0])).toContain('OptionDeck')
})
