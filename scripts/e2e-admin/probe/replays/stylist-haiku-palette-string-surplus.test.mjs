// T-0591 (round `.sdlc/evals/rounds/2026-10-29-r21-pattern/`, smoke-stylist-palette-haiku-2, 2026-10-29.jsonl:129):
// Haiku 5.5 answered "Propose a calm blue palette for a banking app." with render_surface whose `messages` was the same
// 2,398-character JSON string on all three rounds, one `}` too many after the updateDataModel at character 565, so every
// round was PARSE and the turn shipped no palette. A string whose only defect is one surplus closer drops it, so every
// recorded round decodes and the turn ships the palette (the rounds after the first answer a CONTRAST_PAIR_WRAPPED ask).
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'
import { shipped, trace } from './unclosed-array.mjs'

const fixture = parseProbeFixture(readFileSync(new URL('./stylist-haiku-palette-string-surplus.json', import.meta.url), 'utf8'))

it('stylist-haiku-palette-string-surplus: the surplus closer is dropped and the turn ships the palette', async () => {
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[0]).failureCodes).toContain('MESSAGES_STRING_DECODED')
  expect(trace(report.records[0]).failureCodes).not.toContain('PARSE')
  expect(shipped(report.records[0])).toEqual(expect.arrayContaining(['Swatch', 'Ramp', 'ContrastPair']))
})
