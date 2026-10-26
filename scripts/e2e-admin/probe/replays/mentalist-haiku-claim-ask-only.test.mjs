// T-0468 (live round 14 cluster W, `.sdlc/evals/rounds/2026-10-26-r14-pattern/`, smoke-mentalist-first-answer-haiku-1,
// traces 2026-10-26.jsonl:7 and :8): Haiku 5.5 opened Twenty Questions with a meta-line declaring an ask on ask-1 and no
// render_surface call. The SURFACE_CLAIMED repair asked only for the claimed surface, so round 2 built ask-1 alone (one
// OptionDeck) and the game never got a GameHud; "Yes." repeated it for ask-2. The fix has two legs: the SURFACE_CLAIMED
// hint asks a game for its HUD surface beside the ask deck, and the game-ask-hud check (GAME_HUD_MISSING) sends back a
// game opening whose new ask deck has no GameHud anywhere. Both turns replay their recorded rounds verbatim, so turn 0's
// ask-only round now draws the finding that names the missing HUD on rounds 2 and 3 and ships tallied on the round bound; the live
// measure of the repaired round is the round 15 rerun of smoke-mentalist-first-answer-haiku.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'

const componentsOn = (lines, sid) =>
  lines.map((l) => JSON.parse(l)).filter((m) => m.updateComponents?.surfaceId === sid).flatMap((m) => m.updateComponents.components.map((c) => c.component))

it('mentalist-haiku-claim-ask-only: the SURFACE_CLAIMED repair asks a game for its HUD, and an ask-only opening draws GAME_HUD_MISSING', async () => {
  const produce = readFileSync(new URL('../../../../packages/agent-ui/a2ui/src/agent/produce.ts', import.meta.url), 'utf8')
  expect(produce).toMatch(/In a game, also send the game's HUD surface beside the ask deck in this answer/)

  const fixture = parseProbeFixture(readFileSync(new URL('./mentalist-haiku-claim-ask-only.json', import.meta.url), 'utf8'))
  expect(fixture.steps.map((s) => s.say)).toEqual(["Let's play Twenty Questions. I'm thinking of something.", 'Yes.'])
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  const meta = (i) => report.records[i].lines.map((l) => JSON.parse(l).a2uiMeta).find((m) => m?.trace !== undefined)
  expect(meta(0).trace).toMatchObject({ rounds: 3, failureCodes: ['GAME_HUD_MISSING', 'SEMANTIC_UNCORRECTED'] })
  expect(componentsOn(report.records[0].lines, 'ask-1')).toEqual(['OptionDeck'])
  expect(meta(1).trace.failureCodes).toContain('SURFACE_CLAIMED')
})
