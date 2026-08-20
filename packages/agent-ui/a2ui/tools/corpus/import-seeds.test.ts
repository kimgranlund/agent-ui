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
// unjudged run; `parseArgs` via `--bogus-flag`/`--help`), and so do every ADR-0165 clause and GH #1346's
// fail-closed judge-tier guard. A new pure helper here needs its own subprocess leg too, or it is only
// half-covered.
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
import { DISPOSITION_ALLOWLIST } from '../../src/corpus/disposition-allowlist.ts'

declare const process: { cwd(): string }

// The LIVE rubric's version marker (its own `version:` line) — fixtures that must parse as a
// CURRENT VerdictsFile cite the owner instead of a copied literal (GH #747 bumped it 1.0 → 1.1;
// the hardcoded copies were exactly the rot GH #757 names). Archived-history plants below keep
// their frozen '1.0' — an old archive legitimately cites the version it was judged under.
const LIVE_RUBRIC_VERSION = /^version:\s*(\S+)/m.exec(
  readFileSync(join(process.cwd(), '.claude/docs/rubrics/a2ui-corpus.md'), 'utf8'),
)![1]!

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

// The allowlist input is SYNTHETIC here (the guard's injectable `allowlist` parameter — the
// `admission-coverage.test.ts` pure-predicate precedent): between 2026-08-18 and GH #1377 the real
// `DISPOSITION_ALLOWLIST` was legitimately EMPTY (every shelf seed admitted; the two standing refusals
// — `stats-grid-dashboard`, the original GH #335 repro name, and `wizard-step-progress` — DROPPED per
// the ADR-0165 drop path, their entries drained). GH #1377 (2026-08-19) put two live entries back
// (`product-options-quantity` · `listing-photo-grid`, the NO-VERDICT-SOUGHT-YET category), so the guard
// now has REAL names to exercise too (below) — the PLANTED fixture stays the primary coverage surface
// regardless (a synthetic name that can never collide with a real future seed).
const PLANTED_ALLOWLIST = new Map<string, string>([
  ['planted-refused-seed', 'curated planted prose — judged E_QUALITY, KEPT on the shelf pending repair (synthetic fixture)'],
])

describe('dispositionGuard — GH #335 defect 1 (an unjudged run must not silently re-admit a disposition-allowlisted candidate)', () => {
  it('the exact repro shape: an unjudged run (no --verdicts) HALTS on a disposition-allowlisted name that was never admitted', () => {
    const halt = dispositionGuard('planted-refused-seed', undefined, false, NO_ARCHIVE, PLANTED_ALLOWLIST)
    expect(halt).toBeDefined()
    expect(halt).toMatch(/HALTED/)
    expect(halt).toMatch(/planted-refused-seed/)
    expect(halt, 'the allowlist leg surfaces the curated prose itself').toContain('curated planted prose')
  })

  it('a --verdicts run (judge wired) is NEVER halted by this guard — createVerdictJudge already fails closed on its own (ADR-0068 clause 2)', () => {
    expect(dispositionGuard('planted-refused-seed', 'some-verdicts-path.json', false, NO_ARCHIVE, PLANTED_ALLOWLIST)).toBeUndefined()
  })

  it('a name with no recorded disposition is never halted', () => {
    expect(dispositionGuard('some-ordinary-seed-name', undefined, false, NO_ARCHIVE, PLANTED_ALLOWLIST)).toBeUndefined()
  })

  it('a disposition-allowlisted name that IS already admitted (alreadyAdmitted:true) is untouched — the ordinary E_DUP idempotent-rerun path, not this guard', () => {
    expect(dispositionGuard('planted-refused-seed', undefined, true, NO_ARCHIVE, PLANTED_ALLOWLIST)).toBeUndefined()
  })

  it('the halt message names the guard-exit path (--verdicts) so an operator knows how to proceed', () => {
    const halt = dispositionGuard('planted-refused-seed', undefined, false, NO_ARCHIVE, PLANTED_ALLOWLIST)
    expect(halt).toMatch(/--verdicts/)
    expect(halt).toMatch(/Nothing was written/)
  })

  it('the REAL allowlist is the default input — every shelf name in it halts, every other shelf name passes through (GH #1352 flipped this from the prior all-empty steady state)', () => {
    // Anti-drift, generalized rather than frozen to "empty": this reads the REAL DISPOSITION_ALLOWLIST
    // directly rather than asserting a specific size or membership, so the NEXT entry (or drain) needs
    // no edit here — only a genuinely new disposition SHAPE (the guard itself changing) would.
    for (const seed of allSeeds) {
      const halt = dispositionGuard(seed.name, undefined, false, NO_ARCHIVE)
      if (DISPOSITION_ALLOWLIST.has(seed.name)) {
        expect(halt, seed.name).toBeDefined()
        expect(halt, seed.name).toMatch(/HALTED/)
        expect(halt, seed.name).toContain(seed.name)
      } else {
        expect(halt, seed.name).toBeUndefined()
      }
    }
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
    const both = new Map([['planted-refused-seed', archivedVerdict({ qualityScore: 3 })]])
    const halt = dispositionGuard('planted-refused-seed', undefined, false, both, PLANTED_ALLOWLIST)
    expect(halt).toMatch(/ARCHIVED/)
    expect(halt).toContain('qualityScore 3')
    expect(halt, 'the allowlist prose must not be what an operator sees when a real verdict exists').not.toContain('curated planted prose')
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
// real fs) against the REAL committed tree and proves the wiring itself, not just the helpers.
//
// SCOPE NARROWED 2026-08-18: this block now carries only the ARG-PARSING legs (--bogus-flag / --help),
// which exit before any fs work. The unjudged-HALT wiring leg lived here while the committed shelf held
// a never-admitted disposition-recorded seed to trip on (`stats-grid-dashboard` originally, per GH
// #335's live repro). Since the 2026-08-18 judged waves + Kim's drop ruling, the shelf and the store
// are in exact 1:1 correspondence — NO real un-admitted name remains, so a real-tree unjudged run no
// longer halts on a disposition. (It USED to then tier-1-admit any source-drifted seed and WRITE the
// real corpus — the very hole GH #1346's fail-closed judge-tier guard closed: a bare run now halts the
// moment any candidate clears dedup. The live corpus is still not a fixture, so that guard's legs run
// in the sandbox block below too.) The disposition-halt proof moved to the sandbox block's ADR-0165
// clause-4 unjudged-halt case (the REAL script, a PLANTED archive refusal, a throwaway repo root) —
// same subprocess tier, same deleted-call-site sensitivity, no real-corpus exposure. ──
describe('import-seeds main() wiring — a real subprocess run proves arg-parsing runs before any fs work', () => {
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

  // GH #341's remaining half. The issue's repro ("delete the dispositionGuard call site and all tests
  // still pass") is covered by the sandbox block's clause-4 unjudged-halt leg (see the scope note
  // above). What the issue is right about applies to the OTHER defect: `parseArgs` was
  // only ever unit-tested, so nothing proved `main()` consults it BEFORE touching the fs. The two legs
  // below close that — the exact `--bogus-flag` / `--help` probes #341 records as run by hand.
  //
  // Note on why exit code alone is NOT enough here: with the arg-error branch deleted, a `--bogus-flag`
  // run falls through into the real UNJUDGED pipeline. Pre-GH #1346 that run would tier-1-admit any
  // source-drifted seed and WRITE the real corpus (exit 0, corpus mutated); since the fail-closed
  // judge-tier guard it instead halts on drift (exit 1, nothing written) or runs the all-E_DUP no-op
  // (exit 0, summary printed) — either way indistinguishable by exit code + corpus bytes alone from
  // "stopped at arg-parsing". So the discriminating assertions are that the run stopped AT arg-parsing
  // — the bad flag is named, help is printed, no HALT line appears, no admission report prints — with
  // the corpus byte-identity check kept as defense-in-depth.
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
describe('import-seeds main() — the verdict archive (ADR-0165) + the GH #1346 fail-closed guard, real subprocess runs against a sandbox repo root', () => {
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
      `${JSON.stringify({ rubric: 'a2ui-corpus', rubricVersion: LIVE_RUBRIC_VERSION, judgedBy: 'a2ui-reviewer', ...body }, null, 2)}\n`,
    )
    return path
  }

  const plantArchive = (fileName: string, text: string): string => {
    mkdirSync(join(sandbox, ARCHIVE_DIR), { recursive: true })
    const path = join(sandbox, ARCHIVE_DIR, fileName)
    writeFileSync(path, text)
    return path
  }

  /** Every shelf name the REAL `DISPOSITION_ALLOWLIST` currently disposition — derived, never hardcoded,
   *  so this fixture stays correct as the map's live content churns (the dispositionGuard doc comment's
   *  own warning: "the real map legitimately drained to EMPTY … leaving no real name to test with").
   *  The GH #1346 judge-tier guard tests below want a baseline where dispositionGuard's OWN halt (which
   *  takes priority over the judge-tier accumulation, `main()`'s per-seed loop) never fires on an
   *  UNRELATED, deliberately-planted candidate — so any live disposition-allowlist name is pre-admitted
   *  into the sandbox first (below), the same way the REAL corpus will hold it once wave 3's judged
   *  pipeline runs. */
  const LIVE_DISPOSITIONED_NAMES = allSeeds.map((s) => s.name).filter((n) => DISPOSITION_ALLOWLIST.has(n))

  /** Pre-admit every currently-live disposition-allowlisted seed into the sandbox's shard via a REAL
   *  `--verdicts` run (never a hand-rolled JSONL row — the tool's own writer is the only source of a
   *  correctly-shaped record). A no-op when the map is empty (the steady state most of this suite's
   *  history has held). Must run BEFORE any drift-planting so a genuinely-unrelated candidate (e.g.
   *  `empty-error-retry-card`) is the ONLY one left for the guard under test to see. */
  const admitLiveDispositionedSeeds = (): void => {
    if (LIVE_DISPOSITIONED_NAMES.length === 0) return
    const verdicts: Record<string, unknown> = {}
    for (const name of LIVE_DISPOSITIONED_NAMES) verdicts[name] = { passed: true, qualityScore: 5 }
    const verdictsPath = writeVerdicts('pre-admit-dispositioned.json', { date: '2026-08-19', verdicts })
    const result = run(['--verdicts', verdictsPath])
    if (result.status !== 0) {
      throw new Error(`admitLiveDispositionedSeeds setup failed: ${result.stderr}`)
    }
  }

  /** The `withShard:false` sibling of `admitLiveDispositionedSeeds` above: a TRULY empty sandbox has
   *  every seed (not just the dispositioned ones) reach the judge tier, so a `--verdicts` run needs a
   *  verdict for every name (`createVerdictJudge`'s own fail-closed law) — admitting the dispositioned
   *  names ALONE isn't reachable directly. Admits the WHOLE shelf instead (the "sandbox itself is
   *  honest" test's own precedent, above) then PRUNES the resulting shard back down to just the
   *  currently-live disposition-allowlisted rows (the `plantDrift` doctoring technique, applied in
   *  reverse) — restoring the "everything else still needs judging" premise this test's guard targets. */
  const admitOnlyLiveDispositionedFromEmpty = (): void => {
    if (LIVE_DISPOSITIONED_NAMES.length === 0) return
    const verdicts: Record<string, unknown> = {}
    for (const seed of allSeeds) verdicts[seed.name] = { passed: true, qualityScore: 5 }
    const verdictsPath = writeVerdicts('pre-admit-whole-shelf.json', { date: '2026-08-19', verdicts })
    const result = run(['--verdicts', verdictsPath])
    if (result.status !== 0) {
      throw new Error(`admitOnlyLiveDispositionedFromEmpty setup failed: ${result.stderr}`)
    }
    const shardPath = join(sandbox, SHARD)
    const keptRows = readFileSync(shardPath, 'utf8')
      .split('\n')
      .filter((line) => line !== '' && LIVE_DISPOSITIONED_NAMES.some((name) => line.includes(`"name":"${name}"`)))
    writeFileSync(shardPath, keptRows.length > 0 ? `${keptRows.join('\n')}\n` : '')
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

  /** With the committed shard loaded, seeds whose SOURCE still matches their shard row short-circuit at
   *  dedup (`E_DUP`) and never reach the judge. Since the 2026-08-18 judged waves (backable-wizard
   *  admitted post-repair, PR #1338) + the drop of the two standing refusals (`stats-grid-dashboard` ·
   *  `wizard-step-progress` — the ADR-0165 drop path; a dropped seed is no longer a candidate, so it
   *  holds NO row here), the shelf and the shard are in exact 1:1 NAME correspondence — and since the
   *  GH #1346 judged `--replace` leg re-aligned the 8 GH #1342 card-anatomy rows, in exact CONTENT
   *  correspondence too, so a run against the untouched shard reaches the judge for NO seed at all.
   *  The rows below stay anyway: dedup is CONTENT-based, so any FUTURE source↔shard drift makes that
   *  seed reach a wired judge again, which fails closed unless the file rules on it (ADR-0068
   *  clause 2) — these rows keep the archive tests robust to that drift instead of red on it. A test
   *  that NEEDS a candidate to actually reach the judge must plant its own drift (see the dry-run
   *  collision test below) rather than lean on incidental drift. Refusing all keeps any such run at
   *  zero admissions while still reaching `saveStore` — the archive's actual trigger. */
  const SHARD_LOADED_VERDICTS = {
    'frontier-trip-card': { passed: false, qualityScore: 2 },
    'frontier-invite-modal': { passed: false, qualityScore: 2 },
    'frontier-review-split': { passed: false, qualityScore: 2 },
    'frontier-onboarding-tour': { passed: false, qualityScore: 2 },
    'frontier-round-outcome': { passed: false, qualityScore: 2 },
    'frontier-booking-receipt': { passed: false, qualityScore: 2 },
    'frontier-image-hero-card': { passed: false, qualityScore: 2 },
    'frontier-card-anatomy-ask': { passed: false, qualityScore: 2 },
    'backable-wizard': { passed: false, qualityScore: 2 },
    'frontier-greet-card': { passed: false, qualityScore: 2 },
    'agent-roster-drawer': { passed: false, qualityScore: 2 },
    'slideshow-gallery': { passed: false, qualityScore: 2 },
    'confirmation-view': { passed: false, qualityScore: 2 },
    'trend-list': { passed: false, qualityScore: 2 },
    'card-layouts': { passed: false, qualityScore: 2 },
    'five-day-weather': { passed: false, qualityScore: 2 },
    'restaurant-menu': { passed: false, qualityScore: 2 },
    'travel-itinerary': { passed: false, qualityScore: 2 },
    'frontier-latency-line-chart': { passed: false, qualityScore: 2 },
    'frontier-media-tour': { passed: false, qualityScore: 2 },
    'frontier-drill-settings': { passed: false, qualityScore: 2 },
    'frontier-pane-switcher': { passed: false, qualityScore: 2 },
    'pattern-confirmation-card': { passed: false, qualityScore: 2 },
    'pattern-settings-form': { passed: false, qualityScore: 2 },
    'pattern-schedule-picker': { passed: false, qualityScore: 2 },
    'pattern-wizard': { passed: false, qualityScore: 2 },
    'generative-form': { passed: false, qualityScore: 2 },
    'booking-reservation': { passed: false, qualityScore: 2 },
    'feedback-form': { passed: false, qualityScore: 2 },
    'trivia-round-resume': { passed: false, qualityScore: 2 },
    'empty-error-retry-card': { passed: false, qualityScore: 2 },
    // GH #1355 — a genuinely NEW seed (not yet in the committed shard, so dedup doesn't reject it
    // before the judge is reached): rejected here too, keeping these archive-mechanics tests at zero
    // admissions rather than needing a real quality judgment.
    'crud-entry-list-drawer': { passed: false, qualityScore: 2 },
    // GH #1377 — the commerce+hospitality genui-pack's three new seeds; refused here for the same
    // "keeps any such run at zero admissions while still reaching saveStore" reason as every row above
    // (the flagship `commerce-product-card` is judged+admitted separately, via a real passing verdict —
    // this fixture only needs it refused so this describe's zero-admission runs stay zero).
    'commerce-product-card': { passed: false, qualityScore: 2 },
    'product-options-quantity': { passed: false, qualityScore: 2 },
    'listing-photo-grid': { passed: false, qualityScore: 2 },
    // GH #1479 — the Amenities-style feature-list seed; refused here for the same zero-admission
    // reason as the three GH #1377 rows above (its real disposition is DISPOSITION_ALLOWLIST's pending
    // "NO VERDICT SOUGHT YET" entry).
    'features-list-card': { passed: false, qualityScore: 2 },
    // The 2026-08-19 nine-ADR campaign's six coverage-gap seeds (catalog-frontier.ts) — refused here for
    // the same zero-admission reason as every row above; their real disposition is DISPOSITION_ALLOWLIST's
    // pending "NO VERDICT SOUGHT YET" entries (wave 3 runs the real judged pipeline).
    'frontier-file-drop-attach': { passed: false, qualityScore: 2 },
    'frontier-suggestions-chips': { passed: false, qualityScore: 2 },
    'frontier-source-list-citations': { passed: false, qualityScore: 2 },
    'frontier-rating-review': { passed: false, qualityScore: 2 },
    'frontier-pie-chart-budget': { passed: false, qualityScore: 2 },
    'frontier-choice-group-rooms': { passed: false, qualityScore: 2 },
    // ADR-0209/GH #1389 — the Disclosure summary-row Switch coverage-gap seed; refused here for the
    // same zero-admission reason as every row above; its real disposition is DISPOSITION_ALLOWLIST's
    // pending "NO VERDICT SOUGHT YET" entry (wave 3 runs the real judged pipeline).
    'frontier-disclosure-summary-switch': { passed: false, qualityScore: 2 },
    // ADR-0224/GH #1429 — the ServiceCard coverage-gap seed; judged+admitted for real 2026-08-19
    // (PASS, qualityScore 4, verdicts archived 2026-08-19t23-40-00z, allowlist entry drained); refused
    // here only so this describe's zero-admission runs stay zero (the commerce-product-card
    // convention above).
    'frontier-service-gateway': { passed: false, qualityScore: 2 },
  }

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
    // Since the GH #1346 judged --replace leg the committed shard matches every seed's source, so no
    // candidate reaches the judge on its own — plant the drift deterministically: drop ONE row from
    // the sandbox's shard copy, making that seed a fresh candidate its `passed:false` row refuses.
    makeSandbox({ withShard: true })
    const shardPath = join(sandbox, SHARD)
    const keptRows = readFileSync(shardPath, 'utf8')
      .split('\n')
      .filter((line) => line !== '' && !line.includes('"name":"empty-error-retry-card"'))
    writeFileSync(shardPath, `${keptRows.join('\n')}\n`)
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

  it('clause 4 — a plain UNJUDGED run HALTS on a name carrying an archived passed:false verdict, quoting the verdict, with nothing written (ALSO the dispositionGuard wiring proof — real script, real subprocess)', () => {
    // Since 2026-08-18 the committed shelf holds NO never-admitted disposition-recorded name (the
    // standing refusals were dropped; backable-wizard was admitted), so this candidate is PLANTED: an
    // EMPTY sandbox corpus makes `canvas-button` — the first seed in SEEDS_BY_MODULE order, so the halt
    // is deterministic — a never-admitted candidate, and the planted archive gives it the refusal.
    // This leg doubles as the GH #341 deleted-call-site tripwire the real-tree block used to carry:
    // with the `dispositionGuard` call gone, this run would tier-1-admit the whole shelf and exit 0.
    makeSandbox({ withShard: false })
    plantArchive(
      '2026-07-11--m-b-wave.json',
      `${JSON.stringify({
        rubric: 'a2ui-corpus',
        rubricVersion: '1.0',
        judgedBy: 'a2ui-reviewer',
        date: '2026-07-11',
        verdicts: { 'canvas-button': { passed: false, qualityScore: 3, failingDimensions: ['D1'] } },
      })}\n`,
    )

    const result = run([])

    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/HALTED/)
    expect(result.stderr).toMatch(/ARCHIVED quality rejection/)
    expect(result.stderr).toContain('canvas-button')
    expect(result.stderr).toContain('qualityScore 3')
    expect(result.stderr).toContain('D1')
    expect(result.stderr).toContain('2026-07-11--m-b-wave.json')
    expect(archivedFiles(), 'the halted run touched nothing').toEqual(['2026-07-11--m-b-wave.json'])
    expect(existsSync(join(sandbox, SHARD)), 'the halt precedes saveStore — no shard was minted').toBe(false)
  })

  it('clause 4 — the same run WITH --verdicts supplying a fresh PASSING verdict admits the name and archives the newer file', () => {
    // The same PLANTED shape as the halt case above (empty corpus, archived refusal for canvas-button),
    // now superseded by a fresh judgment: every other shelf seed is refused (derived from `allSeeds`,
    // never a hand-counted map) so this test's claim stays exactly "the re-judged name admits", nothing
    // else moves.
    makeSandbox({ withShard: false })
    plantArchive(
      '2026-07-11--m-b-wave.json',
      `${JSON.stringify({
        rubric: 'a2ui-corpus',
        rubricVersion: '1.0',
        judgedBy: 'a2ui-reviewer',
        date: '2026-07-11',
        verdicts: { 'canvas-button': { passed: false, qualityScore: 3, failingDimensions: ['D1'] } },
      })}\n`,
    )
    const verdicts: Record<string, unknown> = {}
    for (const seed of allSeeds) {
      verdicts[seed.name] =
        seed.name === 'canvas-button' ? { passed: true, qualityScore: 5 } : { passed: false, qualityScore: 2 }
    }
    const verdictsPath = writeVerdicts('re-judged.json', { date: '2026-07-29', verdicts })

    const result = run(['--verdicts', verdictsPath])

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toMatch(/1 admitted/)
    expect(result.stdout).toContain('canvas-button')
    expect(archivedFiles()).toEqual(['2026-07-11--m-b-wave.json', '2026-07-29--re-judged.json'])
    expect(readFileSync(join(sandbox, SHARD), 'utf8'), 'the re-admitted record landed in the shard').toContain('canvas-button')
  })

  it('clause 3 — a SELF-CONFLICTING archive (two same-date files disagreeing) halts every run before any work', () => {
    makeSandbox({ withShard: true })
    const body = (passed: boolean): string =>
      `${JSON.stringify({
        rubric: 'a2ui-corpus',
        rubricVersion: '1.0',
        judgedBy: 'a2ui-reviewer',
        date: '2026-07-28',
        verdicts: { 'planted-conflict-seed': { passed, qualityScore: passed ? 5 : 2 } },
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

  it('the sandbox itself is honest — a JUDGED all-passing run over an EMPTY sandbox corpus admits the whole shelf and writes the shard', () => {
    // The negative control for every case above: if the sandbox were subtly wrong (a missing rubric, a
    // catalog that would not load), these runs would fail for a reason unrelated to the clause under
    // test. This control was the bare-run whole-shelf admit while a bare run could still admit at all;
    // GH #1346 closed that path (a bare run fails closed the moment any candidate reaches the judge
    // tier — the block below), so the honest end-to-end baseline is now the JUDGED all-passing wave:
    // rubric, catalog, seed shelf, judge and store wiring all load, every seed admits, the shard is
    // minted. (The halting cases above are therefore attributable to exactly the condition each one
    // plants.)
    makeSandbox({ withShard: false })
    const verdicts: Record<string, unknown> = {}
    for (const seed of allSeeds) verdicts[seed.name] = { passed: true, qualityScore: 5 }
    const verdictsPath = writeVerdicts('all-passing.json', { date: '2026-07-30', verdicts })
    const result = run(['--verdicts', verdictsPath])
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toMatch(new RegExp(`${allSeeds.length} admitted`))
    expect(existsSync(join(sandbox, SHARD)), 'the run reached saveStore and minted the shard').toBe(true)
  })


  // ── GH #1346 — the fail-closed judge-tier guard, proven on the same sandbox harness. A bare (no
  // --verdicts) run used to tier-1-admit ANY candidate that cleared dedup and WRITE the corpus —
  // including the source-drifted content of an already-admitted name, which name-based
  // `alreadyAdmitted`, content-based dedup, AND `dispositionGuard` (archived refusals only) all miss.
  // The clause-4 unjudged-halt leg above (PR #1345) is the shape precedent these follow: the REAL
  // script, a PLANTED condition, the halt proven to precede `saveStore`. ──
  describe('GH #1346 — a bare run fails closed the moment any candidate reaches the judge tier', () => {
    /** Plant the drift deterministically (the dry-run collision test's established pattern): drop ONE
     *  row from the sandbox's shard copy. On the next bare run that seed clears dedup and reaches the
     *  judge tier — the same guard-visible state source-drifted content of an admitted name produces
     *  (dedup is content-based, so drifted content misses its own row exactly as a dropped row does).
     *  Returns the doctored shard bytes, the before-image for the halt-before-saveStore assertion. */
    const plantDrift = (): string => {
      const shardPath = join(sandbox, SHARD)
      const keptRows = readFileSync(shardPath, 'utf8')
        .split('\n')
        .filter((line) => line !== '' && !line.includes('"name":"empty-error-retry-card"'))
      writeFileSync(shardPath, `${keptRows.join('\n')}\n`)
      return readFileSync(shardPath, 'utf8')
    }

    it('THE ISSUE REPRO SHAPE — a planted-drift bare run HALTS before saveStore: the named fail-closed report, exit 1, shard byte-unchanged, no archive minted', () => {
      makeSandbox({ withShard: true })
      admitLiveDispositionedSeeds() // any live disposition-allowlist name is a DIFFERENT candidate class than this test's target — pre-admitted so the guard under test sees only the planted drift
      const archiveBaseline = archivedFiles() // the pre-admit step above archives its OWN verdicts file (ADR-0165) when the map is non-empty
      const doctoredShard = plantDrift()

      const result = run([])

      expect(result.status).toBe(1)
      expect(result.stderr).toMatch(/HALTED/)
      expect(result.stderr, 'the named report the issue specifies').toMatch(
        /1 candidate\(s\) reached the judge tier with no judge wired — nothing written/,
      )
      expect(result.stderr).toContain('empty-error-retry-card')
      expect(result.stderr, 'the operator is pointed at the guard exit').toMatch(/--verdicts/)
      expect(result.stdout, 'the run summary never prints — the halt is a halt').not.toMatch(/admitted/)
      // The halt-before-saveStore proof: had the run reached saveStore, the tier-1-admitted candidate
      // would have been written back and the dropped row restored. The doctored shard is byte-identical
      // instead — nothing was written.
      expect(readFileSync(join(sandbox, SHARD), 'utf8'), 'the halt precedes saveStore').toBe(doctoredShard)
      expect(archivedFiles(), 'no NEW archive from the bare run under test — a bare run carries no verdicts file to archive').toEqual(archiveBaseline)
    })

    it('the same planted drift under --dry-run reports the would-HALT truth and still finishes its summary — exit 0, nothing written', () => {
      makeSandbox({ withShard: true })
      admitLiveDispositionedSeeds() // see THE ISSUE REPRO SHAPE's own note, above
      const doctoredShard = plantDrift()

      const result = run(['--dry-run'])

      expect(result.status, result.stderr).toBe(0)
      expect(result.stdout).toMatch(/a real run would HALT here/)
      expect(result.stdout).toMatch(/1 candidate\(s\) reached the judge tier with no judge wired/)
      // The headline stays honest: a real run admits NONE of these, so neither does the dry-run count.
      expect(result.stdout).toMatch(/0 admitted/)
      expect(result.stdout).toMatch(
        /would HALT on a real run \(--dry-run only, 1 candidate\(s\) at the judge tier with no judge wired\): empty-error-retry-card/,
      )
      expect(readFileSync(join(sandbox, SHARD), 'utf8'), 'a dry run writes nothing, warning or not').toBe(doctoredShard)
    })

    it('the all-E_DUP bare run STAYS LEGAL — every seed an idempotent re-run of its own admitted record, exit 0 (the one verdict-less case the guard leaves open)', () => {
      makeSandbox({ withShard: true })
      admitLiveDispositionedSeeds() // every shelf name now genuinely admitted — the all-E_DUP premise this test needs

      const result = run([])

      expect(result.status, result.stderr).toBe(0)
      expect(result.stdout).toMatch(new RegExp(`0 admitted, ${allSeeds.length} already present`))
      expect(result.stderr).not.toMatch(/HALTED/)
    })

    it('an EMPTY corpus makes every shelf seed an unjudged candidate — the guard counts all N and writes nothing (the full-scale N)', () => {
      makeSandbox({ withShard: false })
      // Any LIVE disposition-allowlist name is a DIFFERENT, dispositionGuard-owned candidate class (it
      // halts BEFORE the judge-tier count ever accumulates, main()'s per-seed loop) — pre-admit them so
      // "every shelf seed" here means every NON-dispositioned one, the guard this test actually targets.
      admitOnlyLiveDispositionedFromEmpty()
      const preAdmittedShard = existsSync(join(sandbox, SHARD)) ? readFileSync(join(sandbox, SHARD), 'utf8') : ''
      const expectedCandidateCount = allSeeds.length - LIVE_DISPOSITIONED_NAMES.length

      const result = run([])

      expect(result.status).toBe(1)
      expect(result.stderr).toMatch(
        new RegExp(`${expectedCandidateCount} candidate\\(s\\) reached the judge tier with no judge wired`),
      )
      // Mirror the pre-read's existsSync guard: with the REAL allowlist at its EMPTY steady state
      // (post-drain), zero rows pre-admit and the shard legitimately never exists — absent-both-times
      // is the same "no NEW admission" proof (latent hole exposed by the 2026-08-20 wave-3 drain).
      expect(
        existsSync(join(sandbox, SHARD)) ? readFileSync(join(sandbox, SHARD), 'utf8') : '',
        'no NEW admission — the halt precedes saveStore; only the pre-admitted rows (if any) are present',
      ).toBe(preAdmittedShard)
    })
  })
})
