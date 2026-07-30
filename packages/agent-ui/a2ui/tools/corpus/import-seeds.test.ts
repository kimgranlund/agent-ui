// import-seeds.test.ts — GH #335 regression coverage for `import-seeds.ts`'s two argv-adjacent
// defects: an unjudged run silently re-admitting a disposition-allowlisted candidate (defect 1,
// `dispositionGuard`), and an unrecognized argument silently falling through into a real mutating run
// instead of hard-erroring (defect 2, `parseArgs`).
//
// Importing this module is SAFE — the CLI-entry guard at the bottom of `import-seeds.ts`
// (`process.argv[1]?.endsWith('import-seeds.ts')`) only fires `main()` when the file is executed
// directly by Node, never when a test imports `parseArgs`/`dispositionGuard` from it (vitest's own
// `process.argv[1]` never ends with that filename). Both functions under test are pure — no fs, no
// `process.exit` — so this file needs neither a scratch corpus dir nor a `process.exit` spy.
//
// Two TIERS live here, and the split is the point (GH #341): the `describe` blocks below exercise the
// pure helpers in isolation, which proves their SHAPE and nothing about whether `main()` consults them.
// The last two blocks spawn the REAL script in REAL subprocesses, which is the only tier that can catch
// a deleted call site. Both defects GH #335 fixed have a subprocess leg (the disposition guard on an
// unjudged run; `parseArgs` via `--bogus-flag`/`--help`), and so does every ADR-0165 clause. A new pure
// helper here needs its own subprocess leg too, or it is only half-covered.
//
// The ADR-0165 block runs against a THROWAWAY SANDBOX repo root rather than the committed corpus: those
// clauses are about runs that reach `saveStore` and WRITE, and the live corpus is not a fixture. The
// sandbox holds only what `main()` reads off `process.cwd()` — the rubric doc, `catalog.json`, and the
// corpus data dir — while the script itself, the seed shelf and every `src/corpus` module resolve
// relative to the real file, so the code under test is the shipped code.

import { describe, it, expect, afterEach } from 'vitest'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync, readdirSync, cpSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseArgs, dispositionGuard, dispositionAllowlistSnippet } from './import-seeds.ts'
import type { SeedRejection } from '../../src/corpus/import-report.ts'
import type { ArchivedVerdict } from '../../src/corpus/verdict-archive.ts'
import { allSeeds } from '../../src/examples/index.ts'

declare const process: { cwd(): string }

/** No archived verdicts — the guard input every pre-ADR-0165 case implicitly had. */
const NO_ARCHIVE = new Map<string, ArchivedVerdict>()

const archivedVerdict = (over: Partial<ArchivedVerdict> = {}): ArchivedVerdict => ({
  passed: false,
  qualityScore: 2,
  failingDimensions: ['D1', 'D5'],
  rubricVersion: '1.0',
  judgedBy: 'a2ui-reviewer',
  date: '2026-07-28',
  sourceFile: 'packages/agent-ui/a2ui/corpus/verdicts/2026-07-28--wave-b.json',
  ...over,
})

describe('parseArgs — GH #335 defect 2 (unrecognized argv must hard-error, not silently mutate)', () => {
  it('an unrecognized argument is a structured error, never silently dropped', () => {
    const parsed = parseArgs(['--help-me-please'])
    expect(parsed.kind).toBe('error')
  })

  it('the exact defect-2 repro — "--help" alone used to fall through to a real run; it must now be recognized as help, not an error and not a silent run', () => {
    const parsed = parseArgs(['--help'])
    expect(parsed).toEqual({ kind: 'help' })
  })

  it('"-h" is the short form of --help', () => {
    expect(parseArgs(['-h'])).toEqual({ kind: 'help' })
  })

  it('a genuine typo of a real flag is an error, not a silent no-op run', () => {
    // The exact shape the issue's live repro hit: an unrecognized flag must not be swallowed into
    // `{ kind: 'run' }` (which the pre-fix code always returned, mutating flags be damned).
    const parsed = parseArgs(['--verdict', 'verdicts.json']) // missing the trailing "s"
    expect(parsed.kind).toBe('error')
  })

  it('--verdicts with no path argument is an error, not a run with an undefined path', () => {
    expect(parseArgs(['--verdicts']).kind).toBe('error')
  })

  it('--replace with no name argument is an error', () => {
    expect(parseArgs(['--replace']).kind).toBe('error')
  })

  it('no arguments at all is a plain run with no options', () => {
    expect(parseArgs([])).toEqual({ kind: 'run', verdictsPath: undefined, replaceName: undefined, dryRun: false })
  })

  it('every known flag composes into one run', () => {
    expect(parseArgs(['--verdicts', 'v.json', '--replace', 'some-name', '--dry-run'])).toEqual({
      kind: 'run',
      verdictsPath: 'v.json',
      replaceName: 'some-name',
      dryRun: true,
    })
  })

  it('--help short-circuits even alongside other recognized flags (help wins, nothing else parses)', () => {
    expect(parseArgs(['--verdicts', 'v.json', '--help'])).toEqual({ kind: 'help' })
  })
})

describe('dispositionGuard — GH #335 defect 1 (an unjudged run must not silently re-admit a disposition-allowlisted candidate)', () => {
  it('the exact repro: an unjudged run (no --verdicts) HALTS on stats-grid-dashboard, the real disposition-allowlisted name, when it was never admitted', () => {
    const halt = dispositionGuard('stats-grid-dashboard', undefined, false, NO_ARCHIVE)
    expect(halt).toBeDefined()
    expect(halt).toMatch(/HALTED/)
    expect(halt).toMatch(/stats-grid-dashboard/)
  })

  it('a --verdicts run (judge wired) is NEVER halted by this guard — createVerdictJudge already fails closed on its own (ADR-0068 clause 2)', () => {
    expect(dispositionGuard('stats-grid-dashboard', 'some-verdicts-path.json', false, NO_ARCHIVE)).toBeUndefined()
  })

  it('a name with no recorded disposition is never halted', () => {
    expect(dispositionGuard('some-ordinary-seed-name', undefined, false, NO_ARCHIVE)).toBeUndefined()
  })

  it('a disposition-allowlisted name that IS already admitted (alreadyAdmitted:true) is untouched — the ordinary E_DUP idempotent-rerun path, not this guard', () => {
    expect(dispositionGuard('stats-grid-dashboard', undefined, true, NO_ARCHIVE)).toBeUndefined()
  })

  it('the halt message names the guard-exit path (--verdicts) so an operator knows how to proceed', () => {
    const halt = dispositionGuard('stats-grid-dashboard', undefined, false, NO_ARCHIVE)
    expect(halt).toMatch(/--verdicts/)
    expect(halt).toMatch(/Nothing was written/)
  })
})

describe('dispositionGuard — ADR-0165 clause 4 (the ARCHIVE is the third guard input, and the primary one)', () => {
  const archive = new Map([['some-new-candidate', archivedVerdict()]])

  it('an unjudged run HALTS on a name carrying an ARCHIVED passed:false verdict — the name no human ever transcribed', () => {
    const halt = dispositionGuard('some-new-candidate', undefined, false, archive)
    expect(halt).toBeDefined()
    expect(halt).toMatch(/HALTED/)
    expect(halt).toMatch(/some-new-candidate/)
    expect(halt).toMatch(/ARCHIVED/)
  })

  it('the halt quotes the verdict\'s own facts — qualityScore, failing dimensions, rubric version, judge, date — so an operator need not go find the file', () => {
    const halt = dispositionGuard('some-new-candidate', undefined, false, archive)
    expect(halt).toContain('qualityScore 2')
    expect(halt).toContain('D1, D5')
    expect(halt).toContain('a2ui-corpus 1.0')
    expect(halt).toContain('a2ui-reviewer')
    expect(halt).toContain('2026-07-28')
    expect(halt).toContain('2026-07-28--wave-b.json')
    expect(halt).toMatch(/Nothing was written/)
  })

  it('an archived PASSING verdict is not a disposition — it falls through and the run proceeds', () => {
    const passing = new Map([['some-new-candidate', archivedVerdict({ passed: true, qualityScore: 5 })]])
    expect(dispositionGuard('some-new-candidate', undefined, false, passing)).toBeUndefined()
  })

  it('a --verdicts run is never halted by the archive either — a fresh judgment supersedes an archived one (clause 4)', () => {
    expect(dispositionGuard('some-new-candidate', 'v.json', false, archive)).toBeUndefined()
  })

  it('an archived refusal for an ALREADY-ADMITTED name is not this guard\'s business — that is ADR-0068 clause 4\'s rescore path (clause 5\'s scope note)', () => {
    expect(dispositionGuard('some-new-candidate', undefined, true, archive)).toBeUndefined()
  })

  it('the archive is checked BEFORE the allowlist — a name in both halts with the machine-written verdict, not the curated prose', () => {
    const both = new Map([['stats-grid-dashboard', archivedVerdict({ qualityScore: 3 })]])
    const halt = dispositionGuard('stats-grid-dashboard', undefined, false, both)
    expect(halt).toMatch(/ARCHIVED/)
    expect(halt).toContain('qualityScore 3')
    expect(halt, 'the allowlist prose must not be what an operator sees when a real verdict exists').not.toContain('strict-subset duplicate')
  })

  it('a failing verdict with no failingDimensions still halts, reporting them as none', () => {
    const noDims = new Map([['x', archivedVerdict({ failingDimensions: undefined })]])
    expect(dispositionGuard('x', undefined, false, noDims)).toContain('(none reported)')
  })
})

describe('dispositionAllowlistSnippet — a paste-ready DISPOSITION_ALLOWLIST entry, DEMOTED to optional curated prose (ADR-0165 clause 6)', () => {
  const rejection: SeedRejection = {
    name: 'some-new-candidate',
    code: 'E_QUALITY',
    message: 'below the corpus-quality rubric bar',
    failingDimensions: ['D5', 'D2'],
  }
  const meta = { rubricVersion: '1.0', judgedBy: 'a2ui-reviewer', date: '2026-07-28' }

  it('formats as a real JS array-literal entry — `[\'name\', "reason"],` — pasteable straight into DISPOSITION_ALLOWLIST\'s Map constructor', () => {
    const snippet = dispositionAllowlistSnippet(rejection, meta)
    expect(snippet).toMatch(/^ {2}\['some-new-candidate', ".*"\],$/)
    // JSON.stringify (used to produce the reason string) always double-quotes and escapes correctly —
    // parsing the substring between the two matching double quotes proves it is valid JS string syntax,
    // not just "looks like" one.
    const reasonMatch = snippet.match(/, (".*")\],$/)
    expect(reasonMatch).not.toBeNull()
    expect(() => JSON.parse(reasonMatch![1]!)).not.toThrow()
  })

  it('carries the real rubric version/judge/date/failing-dimensions this run used, not placeholders', () => {
    const snippet = dispositionAllowlistSnippet(rejection, meta)
    expect(snippet).toContain('2026-07-28')
    expect(snippet).toContain('1.0')
    expect(snippet).toContain('a2ui-reviewer')
    expect(snippet).toContain('D5, D2')
  })

  it('points at the ARCHIVE as the machine-readable record and frames itself as optional — the ADR-0165 clause 6 demotion, not the old "paste this or it gets re-admitted" obligation', () => {
    const snippet = dispositionAllowlistSnippet(rejection, meta)
    expect(snippet).toMatch(/archived verdicts file/)
    expect(snippet).toMatch(/optional/)
    expect(
      snippet,
      'a refused seed LEAVES THE SHELF (ADR-0165 REV 2026-07-30, GH #361 reading (b)), so the deadline the old reminder implied went with it',
    ).not.toMatch(/before the next unjudged run/)
    // GH #372 — and "optional" must never stand ALONE again. Bare, it licenses the false inference the REV
    // ruled on: an entry is unowed only because the expected disposition is DROPPING the seed, and a seed
    // kept on the shelf is still a coverage candidate that owes one. Both halves of that condition are
    // pinned, because the sentence is only true with both — a snippet stating the drop while omitting the
    // kept-seed obligation is the same misreading in a friendlier costume.
    expect(snippet, 'the reason must say WHY the entry is optional — the seed is dropped from the shelf').toMatch(/dropping the seed/)
    expect(snippet, 'the reason must say a seed KEPT on the shelf still owes the entry').toMatch(/KEPT on the shelf[^.]*owes this entry/)
  })

  it('handles a rejection with no failingDimensions reported', () => {
    const noFailingDims: SeedRejection = { name: 'x', code: 'E_QUALITY', message: 'below bar' }
    expect(dispositionAllowlistSnippet(noFailingDims, meta)).toContain('(none reported)')
  })
})

// ── end-to-end wiring smoke — the review finding that the unit tests above cover the two PURE
// helpers, not that `main()` actually consults them: deleting either call site and every test above
// still passes. This spawns the REAL script (a real subprocess, real `--experimental-strip-types`,
// real fs) against the REAL committed shelf and proves the wiring itself, not just the helpers. Not a
// mandated fix (coordinator's "not yours to fix" list) — added because it was flagged as the single
// highest-value addition and is cheap. Coupled to the real corpus's current content (like
// `admission-coverage.test.ts` already is) — if `stats-grid-dashboard` is ever legitimately re-admitted
// via the sanctioned `--replace` path, this test needs a new never-admitted disposition-allowlisted
// fixture name, same as that gate would. ──
describe('import-seeds main() wiring — a real subprocess run proves the guard is actually consulted, not just unit-tested in isolation', () => {
  const repoRoot = process.cwd()
  const shardPath = `${repoRoot}/packages/agent-ui/a2ui/corpus/exemplar/v1_0/agent-ui.jsonl`
  const indexPath = `${repoRoot}/packages/agent-ui/a2ui/corpus/index.json`
  const scriptPath = 'packages/agent-ui/a2ui/tools/corpus/import-seeds.ts'

  /** Run the REAL script in a real subprocess, with the corpus read before and after. */
  const runScript = (args: string[]): { status: number | null; stdout: string; stderr: string; corpusUntouched: boolean } => {
    const beforeShard = readFileSync(shardPath, 'utf8')
    const beforeIndex = readFileSync(indexPath, 'utf8')
    const result = spawnSync('node', ['--experimental-strip-types', scriptPath, ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
    })
    const corpusUntouched =
      readFileSync(shardPath, 'utf8') === beforeShard && readFileSync(indexPath, 'utf8') === beforeIndex
    return { status: result.status, stdout: result.stdout, stderr: result.stderr, corpusUntouched }
  }

  it('a real unjudged run against the committed shelf HALTS on stats-grid-dashboard, exits non-zero, and leaves the corpus byte-identical', () => {
    const result = runScript([])

    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/HALTED/)
    expect(result.stderr).toMatch(/stats-grid-dashboard/)
    expect(result.corpusUntouched, 'the halted run must leave both corpus files byte-identical').toBe(true)
  })

  // GH #341's remaining half. The issue's repro ("delete the dispositionGuard call site and all tests
  // still pass") does NOT reproduce — the leg above already reds on that, since it shipped in the same
  // PR the issue reviewed. What the issue is right about applies to the OTHER defect: `parseArgs` was
  // only ever unit-tested, so nothing proved `main()` consults it BEFORE touching the fs. The two legs
  // below close that — the exact `--bogus-flag` / `--help` probes #341 records as run by hand.
  //
  // Note on why exit code alone is NOT enough here: with the arg-error branch deleted, a `--bogus-flag`
  // run falls through into the real pipeline, hits the disposition guard and STILL exits 1 with the
  // corpus untouched. So the discriminating assertion is that the run stopped AT arg-parsing — the bad
  // flag is named, help is printed, and no HALT line (which only the seed loop can emit) appears.
  it('--bogus-flag hard-errors AT ARG-PARSING (names the flag, prints help, never reaches the seed loop) and leaves the corpus byte-identical', () => {
    const result = runScript(['--bogus-flag'])

    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/unrecognized argument "--bogus-flag"/)
    expect(result.stderr).toMatch(/Nothing was written/)
    // Help is printed on the error path so an operator sees the real flag set (GH #335 defect 2).
    expect(result.stderr).toMatch(/--experimental-strip-types/)
    // The proof it stopped BEFORE any fs work: the seed loop's HALT line cannot have fired, and the
    // run summary cannot have printed. Exit 1 alone would also hold if parsing were skipped entirely.
    expect(result.stderr, 'a bogus flag must never reach the seed loop — arg-parsing runs first').not.toMatch(/HALTED/)
    expect(result.stdout, 'a bogus flag must never reach the admission report').not.toMatch(/admitted/)
    expect(result.corpusUntouched, 'a bogus flag must never mutate the corpus (the live GH #335 defect)').toBe(true)
  })

  it('--help exits 0 with real usage on stdout, reads and writes nothing', () => {
    const result = runScript(['--help'])

    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/import-seeds — the ADR-0055 seed-import script/)
    expect(result.stdout).toMatch(/--verdicts <path>/)
    // Same discrimination as above: --help must short-circuit before the pipeline, so neither the
    // seed loop's HALT nor the admission report can appear.
    expect(result.stderr, '--help must not reach the seed loop').not.toMatch(/HALTED/)
    expect(result.stdout, '--help must not reach the admission report').not.toMatch(/admitted \(/)
    expect(result.corpusUntouched, '--help must leave the corpus byte-identical').toBe(true)
  })
})

// ── ADR-0165 / GH #340 — the verdict archive, proven through REAL subprocess runs. Every clause here is
// about a run that WRITES, so these run against a throwaway sandbox repo root (see the header note): the
// committed corpus is live data, not a fixture. The `runScript` block above stays the leg that proves
// behaviour against the real tree; this block proves the write behaviour the real tree must never
// exercise in a test. ──
describe('import-seeds main() — the verdict archive (ADR-0165), real subprocess runs against a sandbox repo root', () => {
  const REAL_ROOT = process.cwd()
  const SCRIPT = join(REAL_ROOT, 'packages/agent-ui/a2ui/tools/corpus/import-seeds.ts')
  const RUBRIC = '.claude/docs/rubrics/a2ui-corpus.md'
  const CATALOG = 'packages/agent-ui/a2ui/src/catalog/default/catalog.json'
  const SHARD = 'packages/agent-ui/a2ui/corpus/exemplar/v1_0/agent-ui.jsonl'
  const ARCHIVE_DIR = 'packages/agent-ui/a2ui/corpus/verdicts'

  let sandbox: string

  /** A sandbox repo root holding exactly what `main()` reads off `process.cwd()`. `withShard` decides
   *  whether the 24 committed records are already admitted (so every seed is an idempotent `E_DUP`) or
   *  the corpus is empty (so every seed is a fresh candidate the judge must rule on). */
  const makeSandbox = (opts: { withShard: boolean }): void => {
    sandbox = mkdtempSync(join(tmpdir(), 'a2ui-import-seeds-'))
    for (const rel of [RUBRIC, CATALOG]) {
      mkdirSync(join(sandbox, rel.slice(0, rel.lastIndexOf('/'))), { recursive: true })
      cpSync(join(REAL_ROOT, rel), join(sandbox, rel))
    }
    if (opts.withShard) {
      mkdirSync(join(sandbox, SHARD.slice(0, SHARD.lastIndexOf('/'))), { recursive: true })
      cpSync(join(REAL_ROOT, SHARD), join(sandbox, SHARD))
    }
  }

  const writeVerdicts = (name: string, body: { date: string; verdicts: Record<string, unknown> }): string => {
    const path = join(sandbox, name)
    writeFileSync(
      path,
      `${JSON.stringify({ rubric: 'a2ui-corpus', rubricVersion: '1.0', judgedBy: 'a2ui-reviewer', ...body }, null, 2)}\n`,
    )
    return path
  }

  const plantArchive = (fileName: string, text: string): string => {
    mkdirSync(join(sandbox, ARCHIVE_DIR), { recursive: true })
    const path = join(sandbox, ARCHIVE_DIR, fileName)
    writeFileSync(path, text)
    return path
  }

  const run = (args: string[]): { status: number | null; stdout: string; stderr: string } => {
    const r = spawnSync('node', ['--experimental-strip-types', SCRIPT, ...args], { cwd: sandbox, encoding: 'utf8' })
    return { status: r.status, stdout: r.stdout, stderr: r.stderr }
  }

  const archivedFiles = (): string[] => {
    try {
      return readdirSync(join(sandbox, ARCHIVE_DIR)).sort()
    } catch {
      return []
    }
  }

  afterEach(() => {
    rmSync(sandbox, { recursive: true, force: true })
  })

  /** With the committed shard loaded, the 23 admitted seeds short-circuit at dedup (`E_DUP`) and never
   *  reach the judge; `stats-grid-dashboard` is the ONE shelf seed absent from it, so a wired judge
   *  fails closed unless the file rules on it (ADR-0068 clause 2). Refusing it keeps the run at zero
   *  admissions while still reaching `saveStore` — the archive's actual trigger. */
  const SHARD_LOADED_VERDICTS = { 'stats-grid-dashboard': { passed: false, qualityScore: 2 } }

  it('clause 1 — a judged run that reaches saveStore archives its verdicts file BYTE-IDENTICALLY at <date>--<slug>.json, and a second identical run is a no-op', () => {
    makeSandbox({ withShard: true })
    const verdictsPath = writeVerdicts('wave-b.json', { date: '2026-07-28', verdicts: SHARD_LOADED_VERDICTS })
    const input = readFileSync(verdictsPath, 'utf8')

    const first = run(['--verdicts', verdictsPath])
    expect(first.status, first.stderr).toBe(0)
    expect(archivedFiles()).toEqual(['2026-07-28--wave-b.json'])
    expect(readFileSync(join(sandbox, ARCHIVE_DIR, '2026-07-28--wave-b.json'), 'utf8')).toBe(input)
    expect(first.stdout).toContain(`verdicts archived to: ${ARCHIVE_DIR}/2026-07-28--wave-b.json`)

    const second = run(['--verdicts', verdictsPath])
    expect(second.status, second.stderr).toBe(0)
    expect(second.stdout).toContain('verdicts already archived at')
    expect(archivedFiles(), 'idempotence — a re-run resolves to the same path and writes nothing new').toEqual([
      '2026-07-28--wave-b.json',
    ])
    expect(readFileSync(join(sandbox, ARCHIVE_DIR, '2026-07-28--wave-b.json'), 'utf8')).toBe(input)
  })

  it('THE ALL-REJECTED WAVE (clause 1) — every candidate rejected E_QUALITY, ZERO admissions, and the archive STILL lands carrying every passed:false verdict', () => {
    makeSandbox({ withShard: false })
    const verdicts: Record<string, unknown> = {}
    for (const seed of allSeeds) verdicts[seed.name] = { passed: false, qualityScore: 2, failingDimensions: ['D1'] }
    const verdictsPath = writeVerdicts('all-rejected.json', { date: '2026-07-29', verdicts })
    const input = readFileSync(verdictsPath, 'utf8')

    const result = run(['--verdicts', verdictsPath])

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout, 'zero admissions — this is the whole point of the case').toMatch(/0 admitted/)
    expect(result.stdout).toMatch(new RegExp(`${allSeeds.length} quality-rejected`))
    expect(existsSync(join(sandbox, SHARD)), 'nothing was admitted, so no shard exists').toBe(false)
    expect(archivedFiles(), 'zero admissions is NOT zero record').toEqual(['2026-07-29--all-rejected.json'])
    expect(readFileSync(join(sandbox, ARCHIVE_DIR, '2026-07-29--all-rejected.json'), 'utf8')).toBe(input)

    // The archived file is the durable E_QUALITY record: every refused name is IN it, machine-readable.
    const archived = JSON.parse(readFileSync(join(sandbox, ARCHIVE_DIR, '2026-07-29--all-rejected.json'), 'utf8')) as {
      verdicts: Record<string, { passed: boolean }>
    }
    expect(Object.keys(archived.verdicts).sort()).toEqual(allSeeds.map((s) => s.name).sort())
    expect(Object.values(archived.verdicts).every((v) => v.passed === false)).toBe(true)
  })

  it('clause 1 — --dry-run --verdicts writes NEITHER store nor archive, while reporting the path a real run would use', () => {
    makeSandbox({ withShard: true })
    const verdictsPath = writeVerdicts('wave-b.json', { date: '2026-07-28', verdicts: SHARD_LOADED_VERDICTS })

    const result = run(['--verdicts', verdictsPath, '--dry-run'])

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain(`would archive verdicts to: ${ARCHIVE_DIR}/2026-07-28--wave-b.json`)
    expect(archivedFiles(), 'a dry run writes nothing here either').toEqual([])
  })

  it('clause 1 — a run that ABORTS on hardErrors before saveStore writes NO archive (the one direction the trigger distinction cuts)', () => {
    makeSandbox({ withShard: false })
    // A real hardErrors abort, not a parse failure: strip `Text` out of the sandbox catalog so every seed
    // that uses it fails admission with E_CATALOG — a code `classifyRejections` routes to `hardErrors`,
    // which `shouldAbort` turns into "nothing written, even for candidates that themselves passed".
    const catalog = JSON.parse(readFileSync(join(sandbox, CATALOG), 'utf8')) as { components: Record<string, unknown> }
    delete catalog.components.Text
    writeFileSync(join(sandbox, CATALOG), JSON.stringify(catalog))

    const verdicts: Record<string, unknown> = {}
    for (const seed of allSeeds) verdicts[seed.name] = { passed: true, qualityScore: 5 }
    const verdictsPath = writeVerdicts('wave-b.json', { date: '2026-07-28', verdicts })

    const result = run(['--verdicts', verdictsPath])

    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/failed admission for a non-duplicate, non-quality reason/)
    expect(result.stderr).toMatch(/E_CATALOG/)
    expect(archivedFiles(), 'a run that aborts before saveStore archives nothing — the store\'s own posture').toEqual([])
    expect(existsSync(join(sandbox, SHARD))).toBe(false)
  })

  it('the hardErrors abort and the all-rejected wave are DIFFERENT — E_QUALITY alone never aborts, so it still archives (the distinction clause 1 calls load-bearing)', () => {
    // The pairing that makes the case above meaningful: identical shape, one rejection code apart, and
    // the archive outcome inverts. Without this, "aborts => no archive" could be read as "rejections =>
    // no archive", which is exactly the skip the ADR warns an implementer is most likely to make.
    makeSandbox({ withShard: false })
    const verdicts: Record<string, unknown> = {}
    for (const seed of allSeeds) verdicts[seed.name] = { passed: false, qualityScore: 2 }
    const verdictsPath = writeVerdicts('wave-b.json', { date: '2026-07-28', verdicts })

    const result = run(['--verdicts', verdictsPath])

    expect(result.status, result.stderr).toBe(0)
    expect(archivedFiles()).toEqual(['2026-07-28--wave-b.json'])
  })

  it('clause 2 — a DIFFERING existing archive at the target path HALTS: non-zero, both hashes named, and NEITHER the archive nor the store is written', () => {
    makeSandbox({ withShard: false })
    // All-passing verdicts: without the collision this run would admit every seed and write a shard.
    const verdicts: Record<string, unknown> = {}
    for (const seed of allSeeds) verdicts[seed.name] = { passed: true, qualityScore: 5 }
    const verdictsPath = writeVerdicts('wave-b.json', { date: '2026-07-28', verdicts })

    const planted = plantArchive(
      '2026-07-28--wave-b.json',
      `${JSON.stringify({ rubric: 'a2ui-corpus', rubricVersion: '1.0', judgedBy: 'someone-else', date: '2026-07-28', verdicts: {} })}\n`,
    )
    const before = readFileSync(planted, 'utf8')

    const result = run(['--verdicts', verdictsPath])

    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/HALTED/)
    expect(result.stderr).toContain(`${ARCHIVE_DIR}/2026-07-28--wave-b.json`)
    expect(result.stderr, 'both contents\' hashes are named so an operator can tell the two waves apart').toMatch(
      /existing sha256 [0-9a-f]{64}.*incoming sha256 [0-9a-f]{64}/s,
    )
    expect(result.stderr).toMatch(/distinct --verdicts filename/)
    expect(readFileSync(planted, 'utf8'), 'the existing archived record is byte-unchanged').toBe(before)
    expect(
      existsSync(join(sandbox, SHARD)),
      'the store must not be written either — the archive halt precedes saveStore (clause 1\'s all-or-nothing posture)',
    ).toBe(false)
  })

  it('the SAME collision under --dry-run is a WARNING, not a halt — exit 0, the run summary still prints (GH #360 review item 3)', () => {
    // The dry-run softening the disposition guard already carries, applied to the archive collision: a
    // dry run writes nothing to collide with, so hard-exiting suppressed the very summary --dry-run
    // exists to produce. The COLLISION is what this shares with the case above; the rest of the setup
    // deliberately differs — that case runs an EMPTY sandbox with all-passing verdicts, while this one
    // needs a pre-loaded shard AND a `passed:false` verdict so the run actually reaches the
    // `quality-rejected` / `NOT recorded durably` summary lines the hard exit used to suppress.
    makeSandbox({ withShard: true })
    const verdictsPath = writeVerdicts('wave-b.json', { date: '2026-07-28', verdicts: SHARD_LOADED_VERDICTS })
    const planted = plantArchive(
      '2026-07-28--wave-b.json',
      `${JSON.stringify({ rubric: 'a2ui-corpus', rubricVersion: '1.0', judgedBy: 'someone-else', date: '2026-07-28', verdicts: {} })}\n`,
    )
    const before = readFileSync(planted, 'utf8')

    const result = run(['--verdicts', verdictsPath, '--dry-run'])

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout, 'the collision is still reported, in the dry-run voice').toMatch(/a real run would HALT here/)
    expect(result.stdout).toContain(`${ARCHIVE_DIR}/2026-07-28--wave-b.json`)
    expect(result.stdout).toMatch(/existing sha256 [0-9a-f]{64}.*incoming sha256 [0-9a-f]{64}/s)
    expect(result.stdout, 'the summary the hard exit used to suppress').toMatch(/--dry-run, nothing written.*quality-rejected/s)
    expect(result.stdout).toMatch(/would HALT on a real run \(--dry-run only, archive path already holds DIFFERENT content\)/)
    expect(result.stdout, 'a dry run never claims it would archive over a collision').not.toMatch(/would archive verdicts to/)
    expect(result.stdout, 'nor that the refusals are recorded in a file it did not write').toMatch(/NOT recorded durably/)
    expect(readFileSync(planted, 'utf8'), 'still byte-unchanged — a dry run writes nothing, warning or not').toBe(before)
  })

  it('clause 4 — a plain UNJUDGED run HALTS on a name carrying an archived passed:false verdict, quoting the verdict, with nothing written', () => {
    makeSandbox({ withShard: true })
    // `stats-grid-dashboard` is the one shelf seed absent from the committed shard — exactly the ADR's
    // "X absent from the store" case. Its archived refusal must halt the run BEFORE the allowlist prose.
    plantArchive(
      '2026-07-11--m-b-wave.json',
      `${JSON.stringify({
        rubric: 'a2ui-corpus',
        rubricVersion: '1.0',
        judgedBy: 'a2ui-reviewer',
        date: '2026-07-11',
        verdicts: { 'stats-grid-dashboard': { passed: false, qualityScore: 3, failingDimensions: ['D5'] } },
      })}\n`,
    )

    const result = run([])

    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/HALTED/)
    expect(result.stderr).toMatch(/ARCHIVED quality rejection/)
    expect(result.stderr).toContain('stats-grid-dashboard')
    expect(result.stderr).toContain('qualityScore 3')
    expect(result.stderr).toContain('D5')
    expect(result.stderr).toContain('2026-07-11--m-b-wave.json')
    expect(archivedFiles(), 'the halted run touched nothing').toEqual(['2026-07-11--m-b-wave.json'])
  })

  it('clause 4 — the same run WITH --verdicts supplying a fresh PASSING verdict admits the name and archives the newer file', () => {
    makeSandbox({ withShard: true })
    plantArchive(
      '2026-07-11--m-b-wave.json',
      `${JSON.stringify({
        rubric: 'a2ui-corpus',
        rubricVersion: '1.0',
        judgedBy: 'a2ui-reviewer',
        date: '2026-07-11',
        verdicts: { 'stats-grid-dashboard': { passed: false, qualityScore: 3, failingDimensions: ['D5'] } },
      })}\n`,
    )
    const verdictsPath = writeVerdicts('re-judged.json', {
      date: '2026-07-29',
      verdicts: { 'stats-grid-dashboard': { passed: true, qualityScore: 5 } },
    })

    const result = run(['--verdicts', verdictsPath])

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toMatch(/1 admitted/)
    expect(result.stdout).toContain('stats-grid-dashboard')
    expect(archivedFiles()).toEqual(['2026-07-11--m-b-wave.json', '2026-07-29--re-judged.json'])
    expect(readFileSync(join(sandbox, SHARD), 'utf8'), 'the re-admitted record landed in the shard').toContain('stats-grid-dashboard')
  })

  it('clause 3 — a SELF-CONFLICTING archive (two same-date files disagreeing) halts every run before any work', () => {
    makeSandbox({ withShard: true })
    const body = (passed: boolean): string =>
      `${JSON.stringify({
        rubric: 'a2ui-corpus',
        rubricVersion: '1.0',
        judgedBy: 'a2ui-reviewer',
        date: '2026-07-28',
        verdicts: { 'stats-grid-dashboard': { passed, qualityScore: passed ? 5 : 2 } },
      })}\n`
    plantArchive('2026-07-28--a.json', body(false))
    plantArchive('2026-07-28--b.json', body(true))

    const result = run([])

    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/HALTED/)
    expect(result.stderr).toMatch(/verdict archive/)
    expect(result.stderr).toContain('2026-07-28--a.json')
    expect(result.stderr).toContain('2026-07-28--b.json')
    expect(result.stderr).toMatch(/Nothing was written/)
  })

  it('the sandbox itself is honest — an unjudged run against the shard-loaded sandbox with an EMPTY archive still halts on the allowlist, exactly as the real tree does', () => {
    // The negative control for every case above: if the sandbox were subtly wrong (a missing rubric, a
    // catalog that would not load), these runs would fail for a reason unrelated to the clause under test.
    makeSandbox({ withShard: true })
    const result = run([])
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/HALTED/)
    expect(result.stderr).toContain('stats-grid-dashboard')
    expect(result.stderr, 'with no archive planted, the fallback is the curated allowlist prose').toContain('strict-subset duplicate')
  })
})
