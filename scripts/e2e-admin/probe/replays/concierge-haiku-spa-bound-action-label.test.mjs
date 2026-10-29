// T-0587 (live round 20 cluster S, `.sdlc/evals/rounds/2026-10-29-r20-pattern/`, long-concierge-spa-services-haiku-3,
// trace 2026-10-29.jsonl:107, converted with `npm run chat:probe -- --from-trace`): on "What spa services can I book during
// my stay?" round 1 templates one ProductCard in a Grid with `actionLabel` bound to the item. ProductCard.actionLabel was
// not bindable, so round 1 failed CATALOG `tmpl.actionLabel` and a second round was spent. The fixture is the recorded
// run verbatim; with actionLabel bindable round 1 ships.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'
import { trace } from './unclosed-array.mjs'

const fixture = parseProbeFixture(readFileSync(new URL('./concierge-haiku-spa-bound-action-label.json', import.meta.url), 'utf8'))
const shippedComponents = (record) => record.lines.flatMap((l) => JSON.parse(l).updateComponents?.components ?? [])

it('concierge-haiku-spa-bound-action-label: the recorded turn replays green and round 1 ships the bound card', async () => {
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed).toEqual([])
  const t = trace(report.records[0])
  expect(t).toMatchObject({ rounds: 1 })
  expect(t.failureCodes).not.toContain('CATALOG')
  const card = shippedComponents(report.records[0]).find((c) => c.component === 'ProductCard')
  expect(card?.actionLabel).toMatchObject({ path: expect.any(String) })
})
