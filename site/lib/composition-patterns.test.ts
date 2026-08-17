import { describe, it, expect } from 'vitest'
// composition-patterns.test.ts — the co-located unit test for site/lib/composition-patterns.ts (the pure
// parser), run under the `site` vitest project (jsdom; vitest.config.ts's `test.projects`). One parser, two
// consumers (this test + pages/composition.ts), so the reference-table grammar cannot drift between them —
// the site/lib/adr.test.ts precedent.
import { parsePatternFile, parsePatternFiles } from './composition-patterns.ts'
// Raw-text fs read — the same reverse-coupling fs-read pattern as descriptor/site-canon.test.ts /
// site/lib/adr.test.ts, reading the REAL skill reference files this hub page derives from.
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime
import { readFileSync, readdirSync } from 'node:fs'
declare const process: { cwd(): string }

const ROOT = process.cwd()
const REFS_DIR = `${ROOT}/.claude/skills/composition-patterns/references`

// A representative synthetic reference file — the exact shape every real file carries: an H1, an intro
// paragraph, then a 3-column table with a separator row. Exercises the parser without depending on any real
// file's exact wording (the adr.test.ts SAMPLE precedent).
const SAMPLE = `# Sample assembly problems

Some intro prose that is not a table row.

| Assembly problem | The fleet's answer | Owner · exemplar |
|---|---|---|
| A labelled form | \`ui-form-provider\` + \`ui-field\` | ADR-0050/0051 · \`site/pages/forms.ts\` |
| Opening an overlay | flip the prop | ADR-0101 · \`controls/select/\` |
`

describe('parsePatternFile — the pure parser (synthetic input)', () => {
  it('reads the H1 as the group title', () => {
    expect(parsePatternFile('sample.md', SAMPLE).title).toBe('Sample assembly problems')
  })

  it('extracts column 1 (problem) + column 3 (owner), skipping the header + separator rows', () => {
    const { rows } = parsePatternFile('sample.md', SAMPLE)
    expect(rows).toEqual([
      { problem: 'A labelled form', owner: 'ADR-0050/0051 · `site/pages/forms.ts`' },
      { problem: 'Opening an overlay', owner: 'ADR-0101 · `controls/select/`' },
    ])
  })

  it('NEVER carries column 2 (the fleet\'s answer / mechanism prose) — the never-copy-bodies discipline', () => {
    const { rows } = parsePatternFile('sample.md', SAMPLE)
    for (const row of rows) {
      expect(row).not.toHaveProperty('answer')
      expect(JSON.stringify(row)).not.toContain('ui-form-provider` + `ui-field`')
      expect(JSON.stringify(row)).not.toContain('flip the prop')
    }
  })

  it('a title-less file falls back to its path (anti-crash, not anti-vacuous — real files always carry an H1)', () => {
    expect(parsePatternFile('no-h1.md', '| a | b | c |\n|---|---|---|\n').title).toBe('no-h1.md')
  })
})

describe('parsePatternFiles — the glob-entries → groups mapping', () => {
  it('preserves entry order and each path', () => {
    const groups = parsePatternFiles([
      ['b.md', SAMPLE],
      ['a.md', SAMPLE],
    ])
    expect(groups.map((g) => g.path)).toEqual(['b.md', 'a.md'])
  })
})

describe('parsePatternFile — the gate BITES (a synthetic malformed table)', () => {
  it('a row with fewer than 3 cells is dropped, not crashed on', () => {
    const malformed = '# X\n\n| only two | cells |\n|---|---|\n'
    expect(parsePatternFile('x.md', malformed).rows).toEqual([])
  })

  it('a separator-only table (no data rows) yields zero rows, not the separator as a fake row', () => {
    const headerOnly = '# X\n\n| a | b | c |\n|---|---|---|\n'
    expect(parsePatternFile('x.md', headerOnly).rows).toEqual([])
  })
})

describe('composition-patterns.ts — the four real reference files parse non-vacuously', () => {
  const files = readdirSync(REFS_DIR).filter((f: string) => f.endsWith('.md'))

  it('found all four reference files (anti-vacuous — a renamed/moved skill dir would zero this)', () => {
    expect(files.length).toBe(4)
  })

  it('every real reference file parses at least one pattern row', () => {
    for (const file of files) {
      const source = readFileSync(`${REFS_DIR}/${file}`, 'utf8') as string
      const group = parsePatternFile(file, source)
      expect(group.rows.length, `${file} parsed 0 rows`).toBeGreaterThan(0)
      expect(group.title).not.toBe(file) // every real file carries a real H1, not the path fallback
    }
  })
})
