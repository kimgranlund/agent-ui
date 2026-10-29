// T-0583 (round `.sdlc/evals/rounds/2026-10-29-r19-pattern/`, cluster Z, smoke-negotiator-first-offer-haiku-3,
// 2026-10-29.jsonl:83,84, converted with `npm run chat:probe -- --from-trace`): Haiku 5.5 answered "I offer 20." with a
// meta note targeting ask-1 ("... I will come down to $165, and not one coin lower ...") and no tool call.
// CHANGE_CLAIM_IN_REPLY had no "come down to $N", so the counter shipped note-only on round 1 with the GameHud deal
// unmoved, and action-updates-surface failed. Turn 1's round 1 is that recorded round verbatim; the claim now keeps
// the full repair (CHANGE_CLAIMED, render_surface offered and forced), and round 2 is AUTHORED as the counter landing
// on hud-1 (GameHud asking $165, the sparkline 180 to 165) and the ask-1 move card.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'
import { shipped, trace } from './unclosed-array.mjs'

it('negotiator-haiku-come-down-claim: "come down to $165" with no update is CHANGE_CLAIMED, and the repair moves the GameHud', async () => {
  const fixture = parseProbeFixture(readFileSync(new URL('./negotiator-haiku-come-down-claim.json', import.meta.url), 'utf8'))
  expect(fixture.turns[1].rounds[0].text).toContain('I will come down to $165')
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[1])).toMatchObject({ rounds: 2, failureCodes: ['CHANGE_CLAIMED'] })
  expect(shipped(report.records[1])).toContain('GameHud')
})
