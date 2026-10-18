// T-0363 (Kim 2026-10-18): grammar.md admits a game's ONE HUD surface beside its ask, and a game's end settles that HUD.
// AUTHORED, keyless: turn 0 creates ask-1 (a Slider, an Offer / Accept / Walk away SegmentedControl and ONE Send Button)
// and the deal sheet deal-1 (item Card, GameHud, price Sparkline); turn 1 ("I offer 200.") opens ask-2 and updates
// deal-1 under "target"; turn 2 answers ask-2 with Accept by click and is the closing turn: flowEnd, no ask, and one
// deal-1 update adding the ResultCard.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { FEED_SURFACE_TYPE_SET } from '../../../../packages/agent-ui/a2ui/src/agent/feed-catalog.ts'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'

const componentsOn = (lines, sid) =>
  lines.map((l) => JSON.parse(l)).filter((m) => m.updateComponents?.surfaceId === sid).flatMap((m) => m.updateComponents.components.map((c) => c.component))

it('negotiator-ask-hud-beside: each offer is an ask beside the deal sheet, and Accept settles the sheet', async () => {
  const fixture = parseProbeFixture(readFileSync(new URL('./negotiator-ask-hud-beside.json', import.meta.url), 'utf8'))
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  const meta = (i) => report.records[i].lines.map((l) => JSON.parse(l).a2uiMeta).find((m) => m?.trace !== undefined)
  for (const i of [0, 1, 2]) expect(meta(i).trace).toMatchObject({ rounds: 1, failureCodes: [] })
  for (const [i, sid] of [[0, 'ask-1'], [1, 'ask-2']]) {
    expect(meta(i).ask).toEqual({ surfaceId: sid })
    const types = componentsOn(report.records[i].lines, sid)
    expect(types.filter((t) => t === 'Button')).toHaveLength(1)
    expect(types.filter((t) => !FEED_SURFACE_TYPE_SET.has(t))).toEqual([])
    expect(componentsOn(report.records[i].lines, 'deal-1')).toContain('GameHud')
  }
  expect(meta(1).target).toEqual({ surfaceId: 'deal-1' })
  expect(meta(2).flowEnd).toBe(true)
  expect(meta(2).ask).toBeUndefined()
  expect(componentsOn(report.records[2].lines, 'deal-1')).toEqual(expect.arrayContaining(['GameHud', 'ResultCard']))
})
