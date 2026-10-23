// AUTHORED (T-0429), on the `croupier-haiku-hit.json` client-turn shape. Keyless: the rounds replay through the real
// produce(), then the probe checks run with no browser. The browser leg is
// `npm run chat:probe -- --replay quizmaster-pick-reveals.json` from this folder.
// Turn 1 is the smoke-quizmaster-first-question-haiku turn with its authored CATALOG repair (the QuestionCard carries
// "actionName":"answer"). Turn 2 is the pick: tapping Canberra sends the card's `answer` action with the picked value
// as its context, with no Check answer Button, and the authored reveal round rewrites the same card with revealed
// true and one Next question Button child.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'

it('quizmaster-pick-reveals: a QuestionCard pick sends the answer action and the next turn reveals the round', async () => {
  const fixture = parseProbeFixture(readFileSync(new URL('./quizmaster-pick-reveals.json', import.meta.url), 'utf8'))
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed).toEqual([])
  const action = fixture.turns[1].input.message.action
  expect([action.name, action.sourceComponentId, action.context]).toEqual(['answer', 'qcard', { value: 'canberra' }])
  const cards = report.records[1].lines
    .map((l) => JSON.parse(l).updateComponents)
    .filter((u) => u?.surfaceId === 'quiz-capitals')
    .flatMap((u) => u.components)
    .filter((c) => c.id === 'qcard')
  expect(cards).toHaveLength(1)
  expect(cards[0]).toMatchObject({ component: 'QuestionCard', revealed: true, actionName: 'answer', children: ['next'] })
})
