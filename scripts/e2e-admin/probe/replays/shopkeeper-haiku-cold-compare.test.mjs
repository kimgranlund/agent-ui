// T-0456 guarding T-0453 (live run reach-shopkeeper-compare-haiku-1, 2026-10-25.jsonl:1, the T-0453 run records): after
// the fix Haiku 5.5 answered a cold "Compare your two cheapest lamps." with ONE OptionCompare of illustrative products.
// Round 13 cluster V refused it for lack of prices or asked which lamps were meant. The fix is the shopkeeper persona
// (v6): the catalog is the shop's own, so a cold product ask is answered from it. The fixture is the live run's own
// keyless replay; the content leg reads the persona from the agent content registry the page composes from, so
// reverting v6 reds this file.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { AGENT_CONTENT } from '../../../../site/agent-content/registry.gen.ts'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'

const shipped = (turn) => turn.lines.flatMap((l) => JSON.parse(l).updateComponents?.components ?? []).map((c) => c.component)

it('shopkeeper-haiku-cold-compare: a cold compare ask is answered with one OptionCompare from the shop catalog', async () => {
  const persona = AGENT_CONTENT.find((r) => r.kind === 'persona' && r.id === 'shopkeeper')?.body ?? ''
  expect(persona).toMatch(/you answer any product ask from it, including one that names nothing on screen \("your two cheapest lamps"/)
  expect(persona).toMatch(/never say you lack prices or ask the customer which products they mean/)
  expect(persona).toMatch(/or a cold "compare your two cheapest lamps" where you pick the products from your catalog\) → ONE side-by-side option compare/)

  const fixture = parseProbeFixture(readFileSync(new URL('./shopkeeper-haiku-cold-compare.json', import.meta.url), 'utf8'))
  expect(fixture.steps[0].say).toBe('Compare your two cheapest lamps.')
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(shipped(report.records[0]).filter((c) => c === 'OptionCompare')).toHaveLength(1)
})
