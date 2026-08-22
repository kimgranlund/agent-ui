// report.test.ts — LLD-C4 §5 (GH #1584), AC12: `report` over the empty dir yields `index.json` with
// `records:0` and `m3:null`; over a judged fixture set yields the exact aggregate; output is sorted +
// stable (two runs byte-identical); `--require-m3` follows the floor.

import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runReportLeg, deriveGenuiCorpusIndex } from './legs/report.ts'
import { runGenerateLeg } from './legs/generate.ts'
import { runApplyLeg } from './legs/apply.ts'
import { makeTempRepoRoot, cleanupTempRepoRoot } from './test-helpers.ts'
import type { AgentProvider } from '../../src/agent/agent-transport.ts'

let repoRoot: string
afterEach(() => cleanupTempRepoRoot(repoRoot))

async function seedRecord(repoRoot: string, onlyPrompt: string, html = '<p>chart</p>'): Promise<string> {
  const deps = { provider: { async *stream() { yield `{"genui":{"surfaceId":"q3","html":"${html}"}}` } } as AgentProvider }
  const result = await runGenerateLeg(repoRoot, 'claude-sonnet-5', { onlyPrompt }, deps)
  return result.written[0]!.record.name
}

async function applyVerdict(repoRoot: string, name: string, qualityScore: number, dimensions: Record<string, number>): Promise<void> {
  const rubricText = readFileSync(join(repoRoot, '.claude/docs/rubrics/genui-pack-idiom.md'), 'utf8') as string
  const version = rubricText.match(/^version:\s*(\S+)/m)![1]!
  const path = join(repoRoot, `verdicts-${name.replace(/[^a-z0-9]/gi, '-')}.json`)
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

describe('report — over the EMPTY dir: records:0, m3:null', () => {
  it('yields the honest empty aggregate', () => {
    repoRoot = makeTempRepoRoot()
    const result = runReportLeg(repoRoot, { now: () => '2026-08-22T00:00:00.000Z' })
    expect(result.index.records).toEqual([])
    expect(result.index.m3).toBeNull()
    expect(result.index.promptSetVersion).toBe(1)
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
    expect(m3.floorMet).toBe(false) // a single sub-4 record fails the floor
    expect(m3.perPack['data-viz-layouts']!.judged).toBe(2)
    expect(m3.perPack['data-viz-layouts']!.passed).toBe(1)
    expect(m3.perPack['data-viz-layouts']!.minScore).toBe(2)
    expect(m3.perPack['data-viz-layouts']!.meanD2).toBe(3.5) // (5+2)/2

    const row = index.records.find((r) => r.name === nameA)!
    expect(row.qualityScore).toBe(5)
    expect(row.passed).toBe(true)
    expect(row.dimensions).toEqual({ D1: 5, D2: 5, D3: 5, D4: 5 })
  })

  it('floorMet:true when every judged pack-conditioned record passes', async () => {
    repoRoot = makeTempRepoRoot()
    const name = await seedRecord(repoRoot, 'data-viz-layouts-1')
    await applyVerdict(repoRoot, name, 5, { D1: 5, D2: 5, D3: 5, D4: 5 })
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

  it('exits ok:true when the floor IS met', async () => {
    repoRoot = makeTempRepoRoot()
    const name = await seedRecord(repoRoot, 'data-viz-layouts-1')
    await applyVerdict(repoRoot, name, 5, { D1: 5, D2: 5, D3: 5, D4: 5 })
    const result = runReportLeg(repoRoot, { requireM3: true })
    expect(result.ok).toBe(true)
  })

  it('without --require-m3, a missed floor is a RESULT, not a red — exit 0', () => {
    repoRoot = makeTempRepoRoot()
    const result = runReportLeg(repoRoot, {})
    expect(result.ok).toBe(true)
  })
})
