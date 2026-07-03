// fs-store.ts — the Node shell for the corpus data dir (corpus LLD-C1, ADR-0062 clause 2).
//
// Bridges `store.ts`'s pure, platform-neutral `ShardText[]` in/out to real files. `src/corpus/*`
// never touches `fs` (SPEC-N5 / ADR-0062 clause 1); this module — and `import-seeds.ts`, which
// composes it — is the ONLY code permitted to read/write `corpus/` on disk (LLD §2 invariant iv).
// Plain `.ts`, run via Node type-stripping (no build step; `erasableSyntaxOnly` guarantees it strips
// cleanly): `node --experimental-strip-types tools/corpus/import-seeds.ts` from the repo root.
//
// `dataDir` is the REPO ROOT: every `ShardText.path` `store.ts` computes/expects is already the full
// repo-relative path (it begins with the corpus data home, `packages/agent-ui/a2ui/corpus` — ADR-0062
// clause 3), so this shell needs no extra path arithmetic beyond joining `dataDir` to that path.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { createStore } from '../../src/corpus/store.ts'
import type { CorpusStore, ShardText } from '../../src/corpus/store.ts'

// The corpus data home, repo-relative (ADR-0062 clause 3) — matches `store.ts`'s own private
// `CORPUS_ROOT` constant. Duplicated deliberately: the pure core independently owns "what a shard
// path is called" (it computes them from a record's facet/pin/catalogId); this Node shell
// independently owns "where the files actually live" — the split ADR-0062 draws between the two.
const CORPUS_DATA_DIR = 'packages/agent-ui/a2ui/corpus'

/** Recursively list every file under `dir` (absolute in, absolute out). */
function walk(dir: string): string[] {
  let out: string[] = []
  for (const entry of readdirSync(dir) as string[]) {
    const full = join(dir, entry)
    if ((statSync(full) as { isDirectory(): boolean }).isDirectory()) out = out.concat(walk(full))
    else out.push(full)
  }
  return out
}

/**
 * Read every shard file (`.jsonl` / `.jsonl.enc`) under the corpus data dir into a pure `CorpusStore`.
 * `index.json` is deliberately never handed in — it is derived, not source of truth (`store.ts`
 * invariant iii; `createStore` would ignore it anyway, since it lives outside `exemplar/`/`eval/`, but
 * this shell doesn't even try). A data dir that doesn't exist yet (the very first import) yields an
 * empty store — the LLD §5/§8 "empty corpus" edge case, reached here rather than in the pure core.
 */
export function loadStore(dataDir: string): CorpusStore {
  const root = join(dataDir, CORPUS_DATA_DIR)
  let files: string[]
  try {
    files = walk(root)
  } catch {
    return createStore([])
  }

  const shards: ShardText[] = files
    .filter((f) => f.endsWith('.jsonl') || f.endsWith('.jsonl.enc'))
    .map((f) => ({ path: f.slice(dataDir.length + 1), text: readFileSync(f, 'utf8') as string }))

  return createStore(shards)
}

/**
 * Serialize `store` and write every shard + `index.json` back under the corpus data dir — the single
 * write path this wave's admission pipeline feeds (LLD §2 invariant iv). Creates parent directories as
 * needed (a shard's first record has nowhere to land yet).
 */
export function saveStore(dataDir: string, store: CorpusStore): void {
  for (const shard of store.serialize()) {
    const full = join(dataDir, shard.path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, shard.text)
  }
}
