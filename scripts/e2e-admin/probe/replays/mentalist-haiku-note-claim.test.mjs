// T-0442 (round `.sdlc/evals/rounds/2026-10-24-t0440-sweep/`, pick-mentalist-answer-deck-haiku-1, 2026-10-24.jsonl:13):
// Haiku 5.5 opened Twenty Questions with a meta-line declaring an ask on ask-1 and prose saying "Answer Yes, No, or Sort
// of below", with no render_surface call and no A2UI line, and the producer shipped it clean on round 1. Turn 0's round
// 1 is that recorded round verbatim; a reply that names a surface it never creates now keeps the full repair
// (SURFACE_CLAIMED, render_surface offered and forced), and round 2 is AUTHORED as a render_surface call carrying the
// mentalist-ask-hud-beside split: ask-1 one OptionDeck, hud-1 the GameHud. Turn 1 presses Yes on ask-1, as that replay does.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'

const componentsOn = (lines, sid) =>
  lines.map((l) => JSON.parse(l)).filter((m) => m.updateComponents?.surfaceId === sid).flatMap((m) => m.updateComponents.components.map((c) => c.component))

it('mentalist-haiku-note-claim: a note-only opening that claims the card below is repaired and the OptionDeck lands', async () => {
  const fixture = parseProbeFixture(readFileSync(new URL('./mentalist-haiku-note-claim.json', import.meta.url), 'utf8'))
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  const meta = (i) => report.records[i].lines.map((l) => JSON.parse(l).a2uiMeta).find((m) => m?.trace !== undefined)
  expect(meta(0).trace).toMatchObject({ rounds: 2, failureCodes: ['SURFACE_CLAIMED'] })
  expect(meta(0).ask).toEqual({ surfaceId: 'ask-1' })
  expect(componentsOn(report.records[0].lines, 'ask-1')).toEqual(['OptionDeck'])
  expect(componentsOn(report.records[0].lines, 'hud-1')).toContain('GameHud')
  expect(meta(1).trace).toMatchObject({ rounds: 1, failureCodes: [] })
})
