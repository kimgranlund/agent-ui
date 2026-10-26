// T-0472 guarding T-0467 (live run pick-mentalist-answer-deck-haiku-1, 2026-10-26.jsonl:117, the round 14 trace): Haiku 5.5
// opened Twenty Questions with ONE `messages` array that creates `ask-1` (the OptionDeck) BEFORE `hud-1`. The GH #1164
// superseded sweep then dimmed the deck and its press sent nothing (`click-target`). The fixture is the trace turn made by
// `npm run chat:probe -- --from-trace`; this file pins the recorded lines, the host leg that the sweep keeps both surfaces
// live is packages/agent-ui/app/src/controls/conversation/conversation-replay.test.ts, which reads this fixture.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'

it('mentalist-haiku-same-turn-ask-deck: one turn creates the ask deck first and the HUD second, every probe check green', async () => {
  const fixture = parseProbeFixture(readFileSync(new URL('./mentalist-haiku-same-turn-ask-deck.json', import.meta.url), 'utf8'))
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed).toEqual([])
  const messages = report.records[0].lines.map((l) => JSON.parse(l))
  expect(messages.filter((m) => m.createSurface).map((m) => m.createSurface.surfaceId)).toEqual(['ask-1', 'hud-1'])
  expect(messages.find((m) => m.a2uiMeta?.ask)?.a2uiMeta.ask).toEqual({ surfaceId: 'ask-1' })
  expect(messages.filter((m) => m.updateComponents?.surfaceId === 'ask-1').flatMap((m) => m.updateComponents.components.map((c) => c.component))).toContain('OptionDeck')
})
