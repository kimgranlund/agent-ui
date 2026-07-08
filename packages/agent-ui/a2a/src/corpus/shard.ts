// shard.ts — the pure shard store core (corpus LLD-C2, SPEC-R14). Parse · canonical serialize · paths ·
// the consumption filter. Zero-dep (no `fs`, no Node builtins) — mirrors the a2ui `store.ts` split
// (re-derived, not shared): every real filesystem touch lives in `tools/corpus/` or a test file.
//
// Layout (LLD §4 — no catalogId axis exists here, unlike the a2ui store):
//   packages/agent-ui/a2a/corpus/concept/v0_3_0/a2a.jsonl    <- facet:'concept' only
//   packages/agent-ui/a2a/corpus/demo/v0_3_0/a2a.jsonl       <- facet:'demo' only
//
// Byte-stability without a hash (LLD §4): this corpus has no dedup, so byte-stability is enforced
// directly — the committed line IS its canonical form. The standing gate (`corpus-data.test.ts`, S5)
// asserts `serializeRecord(JSON.parse(line)) === line` for every line.

import type { A2aCorpusRecord, A2aFacet, CorpusFailure } from './record.ts'

const CORPUS_ROOT = 'packages/agent-ui/a2a/corpus'

/** facet + protocolVersion -> the repo-relative shard path. Pin dir = the file-safe spelling of the
 * pin string (`.` -> `_`, `v`-prefixed): `'0.3.0'` -> `'v0_3_0'` (LLD §4). */
export function shardPath(facet: A2aFacet, protocolVersion: string): string {
  const pinDir = `v${protocolVersion.replace(/\./g, '_')}`
  return `${CORPUS_ROOT}/${facet}/${pinDir}/a2a.jsonl`
}

export interface ParsedShard {
  records: A2aCorpusRecord[]
  failures: CorpusFailure[]
}

/** Total: every non-blank line either parses to a candidate record or contributes a line-indexed
 * E_SCHEMA failure — this function never throws. Schema/pin/citation-shape validation is NOT this
 * module's job (LLD §2/§4 split) — callers (admission, the standing gate) run `validateCorpusRecord`
 * themselves over the returned `records`. */
export function parseShard(text: string): ParsedShard {
  const records: A2aCorpusRecord[] = []
  const failures: CorpusFailure[] = []
  const lines = text.split('\n')

  lines.forEach((line, i) => {
    if (line.trim() === '') return
    let candidate: unknown
    try {
      candidate = JSON.parse(line)
    } catch (e) {
      failures.push({ code: 'E_SCHEMA', path: `line ${i + 1}`, detail: `JSON parse error: ${String(e)}` })
      return
    }
    records.push(candidate as A2aCorpusRecord)
  })

  return { records, failures }
}

/** The canonical line form: recursively key-sorted `JSON.stringify`, no insignificant whitespace,
 * `undefined`-valued keys dropped (matches `JSON.stringify`'s own omission rule). Array order is
 * preserved (semantic — `citations`/`wire` order is authoring order). This is what the standing gate's
 * byte-stability leg re-derives per line (LLD §4). */
export function serializeRecord(rec: A2aCorpusRecord): string {
  return stableStringify(rec)
}

/** One line per record, IN GIVEN ORDER (LLD §4 — line order = seed authoring order = the page's
 * teaching order; determinism comes from `seeds.ts` being code, not from sorting), + a trailing
 * newline. Empty input serializes to an empty string (no file is ever written with just a bare `\n`). */
export function serializeShard(records: A2aCorpusRecord[]): string {
  if (records.length === 0) return ''
  return `${records.map(serializeRecord).join('\n')}\n`
}

/** The consumption filter (SPEC-R14/the a2ui `all()` posture): excludes `status:'quarantined'`. */
export function admittedRecords(records: A2aCorpusRecord[]): A2aCorpusRecord[] {
  return records.filter((r) => r.meta.status !== 'quarantined')
}

/** Deterministic JSON text: object keys sorted recursively, array order preserved, no insignificant
 * whitespace, `undefined`-valued keys dropped — mirrors the a2ui `store.ts` stable writer. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}
