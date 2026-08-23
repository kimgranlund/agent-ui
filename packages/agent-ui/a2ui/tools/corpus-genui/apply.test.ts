// apply.test.ts — LLD-C4 (GH #1584), AC11: apply over a pending fixture shard + a verdicts fixture
// rewrites exactly the named records and archives the file; a verdict naming an unknown record halts
// with nothing written; re-applying the same file is a byte-identical no-op; a DIFFERENT verdict for an
// already-judged name halts naming both.

import { describe, it, expect, afterEach } from 'vitest'
import { writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { runApplyLeg } from './legs/apply.ts'
import { runGenerateLeg } from './legs/generate.ts'
import { validateGenuiRecord } from '../../src/corpus-genui/record.ts'
import { makeTempRepoRoot, cleanupTempRepoRoot } from './test-helpers.ts'
import type { AgentProvider } from '../../src/agent/agent-transport.ts'

let repoRoot: string
afterEach(() => cleanupTempRepoRoot(repoRoot))

async function seedOnePendingRecord(repoRoot: string): Promise<string> {
  const deps = { provider: { async *stream() { yield '{"genui":{"surfaceId":"q3","html":"<p>chart</p>"}}' } } as AgentProvider }
  const result = await runGenerateLeg(repoRoot, 'claude-sonnet-5', { onlyPrompt: 'data-viz-layouts-1' }, deps)
  return result.written[0]!.record.name
}

function writeVerdictsFixture(repoRoot: string, path: string, verdicts: Record<string, unknown>, date = '2026-08-22'): void {
  const rubricText = readFileSync(join(repoRoot, '.claude/docs/rubrics/genui-pack-idiom.md'), 'utf8') as string
  const version = rubricText.match(/^version:\s*(\S+)/m)![1]!
  writeFileSync(
    join(repoRoot, path),
    JSON.stringify({ rubric: 'genui-pack-idiom', rubricVersion: version, judgedBy: 'test-critic', date, verdicts }, null, 2),
  )
}

describe('apply — rewrites exactly the named records and archives the file', () => {
  it('flips a pending record to judged with the verdict values, archives verbatim under verdicts/', async () => {
    repoRoot = makeTempRepoRoot()
    const name = await seedOnePendingRecord(repoRoot)
    writeVerdictsFixture(repoRoot, 'incoming.json', { [name]: { qualityScore: 5, passed: true, failingDimensions: [] } })

    const result = await runApplyLeg(repoRoot, { verdictsPath: join(repoRoot, 'incoming.json') })
    expect(result.ok).toBe(true)
    expect(result.updated).toEqual([name])
    expect(result.noops).toEqual([])
    expect(result.archiveOutcome).toBe('archived')

    const shardText = readFileSync(join(repoRoot, 'packages/agent-ui/a2ui/corpus-genui/records/v1/data-viz-layouts.jsonl'), 'utf8') as string
    const record = JSON.parse(shardText.trim())
    expect(record.meta.status).toBe('judged')
    expect(record.meta.qualityScore).toBe(5)
    expect(record.meta.passed).toBe(true)
    expect(record.meta.verdictDate).toBe('2026-08-22')
    expect(validateGenuiRecord(record)).toEqual([])

    const archived = readdirSync(join(repoRoot, 'packages/agent-ui/a2ui/corpus-genui/verdicts')) as string[]
    expect(archived).toHaveLength(1)
  })
})

describe('apply — an unknown name halts with nothing written', () => {
  it('reports the issue, writes neither a record nor an archive file', async () => {
    repoRoot = makeTempRepoRoot()
    await seedOnePendingRecord(repoRoot)
    writeVerdictsFixture(repoRoot, 'incoming.json', { 'not-a-real-record--x--y': { qualityScore: 5, passed: true } })

    const result = await runApplyLeg(repoRoot, { verdictsPath: join(repoRoot, 'incoming.json') })
    expect(result.ok).toBe(false)
    expect(result.issues[0]).toMatch(/no record with this name/)

    const shardText = readFileSync(join(repoRoot, 'packages/agent-ui/a2ui/corpus-genui/records/v1/data-viz-layouts.jsonl'), 'utf8') as string
    expect(JSON.parse(shardText.trim()).meta.status).toBe('pending') // untouched
    const dir = join(repoRoot, 'packages/agent-ui/a2ui/corpus-genui/verdicts')
    let archivedFiles: string[] = []
    try {
      archivedFiles = readdirSync(dir) as string[]
    } catch {
      archivedFiles = []
    }
    expect(archivedFiles).toEqual([])
  })
})

describe('apply — re-applying the SAME file is a byte-identical no-op', () => {
  it('the second apply reports the name as a no-op, touches nothing further', async () => {
    repoRoot = makeTempRepoRoot()
    const name = await seedOnePendingRecord(repoRoot)
    writeVerdictsFixture(repoRoot, 'incoming.json', { [name]: { qualityScore: 5, passed: true, failingDimensions: [] } })
    await runApplyLeg(repoRoot, { verdictsPath: join(repoRoot, 'incoming.json') })

    const shardPath = join(repoRoot, 'packages/agent-ui/a2ui/corpus-genui/records/v1/data-viz-layouts.jsonl')
    const before = readFileSync(shardPath, 'utf8')

    const second = await runApplyLeg(repoRoot, { verdictsPath: join(repoRoot, 'incoming.json') })
    expect(second.ok).toBe(true)
    expect(second.updated).toEqual([])
    expect(second.noops).toEqual([name])
    expect(readFileSync(shardPath, 'utf8')).toBe(before)
  })
})

describe('apply — a DIFFERENT verdict for an already-judged name halts, naming both', () => {
  it('reports the conflict, changes nothing', async () => {
    repoRoot = makeTempRepoRoot()
    const name = await seedOnePendingRecord(repoRoot)
    writeVerdictsFixture(repoRoot, 'first.json', { [name]: { qualityScore: 5, passed: true, failingDimensions: [] } })
    await runApplyLeg(repoRoot, { verdictsPath: join(repoRoot, 'first.json') })

    writeVerdictsFixture(repoRoot, 'second.json', { [name]: { qualityScore: 2, passed: false, failingDimensions: ['D2'] } }, '2026-08-23')
    const result = await runApplyLeg(repoRoot, { verdictsPath: join(repoRoot, 'second.json') })
    expect(result.ok).toBe(false)
    expect(result.issues[0]).toMatch(/DIFFERENT verdict/)
    expect(result.issues[0]).toContain('passed=true')
    expect(result.issues[0]).toContain('passed=false')

    const shardText = readFileSync(join(repoRoot, 'packages/agent-ui/a2ui/corpus-genui/records/v1/data-viz-layouts.jsonl'), 'utf8') as string
    expect(JSON.parse(shardText.trim()).meta.qualityScore).toBe(5) // unchanged — the FIRST verdict stands
  })
})

describe('apply — --dry-run computes and reports, writes nothing', () => {
  it('writes no record and no archive under --dry-run', async () => {
    repoRoot = makeTempRepoRoot()
    const name = await seedOnePendingRecord(repoRoot)
    writeVerdictsFixture(repoRoot, 'incoming.json', { [name]: { qualityScore: 5, passed: true, failingDimensions: [] } })
    const result = await runApplyLeg(repoRoot, { verdictsPath: join(repoRoot, 'incoming.json'), dryRun: true })
    expect(result.updated).toEqual([name])
    const shardText = readFileSync(join(repoRoot, 'packages/agent-ui/a2ui/corpus-genui/records/v1/data-viz-layouts.jsonl'), 'utf8') as string
    expect(JSON.parse(shardText.trim()).meta.status).toBe('pending')
  })
})
