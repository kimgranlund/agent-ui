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

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { createHash } from 'node:crypto'
import { createStore } from '../../src/corpus/store.ts'
import type { CorpusStore, ShardText } from '../../src/corpus/store.ts'
import { mergeVerdictArchive, parseArchivedVerdicts, verdictArchiveFileName } from '../../src/corpus/verdict-archive.ts'
import type { ArchivedVerdict, ArchivedVerdictsSource } from '../../src/corpus/verdict-archive.ts'

// The corpus data home, repo-relative (ADR-0062 clause 3) — matches `store.ts`'s own private
// `CORPUS_ROOT` constant. Duplicated deliberately: the pure core independently owns "what a shard
// path is called" (it computes them from a record's facet/pin/catalogId); this Node shell
// independently owns "where the files actually live" — the split ADR-0062 draws between the two.
const CORPUS_DATA_DIR = 'packages/agent-ui/a2ui/corpus'

/** The archived-verdicts home (ADR-0165 clause 1) — a committed data class inside the corpus data dir,
 *  so the ADR-0062 rule that only this Node shell writes the data dir covers it unchanged. Invisible to
 *  every existing reader by construction: `loadStore` filters to `.jsonl`/`.jsonl.enc` (below),
 *  `corpus-data.test.ts` pins a fixed shard path, and `admission-coverage.test.ts`'s own walker filters
 *  `.jsonl` too — none of the three needed a change to ignore `verdicts/*.json`. */
const VERDICT_ARCHIVE_DIR = `${CORPUS_DATA_DIR}/verdicts`

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

// ── ADR-0165: the verdict archive — the Node shell's reader + writer over `corpus/verdicts/` ──

export type LoadVerdictArchiveResult =
  | { ok: true; archive: Map<string, ArchivedVerdict>; files: string[] }
  | { ok: false; issues: string[] }

/**
 * Read every archived verdicts file under `corpus/verdicts/` and merge it into the disposition archive
 * (ADR-0165 clause 3 — this is the Node-shell reader; `admission-coverage.test.ts` keeps its own
 * `readFileSync` walk over the SAME pure merge, so a src-side test never depends on tool-shell code).
 *
 * Files are sorted by path before merging so a same-date conflict names the same two files every run.
 * A malformed archived file and a same-date disagreement both come back as `ok:false` with a printable
 * issue list — the caller halts with nothing written. An absent directory (the archive starts EMPTY,
 * clause 8) is an empty archive, not a failure.
 */
export function loadVerdictArchive(dataDir: string): LoadVerdictArchiveResult {
  const root = join(dataDir, VERDICT_ARCHIVE_DIR)
  let files: string[]
  try {
    files = walk(root)
  } catch {
    return { ok: true, archive: new Map(), files: [] }
  }

  const jsonFiles = files.filter((f) => f.endsWith('.json')).sort()
  const sources: ArchivedVerdictsSource[] = []
  const issues: string[] = []

  for (const full of jsonFiles) {
    const sourceFile = full.slice(dataDir.length + 1)
    const parsed = parseArchivedVerdicts(readFileSync(full, 'utf8') as string)
    if (!parsed.ok) {
      for (const issue of parsed.issues) issues.push(`${sourceFile}: ${issue.path || '(root)'}: ${issue.message}`)
      continue
    }
    sources.push({ sourceFile, file: parsed.file })
  }

  if (issues.length > 0) return { ok: false, issues }

  const merged = mergeVerdictArchive(sources)
  if (!merged.ok) return { ok: false, issues: merged.conflicts.map((c) => c.message) }
  return { ok: true, archive: merged.archive, files: jsonFiles.map((f) => f.slice(dataDir.length + 1)) }
}

export type VerdictArchiveOutcome =
  /** The archive was written (or, under `dryRun`, WOULD be written — the caller's own `--dry-run`
   *  prefix carries that distinction into the report). */
  | { kind: 'archived'; path: string }
  /** The target path already holds byte-identical content — a no-op, the idempotent re-run case. */
  | { kind: 'unchanged'; path: string }
  /** The target path exists with DIFFERENT content. Nothing is written, ever: the caller must halt
   *  BEFORE `saveStore` (ADR-0165 clause 2). */
  | { kind: 'conflict'; path: string; existingHash: string; incomingHash: string }

/**
 * Copy a run's already-validated verdicts file VERBATIM into `corpus/verdicts/` (ADR-0165 clause 1) —
 * the Node shell is the only sanctioned writer of the data dir (ADR-0062 clause 2). `text` is the exact
 * bytes `--verdicts <path>` was read with; nothing is re-serialized, so the archived file is
 * byte-identical to the operator's input.
 *
 * **A write never overwrites** (clause 2). If the target path exists: identical bytes → `unchanged`;
 * different bytes → `conflict`, nothing written, and the caller halts before `saveStore`. This is
 * deliberately a WRITE-time guard rather than a restatement of clause 3's read-time conflict rule — an
 * overwrite destroys one of the two records, so there would never be two files left for a read-time
 * check to find the conflict in: silent loss of exactly the durable record this ADR exists to create.
 *
 * `date` is the `VerdictsFile`'s OWN `date` field (never the wall clock) and the slug is the basename
 * of `verdictsPath` — see `verdictArchiveFileName`.
 */
export function archiveVerdicts(
  dataDir: string,
  verdictsPath: string,
  text: string,
  date: string,
  opts?: { dryRun?: boolean },
): VerdictArchiveOutcome {
  const slugSource = basename(verdictsPath).replace(/\.json$/i, '')
  const relative = `${VERDICT_ARCHIVE_DIR}/${verdictArchiveFileName(date, slugSource)}`
  const full = join(dataDir, relative)

  if (existsSync(full)) {
    const existing = readFileSync(full, 'utf8') as string
    if (existing === text) return { kind: 'unchanged', path: relative }
    return { kind: 'conflict', path: relative, existingHash: sha256(existing), incomingHash: sha256(text) }
  }

  if (opts?.dryRun !== true) {
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, text)
  }
  return { kind: 'archived', path: relative }
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}
