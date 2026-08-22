// fs.ts — LLD-C4 (GH #1584, genui-b3-judged-eval.lld.md §4): the Node shell for `corpus-genui/` — the
// ONE writer of the data dir (ADR-0062's pure-core/shell split, `tools/corpus/fs-store.ts`'s own
// discipline, mirrored — never imported: this is a sibling data dir, LLD §2). Every leg (`legs/*.ts`)
// reads/writes exclusively through this module; nothing else under `tools/corpus-genui/` touches `fs`.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { createHash } from 'node:crypto'
import { validateGenuiRecord } from '../../src/corpus-genui/record.ts'
import type { GenuiCorpusRecord } from '../../src/corpus-genui/record.ts'
import { parseArchivedGenuiVerdictsFile, mergeGenuiVerdictArchive } from '../../src/corpus-genui/verdicts.ts'
import type { GenuiVerdictsFile, GenuiArchivedVerdict, GenuiArchivedVerdictsSource } from '../../src/corpus-genui/verdicts.ts'
import type { CorpusRecord } from '../../src/corpus/record.ts'
import { loadCatalog } from '../../src/catalog/catalog.ts'
import type { Catalog } from '../../src/catalog/catalog.ts'

export const CORPUS_GENUI_DATA_DIR = 'packages/agent-ui/a2ui/corpus-genui'
export const RECORDS_DIR = `${CORPUS_GENUI_DATA_DIR}/records/v1`
export const VERDICTS_DIR = `${CORPUS_GENUI_DATA_DIR}/verdicts`
export const RUNS_DIR = `${CORPUS_GENUI_DATA_DIR}/runs`
export const FIXTURES_DIR = `${CORPUS_GENUI_DATA_DIR}/fixtures`
export const PROMPTS_PATH = `${CORPUS_GENUI_DATA_DIR}/prompts.json`
export const INDEX_PATH = `${CORPUS_GENUI_DATA_DIR}/index.json`
export const README_PATH = `${CORPUS_GENUI_DATA_DIR}/README.md`
export const RUBRIC_PATH = '.claude/docs/rubrics/genui-pack-idiom.md'
/** The judged A2UI shard the `generate` leg's retrieval reads — the SAME file the dev proxy reads
 *  (`tools/agent/dev-proxy-plugin.ts`'s `SHARD_PATH`), read directly via `readFileSync` (the LLD §1
 *  import list names `src/corpus/retrieve.ts` but not `tools/corpus/fs-store.ts` — this mirrors the
 *  proxy's own direct-read shape rather than routing through the A2UI corpus's Node shell). */
export const A2UI_SHARD_PATH = 'packages/agent-ui/a2ui/corpus/exemplar/v1_0/agent-ui.jsonl'

// ── prompts.json ─────────────────────────────────────────────────────────────────────────────────────────

export interface GenuiPrompt {
  id: string
  packId: string
  promptText: string
}
export interface GenuiPromptSet {
  promptSetVersion: number
  prompts: GenuiPrompt[]
}

export function loadPrompts(repoRoot: string): GenuiPromptSet {
  const text = readFileSync(join(repoRoot, PROMPTS_PATH), 'utf8') as string
  return JSON.parse(text) as GenuiPromptSet
}

// ── records/v1/*.jsonl — one file per pack + control.jsonl ─────────────────────────────────────────────

/** The shard filename (basename only, no dir) a record with this `packId` lives in. */
export function shardFileFor(packId: string | null): string {
  return packId === null ? 'control.jsonl' : `${packId}.jsonl`
}

/** Every records/v1/*.jsonl file, grouped by its OWN basename — an empty map when the dir doesn't exist
 *  yet (records/ ships empty at ship, LLD §0). Records within a file are NOT assumed sorted on disk (the
 *  writer sorts; a reader tolerates any order). */
export function loadGenuiRecordsByFile(repoRoot: string): Map<string, GenuiCorpusRecord[]> {
  const dir = join(repoRoot, RECORDS_DIR)
  const out = new Map<string, GenuiCorpusRecord[]>()
  if (!existsSync(dir)) return out
  const files = (readdirSync(dir) as string[]).filter((f) => f.endsWith('.jsonl')).sort()
  for (const file of files) {
    const text = readFileSync(join(dir, file), 'utf8') as string
    const records: GenuiCorpusRecord[] = []
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.length === 0) continue
      records.push(JSON.parse(trimmed) as GenuiCorpusRecord)
    }
    out.set(file, records)
  }
  return out
}

/** Flattened `{file, record}` pairs across every shard — the common read shape most legs actually want. */
export interface LoadedGenuiRecord {
  file: string
  record: GenuiCorpusRecord
}
export function loadGenuiRecords(repoRoot: string): LoadedGenuiRecord[] {
  const byFile = loadGenuiRecordsByFile(repoRoot)
  const out: LoadedGenuiRecord[] = []
  for (const [file, records] of byFile) for (const record of records) out.push({ file, record })
  return out
}

/** Write ONLY the shard files present in `changed` — each one's ENTIRE content is replaced (stable-sorted
 *  by `name`), the every-leg read-merge-write discipline (never a line patch). Untouched shard files are
 *  left byte-identical on disk (this function never even opens them). */
export function writeGenuiRecordsByFile(repoRoot: string, changed: ReadonlyMap<string, readonly GenuiCorpusRecord[]>): void {
  const dir = join(repoRoot, RECORDS_DIR)
  mkdirSync(dir, { recursive: true })
  for (const [file, records] of changed) {
    const sorted = [...records].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    const text = sorted.map((r) => JSON.stringify(r)).join('\n') + (sorted.length > 0 ? '\n' : '')
    writeFileSync(join(dir, file), text)
  }
}

// ── the rubric doc ───────────────────────────────────────────────────────────────────────────────────────

/** The rubric doc's `version:` marker (the `rescore.ts` `readRubricVersion` precedent, reused by name) —
 *  `undefined` when the file is missing or carries no marker (the CALLER decides the exit-2 message, this
 *  shell never calls `process.exit` itself — every leg is a plain async function under test). */
export function readRubricVersion(repoRoot: string): string | undefined {
  let text: string
  try {
    text = readFileSync(join(repoRoot, RUBRIC_PATH), 'utf8') as string
  } catch {
    return undefined
  }
  const match = text.match(/^version:\s*(\S+)\s*$/m)
  return match ? match[1] : undefined
}

/** The whole rubric document, verbatim (the `judge` leg's system-prompt standard-of-record, LLD §4.2). */
export function readRubricBody(repoRoot: string): string {
  return readFileSync(join(repoRoot, RUBRIC_PATH), 'utf8') as string
}

// ── verdicts/*.json — the durable archive (the ADR-0165 pattern, mirrored) ─────────────────────────────

export type LoadGenuiVerdictArchiveResult =
  | { ok: true; archive: Map<string, GenuiArchivedVerdict>; files: string[] }
  | { ok: false; issues: string[] }

/** Read + merge every archived verdicts file under `verdicts/` (files sorted by path so a same-date
 *  conflict names the same two files every run). An absent directory is an empty archive (the archive
 *  starts EMPTY, LLD §0), not a failure. */
export function loadGenuiVerdictArchive(repoRoot: string): LoadGenuiVerdictArchiveResult {
  const dir = join(repoRoot, VERDICTS_DIR)
  if (!existsSync(dir)) return { ok: true, archive: new Map(), files: [] }
  const jsonFiles = (readdirSync(dir) as string[]).filter((f) => f.endsWith('.json')).sort()
  const sources: GenuiArchivedVerdictsSource[] = []
  const issues: string[] = []
  for (const file of jsonFiles) {
    const sourceFile = `${VERDICTS_DIR}/${file}`
    const parsed = parseArchivedGenuiVerdictsFile(readFileSync(join(dir, file), 'utf8') as string)
    if (!parsed.ok) {
      for (const issue of parsed.issues) issues.push(`${sourceFile}: ${issue.path || '(root)'}: ${issue.message}`)
      continue
    }
    sources.push({ sourceFile, file: parsed.file })
  }
  if (issues.length > 0) return { ok: false, issues }
  const merged = mergeGenuiVerdictArchive(sources)
  if (!merged.ok) return { ok: false, issues: merged.conflicts.map((c) => c.message) }
  return { ok: true, archive: merged.archive, files: jsonFiles.map((f) => `${VERDICTS_DIR}/${f}`) }
}

export type GenuiVerdictArchiveOutcome =
  | { kind: 'archived'; path: string }
  | { kind: 'unchanged'; path: string }
  | { kind: 'conflict'; path: string; existingHash: string; incomingHash: string }

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/** The archived file's name — `<date>--<slug>.json` (the ADR-0165 clause 2 pattern). `date` is the
 *  `GenuiVerdictsFile`'s own `date` field (never the wall clock); `slugSource` is the operator's `--out`
 *  basename sans `.json`. Both parts slugified (lowercased, non-alnum collapsed to `-`). */
export function genuiVerdictArchiveFileName(date: string, slugSource: string): string {
  const slugify = (v: string): string =>
    v
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  const datePart = slugify(date) || 'undated'
  const slugPart = slugify(slugSource) || 'verdicts'
  return `${datePart}--${slugPart}.json`
}

/** Copy `text` VERBATIM into `verdicts/` (ADR-0165 clause 1's pattern) — never overwrites: identical
 *  bytes at the target path is `unchanged`; different bytes is a `conflict` (nothing written; the caller
 *  halts before touching any record). */
export function archiveGenuiVerdicts(repoRoot: string, targetRelativePath: string, text: string, opts?: { dryRun?: boolean }): GenuiVerdictArchiveOutcome {
  const full = join(repoRoot, targetRelativePath)
  if (existsSync(full)) {
    const existing = readFileSync(full, 'utf8') as string
    if (existing === text) return { kind: 'unchanged', path: targetRelativePath }
    return { kind: 'conflict', path: targetRelativePath, existingHash: sha256(existing), incomingHash: sha256(text) }
  }
  if (opts?.dryRun !== true) {
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, text)
  }
  return { kind: 'archived', path: targetRelativePath }
}

// ── index.json ───────────────────────────────────────────────────────────────────────────────────────────

export function readIndexJson(repoRoot: string): string | undefined {
  try {
    return readFileSync(join(repoRoot, INDEX_PATH), 'utf8') as string
  } catch {
    return undefined
  }
}

export function writeIndexJson(repoRoot: string, text: string): void {
  writeFileSync(join(repoRoot, INDEX_PATH), text)
}

// ── fixtures/ — the two committed calibration fixtures (never records, never scored) ───────────────────

export function loadFixtures(repoRoot: string): { file: string; text: string }[] {
  const dir = join(repoRoot, FIXTURES_DIR)
  if (!existsSync(dir)) return []
  return (readdirSync(dir) as string[])
    .filter((f) => f.endsWith('.genui.json'))
    .sort()
    .map((f) => ({ file: `${FIXTURES_DIR}/${f}`, text: readFileSync(join(dir, f), 'utf8') as string }))
}

// ── the judged A2UI shard (generate leg's retrieval input) ─────────────────────────────────────────────

export function loadA2uiShard(repoRoot: string): CorpusRecord[] {
  try {
    const text = readFileSync(join(repoRoot, A2UI_SHARD_PATH), 'utf8') as string
    return text
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l) as CorpusRecord)
  } catch {
    return [] // no shard yet — retrieval degrades to zero exemplars, never a hard failure
  }
}

// ── the default catalog (generate leg's `deps.catalog`) ────────────────────────────────────────────────

const DEFAULT_CATALOG_PATH = 'packages/agent-ui/a2ui/src/catalog/default/catalog.json'

/** Read + build the default catalog via `readFileSync` + `JSON.parse` + `loadCatalog` — the SAME
 *  construction `tools/agent/dev-proxy-plugin.ts` already uses, deliberately NOT a static
 *  `import defaultCatalog from '../../src/catalog/default/index.ts'`: that module's own
 *  `import catalogDoc from './catalog.json'` carries no `with {type:'json'}` attribute (fine under
 *  Vite/Vitest's transform, the ONLY way it is consumed everywhere else in this repo) and Node's own
 *  ESM loader rejects an attribute-less JSON import outright under `--experimental-strip-types`
 *  (`ERR_IMPORT_ATTRIBUTE_MISSING`, measured) — the SAME constraint `providers-config.ts`'s own header
 *  names for `providers.json`. This CLI is a plain-Node entry (LLD §4's own invocation), so it reads the
 *  JSON itself, exactly like the dev proxy does. */
export function loadDefaultCatalog(repoRoot: string): Catalog {
  const doc = JSON.parse(readFileSync(join(repoRoot, DEFAULT_CATALOG_PATH), 'utf8') as string)
  return loadCatalog(doc)
}

// ── runs/ — gitignored per-run reports (misses, timings, raw replies for E_JUDGE_PARSE post-mortems) ──

/** Write a per-run report JSON under `runs/` (gitignored, LLD §5) — never read back by any leg, purely
 *  an operator post-mortem artifact. Returns the repo-relative path written. */
export function writeRunReport(repoRoot: string, name: string, data: unknown): string {
  const dir = join(repoRoot, RUNS_DIR)
  mkdirSync(dir, { recursive: true })
  const relative = `${RUNS_DIR}/${name}.json`
  writeFileSync(join(repoRoot, relative), `${JSON.stringify(data, null, 2)}\n`)
  return relative
}

// ── the key + model reader (the run-flagship.ts pattern, mirrored) ─────────────────────────────────────

/** Minimal `.env` reader — repo-root `.env`, gitignored, `KEY=value` per line (the `run-flagship.ts`
 *  precedent, mirrored by pattern). */
export function loadDotEnv(repoRoot: string): Record<string, string> {
  try {
    const text = readFileSync(join(repoRoot, '.env'), 'utf8') as string
    const out: Record<string, string> = {}
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (trimmed === '' || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
    }
    return out
  } catch {
    return {}
  }
}

/** `process.env.ANTHROPIC_API_KEY` or the repo-root `.env` — the ONE key reader both `generate` and
 *  `judge` use (the run-flagship.ts pattern). `undefined` ⇒ no key found anywhere. */
export function readAnthropicApiKey(repoRoot: string, env: Record<string, string | undefined>): string | undefined {
  const fromEnv = env.ANTHROPIC_API_KEY
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv
  const dotenv = loadDotEnv(repoRoot)
  return dotenv.ANTHROPIC_API_KEY !== undefined && dotenv.ANTHROPIC_API_KEY !== '' ? dotenv.ANTHROPIC_API_KEY : undefined
}

// re-exported for legs that need to validate a record against the pure core without a second import line
export { validateGenuiRecord }
export type { GenuiCorpusRecord, GenuiVerdictsFile }
export { basename }
