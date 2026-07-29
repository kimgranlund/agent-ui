// fs-store.test.ts — ADR-0165's fs discipline for the verdict archive: `archiveVerdicts()` (clause 1's
// verbatim copy + clause 2's never-overwrite write-time rule) and `loadVerdictArchive()` (clause 3's
// Node-shell reader over the shared pure merge).
//
// Every case runs against a THROWAWAY temp dir — this file never touches the committed corpus. The
// end-to-end proof that `import-seeds.ts`'s `main()` actually calls these (GH #341: a helper test passes
// over broken wiring) lives in `import-seeds.test.ts`'s subprocess block, not here.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { archiveVerdicts, loadVerdictArchive } from './fs-store.ts'

const ARCHIVE_DIR = 'packages/agent-ui/a2ui/corpus/verdicts'

const verdictsJson = (over: { date?: string; verdicts?: Record<string, unknown> } = {}): string =>
  `${JSON.stringify(
    {
      rubric: 'a2ui-corpus',
      rubricVersion: '1.0',
      judgedBy: 'a2ui-reviewer',
      date: over.date ?? '2026-07-28',
      verdicts: over.verdicts ?? { x: { passed: false, qualityScore: 2, failingDimensions: ['D1'] } },
    },
    null,
    2,
  )}\n`

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'a2ui-verdict-archive-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

const plant = (fileName: string, text: string): string => {
  const dir = join(root, ARCHIVE_DIR)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, fileName), text)
  return join(dir, fileName)
}

describe('archiveVerdicts — clause 1: the run archives its own verdicts file VERBATIM', () => {
  it('writes corpus/verdicts/<date>--<slug>.json byte-identical to the input, with <date> from the FILE and <slug> from the --verdicts basename', () => {
    const text = verdictsJson({ date: '2026-07-28' })
    const outcome = archiveVerdicts(root, '/some/where/wave-b.json', text, '2026-07-28')

    expect(outcome).toEqual({ kind: 'archived', path: `${ARCHIVE_DIR}/2026-07-28--wave-b.json` })
    expect(readFileSync(join(root, outcome.path), 'utf8')).toBe(text)
  })

  it('the date comes from the VerdictsFile, never the wall clock — an old file re-archived lands on its own old date', () => {
    const outcome = archiveVerdicts(root, 'wave-a.json', verdictsJson({ date: '2026-01-02' }), '2026-01-02')
    expect(outcome.path).toBe(`${ARCHIVE_DIR}/2026-01-02--wave-a.json`)
  })

  it('creates the archive directory when it does not exist yet (the very first judged wave)', () => {
    expect(existsSync(join(root, ARCHIVE_DIR))).toBe(false)
    archiveVerdicts(root, 'wave-b.json', verdictsJson(), '2026-07-28')
    expect(existsSync(join(root, ARCHIVE_DIR))).toBe(true)
  })

  it('--dry-run writes NOTHING while still reporting the path a real run would use', () => {
    const outcome = archiveVerdicts(root, 'wave-b.json', verdictsJson(), '2026-07-28', { dryRun: true })
    expect(outcome.kind).toBe('archived')
    expect(existsSync(join(root, outcome.path)), 'a dry run must leave the archive directory untouched').toBe(false)
  })
})

describe('archiveVerdicts — clause 2: a write NEVER overwrites', () => {
  it('an identical existing file is a byte-level no-op (idempotence, ADR-0068 clause 4\'s standard)', () => {
    const text = verdictsJson()
    const planted = plant('2026-07-28--wave-b.json', text)

    const outcome = archiveVerdicts(root, 'wave-b.json', text, '2026-07-28')

    expect(outcome).toEqual({ kind: 'unchanged', path: `${ARCHIVE_DIR}/2026-07-28--wave-b.json` })
    expect(readFileSync(planted, 'utf8')).toBe(text)
    expect(readdirSync(join(root, ARCHIVE_DIR)), 'no second file appears').toEqual(['2026-07-28--wave-b.json'])
  })

  it('a DIFFERING existing file is a conflict naming both hashes, and the existing file is left byte-unchanged', () => {
    const existing = verdictsJson({ verdicts: { x: { passed: false, qualityScore: 2 } } })
    const incoming = verdictsJson({ verdicts: { x: { passed: true, qualityScore: 5 } } })
    const planted = plant('2026-07-28--wave-b.json', existing)

    const outcome = archiveVerdicts(root, 'wave-b.json', incoming, '2026-07-28')

    expect(outcome.kind).toBe('conflict')
    if (outcome.kind !== 'conflict') return
    expect(outcome.path).toBe(`${ARCHIVE_DIR}/2026-07-28--wave-b.json`)
    expect(outcome.existingHash).not.toBe(outcome.incomingHash)
    expect(outcome.existingHash).toMatch(/^[0-9a-f]{64}$/)
    expect(outcome.incomingHash).toMatch(/^[0-9a-f]{64}$/)
    expect(
      readFileSync(planted, 'utf8'),
      'the whole point: an overwrite would destroy one of the two records this ADR exists to preserve',
    ).toBe(existing)
  })

  it('a one-byte difference is still a conflict — the comparison is bytes, not "looks like the same wave"', () => {
    plant('2026-07-28--wave-b.json', verdictsJson())
    const outcome = archiveVerdicts(root, 'wave-b.json', `${verdictsJson()} `, '2026-07-28')
    expect(outcome.kind).toBe('conflict')
  })

  it('two DIFFERENTLY-NAMED waves on one date coexist — the collision only fires when the operator reuses a name', () => {
    archiveVerdicts(root, 'wave-a.json', verdictsJson({ verdicts: { a: { passed: false, qualityScore: 2 } } }), '2026-07-28')
    const second = archiveVerdicts(root, 'wave-b.json', verdictsJson({ verdicts: { b: { passed: false, qualityScore: 2 } } }), '2026-07-28')

    expect(second.kind).toBe('archived')
    expect(readdirSync(join(root, ARCHIVE_DIR)).sort()).toEqual(['2026-07-28--wave-a.json', '2026-07-28--wave-b.json'])
  })
})

describe('loadVerdictArchive — clause 3: the Node-shell reader over the shared pure merge', () => {
  it('an absent archive directory is an EMPTY archive, not a failure (the state the tree ships in)', () => {
    const loaded = loadVerdictArchive(root)
    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(loaded.archive.size).toBe(0)
      expect(loaded.files).toEqual([])
    }
  })

  it('reads a planted archive and exposes the failing verdict with its repo-relative sourceFile', () => {
    plant('2026-07-28--wave-b.json', verdictsJson())
    const loaded = loadVerdictArchive(root)

    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.files).toEqual([`${ARCHIVE_DIR}/2026-07-28--wave-b.json`])
    expect(loaded.archive.get('x')).toEqual({
      passed: false,
      qualityScore: 2,
      failingDimensions: ['D1'],
      rubricVersion: '1.0',
      judgedBy: 'a2ui-reviewer',
      date: '2026-07-28',
      sourceFile: `${ARCHIVE_DIR}/2026-07-28--wave-b.json`,
    })
  })

  it('non-.json files in the directory are ignored — the shipped README.md never enters the archive', () => {
    plant('README.md', '# not a verdicts file\n')
    plant('2026-07-28--wave-b.json', verdictsJson())
    const loaded = loadVerdictArchive(root)
    expect(loaded.ok).toBe(true)
    if (loaded.ok) expect(loaded.files).toEqual([`${ARCHIVE_DIR}/2026-07-28--wave-b.json`])
  })

  it('a malformed archived file is a structured failure, never a silently empty archive', () => {
    plant('2026-07-28--broken.json', '{ not json')
    const loaded = loadVerdictArchive(root)
    expect(loaded.ok).toBe(false)
    if (!loaded.ok) expect(loaded.issues.join(' ')).toContain('2026-07-28--broken.json')
  })

  it('clause 7 — an archive whose rubricVersion is OLDER than the current rubric still loads: a recorded refusal is not invalidated by the rubric moving', () => {
    plant('2026-01-02--old.json', verdictsJson({ date: '2026-01-02' }).replace('"1.0"', '"0.9"'))
    const loaded = loadVerdictArchive(root)
    expect(loaded.ok).toBe(true)
    if (loaded.ok) expect(loaded.archive.get('x')?.passed).toBe(false)
  })

  it('two SAME-date files disagreeing halt the read with a conflict naming both — the merge\'s rule, reached through the shell', () => {
    plant('2026-07-28--a.json', verdictsJson({ verdicts: { x: { passed: false, qualityScore: 2 } } }))
    plant('2026-07-28--b.json', verdictsJson({ verdicts: { x: { passed: true, qualityScore: 5 } } }))

    const loaded = loadVerdictArchive(root)
    expect(loaded.ok).toBe(false)
    if (!loaded.ok) {
      expect(loaded.issues).toHaveLength(1)
      expect(loaded.issues[0]).toContain('2026-07-28--a.json')
      expect(loaded.issues[0]).toContain('2026-07-28--b.json')
    }
  })

  it('the later-dated file wins across two real files on disk', () => {
    plant('2026-07-01--a.json', verdictsJson({ date: '2026-07-01', verdicts: { x: { passed: false, qualityScore: 2 } } }))
    plant('2026-07-28--b.json', verdictsJson({ date: '2026-07-28', verdicts: { x: { passed: true, qualityScore: 5 } } }))

    const loaded = loadVerdictArchive(root)
    expect(loaded.ok).toBe(true)
    if (loaded.ok) expect(loaded.archive.get('x')?.passed).toBe(true)
  })
})
