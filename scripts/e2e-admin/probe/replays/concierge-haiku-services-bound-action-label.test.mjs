// T-0587 (live round 20 cluster S, `.sdlc/evals/rounds/2026-10-29-r20-pattern/`, regress-concierge-facilities-then-tour-haiku-3,
// traces 2026-10-29.jsonl:94 to :98, converted with `npm run chat:probe -- --from-trace`): on "What services could I add for
// the rest of my stay?" round 3 templates one ProductCard over `/services` in a Grid and binds `actionLabel` to each item,
// like `title` and `price`. ProductCard.actionLabel was not bindable, so round 3 failed CATALOG `service-card.actionLabel`,
// the 3-round bound ran out and the turn shipped SURFACE_DEGRADED. The fixture is the recorded run verbatim; with
// actionLabel bindable round 3 ships the Grid.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'
import { trace } from './unclosed-array.mjs'

const fixture = parseProbeFixture(readFileSync(new URL('./concierge-haiku-services-bound-action-label.json', import.meta.url), 'utf8'))
const shippedComponents = (record) => record.lines.flatMap((l) => JSON.parse(l).updateComponents?.components ?? [])

it('concierge-haiku-services-bound-action-label: round 3 binds actionLabel on the templated ProductCard', () => {
  const round3 = fixture.turns[4].rounds[2]
  expect(JSON.stringify(round3)).toContain('\\"actionLabel\\":{\\"path\\":\\"actionLabel\\"}')
})

it('concierge-haiku-services-bound-action-label: the recorded turns replay green and round 3 ships the bound Grid', async () => {
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed).toEqual([])
  const t = trace(report.records[4])
  expect(t).toMatchObject({ rounds: 3 })
  expect(t.failureCodes).not.toContain('CATALOG')
  expect(t.failureCodes).not.toContain('SURFACE_DEGRADED')
  const card = shippedComponents(report.records[4]).find((c) => c.component === 'ProductCard')
  expect(card?.actionLabel).toEqual({ path: 'actionLabel' })
})
