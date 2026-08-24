// report.test.ts — LLD-C4 §5 (GH #1584), AC12: `report` over the empty dir yields `index.json` with
// `records:0` and `m3:null`; over a judged fixture set yields the exact aggregate; output is sorted +
// stable (two runs byte-identical); `--require-m3` follows the floor.

import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runReportLeg, deriveGenuiCorpusIndex, findCellOverflow } from './legs/report.ts'
import { runGenerateLeg } from './legs/generate.ts'
import { runApplyLeg } from './legs/apply.ts'
import { makeTempRepoRoot, cleanupTempRepoRoot } from './test-helpers.ts'
import type { AgentProvider } from '../../src/agent/agent-transport.ts'

let repoRoot: string
afterEach(() => cleanupTempRepoRoot(repoRoot))

/** The 12-cell prompt matrix committed at `corpus-genui/prompts.json` v2 (4 per pack x 3 packs) — the
 *  same ids `seedCell` below drives against, so a full-floor test can seed every cell without
 *  hand-listing ids twice. */
const ALL_PROMPT_IDS = [
  'animated-explainers-1',
  'animated-explainers-2',
  'animated-explainers-3',
  'animated-explainers-4',
  'data-viz-layouts-1',
  'data-viz-layouts-2',
  'data-viz-layouts-3',
  'data-viz-layouts-4',
  'interactive-widgets-1',
  'interactive-widgets-2',
  'interactive-widgets-3',
  'interactive-widgets-4',
] as const

async function seedRecord(repoRoot: string, onlyPrompt: string, html = '<p>chart</p>'): Promise<string> {
  const deps = { provider: { async *stream() { yield `{"genui":{"surfaceId":"q3","html":"${html}"}}` } } as AgentProvider }
  const result = await runGenerateLeg(repoRoot, 'claude-sonnet-5', { onlyPrompt }, deps)
  return result.written[0]!.record.name
}

async function applyVerdict(repoRoot: string, name: string, qualityScore: number, dimensions: Record<string, number>): Promise<void> {
  const rubricText = readFileSync(join(repoRoot, '.claude/docs/rubrics/genui-pack-idiom.md'), 'utf8') as string
  const version = rubricText.match(/^version:\s*(\S+)/m)![1]!
  const path = join(repoRoot, `verdicts-${name.replace(/[^a-z0-9]/gi, '-')}-${Math.random().toString(36).slice(2)}.json`)
  const file = {
    rubric: 'genui-pack-idiom',
    rubricVersion: version,
    judgedBy: 'test-critic',
    date: '2026-08-22',
    verdicts: { [name]: { qualityScore, passed: qualityScore >= 4, dimensions } },
  }
  const { writeFileSync } = await import('node:fs')
  writeFileSync(path, JSON.stringify(file))
  const result = await runApplyLeg(repoRoot, { verdictsPath: path })
  expect(result.ok).toBe(true)
}

/** Seed `scores.length` (<=3) records for ONE (promptId, its own pack) cell, judged with the given
 *  scores in order — the `--runs N` + per-cell-majority precedent this D2 amendment tests against. */
async function seedCell(repoRoot: string, promptId: string, scores: readonly number[]): Promise<void> {
  for (const [i, score] of scores.entries()) {
    const name = await seedRecord(repoRoot, promptId, `<p>run ${i}</p>`)
    await applyVerdict(repoRoot, name, score, { D1: 5, D2: score, D3: 5, D4: 5 })
  }
}

describe('report — over the EMPTY dir: records:0, m3:null', () => {
  it('yields the honest empty aggregate', () => {
    repoRoot = makeTempRepoRoot()
    const result = runReportLeg(repoRoot, { now: () => '2026-08-22T00:00:00.000Z' })
    expect(result.index.records).toEqual([])
    expect(result.index.m3).toBeNull()
    expect(result.index.promptSetVersion).toBe(2)
    expect(result.index.generatedAt).toBe('2026-08-22T00:00:00.000Z')
  })

  it('writes index.json to disk (unless --dry-run)', () => {
    repoRoot = makeTempRepoRoot()
    runReportLeg(repoRoot, {})
    const written = readFileSync(join(repoRoot, 'packages/agent-ui/a2ui/corpus-genui/index.json'), 'utf8') as string
    expect(JSON.parse(written).m3).toBeNull()
  })
})

describe('report — over a judged fixture set: the exact aggregate', () => {
  it('computes judged/passed/passRate/minScore/meanScore/floorMet/perPack correctly', async () => {
    repoRoot = makeTempRepoRoot()
    const nameA = await seedRecord(repoRoot, 'data-viz-layouts-1')
    const nameB = await seedRecord(repoRoot, 'data-viz-layouts-2')
    await applyVerdict(repoRoot, nameA, 5, { D1: 5, D2: 5, D3: 5, D4: 5 })
    await applyVerdict(repoRoot, nameB, 2, { D1: 5, D2: 2, D3: 5, D4: 5 })

    const index = deriveGenuiCorpusIndex(repoRoot)
    expect(index.m3).not.toBeNull()
    const m3 = index.m3!
    expect(m3.judged).toBe(2)
    expect(m3.passed).toBe(1)
    expect(m3.passRate).toBe(0.5)
    expect(m3.minScore).toBe(2)
    expect(m3.meanScore).toBe(3.5)
    // D2 (2026-08-24 amendment): floorMet is now a PER-CELL, ALL-12-CELLS predicate — only 2 of the
    // 12 committed prompt cells carry any record here, so the other 10 (zero records = zero passing
    // runs, <2) already fail the floor regardless of what these two records score.
    expect(m3.floorMet).toBe(false)
    expect(m3.perPack['data-viz-layouts']!.judged).toBe(2)
    expect(m3.perPack['data-viz-layouts']!.passed).toBe(1)
    expect(m3.perPack['data-viz-layouts']!.minScore).toBe(2)
    expect(m3.perPack['data-viz-layouts']!.meanD2).toBe(3.5) // (5+2)/2

    const row = index.records.find((r) => r.name === nameA)!
    expect(row.qualityScore).toBe(5)
    expect(row.passed).toBe(true)
    expect(row.dimensions).toEqual({ D1: 5, D2: 5, D3: 5, D4: 5 })
  })

  it('floorMet:false when only one cell is judged, however well it scores (the other 11 cells have zero records)', async () => {
    repoRoot = makeTempRepoRoot()
    const name = await seedRecord(repoRoot, 'data-viz-layouts-1')
    await applyVerdict(repoRoot, name, 5, { D1: 5, D2: 5, D3: 5, D4: 5 })
    const index = deriveGenuiCorpusIndex(repoRoot)
    expect(index.m3!.floorMet).toBe(false)
  })
})

describe('report — D2 (2026-08-24 amendment): per-cell 2-of-3 majority floor', () => {
  it('floorMet:true when every one of the 12 cells has >=2 of its (<=3) records scoring >=4 — a minority low score never sinks a cell', async () => {
    repoRoot = makeTempRepoRoot()
    for (const promptId of ALL_PROMPT_IDS) {
      await seedCell(repoRoot, promptId, [5, 4, 2]) // 2-of-3 pass; the low 2 is outvoted, not a floor breaker
    }
    const index = deriveGenuiCorpusIndex(repoRoot)
    expect(index.m3!.floorMet).toBe(true)
    expect(index.m3!.judged).toBe(36)
  })

  it('a SINGLE cell short of 2-of-3 sinks the whole floor, even with the other 11 cells clean at 3-of-3', async () => {
    repoRoot = makeTempRepoRoot()
    for (const promptId of ALL_PROMPT_IDS) {
      const isShort = promptId === 'interactive-widgets-2'
      await seedCell(repoRoot, promptId, isShort ? [5, 3, 2] : [5, 5, 5]) // 1-of-3 for the short cell
    }
    const index = deriveGenuiCorpusIndex(repoRoot)
    expect(index.m3!.floorMet).toBe(false)
  })

  it('a cell with ZERO records (a total miss) sinks the floor exactly like a cell with sub-4 records — the invisible-miss defect this amendment fixes', async () => {
    repoRoot = makeTempRepoRoot()
    for (const promptId of ALL_PROMPT_IDS) {
      if (promptId === 'animated-explainers-4') continue // never generated at all — E_NO_GENUI x3, no records
      await seedCell(repoRoot, promptId, [5, 5, 5])
    }
    const index = deriveGenuiCorpusIndex(repoRoot)
    expect(index.m3!.floorMet).toBe(false)
    // the miss cell contributes NO judged records at all, so overall judged is 11 cells x 3
    expect(index.m3!.judged).toBe(33)
  })

  it('a cell needs only 2 records total (not 3) to pass, when both are >=4 — the third run is never required once a majority is already locked in', async () => {
    repoRoot = makeTempRepoRoot()
    for (const promptId of ALL_PROMPT_IDS) {
      await seedCell(repoRoot, promptId, promptId === 'data-viz-layouts-3' ? [5, 4] : [5, 5, 5])
    }
    const index = deriveGenuiCorpusIndex(repoRoot)
    expect(index.m3!.floorMet).toBe(true)
  })

  it('a judged CONTROL record aggregates separately under m3.control, never inside perPack', async () => {
    repoRoot = makeTempRepoRoot()
    const packedName = await seedRecord(repoRoot, 'data-viz-layouts-1')
    await applyVerdict(repoRoot, packedName, 5, { D1: 5, D2: 5, D3: 5, D4: 5 })

    const controlDeps = { provider: { async *stream() { yield '{"genui":{"surfaceId":"q3","html":"<p>plain</p>"}}' } } as AgentProvider }
    const controlResult = await runGenerateLeg(repoRoot, 'claude-sonnet-5', { onlyPrompt: 'data-viz-layouts-1', control: true }, controlDeps)
    const controlName = controlResult.written[0]!.record.name
    await applyVerdict(repoRoot, controlName, 2, { D1: 5, D2: 2, D3: 4, D4: 5 })

    const index = deriveGenuiCorpusIndex(repoRoot)
    // the control record must NOT count toward m3's pack-conditioned judged/floor
    expect(index.m3!.judged).toBe(1)
    expect(index.m3!.control).toBeDefined()
    expect(index.m3!.control!.judged).toBe(1)
    expect(index.m3!.control!.meanD2).toBe(2)
  })
})

describe('report — stable output: two runs are byte-identical (the SAME injected clock)', () => {
  it('re-deriving the index against the SAME on-disk state and clock is byte-identical', async () => {
    repoRoot = makeTempRepoRoot()
    const name = await seedRecord(repoRoot, 'data-viz-layouts-1')
    await applyVerdict(repoRoot, name, 5, { D1: 5, D2: 5, D3: 5, D4: 5 })
    const now = () => '2026-08-22T00:00:00.000Z'
    const a = JSON.stringify(deriveGenuiCorpusIndex(repoRoot, { now }))
    const b = JSON.stringify(deriveGenuiCorpusIndex(repoRoot, { now }))
    expect(a).toBe(b)
  })

  it('records are stable-sorted by name', async () => {
    repoRoot = makeTempRepoRoot()
    await seedRecord(repoRoot, 'data-viz-layouts-3')
    await seedRecord(repoRoot, 'data-viz-layouts-1')
    const index = deriveGenuiCorpusIndex(repoRoot)
    const names = index.records.map((r) => r.name)
    expect(names).toEqual([...names].sort())
  })
})

describe('report — --require-m3 follows the floor', () => {
  it('exits ok:false when the floor is unmet (m3 null)', () => {
    repoRoot = makeTempRepoRoot()
    const result = runReportLeg(repoRoot, { requireM3: true })
    expect(result.ok).toBe(false)
  })

  it('exits ok:true when the floor IS met (all 12 cells at >=2-of-3)', async () => {
    repoRoot = makeTempRepoRoot()
    for (const promptId of ALL_PROMPT_IDS) await seedCell(repoRoot, promptId, [5, 5, 5])
    const result = runReportLeg(repoRoot, { requireM3: true })
    expect(result.ok).toBe(true)
  })

  it('exits ok:false when only some cells are judged, even with every judged record passing', async () => {
    repoRoot = makeTempRepoRoot()
    const name = await seedRecord(repoRoot, 'data-viz-layouts-1')
    await applyVerdict(repoRoot, name, 5, { D1: 5, D2: 5, D3: 5, D4: 5 })
    const result = runReportLeg(repoRoot, { requireM3: true })
    expect(result.ok).toBe(false)
  })

  it('without --require-m3, a missed floor is a RESULT, not a red — exit 0', () => {
    repoRoot = makeTempRepoRoot()
    const result = runReportLeg(repoRoot, {})
    expect(result.ok).toBe(true)
  })
})

describe('report — E_CELL_OVERFLOW: the retry/reset guard (2026-08-24 amendment)', () => {
  it('findCellOverflow reports nothing over <=3 records per cell', async () => {
    repoRoot = makeTempRepoRoot()
    await seedCell(repoRoot, 'data-viz-layouts-1', [5, 4, 3])
    const { loadGenuiRecords } = await import('./fs.ts')
    expect(findCellOverflow(loadGenuiRecords(repoRoot))).toEqual([])
  })

  it('findCellOverflow names a cell carrying MORE than 3 records', async () => {
    repoRoot = makeTempRepoRoot()
    await seedCell(repoRoot, 'data-viz-layouts-1', [5, 4, 3, 2]) // 4 records — one retry too many
    const { loadGenuiRecords } = await import('./fs.ts')
    const overflow = findCellOverflow(loadGenuiRecords(repoRoot))
    expect(overflow).toEqual([{ promptId: 'data-viz-layouts-1', packId: 'data-viz-layouts', count: 4 }])
  })

  it('runReportLeg rejects whole (ok:false, named cellOverflow) and never writes index.json when a cell overflows', async () => {
    repoRoot = makeTempRepoRoot()
    await seedCell(repoRoot, 'data-viz-layouts-1', [5, 4, 3, 2])
    const { existsSync } = await import('node:fs')
    const indexPath = join(repoRoot, 'packages/agent-ui/a2ui/corpus-genui/index.json')
    const existedBefore = existsSync(indexPath)
    const result = runReportLeg(repoRoot, {})
    expect(result.ok).toBe(false)
    expect(result.cellOverflow).toEqual([{ promptId: 'data-viz-layouts-1', packId: 'data-viz-layouts', count: 4 }])
    expect(result.summary).toContain('E_CELL_OVERFLOW')
    expect(result.summary).toContain('data-viz-layouts-1')
    expect(existsSync(indexPath)).toBe(existedBefore) // never written on overflow
  })

  it('overflow on a CONTROL cell (packId:null) is named with packId "control" in the summary, not a literal null', async () => {
    repoRoot = makeTempRepoRoot()
    const controlDeps = { provider: { async *stream() { yield '{"genui":{"surfaceId":"q3","html":"<p>plain</p>"}}' } } as AgentProvider }
    for (let i = 0; i < 4; i++) {
      await runGenerateLeg(repoRoot, 'claude-sonnet-5', { onlyPrompt: 'data-viz-layouts-1', control: true }, controlDeps)
    }
    const { loadGenuiRecords } = await import('./fs.ts')
    const overflow = findCellOverflow(loadGenuiRecords(repoRoot))
    expect(overflow).toEqual([{ promptId: 'data-viz-layouts-1', packId: null, count: 4 }])
    const result = runReportLeg(repoRoot, {})
    expect(result.ok).toBe(false)
    expect(result.summary).toContain('packId=control')
  })
})
