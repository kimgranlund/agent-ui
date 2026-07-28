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
  it('a real unjudged run against the committed shelf HALTS on stats-grid-dashboard, exits non-zero, and leaves the corpus byte-identical', () => {
    const repoRoot = process.cwd()
    const shardPath = `${repoRoot}/packages/agent-ui/a2ui/corpus/exemplar/v1_0/agent-ui.jsonl`
    const indexPath = `${repoRoot}/packages/agent-ui/a2ui/corpus/index.json`
    const beforeShard = readFileSync(shardPath, 'utf8')
    const beforeIndex = readFileSync(indexPath, 'utf8')

    const result = spawnSync(
      'node',
      ['--experimental-strip-types', 'packages/agent-ui/a2ui/tools/corpus/import-seeds.ts'],
      { cwd: repoRoot, encoding: 'utf8' },
    )

    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/HALTED/)
    expect(result.stderr).toMatch(/stats-grid-dashboard/)
    expect(readFileSync(shardPath, 'utf8')).toBe(beforeShard)
    expect(readFileSync(indexPath, 'utf8')).toBe(beforeIndex)
  })
})
