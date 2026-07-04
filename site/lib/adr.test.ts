import { describe, it, expect } from 'vitest'
// adr.test.ts — the co-located unit test for site/lib/adr.ts, run under the `site` vitest project (jsdom;
// vitest.config.ts's `test.projects`). One parser, two consumers (this test + pages/adr-index.ts), so the
// frontmatter-table grammar cannot drift between them.
import {
  adrNumber,
  deriveStatusShort,
  extractSummary,
  isDecisionRecord,
  matchesQuery,
  parseAdr,
  sortAdrsDescending,
  STATUS_KEYS,
  stripFrontmatter,
} from './adr.ts'
// node:fs is untyped here (no @types/node devDep) — the same reverse-coupling fs-read pattern as
// descriptor/site-canon.test.ts / descriptor/site-coverage.test.ts.
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync, readdirSync } from 'node:fs'
declare const process: { cwd(): string }

const ROOT = process.cwd()
const ADR_DIR = `${ROOT}/.claude/docs/adr`

// A representative synthetic ADR — the exact shape README.md documents (H1 em-dash separator, a blockquote
// MARKDOWN TABLE frontmatter with a separator row, then prose under ## Context). Exercises the parser without
// depending on any real file's exact wording.
const SAMPLE = `# ADR-0099 — the sample decision title with an \`inline code\` span

> Source: agent-ui ADR log. Log + lifecycle: [\`README.md\`](./README.md). · 2026-07-04
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-04 *(authored)* · 2026-07-05 *(ratified)* |
> | **Proposed by** | someone |
> | **Ratified by** | someone else |
> | **Repairs** | nothing |
> | **Supersedes / Superseded by** | *(none)* |

## Context

This is the first prose paragraph, with a [link](./elsewhere.md) and \`inline code\` and **bold** text that a
teaser should reduce to plain words.
This second line is still part of the same paragraph.

## Decision

A second paragraph that the summary must NOT pick up.
`

describe('lib/adr.ts — adrNumber', () => {
  it('reads the zero-padded number prefix off a real filename', () => {
    expect(adrNumber('0076-renderer-honors-catalog-declared-enums.md')).toBe('0076')
  })

  it('throws on a non-ADR filename (no NNNN- prefix) — the check is not vacuously permissive', () => {
    expect(() => adrNumber('README.md')).toThrow()
  })
})

describe('lib/adr.ts — parseAdr (the frontmatter-table extraction)', () => {
  const record = parseAdr('0099-sample.md', SAMPLE)

  it('extracts the number from the FILENAME, not the H1', () => {
    expect(record.number).toBe('0099')
  })

  it('extracts the title as the H1 text after the em-dash (inline `code` kept raw for appendInline)', () => {
    expect(record.title).toBe('the sample decision title with an `inline code` span')
  })

  it('extracts Status — raw cell + the badge-key short form (identical for a conforming cell)', () => {
    expect(record.status).toBe('accepted')
    expect(record.statusShort).toBe('accepted')
  })

  it('extracts Date — raw cell + the first ISO date for sorting/display', () => {
    expect(record.date).toBe('2026-07-04 *(authored)* · 2026-07-05 *(ratified)*')
    expect(record.dateShort).toBe('2026-07-04')
  })

  it('extracts the summary as the first prose paragraph, inline markdown reduced to plain text', () => {
    expect(record.summary).toBe(
      'This is the first prose paragraph, with a link and inline code and bold text that a teaser should reduce to plain words. This second line is still part of the same paragraph.',
    )
    expect(record.summary).not.toContain('## Decision')
    expect(record.summary).not.toContain('second paragraph')
  })

  it('strips the H1 + the blockquote frontmatter block from body — it starts at the first real heading', () => {
    expect(stripFrontmatter(SAMPLE).startsWith('## Context')).toBe(true)
    expect(record.body).not.toContain('**Status**')
    expect(record.body).not.toContain('# ADR-0099')
  })
})

describe('lib/adr.ts — deriveStatusShort (the badge-key derivation)', () => {
  it('is a literal membership check — an exact one of the 4 keys maps to itself', () => {
    for (const key of STATUS_KEYS) expect(deriveStatusShort(key)).toBe(key)
  })

  it('trims surrounding whitespace before the exact-match check', () => {
    expect(deriveStatusShort('  accepted  ')).toBe('accepted')
  })

  it('falls back to "proposed" (never over-claims "accepted") on ANY trailing prose — the corpus-wide lint gate is what must catch this, not a leading-word guess', () => {
    expect(deriveStatusShort('accepted — ratified on the green gate')).toBe('proposed')
    expect(deriveStatusShort('proposed — SUPERSEDED by ADR-0038 before build')).toBe('proposed')
    expect(deriveStatusShort('')).toBe('proposed')
    expect(deriveStatusShort('*(unparseable cell)*')).toBe('proposed')
  })

  it('always returns a value in STATUS_KEYS — the guarantee the badge CSS relies on', () => {
    for (const s of ['accepted', 'proposed', 'ACCEPTED SUPERSEDED', '', 'garbage', 'deprecated x']) {
      expect(STATUS_KEYS).toContain(deriveStatusShort(s))
    }
  })
})

describe('lib/adr.ts — parseAdr with an embedded literal "|" in a frontmatter cell', () => {
  // Exercised via Status (the only prose-capable field parseAdr surfaces) even though a REAL Status cell is now
  // always a bare keyword (the lint gate below enforces it) — this proves frontmatterField's row regex captures
  // the WHOLE cell on any field, and that a non-canonical cell correctly falls back to 'proposed' rather than
  // matching on its leading word.
  it('captures the WHOLE cell, not truncated at the first embedded pipe', () => {
    const src = `# ADR-0098 — x\n\n> | **Status** | accepted — the \`a|b\` codec ships |\n> | **Date** | 2026-01-01 |\n\n## Context\n\nx\n`
    const record = parseAdr('0098-x.md', src)
    expect(record.status).toBe('accepted — the `a|b` codec ships')
    expect(record.statusShort).toBe('proposed') // not an exact keyword match — the lint gate is what must catch this shape
  })
})

describe('lib/adr.ts — sortAdrsDescending', () => {
  it('sorts zero-padded number strings newest-first (numeric order via lexicographic compare)', () => {
    const records = ['0003', '0076', '0001', '0010'].map((n) => parseAdr(`${n}-x.md`, `# ADR-${n} — x\n\n> | **Status** | accepted |\n> | **Date** | 2026-01-01 |\n\n## Context\n\nx\n`))
    expect(sortAdrsDescending(records).map((r) => r.number)).toEqual(['0076', '0010', '0003', '0001'])
  })
})

describe('lib/adr.ts — matchesQuery', () => {
  const record = parseAdr('0099-sample.md', SAMPLE)

  it('matches on number, title, and body — case-insensitive', () => {
    expect(matchesQuery(record, '0099')).toBe(true)
    expect(matchesQuery(record, 'SAMPLE DECISION')).toBe(true)
    expect(matchesQuery(record, 'second paragraph')).toBe(true) // body, not just the summary teaser
  })

  it('an empty query matches everything (no filter applied)', () => {
    expect(matchesQuery(record, '')).toBe(true)
    expect(matchesQuery(record, '   ')).toBe(true)
  })

  it('BITES on a real miss — a token that appears nowhere in the record', () => {
    expect(matchesQuery(record, 'zzznomatch')).toBe(false)
  })
})

describe('lib/adr.ts — extractSummary edge cases', () => {
  it('returns empty when the body has no prose at all (only headings, no text under any of them)', () => {
    expect(extractSummary('## Context\n\n## Decision\n')).toBe('')
  })

  it('falls through to a LATER heading\'s prose when the first heading has none directly under it', () => {
    expect(extractSummary('## Context\n\n## Decision\n\nx\n')).toBe('x')
  })

  it('stops the paragraph at a bullet list, not folding it in', () => {
    expect(extractSummary('## Context\n\nLead line.\n\n- one\n- two\n')).toBe('Lead line.')
  })
})

describe('lib/adr.ts — isDecisionRecord', () => {
  it('accepts a real NNNN-title.md filename', () => {
    expect(isDecisionRecord('0076-renderer-honors-catalog-declared-enums.md')).toBe(true)
  })

  it('excludes README.md (the log index, no NNNN- prefix)', () => {
    expect(isDecisionRecord('README.md')).toBe(false)
  })

  it('excludes the reserved 0000-template.md (the scaffold, not a decision — BITES the real template file)', () => {
    expect(isDecisionRecord('0000-template.md')).toBe(false)
  })
})

// ── the real ADR log — the glob's actual population (anti-vacuous: proves the build-time glob has real rows) ──

describe('lib/adr.ts — the real .claude/docs/adr log parses cleanly', () => {
  const allEntries = readdirSync(ADR_DIR) as string[]
  const files = allEntries.filter((f) => isDecisionRecord(f))
  const records = files.map((f) => parseAdr(f, readFileSync(`${ADR_DIR}/${f}`, 'utf8') as string))

  it('the real directory actually carries README.md + 0000-template.md (the filter is non-vacuous)', () => {
    expect(allEntries).toContain('README.md')
    expect(allEntries).toContain('0000-template.md')
  })

  it('found a non-zero, non-trivial set of real ADR files (the count the site glob must also resolve)', () => {
    expect(files.length).toBeGreaterThan(50)
    expect(files).not.toContain('README.md')
    expect(files).not.toContain('0000-template.md')
  })

  it('every real ADR parses a non-empty number/title/status/date', () => {
    for (const r of records) {
      expect(r.number, r.filename).toMatch(/^\d{4}$/)
      expect(r.title.length, r.filename).toBeGreaterThan(0)
      expect(r.status.length, r.filename).toBeGreaterThan(0)
      expect(r.dateShort, r.filename).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('every real ADR yields a non-empty summary (a body with real prose under its first heading)', () => {
    const empty = records.filter((r) => r.summary === '').map((r) => r.filename)
    expect(empty).toEqual([])
  })

  it('every real ADR resolves statusShort to one of the 4 badge keys — no unstyled/arbitrary badge value', () => {
    const offenders = records.filter((r) => !(STATUS_KEYS as readonly string[]).includes(r.statusShort)).map((r) => r.filename)
    expect(offenders).toEqual([])
  })

  // The Status LINT GATE — the machine-readable contract this module reads without a heuristic: every real
  // ADR's Status cell must be EXACTLY one of the 4 canonical keywords, verbatim, no trailing prose/ratification
  // detail (that detail lives in Ratified-by / Supersedes-Superseded-by instead — see .claude/docs/adr/README.md
  // and the per-ADR audit that normalized the corpus to this shape). This is the check that actually bites: a
  // future non-conforming Status cell fails HERE, not just at the (always-safe) statusShort fallback above.
  it('every real ADR Status cell is EXACTLY one of the 4 canonical keywords — the lint gate', () => {
    const offenders = records.filter((r) => !(STATUS_KEYS as readonly string[]).includes(r.status)).map((r) => `${r.filename}: "${r.status}"`)
    expect(offenders).toEqual([])
  })

  it('BITES: a non-conforming Status cell (trailing ratification prose) fails the exact lint gate above', () => {
    const offender = parseAdr(
      '9999-x.md',
      `# ADR-9999 — x\n\n> | **Status** | accepted — ratified on the green gate |\n> | **Date** | 2026-01-01 |\n\n## Context\n\nx\n`,
    )
    expect((STATUS_KEYS as readonly string[]).includes(offender.status)).toBe(false)
  })

  it('0037 (superseded by ADR-0038 before ever being built) carries the literal keyword "superseded"', () => {
    const r = records.find((r) => r.number === '0037')
    expect(r?.status).toBe('superseded')
    expect(r?.statusShort).toBe('superseded')
  })

  it('0007 and 0033 are literally "accepted" — their superseded-CLAUSE detail lives in Supersedes/Superseded-by, not Status', () => {
    const r7 = records.find((r) => r.number === '0007')
    const r33 = records.find((r) => r.number === '0033')
    expect(r7?.status).toBe('accepted')
    expect(r7?.statusShort).toBe('accepted')
    expect(r33?.status).toBe('accepted')
    expect(r33?.statusShort).toBe('accepted')
  })

  it('sorts the whole real log newest-first without throwing, ADR-0001 last', () => {
    const sorted = sortAdrsDescending(records)
    expect(sorted[sorted.length - 1].number).toBe('0001')
    expect(sorted[0].number > sorted[1].number).toBe(true)
  })
})
