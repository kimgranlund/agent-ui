// T-0498 (live round 16 cluster M, `.sdlc/evals/rounds/2026-10-28-r16-pattern/`, smoke-negotiator-first-offer-haiku-3,
// traces 2026-10-28.jsonl:83 and :84): turn 0 builds ask-1 with the footer `ask_ft` holding `walk`. On "I offer 20." every
// round resends ask-1 with `ask_ft.child` = `ask_row`, a new Row listing `accept` and `walk`, and resends `walk`. The merge
// disposed `walk` as dropped from `ask_ft` though `ask_row` in the same batch names it, so all three rounds drew
// IDGRAPH `ask_row->walk` and the turn shipped nothing. The merge (component-merge.ts) and the renderer (tree.ts) now keep
// a child the batch moves, so round 1 ships the move. Rounds 2 and 3 stay recorded and unused.
// The fixture's lines are re-derived from the recorded rounds through today's produce() (as `--from-trace` does), so
// `npm run chat:probe -- --replay negotiator-haiku-move-under-row.json` drives the renderer through the same move.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'

it('negotiator-haiku-move-under-row: a footer child moved under a new Row in one batch ships on round 1 with no IDGRAPH', async () => {
  const fixture = parseProbeFixture(readFileSync(new URL('./negotiator-haiku-move-under-row.json', import.meta.url), 'utf8'))
  expect(fixture.steps.map((s) => s.say)).toEqual(["I'd like to buy your brass lantern. What's your price?", 'I offer 20.'])
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  const trace = (i) => report.records[i].lines.map((l) => JSON.parse(l).a2uiMeta?.trace).find((t) => t !== undefined)
  expect(trace(1)).toMatchObject({ rounds: 1, failureCodes: [] })
  const shipped = report.records[1].lines.flatMap((l) => {
    const m = JSON.parse(l)
    return m.updateComponents?.surfaceId === 'ask-1' ? m.updateComponents.components : []
  })
  expect(shipped.find((c) => c.id === 'ask_ft')?.child).toBe('ask_row')
  expect(shipped.find((c) => c.id === 'ask_row')?.children).toEqual(['accept', 'walk'])
})
