// admission-coverage.test.ts — the TKT-0022 trip-wire: every example-shelf seed (`src/examples/`
// `allSeeds`) is either ADMITTED to the corpus store (present by name — the corpus join key, corpus
// LLD §2 invariant i) or explicitly DISPOSITIONED with a recorded reason (the `EXCLUSION_ALLOWLIST`
// comment-with-citation precedent, `catalog/default/index.test.ts`). A future wave that adds a seed to
// `allSeeds` without either admitting it through `tools/corpus/import-seeds.ts` or dispositioning it here
// goes RED — the exact gap TKT-0022 closed (seeds rendering on the gallery but never entering the
// retrieval corpus) cannot silently reopen.
//
// **GH #340 / ADR-0165 clause 5 — the leg that closes the disarm.** The two original legs are defeated
// by the very event they exist to catch: `seedsMissingAdmission` reports a seed only while it is BOTH
// un-admitted and un-allowlisted, and `allowlistResidue` fires only for names already IN the allowlist —
// so the moment an unjudged run admits a previously-refused seed, the gate goes GREEN. `unjudgedAdmissions`
// is the third leg: a seed that IS admitted but whose record carries no `meta.qualityScore` and no
// archived `passed:true` verdict is reported. Combined, a refused seed is now RED on BOTH branches of its
// future — it stays out, or it is silently re-admitted.
//
// Test-only `node:fs` (the `corpus-data.test.ts` precedent) — walks the corpus data dir directly rather
// than importing `tools/corpus/fs-store.ts` (a src test reading raw shard text keeps the same "pure core
// stays fs-free" discipline `corpus-data.test.ts` already holds, SPEC-N5/ADR-0062). ADR-0165 clause 3
// keeps that line for the archive too: this file's own `walk()` reads `corpus/verdicts/` and feeds the
// SHARED pure merge (`verdict-archive.ts`), while `tools/corpus/fs-store.ts`'s `loadVerdictArchive()`
// does the same over the Node shell — one merge, two fs disciplines, no tool-shell import here.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { allSeeds } from '../examples/index.ts'
import type { CorpusRecord } from './record.ts'
import { DISPOSITION_ALLOWLIST } from './disposition-allowlist.ts'
import { mergeVerdictArchive, parseArchivedVerdicts } from './verdict-archive.ts'
import type { ArchivedVerdict, ArchivedVerdictsSource } from './verdict-archive.ts'

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

/** One admitted record, reduced to the two facts this gate judges: it exists, and whether it was
 *  JUDGED. ADR-0165 clause 5 promoted this from a bare name set — `qualityScore`-presence is the
 *  judged-ness marker ADR-0068 clause 3 writes on every judged admission. */
interface AdmittedRecord {
  status: string
  qualityScore?: number
}

/** Every record across every `.jsonl` shard under the corpus data dir, any facet/status — a
 *  quarantined record is still an ADMITTED disposition of its seed (its own healthiness is
 *  `corpus-data.test.ts`'s concern, not this gate's). `.jsonl.enc` shards are skipped: none exist today
 *  and decrypting is out of scope for a name-only coverage gate. */
function admittedRecords(): Map<string, AdmittedRecord> {
  const records = new Map<string, AdmittedRecord>()
  for (const file of walk(CORPUS_ROOT)) {
    if (!file.endsWith('.jsonl')) continue
    const text = readFileSync(file, 'utf8') as string
    for (const line of text.split('\n')) {
      if (line.trim() === '') continue
      const rec = JSON.parse(line) as CorpusRecord
      records.set(rec.name, {
        status: rec.meta.status,
        ...(rec.meta.qualityScore !== undefined ? { qualityScore: rec.meta.qualityScore } : {}),
      })
    }
  }
  return records
}

/** The verdict archive (ADR-0165 clause 1/3), read through THIS file's own `node:fs` walk and merged by
 *  the shared pure `mergeVerdictArchive` — the second of the two readers clause 3 sanctions. Files are
 *  sorted so a same-date conflict names the same two files every run. A malformed archived file or a
 *  same-date disagreement THROWS here: this gate must never silently degrade to an empty archive, which
 *  would quietly weaken `unjudgedAdmissions` back into the disarmable shape #340 filed. */
function verdictArchive(): Map<string, ArchivedVerdict> {
  const sources: ArchivedVerdictsSource[] = []
  for (const file of walk(join(CORPUS_ROOT, 'verdicts')).sort()) {
    if (!file.endsWith('.json')) continue
    const parsed = parseArchivedVerdicts(readFileSync(file, 'utf8') as string)
    if (!parsed.ok) {
      throw new Error(`archived verdicts file ${file} is malformed: ${parsed.issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`)
    }
    sources.push({ sourceFile: file.slice(process.cwd().length + 1), file: parsed.file })
  }
  const merged = mergeVerdictArchive(sources)
  if (!merged.ok) throw new Error(`the verdict archive self-conflicts: ${merged.conflicts.map((c) => c.message).join('; ')}`)
  return merged.archive
}

// `DISPOSITION_ALLOWLIST` now lives in `./disposition-allowlist.ts` (GH #335) — it is no longer this
// test's private fixture: `tools/corpus/import-seeds.ts` reads the SAME map to refuse a silent unjudged
// re-admission of a previously judged-and-rejected candidate. Imported above.

/** The seed names covered by neither the corpus nor the disposition allowlist — the drift this gate
 *  exists to catch. A pure predicate (the `typesMissingCatalog` precedent) so the negative controls below
 *  can drive it with synthetic inputs, independent of the real corpus/allowlist contents. */
function seedsMissingAdmission(
  seedNames: readonly string[],
  admitted: ReadonlyMap<string, AdmittedRecord>,
  allowlist: ReadonlyMap<string, string>,
): string[] {
  return seedNames.filter((n) => !admitted.has(n) && !allowlist.has(n))
}

/** Allowlist entries that ALSO appear in the corpus — a disposition never drained after the seed it
 *  excused was actually admitted (the `allowlistResidue` precedent: a stale exclusion is drift too). */
function allowlistResidue(admitted: ReadonlyMap<string, AdmittedRecord>, allowlist: ReadonlyMap<string, string>): string[] {
  return [...allowlist.keys()].filter((name) => admitted.has(name))
}

/**
 * ADR-0165 clause 5 — the leg that closes GH #340. A seed that IS admitted but carries no evidence it
 * was ever JUDGED: no `meta.qualityScore` on its stored record (ADR-0068 clause 3 writes one on every
 * judged admission) and no archived `passed:true` verdict. With the two legs above, a refused seed is
 * RED on BOTH branches of its future — it stays out (`seedsMissingAdmission`) or it is silently
 * re-admitted (here) — so the gate can no longer be greened by the event it exists to catch.
 *
 * An allowlisted name is excused: a curated `DISPOSITION_ALLOWLIST` entry is a deliberate human ruling
 * (clause 6), and `allowlistResidue` already governs the "excused yet admitted" case on its own terms.
 *
 * `qualityScore`-presence is a PROXY for judged-ness, sound because `admit.ts`'s stage-10 write is the
 * ONLY path that mints a record into the store (`rescore.ts` only UPDATES extant names — a verdict
 * naming a record not in the store halts, ADR-0068 clause 4). A future wave that reintroduces
 * legitimately-unjudged admissions owes an explicit marker, not a weakened gate.
 */
function unjudgedAdmissions(
  seedNames: readonly string[],
  admitted: ReadonlyMap<string, AdmittedRecord>,
  allowlist: ReadonlyMap<string, string>,
  archive: ReadonlyMap<string, ArchivedVerdict>,
): string[] {
  return seedNames.filter((n) => {
    const rec = admitted.get(n)
    if (rec === undefined || rec.qualityScore !== undefined) return false
    if (allowlist.has(n)) return false
    return archive.get(n)?.passed !== true
  })
}

describe('corpus admission coverage — the TKT-0022 trip-wire (every seed admitted or dispositioned)', () => {
  const SEED_NAMES = allSeeds.map((s) => s.name)
  const ADMITTED = admittedRecords()
  const ARCHIVE = verdictArchive()

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

  it('every admitted seed was JUDGED — no record carries an admission without a qualityScore or an archived passing verdict (ADR-0165 clause 5)', () => {
    expect(unjudgedAdmissions(SEED_NAMES, ADMITTED, DISPOSITION_ALLOWLIST, ARCHIVE)).toEqual([])
  })

  // ── negative controls (synthetic inputs — proves the gate actually bites, not just passes vacuously) ──

  const judged = (qualityScore: number): AdmittedRecord => ({ status: 'valid', qualityScore })
  const unjudged = (): AdmittedRecord => ({ status: 'valid' })

  it('a seed name in neither the corpus nor the allowlist is reported', () => {
    const admitted = new Map([
      ['a', judged(4)],
      ['b', judged(4)],
    ])
    const allowlist = new Map([['c', 'excused for testing']])
    expect(seedsMissingAdmission(['a', 'b', 'c', 'd'], admitted, allowlist)).toEqual(['d'])
  })

  it('an allowlisted name that IS in the corpus is flagged as residue', () => {
    const admitted = new Map([
      ['a', judged(4)],
      ['b', judged(4)],
    ])
    const allowlist = new Map([['b', 'stale disposition — b was admitted since']])
    expect(allowlistResidue(admitted, allowlist)).toEqual(['b'])
  })

  // ── ADR-0165 clause 5's own negative controls: the #340 scenario is that an unjudged run ADMITS a
  //    previously-refused seed, which greens both legs above. This leg must red on exactly that. ──

  const archiveOf = (entries: ReadonlyArray<[string, boolean]>): Map<string, ArchivedVerdict> =>
    new Map(
      entries.map(([name, passed]) => [
        name,
        { passed, qualityScore: passed ? 4 : 2, rubricVersion: '1.0', judgedBy: 'a2ui-reviewer', date: '2026-07-28', sourceFile: 'test' },
      ]),
    )

  it('THE #340 SCENARIO: a seed admitted WITHOUT a qualityScore and not allowlisted is reported — the silent re-admission the other two legs go green on', () => {
    const admitted = new Map([
      ['a', judged(4)],
      ['sneaked-in', unjudged()],
    ])
    // Both original legs are GREEN on this input — that is the disarm #340 filed, reproduced here.
    expect(seedsMissingAdmission(['a', 'sneaked-in'], admitted, new Map())).toEqual([])
    expect(allowlistResidue(admitted, new Map())).toEqual([])
    expect(unjudgedAdmissions(['a', 'sneaked-in'], admitted, new Map(), new Map())).toEqual(['sneaked-in'])
  })

  it('the same seed with an ARCHIVED passing verdict is not reported (judged-ness proven by the archive, not the shard)', () => {
    const admitted = new Map([['x', unjudged()]])
    expect(unjudgedAdmissions(['x'], admitted, new Map(), archiveOf([['x', true]]))).toEqual([])
  })

  it('an archived FAILING verdict does not excuse an unjudged admission — that is the refusal being reversed, the loudest case of all', () => {
    const admitted = new Map([['x', unjudged()]])
    expect(unjudgedAdmissions(['x'], admitted, new Map(), archiveOf([['x', false]]))).toEqual(['x'])
  })

  it('the same seed ALLOWLISTED is not reported (a curated human ruling excuses it — clause 6)', () => {
    const admitted = new Map([['x', unjudged()]])
    const allowlist = new Map([['x', 'deliberately-minimal smoke seed']])
    expect(unjudgedAdmissions(['x'], admitted, allowlist, new Map())).toEqual([])
  })

  it('a seed that is NOT admitted at all is not reported here — that is seedsMissingAdmission\'s leg, not this one', () => {
    expect(unjudgedAdmissions(['ghost'], new Map(), new Map(), new Map())).toEqual([])
  })

  it('a judged admission (qualityScore present on the record) is never reported', () => {
    const admitted = new Map([['x', judged(5)]])
    expect(unjudgedAdmissions(['x'], admitted, new Map(), new Map())).toEqual([])
  })
})
