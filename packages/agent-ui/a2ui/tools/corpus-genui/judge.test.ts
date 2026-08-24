// judge.test.ts — LLD-C4 §4.2 (GH #1584), AC10: with a stub provider returning a canned verdict JSON
// the leg writes a VerdictsFile that `parseGenuiVerdictsFile` accepts (rubricVersion = the marker read
// from the rubric doc); a stub returning prose yields `E_JUDGE_PARSE`, the file omits that name, exit 1;
// `--calibrate` reports Δ; an existing target path with different bytes halts before any write.

import { describe, it, expect, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runJudgeLeg } from './legs/judge.ts'
import { runGenerateLeg } from './legs/generate.ts'
import { parseGenuiVerdictsFile } from '../../src/corpus-genui/verdicts.ts'
import { makeTempRepoRoot, cleanupTempRepoRoot } from './test-helpers.ts'
import type { AgentProvider } from '../../src/agent/agent-transport.ts'

let repoRoot: string
afterEach(() => cleanupTempRepoRoot(repoRoot))

function stubStreamingJson(json: string): AgentProvider {
  return {
    async *stream() {
      yield json
    },
  }
}

async function seedOnePendingRecord(repoRoot: string): Promise<void> {
  const genDeps = { provider: { async *stream() { yield '{"genui":{"surfaceId":"q3","html":"<p>chart</p>"}}' } } as AgentProvider }
  const result = await runGenerateLeg(repoRoot, 'claude-sonnet-5', { onlyPrompt: 'data-viz-layouts-1' }, genDeps)
  expect(result.written).toHaveLength(1)
}

const GOOD_REPLY = JSON.stringify({ dimensions: { D1: 5, D2: 5, D3: 5, D4: 5 }, failingDimensions: [], rationale: 'clean' })
const PROSE_REPLY = 'This record looks great, I would score it a 5 across the board.'

describe('judge — a stub provider returning canned verdict JSON', () => {
  it('writes a VerdictsFile parseGenuiVerdictsFile accepts, citing the LIVE rubric marker', async () => {
    repoRoot = makeTempRepoRoot()
    await seedOnePendingRecord(repoRoot)
    const rubricText = readFileSync(join(repoRoot, '.claude/docs/rubrics/genui-pack-idiom.md'), 'utf8') as string
    const version = rubricText.match(/^version:\s*(\S+)/m)![1]!

    const result = await runJudgeLeg(repoRoot, 'claude-sonnet-5', {}, { provider: stubStreamingJson(GOOD_REPLY) })
    expect(result.ok).toBe(true)
    expect(result.parseFailures).toEqual([])
    expect(Object.keys(result.verdicts)).toHaveLength(1)
    const [name, verdict] = Object.entries(result.verdicts)[0]!
    expect(name).toMatch(/^data-viz-layouts--data-viz-layouts-1--/)
    expect(verdict.qualityScore).toBe(5)
    expect(verdict.passed).toBe(true)

    expect(result.outPath).toBeDefined()
    const written = readFileSync(join(repoRoot, result.outPath!), 'utf8') as string
    const parsed = parseGenuiVerdictsFile(written, version)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.file.rubricVersion).toBe(version)
      expect(parsed.file.verdicts[name]!.qualityScore).toBe(5)
    }
  })

  it('the model never computes qualityScore/passed itself — the leg recomputes MIN and >=4 (ignores a wrong model claim)', async () => {
    repoRoot = makeTempRepoRoot()
    await seedOnePendingRecord(repoRoot)
    const skewed = JSON.stringify({ dimensions: { D1: 5, D2: 2, D3: 5, D4: 5 } }) // model never even claims qualityScore/passed
    const result = await runJudgeLeg(repoRoot, 'claude-sonnet-5', {}, { provider: stubStreamingJson(skewed) })
    const verdict = Object.values(result.verdicts)[0]!
    expect(verdict.qualityScore).toBe(2) // MIN(5,2,5,5)
    expect(verdict.passed).toBe(false)
    expect(verdict.failingDimensions).toEqual(['D2'])
  })
})

describe('judge — a prose reply is E_JUDGE_PARSE; that name is OMITTED from the file, exit 1', () => {
  it('reports the parse failure and never writes a verdict for that name', async () => {
    repoRoot = makeTempRepoRoot()
    await seedOnePendingRecord(repoRoot)
    const result = await runJudgeLeg(repoRoot, 'claude-sonnet-5', {}, { provider: stubStreamingJson(PROSE_REPLY) })
    expect(result.ok).toBe(false)
    expect(result.parseFailures).toHaveLength(1)
    expect(result.parseFailures[0]!.reason).toBe('E_JUDGE_PARSE')
    expect(Object.keys(result.verdicts)).toEqual([])

    const written = readFileSync(join(repoRoot, result.outPath!), 'utf8') as string
    const parsed = JSON.parse(written) as { verdicts: Record<string, unknown> }
    expect(Object.keys(parsed.verdicts)).toEqual([])
  })
})

describe('judge — --calibrate scores twice and reports per-dimension Δ, writes nothing', () => {
  it('agreement (Δ 0 everywhere) is ok:true', async () => {
    repoRoot = makeTempRepoRoot()
    await seedOnePendingRecord(repoRoot)
    const result = await runJudgeLeg(repoRoot, 'claude-sonnet-5', { calibrate: true }, { provider: stubStreamingJson(GOOD_REPLY) })
    expect(result.calibration).toHaveLength(1)
    expect(result.calibration![0]!.maxDelta).toBe(0)
    expect(result.ok).toBe(true)
    expect(result.outPath).toBeUndefined() // --calibrate never writes
  })

  it('a Δ > 1 spread between the two reads is red (ok:false)', async () => {
    repoRoot = makeTempRepoRoot()
    await seedOnePendingRecord(repoRoot)
    let call = 0
    const provider: AgentProvider = {
      async *stream() {
        call += 1
        yield call === 1 ? GOOD_REPLY : JSON.stringify({ dimensions: { D1: 1, D2: 5, D3: 5, D4: 5 } }) // D1 delta = 4
      },
    }
    const result = await runJudgeLeg(repoRoot, 'claude-sonnet-5', { calibrate: true }, { provider })
    expect(result.calibration![0]!.maxDelta).toBeGreaterThan(1)
    expect(result.ok).toBe(false)
  })
})

describe('judge — a differing-bytes target halts before any write, both hashes named', () => {
  it('a pre-existing --out file with DIFFERENT content halts (archiveOutcome: conflict)', async () => {
    repoRoot = makeTempRepoRoot()
    await seedOnePendingRecord(repoRoot)
    const outPath = 'packages/agent-ui/a2ui/corpus-genui/verdicts/2026-08-22--claim.json'
    mkdirSync(join(repoRoot, 'packages/agent-ui/a2ui/corpus-genui/verdicts'), { recursive: true })
    writeFileSync(join(repoRoot, outPath), '{"different": "bytes"}')

    const result = await runJudgeLeg(repoRoot, 'claude-sonnet-5', { out: outPath, now: () => '2026-08-22' }, { provider: stubStreamingJson(GOOD_REPLY) })
    expect(result.archiveOutcome).toBe('conflict')
    expect(result.conflict).toBeDefined()
    // nothing OVERWRITTEN — the pre-existing file's bytes are untouched
    expect(readFileSync(join(repoRoot, outPath), 'utf8')).toBe('{"different": "bytes"}')
  })
})

describe('judge — --dry-run never calls the judge model, writes nothing (GH #1608)', () => {
  it('reports the intended outPath but never invokes the provider or writes a file', async () => {
    repoRoot = makeTempRepoRoot()
    await seedOnePendingRecord(repoRoot)
    let calls = 0
    const provider: AgentProvider = {
      async *stream() {
        calls += 1
        yield GOOD_REPLY
      },
    }
    const result = await runJudgeLeg(repoRoot, 'claude-sonnet-5', { dryRun: true }, { provider })
    expect(calls).toBe(0) // the API is never hit under --dry-run
    expect(result.ok).toBe(true)
    expect(result.verdicts).toEqual({})
    expect(result.parseFailures).toEqual([])
    expect(result.outPath).toBeDefined()
    expect(() => readFileSync(join(repoRoot, result.outPath!), 'utf8')).toThrow()
  })

  it('--dry-run --calibrate also never calls the provider', async () => {
    repoRoot = makeTempRepoRoot()
    await seedOnePendingRecord(repoRoot)
    let calls = 0
    const provider: AgentProvider = {
      async *stream() {
        calls += 1
        yield GOOD_REPLY
      },
    }
    const result = await runJudgeLeg(repoRoot, 'claude-sonnet-5', { dryRun: true, calibrate: true }, { provider })
    expect(calls).toBe(0)
    expect(result.calibration).toEqual([])
  })
})
