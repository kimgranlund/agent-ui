// from-conformance.test.ts: every `conformance/fixtures.jsonl` row runs green through the kit's judge, and
// a flipped expectation runs red (tools/testkit/from-conformance.ts, T-0011). The row count is read from
// the suite manifest's `fixtureCount`, never pinned here.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { armOffline } from '../../tools/testkit/offline.ts'
import { fromConformanceFixture } from '../../tools/testkit/from-conformance.ts'
import type { ConformanceRow } from '../../tools/testkit/from-conformance.ts'
import { judgeTurnLines } from '../../tools/testkit/judge.ts'
import type { KitFinding } from '../../tools/testkit/findings.ts'
import type { A2uiScenario } from '../../tools/testkit/scenario.ts'
import type { Catalog } from '../catalog/catalog.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { a2uiBasicCatalog } from '../catalog/a2ui-basic/index.ts'

declare const process: { cwd(): string }

let disarm: () => void
beforeAll(() => {
  disarm = armOffline()
})
afterAll(() => disarm())

const SUITE = `${process.cwd()}/packages/agent-ui/a2ui/conformance`
const CATALOGS: Readonly<Record<string, Catalog>> = { 'agent-ui': defaultCatalog, 'a2ui-basic': a2uiBasicCatalog }
const manifest = JSON.parse(readFileSync(`${SUITE}/manifest.json`, 'utf8')) as { fixtureCount: number }
const rows = (readFileSync(`${SUITE}/fixtures.jsonl`, 'utf8') as string)
  .split('\n')
  .filter((l) => l.trim() !== '')
  .map((l) => JSON.parse(l) as ConformanceRow)

/** Judge a one-turn scenario DOM-free. */
function judge(s: A2uiScenario): KitFinding[] {
  const catalog = CATALOGS[s.catalogId]
  if (catalog === undefined) throw new Error(`no catalog ${s.catalogId}`)
  const turn = s.turns[0]!
  return judgeTurnLines((turn.respond as { lines: string[] }).lines, {
    turn, catalog, catalogId: s.catalogId, session: { turns: [] }, respondPath: '$.turns[0].respond.lines', turnPath: '$.turns[0]',
  }).findings
}

describe('conformance rows through the kit judge', () => {
  it('reads every row the manifest counts (fixtureCount)', () => {
    expect(rows.length).toBe(manifest.fixtureCount)
    expect(rows.length).toBeGreaterThan(0)
  })

  for (const row of rows) {
    it(`${row.name} runs green`, () => {
      expect(judge(fromConformanceFixture(row))).toEqual([])
    })
  }

  it('one row with a flipped expectedVerdict.valid runs red with VERDICT_MISMATCH', () => {
    const row = rows.find((r) => r.name === 'valid-button')!
    const flipped = { ...row, expectedVerdict: { ...row.expectedVerdict, valid: false } }
    expect(judge(fromConformanceFixture(flipped)).map((f) => f.code)).toEqual(['VERDICT_MISMATCH'])
  })

  it('the raw-text row: heal.ok follows the expected PARSE, and the verdict is the native text arm', () => {
    const row = rows.find((r) => typeof r.payload === 'string')!
    expect(row, 'the suite carries one raw-text (non-array) row').toBeDefined()
    const s = fromConformanceFixture(row)
    expect(s.turns[0]!.expect!.heal).toEqual({ ok: false })
    // Control: dropping the heal expectation turns the same line into a heal-layer red, not a pass.
    const bare = { ...s, turns: [{ ...s.turns[0]!, expect: { verdict: s.turns[0]!.expect!.verdict! } }] }
    expect(judge(bare).map((f) => `${f.layer}:${f.code}`)).toEqual(['heal:HEAL_UNPARSEABLE'])
    // Control: a wrong verdict expectation on the same row reds through the native PARSE.
    const wrong = { ...s, turns: [{ ...s.turns[0]!, expect: { heal: { ok: false }, verdict: { valid: false, failures: [{ code: 'SCHEMA', path: '' }] } } }] }
    expect(judge(wrong).map((f) => f.code)).toEqual(['VERDICT_MISMATCH'])
  })
})
