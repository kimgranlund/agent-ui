// T-0363 (Kim 2026-10-18): grammar.md admits a game's ONE HUD surface beside its ask. AUTHORED, keyless: turn 0's
// round 1 is smoke-mentalist-first-answer-haiku turn 0 round 0 verbatim (Haiku 5.5 put a Progress and the question on
// ask-1), which draws FEED_SCOPE; round 2 is authored to the split: ask-1 holds the question, a SegmentedControl and ONE
// Answer Button, and hud-1 holds the GameHud and the question Timeline. Turn 1 answers ask-1 by click and opens ask-2
// while it updates hud-1 under "target" in the same round.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'

const componentsOn = (lines, sid) =>
  lines.map((l) => JSON.parse(l)).filter((m) => m.updateComponents?.surfaceId === sid).flatMap((m) => m.updateComponents.components.map((c) => c.component))

it('mentalist-ask-hud-beside: the ask keeps its answer control and the GameHud ships on hud-1 beside it', async () => {
  const fixture = parseProbeFixture(readFileSync(new URL('./mentalist-ask-hud-beside.json', import.meta.url), 'utf8'))
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  const meta = (i) => report.records[i].lines.map((l) => JSON.parse(l).a2uiMeta).find((m) => m?.trace !== undefined)
  expect(meta(0).trace).toMatchObject({ rounds: 2, failureCodes: ['FEED_SCOPE'] })
  expect(meta(0).ask).toEqual({ surfaceId: 'ask-1' })
  expect(componentsOn(report.records[0].lines, 'ask-1')).not.toContain('GameHud')
  expect(componentsOn(report.records[0].lines, 'hud-1')).toEqual(expect.arrayContaining(['GameHud', 'Timeline', 'TimelineItem']))
  expect(meta(1).trace).toMatchObject({ rounds: 1, failureCodes: [] })
  expect(meta(1).ask).toEqual({ surfaceId: 'ask-2' })
  expect(meta(1).target).toEqual({ surfaceId: 'hud-1' })
  expect(componentsOn(report.records[1].lines, 'hud-1')).toContain('GameHud')
})
