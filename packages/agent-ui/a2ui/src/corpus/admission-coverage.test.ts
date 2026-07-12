// admission-coverage.test.ts — the TKT-0022 trip-wire: every example-shelf seed (`src/examples/`
// `allSeeds`) is either ADMITTED to the corpus store (present by name — the corpus join key, corpus
// LLD §2 invariant i) or explicitly DISPOSITIONED with a recorded reason (the `EXCLUSION_ALLOWLIST`
// comment-with-citation precedent, `catalog/default/index.test.ts`). A future wave that adds a seed to
// `allSeeds` without either admitting it through `tools/corpus/import-seeds.ts` or dispositioning it here
// goes RED — the exact gap TKT-0022 closed (seeds rendering on the gallery but never entering the
// retrieval corpus) cannot silently reopen.
//
// Test-only `node:fs` (the `corpus-data.test.ts` precedent) — walks the corpus data dir directly rather
// than importing `tools/corpus/fs-store.ts` (a src test reading raw shard text keeps the same "pure core
// stays fs-free" discipline `corpus-data.test.ts` already holds, SPEC-N5/ADR-0062), so this gate needs
// only the record `name`s, never a full `CorpusStore`.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { allSeeds } from '../examples/index.ts'
import type { CorpusRecord } from './record.ts'

declare const process: { cwd(): string }

const CORPUS_ROOT = `${process.cwd()}/packages/agent-ui/a2ui/corpus`

/** Recursively list every file under `dir` (absolute in, absolute out) — mirrors
 *  `tools/corpus/fs-store.ts`'s own `walk`; duplicated rather than imported so this src-side test never
 *  depends on tool-shell code (the CORPUS_DATA_DIR split ADR-0062 already draws between the two). A
 *  missing dir (the very first import, never yet run) yields no files, not a throw. */
function walk(dir: string): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir) as string[]
  } catch {
    return []
  }
  let out: string[] = []
  for (const entry of entries) {
    const full = join(dir, entry)
    if ((statSync(full) as { isDirectory(): boolean }).isDirectory()) out = out.concat(walk(full))
    else out.push(full)
  }
  return out
}

/** Every record name across every `.jsonl` shard under the corpus data dir, any facet/status — a
 *  quarantined record is still an ADMITTED disposition of its seed (its own healthiness is
 *  `corpus-data.test.ts`'s concern, not this gate's). `.jsonl.enc` shards are skipped: none exist today
 *  and decrypting is out of scope for a name-only coverage gate. */
function admittedNames(): Set<string> {
  const names = new Set<string>()
  for (const file of walk(CORPUS_ROOT)) {
    if (!file.endsWith('.jsonl')) continue
    const text = readFileSync(file, 'utf8') as string
    for (const line of text.split('\n')) {
      if (line.trim() === '') continue
      const rec = JSON.parse(line) as CorpusRecord
      names.add(rec.name)
    }
  }
  return names
}

/** Every example seed explicitly excused from corpus admission, with the reason it teaches nothing the
 *  corpus needs (the `EXCLUSION_ALLOWLIST` precedent, `catalog/default/index.test.ts`) — a future
 *  deliberately-minimal smoke seed is dispositioned HERE, with a citation, not in a chat log. */
const DISPOSITION_ALLOWLIST = new Map<string, string>([
  [
    'stats-grid-dashboard',
    'judged E_QUALITY 2026-07-11 (VerdictsFile, rubric a2ui-corpus 1.0, D5=3 — strict-subset duplicate ' +
      'of the admitted pattern-dashboard-tiles, container-swap-only: same Card>CardContent>Column ' +
      'anatomy, same relative binds, same "${value}${unit}" interpolation, only Row swapped for Grid). ' +
      'Grid coverage survives via kpi-panel-lifecycle (PASS). Repair path (not this wave, tkt-0022 ' +
      'Findings): differentiate the tile beyond the subset, or teach a Grid-specific behavior Row ' +
      'cannot express — then re-admit via the judged pipeline (a fresh import, not `--replace`, since ' +
      'this record was never written).',
  ],
])

/** The seed names covered by neither the corpus nor the disposition allowlist — the drift this gate
 *  exists to catch. A pure predicate (the `typesMissingCatalog` precedent) so the negative controls below
 *  can drive it with synthetic inputs, independent of the real corpus/allowlist contents. */
function seedsMissingAdmission(
  seedNames: readonly string[],
  admitted: ReadonlySet<string>,
  allowlist: ReadonlyMap<string, string>,
): string[] {
  return seedNames.filter((n) => !admitted.has(n) && !allowlist.has(n))
}

/** Allowlist entries that ALSO appear in the corpus — a disposition never drained after the seed it
 *  excused was actually admitted (the `allowlistResidue` precedent: a stale exclusion is drift too). */
function allowlistResidue(admitted: ReadonlySet<string>, allowlist: ReadonlyMap<string, string>): string[] {
  return [...allowlist.keys()].filter((name) => admitted.has(name))
}

describe('corpus admission coverage — the TKT-0022 trip-wire (every seed admitted or dispositioned)', () => {
  const SEED_NAMES = allSeeds.map((s) => s.name)
  const ADMITTED = admittedNames()

  it('derived a non-empty seed-name set (anti-vacuous — a broken import cannot pass silently)', () => {
    expect(SEED_NAMES.length).toBeGreaterThan(0)
  })

  it('found at least one admitted corpus record (anti-vacuous — an empty/missing shard cannot pass silently)', () => {
    expect(ADMITTED.size).toBeGreaterThan(0)
  })

  it('every example seed minus the disposition allowlist is present in the corpus store by name', () => {
    expect(seedsMissingAdmission(SEED_NAMES, ADMITTED, DISPOSITION_ALLOWLIST)).toEqual([])
  })

  it('the disposition allowlist holds no residue — no excused seed has actually been admitted since', () => {
    expect(allowlistResidue(ADMITTED, DISPOSITION_ALLOWLIST)).toEqual([])
  })

  // ── negative controls (synthetic inputs — proves the gate actually bites, not just passes vacuously) ──

  it('a seed name in neither the corpus nor the allowlist is reported', () => {
    const admitted = new Set(['a', 'b'])
    const allowlist = new Map([['c', 'excused for testing']])
    expect(seedsMissingAdmission(['a', 'b', 'c', 'd'], admitted, allowlist)).toEqual(['d'])
  })

  it('an allowlisted name that IS in the corpus is flagged as residue', () => {
    const admitted = new Set(['a', 'b'])
    const allowlist = new Map([['b', 'stale disposition — b was admitted since']])
    expect(allowlistResidue(admitted, allowlist)).toEqual(['b'])
  })
})
