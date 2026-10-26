// T-0456 guarding T-0451 (live run reach-concierge-room-stepflow-haiku-1, 2026-10-24.jsonl:1, the T-0451 run records):
// after the fix Haiku 5.5 answered "I'd like to book a room." with a StepFlow. The fix is routing, not producer code:
// the step-flow mini-skill carries the `room` trigger, so the bare ask composes the StepFlow teaching (round 13 cluster
// T routed only product-presentation and shipped a BookingForm). The fixture is the live run's own keyless replay; the
// routing leg re-runs today's mini-skill selection on the recorded ask, so dropping the trigger reds this file.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { DEFAULT_MINI_SKILL_CAP, MINI_SKILLS, selectMiniSkills } from '../../../../packages/agent-ui/a2ui/src/agent/mini-skills.ts'
import { parseProbeFixture } from '../model.ts'
import { fixtureCatalogId, offlineReplay } from '../trace.ts'

const shipped = (record) =>
  record.lines.flatMap((l) => JSON.parse(l).updateComponents?.components ?? []).map((c) => c.component)

it('concierge-haiku-room-stepflow: a bare room-booking ask routes step-flow and ships a StepFlow', async () => {
  const fixture = parseProbeFixture(readFileSync(new URL('./concierge-haiku-room-stepflow.json', import.meta.url), 'utf8'))
  const ask = fixture.steps[0].say
  expect(ask).toBe("I'd like to book a room.")
  const routed = selectMiniSkills(ask, MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, fixtureCatalogId(fixture)).map((m) => m.id)
  expect(routed, 'the StepFlow teaching reaches the bare room ask').toContain('step-flow')
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(shipped(report.records[0])).toContain('StepFlow')
})
