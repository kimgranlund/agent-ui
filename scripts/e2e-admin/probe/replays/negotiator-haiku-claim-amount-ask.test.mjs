// T-0479 (live round 15 cluster W2, `.sdlc/evals/rounds/2026-10-26-r15-pattern/`, smoke-negotiator-first-offer-haiku-1,
// trace 2026-10-27.jsonl:9): "I'd like to buy your brass lantern. What's your price?" opened with a meta-line declaring
// an ask on ask-1 and no render_surface call. After SURFACE_CLAIMED, round 2 built ask-1 alone (a Card holding an
// AmountPicker) and the deal never got a GameHud. The game-ask-hud check stayed silent: it judged only a new OptionDeck,
// and neither the player's words nor the reply hold a game word. It now judges a new ask holding any play control and
// knows the game from the session's game persona (`fixture.agent`, the host's persona id), so the ask-only round draws
// GAME_HUD_MISSING on rounds 2 and 3 and ships tallied on the round bound. Both turns replay their recorded rounds
// verbatim, so no round ships a GameHud and the expect-free fixture keeps every probe check green; the live measure of
// the repaired round is a separate paid rerun (Kim's call).
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'

const componentsOn = (lines, sid) =>
  lines.map((l) => JSON.parse(l)).filter((m) => m.updateComponents?.surfaceId === sid).flatMap((m) => m.updateComponents.components.map((c) => c.component))

it('negotiator-haiku-claim-amount-ask: an amount ask with no GameHud in a game persona draws GAME_HUD_MISSING', async () => {
  const fixture = parseProbeFixture(readFileSync(new URL('./negotiator-haiku-claim-amount-ask.json', import.meta.url), 'utf8'))
  expect(fixture.agent).toBe('negotiator')
  expect(fixture.steps.map((s) => s.say)).toEqual(["I'd like to buy your brass lantern. What's your price?", 'I offer 20.'])
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  const meta = (i) => report.records[i].lines.map((l) => JSON.parse(l).a2uiMeta).find((m) => m?.trace !== undefined)
  expect(meta(0).trace).toMatchObject({ rounds: 3, failureCodes: ['GAME_HUD_MISSING', 'SEMANTIC_UNCORRECTED'] })
  expect(componentsOn(report.records[0].lines, 'ask-1')).toContain('AmountPicker')
})
