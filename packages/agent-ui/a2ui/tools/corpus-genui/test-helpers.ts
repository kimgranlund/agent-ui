// test-helpers.ts — GH #1584: a throwaway temp "repo root" every leg test writes/reads against, so no
// test ever touches the REAL committed `corpus-genui/` tree. NOT a test file itself (no vitest include
// needed) — imported by every `*.test.ts` under this directory.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

declare const process: { cwd(): string }

const REAL_ROOT = process.cwd()

/** A fresh temp dir carrying the REAL committed prompts.json/fixtures/rubric/providers.json — the
 *  read-only inputs every leg needs — but a genuinely EMPTY `records/`/`verdicts/` (the leg under test
 *  writes into those, never the real committed dir). */
export function makeTempRepoRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'genui-corpus-test-'))

  mkdirSync(join(dir, '.claude/docs/rubrics'), { recursive: true })
  writeFileSync(join(dir, '.claude/docs/rubrics/genui-pack-idiom.md'), readFileSync(join(REAL_ROOT, '.claude/docs/rubrics/genui-pack-idiom.md')))

  mkdirSync(join(dir, 'packages/agent-ui/a2ui/corpus-genui'), { recursive: true })
  writeFileSync(
    join(dir, 'packages/agent-ui/a2ui/corpus-genui/prompts.json'),
    readFileSync(join(REAL_ROOT, 'packages/agent-ui/a2ui/corpus-genui/prompts.json')),
  )
  cpSync(join(REAL_ROOT, 'packages/agent-ui/a2ui/corpus-genui/fixtures'), join(dir, 'packages/agent-ui/a2ui/corpus-genui/fixtures'), { recursive: true })

  mkdirSync(join(dir, 'packages/agent-ui/a2ui/tools/agent'), { recursive: true })
  writeFileSync(
    join(dir, 'packages/agent-ui/a2ui/tools/agent/providers.json'),
    readFileSync(join(REAL_ROOT, 'packages/agent-ui/a2ui/tools/agent/providers.json')),
  )

  // The judged A2UI shard `generate`'s retrieval reads — a MINIMAL, real, tier-1-legal single-line shard
  // (not the full real one: a test never needs the whole corpus, only a non-throwing read).
  mkdirSync(join(dir, 'packages/agent-ui/a2ui/corpus/exemplar/v1_0'), { recursive: true })
  writeFileSync(join(dir, 'packages/agent-ui/a2ui/corpus/exemplar/v1_0/agent-ui.jsonl'), '')

  // The default catalog `generate`'s `deps.catalog` reads (`fs.ts`'s `loadDefaultCatalog` — a plain
  // `readFileSync`, the Node-ESM-safe precedent, never the static `defaultCatalog` import).
  mkdirSync(join(dir, 'packages/agent-ui/a2ui/src/catalog/default'), { recursive: true })
  writeFileSync(
    join(dir, 'packages/agent-ui/a2ui/src/catalog/default/catalog.json'),
    readFileSync(join(REAL_ROOT, 'packages/agent-ui/a2ui/src/catalog/default/catalog.json')),
  )

  return dir
}

export function cleanupTempRepoRoot(dir: string): void {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
}
