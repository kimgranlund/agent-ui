// exemplar-shards.test.ts: T-0240, the agent-ui exemplar shard family every live retriever loads. The fs reader
// (`loadAgentUiExemplarShards`) takes the base shard and every persona shard and nothing else, and the Worker, which
// cannot read a directory, imports exactly the same files statically.

import { describe, it, expect, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EXEMPLAR_SHARD_DIR, isAgentUiShardFile, loadAgentUiExemplarShards } from './exemplar-shards.ts'

declare const process: { cwd(): string }

const REAL_ROOT = process.cwd()

describe('exemplar-shards: the agent-ui shard family (T-0240)', () => {
  let root: string | undefined
  afterEach(() => {
    if (root !== undefined) rmSync(root, { recursive: true, force: true })
    root = undefined
  })

  it('the family is agent-ui.jsonl plus every agent-ui--<persona>.jsonl, never the Basic shard or a non-jsonl file', () => {
    expect(isAgentUiShardFile('agent-ui.jsonl')).toBe(true)
    expect(isAgentUiShardFile('agent-ui--croupier.jsonl')).toBe(true)
    expect(isAgentUiShardFile('a2ui-basic.jsonl')).toBe(false)
    expect(isAgentUiShardFile('a2ui-basic--croupier.jsonl')).toBe(false)
    expect(isAgentUiShardFile('agent-ui--croupier.jsonl.enc')).toBe(false)
    expect(isAgentUiShardFile('agent-ui-extra.jsonl')).toBe(false)
  })

  it('reads every family shard on a planted root, base first, and skips the rest', () => {
    root = mkdtempSync(join(tmpdir(), 'a2ui-exemplar-shards-'))
    const dir = join(root, EXEMPLAR_SHARD_DIR)
    mkdirSync(dir, { recursive: true })
    const line = (name: string): string => `${JSON.stringify({ name })}\n`
    writeFileSync(join(dir, 'agent-ui.jsonl'), line('base') + '\n')
    writeFileSync(join(dir, 'agent-ui--croupier.jsonl'), line('croupier'))
    writeFileSync(join(dir, 'a2ui-basic.jsonl'), line('basic'))
    expect(loadAgentUiExemplarShards(root).map((r) => r.name)).toEqual(['base', 'croupier'])
  })

  it('a root with no shard directory yields no records, never a throw', () => {
    root = mkdtempSync(join(tmpdir(), 'a2ui-exemplar-shards-'))
    expect(loadAgentUiExemplarShards(root)).toEqual([])
  })

  it('on the real tree it holds a persona shard (anti-vacuous: the family is more than the base shard)', () => {
    const files = (readdirSync(join(REAL_ROOT, EXEMPLAR_SHARD_DIR)) as string[]).filter(isAgentUiShardFile)
    expect(files).toContain('agent-ui.jsonl')
    expect(files.some((f) => f.startsWith('agent-ui--'))).toBe(true)
  })

  it('the Worker statically imports exactly the family on disk, so production retrieves what the dev proxy does', () => {
    const files = (readdirSync(join(REAL_ROOT, EXEMPLAR_SHARD_DIR)) as string[]).filter(isAgentUiShardFile).sort()
    const worker = readFileSync(join(REAL_ROOT, 'packages/agent-ui/a2ui/tools/agent/worker/index.ts'), 'utf8') as string
    const imported = [...worker.matchAll(/from '\.\.\/\.\.\/\.\.\/corpus\/exemplar\/v1_0\/([^']+)'/g)].map((m) => m[1]!).sort()
    expect(imported).toEqual(files)
  })
})
