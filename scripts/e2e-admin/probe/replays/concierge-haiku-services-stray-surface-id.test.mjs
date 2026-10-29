// T-0588 (round `.sdlc/evals/rounds/2026-10-29-r20-pattern/`, cluster S, regress-concierge-facilities-then-tour-haiku-2,
// 2026-10-29.jsonl:57,58,59,60,61, converted with `npm run chat:probe -- --from-trace`): on "What services could I add
// for the rest of my stay?" Haiku 5.5 spent round 1 on PRODUCT_CARD_MISSING and round 2 on IDGRAPH, CONTAINMENT and
// SURFACE_NOT_CREATED, and its round 3 sent the ProductCard Grid with the updateDataModel's `surfaceId` beside the op.
// That was SCHEMA [1].updateDataModel.surfaceId on the last round, so the turn shipped SURFACE_DEGRADED and no surface.
// Every round is the recorded one verbatim; heal's arm (e) now moves the id into the op and round 3 ships.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'
import { shipped, trace } from './unclosed-array.mjs'

it('concierge-haiku-services-stray-surface-id: the stray envelope surfaceId heals and round 3 ships the ProductCard Grid', async () => {
  const fixture = parseProbeFixture(readFileSync(new URL('./concierge-haiku-services-stray-surface-id.json', import.meta.url), 'utf8'))
  expect(JSON.stringify(fixture.turns[4].rounds[2].tools)).toContain('"value":{"spa":')
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed).toEqual([])
  const t = trace(report.records[4])
  expect(t).toMatchObject({ rounds: 3, healed: 1 })
  expect(t.failureCodes).not.toContain('SURFACE_DEGRADED')
  expect(shipped(report.records[4])).toContain('ProductCard')
})
