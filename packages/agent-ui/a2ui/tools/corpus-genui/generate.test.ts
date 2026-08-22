// generate.test.ts — LLD-C4 §4.1 (GH #1584), AC9: with a STUB AgentProvider injected (the
// `produce-loop.test.ts` precedent, `genui-produce.test.ts`) yielding a canned genui line, the leg
// writes exactly the expected record shape per (prompt, its own paired pack); a stub yielding only
// A2UI/prose lines yields `E_NO_GENUI` in the run report and no record; exit-worthiness follows
// `misses.length > 0`; the real `anthropicProvider` path is reached only through the key-bearing CLI arm
// (never here — this test drives ONLY the injected stub).

import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runGenerateLeg } from './legs/generate.ts'
import type { GenerateOptions } from './legs/generate.ts'
import { validateGenuiRecord } from '../../src/corpus-genui/record.ts'
import { makeTempRepoRoot, cleanupTempRepoRoot } from './test-helpers.ts'
import type { AgentProvider } from '../../src/agent/agent-transport.ts'

let repoRoot: string
afterEach(() => cleanupTempRepoRoot(repoRoot))

function stubProviderYielding(raw: string): AgentProvider {
  return {
    async *stream() {
      yield raw
    },
  }
}

const GENUI_TURN = '{"a2uiMeta":{"note":"here"}}\n{"genui":{"surfaceId":"q3","html":"<p>chart</p>"}}'
const NO_GENUI_TURN = '{"a2uiMeta":{"note":"just chatting, no surface this time"}}'

describe('generate — a stub provider yielding a genui line writes the expected record shape', () => {
  it('writes exactly one record per (prompt, its own paired pack), restricted by --only-prompt', async () => {
    repoRoot = makeTempRepoRoot()
    const deps = { provider: stubProviderYielding(GENUI_TURN) }
    const opts: GenerateOptions = { onlyPrompt: 'data-viz-layouts-1', now: () => '2026-08-22T00:00:00.000Z', runId: () => 'testrun' }
    const result = await runGenerateLeg(repoRoot, 'claude-sonnet-5', opts, deps)

    expect(result.ok).toBe(true)
    expect(result.misses).toEqual([])
    expect(result.written).toHaveLength(1)
    const { record } = result.written[0]!
    expect(record.promptId).toBe('data-viz-layouts-1')
    expect(record.packId).toBe('data-viz-layouts')
    expect(record.name).toBe('data-viz-layouts--data-viz-layouts-1--testrun')
    expect(record.surfaceId).toBe('q3')
    expect(record.html).toBe('<p>chart</p>')
    expect(record.meta.status).toBe('pending')
    expect(record.meta.model).toBe('claude-sonnet-5')
    expect(record.meta.dogfood).toBe(false)
    expect(record.meta.provenance.source).toBe('generated')
    expect(record.meta.packHash).toBeTruthy() // conditioned by a real pack — never null
    expect(record.meta.htmlHash).toBeTruthy()
    expect(record.meta.generatedAt).toBe('2026-08-22T00:00:00.000Z')
    expect(validateGenuiRecord(record)).toEqual([])

    const shardText = readFileSync(join(repoRoot, 'packages/agent-ui/a2ui/corpus-genui/records/v1/data-viz-layouts.jsonl'), 'utf8')
    expect(shardText.trim().split('\n')).toHaveLength(1)
  })

  it('--control produces a pack-less record (packId null, packHash null)', async () => {
    repoRoot = makeTempRepoRoot()
    const deps = { provider: stubProviderYielding(GENUI_TURN) }
    const result = await runGenerateLeg(repoRoot, 'claude-sonnet-5', { onlyPrompt: 'data-viz-layouts-1', control: true }, deps)
    expect(result.written).toHaveLength(1)
    const { record } = result.written[0]!
    expect(record.packId).toBeNull()
    expect(record.meta.packHash).toBeNull()
    expect(record.name).toMatch(/^control--data-viz-layouts-1--/)
    const shardText = readFileSync(join(repoRoot, 'packages/agent-ui/a2ui/corpus-genui/records/v1/control.jsonl'), 'utf8')
    expect(shardText.trim().split('\n')).toHaveLength(1)
  })

  it('--runs 2 produces two distinct records for the same prompt', async () => {
    repoRoot = makeTempRepoRoot()
    let n = 0
    const deps = {
      provider: {
        async *stream() {
          n += 1
          yield GENUI_TURN
        },
      } as AgentProvider,
    }
    const result = await runGenerateLeg(repoRoot, 'claude-sonnet-5', { onlyPrompt: 'data-viz-layouts-1', runs: 2 }, deps)
    expect(result.written).toHaveLength(2)
    expect(n).toBe(2)
    expect(new Set(result.written.map((w) => w.record.name)).size).toBe(2) // distinct names
  })
})

describe('generate — a stub yielding no genui line is a MISS (E_NO_GENUI), never a fabricated record', () => {
  it('reports E_NO_GENUI and writes nothing for that prompt', async () => {
    repoRoot = makeTempRepoRoot()
    const deps = { provider: stubProviderYielding(NO_GENUI_TURN) }
    const result = await runGenerateLeg(repoRoot, 'claude-sonnet-5', { onlyPrompt: 'data-viz-layouts-1' }, deps)
    expect(result.ok).toBe(false) // exit 1 iff any miss
    expect(result.written).toEqual([])
    expect(result.misses).toHaveLength(1)
    expect(result.misses[0]!.reason).toBe('E_NO_GENUI')
    expect(result.misses[0]!.promptId).toBe('data-viz-layouts-1')
    // the miss is recorded in the run report file, never as a shard record
    expect(result.reportPath).toBeDefined()
    const reportText = readFileSync(join(repoRoot, result.reportPath!), 'utf8')
    expect(JSON.parse(reportText).misses).toHaveLength(1)
  })
})

describe('generate — --dry-run computes and reports, writes nothing', () => {
  it('writes no shard file and no run report under --dry-run', async () => {
    repoRoot = makeTempRepoRoot()
    const deps = { provider: stubProviderYielding(GENUI_TURN) }
    const result = await runGenerateLeg(repoRoot, 'claude-sonnet-5', { onlyPrompt: 'data-viz-layouts-1', dryRun: true }, deps)
    expect(result.written).toHaveLength(1)
    expect(result.reportPath).toBeUndefined()
    expect(() => readFileSync(join(repoRoot, 'packages/agent-ui/a2ui/corpus-genui/records/v1/data-viz-layouts.jsonl'), 'utf8')).toThrow()
  })
})
