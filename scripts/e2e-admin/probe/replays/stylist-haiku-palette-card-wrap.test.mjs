// Converted with `fixtureFromTrace` (T-0174) from the round 12 archive, `.sdlc/evals/rounds/2026-10-19-r12-targeted/`
// traces/2026-10-19.jsonl:3 (catalog agent-ui--stylist). Keyless: the recorded model rounds replay through the real
// produce(), then the probe checks run with no browser. The browser leg (its render lint) is
// `npm run chat:probe -- --replay stylist-haiku-palette-card-wrap.json` from this folder.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'

// T-0377 (fixed). Round 12 :3 (smoke-stylist-palette-haiku-1, Haiku 5.5) rooted its palette in a Card > CardContent >
// Column holding three ContrastPairs. A ContrastPair draws its own card, so the browser render lint failed nested-card.
// That round now gets CONTRAST_PAIR_WRAPPED. The second round is AUTHORED (the live turn had one): it re-creates the
// surface with its data model and roots it in a Column, the Card's title Text first, then the Swatches, Ramp and
// ContrastPairs, with no Card, CardHeader or CardContent left.
it('stylist-haiku-palette-card-wrap: ContrastPairs in a root Card are sent back and ship in a root Column', async () => {
  const fixture = parseProbeFixture(readFileSync(new URL('./stylist-haiku-palette-card-wrap.json', import.meta.url), 'utf8'))
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => `${c.check}:${c.turn}`)).toEqual([])
  const trace = report.records[0].lines.map((l) => JSON.parse(l).a2uiMeta?.trace).find((t) => t !== undefined)
  expect(trace).toMatchObject({ rounds: 2, failureCodes: ['CONTRAST_PAIR_WRAPPED'] })
  const components = report.records[0].lines.flatMap((l) => JSON.parse(l).updateComponents?.components ?? [])
  const types = components.map((c) => c.component)
  expect(types).not.toEqual(expect.arrayContaining(['Card']))
  expect(types.filter((t) => t.startsWith('Card'))).toEqual([])
  expect(types.filter((t) => t === 'ContrastPair')).toHaveLength(3)
  const root = components.find((c) => c.id === 'root')
  expect(root.component).toBe('Column')
  expect(root.children[0]).toBe('title')
})
