// T-0468 (live round 14 cluster W, `.sdlc/evals/rounds/2026-10-26-r14-pattern/`, smoke-mentalist-first-answer-haiku-3,
// traces 2026-10-26.jsonl:81 and :82): the negative control for the game-ask-hud check. Turn 0 opened hud-1 with its
// GameHud beside the ask-1 OptionDeck, so the check stays silent there. Turn 1 ("Yes.") is note-only on round 1
// (ACTION_NOT_APPLIED on hud-1), empty on round 2 (PARSE) and note-only again on round 3, whose SURFACE_CLAIMED on the
// last round halts with no earlier valid round to ship (T-0442). Every recorded round is the model's, so that halt is
// pinned here as recorded; only a live rerun measures whether the repair wording moves it.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'

const componentsOn = (lines, sid) =>
  lines.map((l) => JSON.parse(l)).filter((m) => m.updateComponents?.surfaceId === sid).flatMap((m) => m.updateComponents.components.map((c) => c.component))

it('mentalist-haiku-claim-last-round: an opening with its GameHud draws no GAME_HUD_MISSING; the all-model last-round claim still halts', async () => {
  const fixture = parseProbeFixture(readFileSync(new URL('./mentalist-haiku-claim-last-round.json', import.meta.url), 'utf8'))
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([['no-halt', 1]])
  const meta = report.records[0].lines.map((l) => JSON.parse(l).a2uiMeta).find((m) => m?.trace !== undefined)
  expect(meta.trace.failureCodes ?? []).not.toContain('GAME_HUD_MISSING')
  expect(componentsOn(report.records[0].lines, 'hud-1')).toContain('GameHud')
  expect(componentsOn(report.records[0].lines, 'ask-1')).toEqual(['OptionDeck'])
  expect(report.records[1].lines.join('\n')).toContain('SURFACE_CLAIMED')
})
