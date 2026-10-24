// T-0448 (round `.sdlc/evals/rounds/2026-10-24-r13-pattern/`, claim-croupier-rename-table-haiku-3, 2026-10-24.jsonl:154,155):
// Haiku 5.5 answered "Rename the table to Kim's table" with a note-only reply targeting table-1, "Done, the table is now
// Kim's table", no render_surface call and no surface id in the prose, and the producer shipped it clean on round 1.
// Turn 1's round 1 is that recorded round verbatim; a targeted say reply that claims a change it never sent now keeps the
// full repair (CHANGE_CLAIMED, render_surface offered and forced), and round 2 is AUTHORED as a render_surface call that
// retitles turn 0's CardTable.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'

const trace = (record) => record.lines.map((l) => JSON.parse(l).a2uiMeta?.trace).find((t) => t !== undefined)
const tableTitles = (record) =>
  record.lines.map((l) => JSON.parse(l)).filter((m) => m.updateComponents?.surfaceId === 'table-1').flatMap((m) => m.updateComponents.components.map((c) => c.title))

it('croupier-haiku-rename-claim-no-id: a targeted rename claimed in prose alone is repaired and the title lands', async () => {
  const fixture = parseProbeFixture(readFileSync(new URL('./croupier-haiku-rename-claim-no-id.json', import.meta.url), 'utf8'))
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[1])).toMatchObject({ rounds: 2, failureCodes: ['CHANGE_CLAIMED'] })
  expect(tableTitles(report.records[1])).toEqual(["Kim's table"])
})
