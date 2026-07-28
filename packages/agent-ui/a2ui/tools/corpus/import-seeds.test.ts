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
import { parseArgs, dispositionGuard } from './import-seeds.ts'

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
