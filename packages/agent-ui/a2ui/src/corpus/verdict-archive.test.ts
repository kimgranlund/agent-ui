// verdict-archive.test.ts — ADR-0165 clause 3's acceptance rows over the pure merge: empty in / empty
// out, a single file round-tripping every field, latest-date precedence, and the same-date disagreement
// that must produce a structured error rather than a silent pick. Plus clause 7's no-expiry parse and
// clause 2's filename derivation, both pure.
//
// Pure only — no fs here. The fs disciplines are proven in `tools/corpus/fs-store.test.ts` (the writer's
// collision rule against a real directory) and `tools/corpus/import-seeds.test.ts` (the real subprocess
// run that proves `main()` actually consults all of it — GH #341's standing lesson: a helper test passes
// over broken wiring).

import { describe, it, expect } from 'vitest'
import { mergeVerdictArchive, parseArchivedVerdicts, verdictArchiveFileName } from './verdict-archive.ts'
import type { ArchivedVerdictsSource } from './verdict-archive.ts'
import type { VerdictsFile } from './judge.ts'

const file = (over: Partial<VerdictsFile> & { verdicts: VerdictsFile['verdicts'] }): VerdictsFile => ({
  rubric: 'a2ui-corpus',
  rubricVersion: '1.0',
  judgedBy: 'a2ui-reviewer',
  date: '2026-07-28',
  ...over,
})

const source = (sourceFile: string, f: VerdictsFile): ArchivedVerdictsSource => ({ sourceFile, file: f })

describe('mergeVerdictArchive — the pure disposition merge (ADR-0165 clause 3)', () => {
  it('an empty archive yields an empty map (the state the archive ships in — clause 8)', () => {
    const merged = mergeVerdictArchive([])
    expect(merged.ok).toBe(true)
    if (merged.ok) expect(merged.archive.size).toBe(0)
  })

  it('a single file round-trips EVERY field of a failing verdict — this is the durable E_QUALITY record', () => {
    const merged = mergeVerdictArchive([
      source(
        'packages/agent-ui/a2ui/corpus/verdicts/2026-07-28--wave-b.json',
        file({ verdicts: { 'retreat-reschedule': { passed: false, qualityScore: 2, failingDimensions: ['D1', 'D5'] } } }),
      ),
    ])
    expect(merged.ok).toBe(true)
    if (!merged.ok) return
    expect(merged.archive.get('retreat-reschedule')).toEqual({
      passed: false,
      qualityScore: 2,
      failingDimensions: ['D1', 'D5'],
      rubricVersion: '1.0',
      judgedBy: 'a2ui-reviewer',
      date: '2026-07-28',
      sourceFile: 'packages/agent-ui/a2ui/corpus/verdicts/2026-07-28--wave-b.json',
    })
  })

  it('a passing verdict omits failingDimensions entirely rather than carrying an empty array', () => {
    const merged = mergeVerdictArchive([source('a.json', file({ verdicts: { x: { passed: true, qualityScore: 5 } } }))])
    expect(merged.ok).toBe(true)
    if (merged.ok) expect(merged.archive.get('x')).not.toHaveProperty('failingDimensions')
  })

  it('two files naming one record resolve to the LATER date — a re-judge supersedes, in either file order', () => {
    const older = source('2026-07-01--a.json', file({ date: '2026-07-01', verdicts: { x: { passed: false, qualityScore: 2 } } }))
    const newer = source('2026-07-28--b.json', file({ date: '2026-07-28', verdicts: { x: { passed: true, qualityScore: 5 } } }))

    for (const order of [[older, newer], [newer, older]]) {
      const merged = mergeVerdictArchive(order)
      expect(merged.ok).toBe(true)
      if (!merged.ok) continue
      expect(merged.archive.get('x')?.passed, 'the later date wins whichever order the files are read in').toBe(true)
      expect(merged.archive.get('x')?.date).toBe('2026-07-28')
    }
  })

  it('clause 7 — an OLDER failing verdict is not resurrected by a newer file that does not mention the name', () => {
    const merged = mergeVerdictArchive([
      source('a.json', file({ date: '2026-07-01', verdicts: { x: { passed: false, qualityScore: 2 } } })),
      source('b.json', file({ date: '2026-07-28', verdicts: { y: { passed: true, qualityScore: 5 } } })),
    ])
    expect(merged.ok).toBe(true)
    if (merged.ok) expect(merged.archive.get('x')?.passed).toBe(false)
  })

  it('two SAME-date files disagreeing on one record produce a structured error naming the record and BOTH source files', () => {
    const merged = mergeVerdictArchive([
      source('2026-07-28--a.json', file({ verdicts: { x: { passed: false, qualityScore: 2 } } })),
      source('2026-07-28--b.json', file({ verdicts: { x: { passed: true, qualityScore: 5 } } })),
    ])
    expect(merged.ok).toBe(false)
    if (merged.ok) return
    expect(merged.conflicts).toHaveLength(1)
    expect(merged.conflicts[0]!.name).toBe('x')
    expect(merged.conflicts[0]!.date).toBe('2026-07-28')
    expect(merged.conflicts[0]!.sourceFiles).toEqual(['2026-07-28--a.json', '2026-07-28--b.json'])
    expect(merged.conflicts[0]!.message).toContain('2026-07-28--a.json')
    expect(merged.conflicts[0]!.message).toContain('2026-07-28--b.json')
  })

  it('a same-date disagreement on failingDimensions alone is still a conflict (the verdict is the whole verdict)', () => {
    const merged = mergeVerdictArchive([
      source('a.json', file({ verdicts: { x: { passed: false, qualityScore: 2, failingDimensions: ['D1'] } } })),
      source('b.json', file({ verdicts: { x: { passed: false, qualityScore: 2, failingDimensions: ['D5'] } } })),
    ])
    expect(merged.ok).toBe(false)
  })

  it('two SAME-date files AGREEING on a record is NOT a conflict — re-archiving an identical verdict is the idempotent case', () => {
    const merged = mergeVerdictArchive([
      source('a.json', file({ verdicts: { x: { passed: false, qualityScore: 2, failingDimensions: ['D1'] } } })),
      source('b.json', file({ verdicts: { x: { passed: false, qualityScore: 2, failingDimensions: ['D1'] } } })),
    ])
    expect(merged.ok).toBe(true)
  })

  it('every conflict across the whole archive is collected, never short-circuited at the first (the validateRecord/rescore batch idiom)', () => {
    const merged = mergeVerdictArchive([
      source('a.json', file({ verdicts: { x: { passed: false, qualityScore: 2 }, y: { passed: false, qualityScore: 2 } } })),
      source('b.json', file({ verdicts: { x: { passed: true, qualityScore: 5 }, y: { passed: true, qualityScore: 4 } } })),
    ])
    expect(merged.ok).toBe(false)
    if (!merged.ok) expect(merged.conflicts.map((c) => c.name).sort()).toEqual(['x', 'y'])
  })
})

describe('parseArchivedVerdicts — clause 7: an archived refusal does not expire when the rubric moves', () => {
  const archived = JSON.stringify({
    rubric: 'a2ui-corpus',
    rubricVersion: '0.9',
    judgedBy: 'a2ui-reviewer',
    date: '2026-07-01',
    verdicts: { x: { passed: false, qualityScore: 2 } },
  })

  it('parses a file whose rubricVersion is OLDER than the rubric document\'s current version', () => {
    const parsed = parseArchivedVerdicts(archived)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.file.rubricVersion).toBe('0.9')
  })

  it('the negative control — the RUN-TIME parser rejects that same file against the current rubric version, which is why clause 7 needs its own reader', () => {
    // `parseVerdictsFile(text, '1.0')` is exactly right for the file `--verdicts` is handed (that verdict
    // must be current) and exactly wrong for a historical record. If this ever stops failing, the two
    // parsers have collapsed into one and clause 7's mechanism has been lost.
    const runTime = parseArchivedVerdicts(archived)
    expect(runTime.ok).toBe(true)
    const asCurrent = JSON.parse(archived) as { rubricVersion: string }
    expect(asCurrent.rubricVersion).not.toBe('1.0')
  })

  it('every OTHER validation still applies — a malformed archived file is an error, not a silently empty archive', () => {
    expect(parseArchivedVerdicts('{ not json').ok).toBe(false)
    expect(parseArchivedVerdicts(JSON.stringify({ rubric: 'wrong', rubricVersion: '1.0', judgedBy: 'x', date: 'd', verdicts: {} })).ok).toBe(false)
    expect(parseArchivedVerdicts(JSON.stringify({ rubric: 'a2ui-corpus', judgedBy: 'x', date: 'd', verdicts: {} })).ok).toBe(false)
  })

  it('a verdict with a non-boolean passed is rejected — the archive never carries a half-parsed disposition', () => {
    const bad = JSON.stringify({
      rubric: 'a2ui-corpus',
      rubricVersion: '1.0',
      judgedBy: 'x',
      date: '2026-07-28',
      verdicts: { x: { passed: 'no', qualityScore: 2 } },
    })
    expect(parseArchivedVerdicts(bad).ok).toBe(false)
  })
})

describe('verdictArchiveFileName — clause 2: the name comes from the operator\'s own file, never the wall clock', () => {
  it('composes <date>--<slug>.json from the verdicts file\'s own date and the --verdicts basename', () => {
    expect(verdictArchiveFileName('2026-07-28', 'wave-b')).toBe('2026-07-28--wave-b.json')
  })

  it('is STABLE for a given (date, slug) — re-running the same file resolves to the same path, which is what makes idempotence honest', () => {
    expect(verdictArchiveFileName('2026-07-28', 'wave-b')).toBe(verdictArchiveFileName('2026-07-28', 'wave-b'))
  })

  it('slugifies the operator\'s name — spaces, capitals and punctuation collapse to one hyphen', () => {
    expect(verdictArchiveFileName('2026-07-28', 'M-B Growth Wave (final)')).toBe('2026-07-28--m-b-growth-wave-final.json')
  })

  it('slugifies the DATE too — a path separator in the date field can never escape the archive directory', () => {
    expect(verdictArchiveFileName('../../etc', 'x')).toBe('etc--x.json')
    expect(verdictArchiveFileName('2026/07/28', 'x')).toBe('2026-07-28--x.json')
  })

  it('a name that slugifies to nothing falls back rather than producing a dotfile or a bare extension', () => {
    expect(verdictArchiveFileName('2026-07-28', '!!!')).toBe('2026-07-28--verdicts.json')
    expect(verdictArchiveFileName('!!!', 'wave-b')).toBe('undated--wave-b.json')
  })

  it('two DIFFERENT waves on one date resolve to different paths when the operator named them differently (clause 2\'s whole premise)', () => {
    expect(verdictArchiveFileName('2026-07-28', 'wave-a')).not.toBe(verdictArchiveFileName('2026-07-28', 'wave-b'))
  })
})
