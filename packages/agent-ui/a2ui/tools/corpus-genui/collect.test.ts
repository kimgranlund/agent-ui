// collect.test.ts — LLD-C4 (GH #1584), AC8: `collect` over a fixture capture dir writes N pending
// records (status:'pending', no qualityScore, htmlHash/packHash filled, lint filled); exact-dup by
// htmlHash reported E_DUP and skipped, re-run is a byte-identical no-op; collect with nothing to collect
// exits 0 and writes nothing.

import { describe, it, expect, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runCollectLeg } from './legs/collect.ts'
import { validateGenuiRecord } from '../../src/corpus-genui/record.ts'
import { makeTempRepoRoot, cleanupTempRepoRoot } from './test-helpers.ts'

let repoRoot: string
afterEach(() => cleanupTempRepoRoot(repoRoot))

const GENUI_A = '{"genui":{"surfaceId":"s1","html":"<p>one</p>"}}'
const GENUI_B = '{"genui":{"surfaceId":"s2","html":"<p>two</p>"}}'
const NOT_GENUI = '{"a2uiMeta":{"note":"hi"}}' // not a genui candidate at all — skipped silently
const MALFORMED_GENUI = '{"genui":{"surfaceId":"","html":"<p>bad</p>"}}' // empty surfaceId — E_WIRE

function makeCaptureDir(repoRoot: string, lines: string[]): string {
  const dir = join(repoRoot, 'capture')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'transcript.jsonl'), lines.join('\n') + '\n')
  return dir
}

describe('collect — no --from: validates the dir, prints the prompt matrix, writes nothing, exits 0-ready', () => {
  it('reports the real prompt count and writes nothing', async () => {
    repoRoot = makeTempRepoRoot()
    const result = await runCollectLeg(repoRoot, {})
    expect(result.ok).toBe(true)
    expect(result.written).toEqual([])
    expect(result.promptCount).toBe(12)
  })
})

describe('collect — writes N pending records from a capture fixture', () => {
  it('writes one record per valid genui line, skips non-genui lines silently', async () => {
    repoRoot = makeTempRepoRoot()
    const from = makeCaptureDir(repoRoot, [GENUI_A, NOT_GENUI, GENUI_B])
    const result = await runCollectLeg(repoRoot, { from, unpinned: true })
    expect(result.ok).toBe(true)
    expect(result.written).toHaveLength(2)
    expect(result.wireFailures).toEqual([])
    for (const { record } of result.written) {
      expect(record.meta.status).toBe('pending')
      expect(record.meta.qualityScore).toBeUndefined()
      expect(record.meta.htmlHash).toBeTruthy()
      expect(record.meta.packHash).toBeNull()
      expect(record.meta.lint.byteLength).toBeGreaterThan(0)
      expect(record.packId).toBeNull()
      expect(validateGenuiRecord(record)).toEqual([])
    }
  })

  it('a malformed candidate reports E_WIRE and is not written', async () => {
    repoRoot = makeTempRepoRoot()
    const from = makeCaptureDir(repoRoot, [GENUI_A, MALFORMED_GENUI])
    const result = await runCollectLeg(repoRoot, { from, unpinned: true })
    expect(result.written).toHaveLength(1)
    expect(result.wireFailures).toHaveLength(1)
    expect(result.wireFailures[0]!.reason).toBe('E_WIRE')
  })

  it('--pack/--prompt pins provenance on the written record', async () => {
    repoRoot = makeTempRepoRoot()
    const from = makeCaptureDir(repoRoot, [GENUI_A])
    const result = await runCollectLeg(repoRoot, { from, pack: 'data-viz-layouts', prompt: 'data-viz-layouts-1' })
    expect(result.written[0]!.record.packId).toBe('data-viz-layouts')
    expect(result.written[0]!.record.promptId).toBe('data-viz-layouts-1')
    expect(result.written[0]!.record.promptText).toContain('revenue')
  })

  it('--pack without --prompt (and no --unpinned) is a setup error', async () => {
    repoRoot = makeTempRepoRoot()
    const from = makeCaptureDir(repoRoot, [GENUI_A])
    const result = await runCollectLeg(repoRoot, { from, pack: 'data-viz-layouts' })
    expect(result.ok).toBe(false)
    expect(result.setupError).toBeDefined()
  })
})

describe('collect — exact-dup by htmlHash is reported E_DUP and skipped; re-run is a byte-identical no-op', () => {
  it('a duplicate within the SAME run is skipped, not double-written', async () => {
    repoRoot = makeTempRepoRoot()
    const from = makeCaptureDir(repoRoot, [GENUI_A, GENUI_A])
    const result = await runCollectLeg(repoRoot, { from, unpinned: true })
    expect(result.written).toHaveLength(1)
    expect(result.dups).toHaveLength(1)
  })

  it('re-running collect over the SAME input a second time writes nothing new (byte-identical no-op)', async () => {
    repoRoot = makeTempRepoRoot()
    const from = makeCaptureDir(repoRoot, [GENUI_A, GENUI_B])
    await runCollectLeg(repoRoot, { from, unpinned: true })
    const shardPath = join(repoRoot, 'packages/agent-ui/a2ui/corpus-genui/records/v1/control.jsonl')
    const before = readFileSync(shardPath, 'utf8')

    const second = await runCollectLeg(repoRoot, { from, unpinned: true })
    expect(second.written).toEqual([])
    expect(second.dups).toHaveLength(2)
    const after = readFileSync(shardPath, 'utf8')
    expect(after).toBe(before)
  })
})

describe('collect — --dry-run computes and reports, writes nothing', () => {
  it('writes no file at all under --dry-run', async () => {
    repoRoot = makeTempRepoRoot()
    const from = makeCaptureDir(repoRoot, [GENUI_A])
    const result = await runCollectLeg(repoRoot, { from, unpinned: true, dryRun: true })
    expect(result.written).toHaveLength(1)
    const shardPath = join(repoRoot, 'packages/agent-ui/a2ui/corpus-genui/records/v1/control.jsonl')
    expect(() => readFileSync(shardPath, 'utf8')).toThrow()
  })
})
