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
// The last block spawns the REAL script in a REAL subprocess against the REAL committed corpus, which
// is the only tier that can catch a deleted call site. Both defects GH #335 fixed now have a
// subprocess leg: the disposition guard (an unjudged run) and `parseArgs` (`--bogus-flag` / `--help`).
// A new pure helper here needs its own subprocess leg too, or it is only half-covered.

import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { parseArgs, dispositionGuard, dispositionAllowlistSnippet } from './import-seeds.ts'
import type { SeedRejection } from '../../src/corpus/import-report.ts'

declare const process: { cwd(): string }

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
    const halt = dispositionGuard('stats-grid-dashboard', undefined, false)
    expect(halt).toBeDefined()
    expect(halt).toMatch(/HALTED/)
    expect(halt).toMatch(/stats-grid-dashboard/)
  })

  it('a --verdicts run (judge wired) is NEVER halted by this guard — createVerdictJudge already fails closed on its own (ADR-0068 clause 2)', () => {
    expect(dispositionGuard('stats-grid-dashboard', 'some-verdicts-path.json', false)).toBeUndefined()
  })

  it('a name with no recorded disposition is never halted', () => {
    expect(dispositionGuard('some-ordinary-seed-name', undefined, false)).toBeUndefined()
  })

  it('a disposition-allowlisted name that IS already admitted (alreadyAdmitted:true) is untouched — the ordinary E_DUP idempotent-rerun path, not this guard', () => {
    expect(dispositionGuard('stats-grid-dashboard', undefined, true)).toBeUndefined()
  })

  it('the halt message names the guard-exit path (--verdicts) so an operator knows how to proceed', () => {
    const halt = dispositionGuard('stats-grid-dashboard', undefined, false)
    expect(halt).toMatch(/--verdicts/)
    expect(halt).toMatch(/Nothing was written/)
  })
})

describe('dispositionAllowlistSnippet — GH #335 review item 2 (a paste-ready DISPOSITION_ALLOWLIST entry, not a closed class)', () => {
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

  it('names the "record this before the next unjudged run" reminder — the transcription step it removes, not the class it does not close', () => {
    expect(dispositionAllowlistSnippet(rejection, meta)).toMatch(/before the next unjudged run/)
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
