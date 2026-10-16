// Built from the round 4 live run `regress-croupier-seven-card-stud-haiku-1` (2026-10-15-r4-fixes, traces
// 2026-10-16.jsonl:66 to :76, catalog agent-ui--croupier).
// Keyless: the recorded model rounds replay through the real produce(), then the probe checks run with no browser.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'

// T-0286. Live round 4 (:66 to :76, Haiku 5.5). Each prose-only street reply (turns 1, 2, 8 and 10) gets ACTION_NOT_APPLIED
// and its retry updates the table. Turn 1 failed action-updates-surface live only because render_surface named its
// target as the meta-line JSON, `{"surfaceId":"stud-1"}`; produce now reads that as stud-1. The two checks typed at
// the settled table (turns 5 and 6, which offers only Deal again) are answered in prose and stay quiet.
it('croupier-stud-haiku-street-prose: the prose street replies are sent back, the settled-table checks stay quiet', async () => {
  const fixture = parseProbeFixture(readFileSync(new URL('./croupier-stud-haiku-street-prose.json', import.meta.url), 'utf8'))
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => `${c.check}:${c.turn}`)).toEqual([])
  const metas = report.records.map((r) => r.lines.map((l) => JSON.parse(l).a2uiMeta).find((m) => m?.trace !== undefined))
  expect(metas.map((m) => m.trace.failureCodes)).toEqual([
    ['SURFACE_MISSING'], ['ACTION_NOT_APPLIED'], ['ACTION_NOT_APPLIED'], [], ['TEXT_JSONL_ROUTED'], [], [], [], ['ACTION_NOT_APPLIED'], [], ['ACTION_NOT_APPLIED'],
  ])
  expect(metas[1].target).toEqual({ surfaceId: 'stud-1' })
})
