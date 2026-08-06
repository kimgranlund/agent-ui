// wire-tolerance-index.test.ts — GH #484: the wire-tolerance INDEX linking gate.
//
// `.claude/docs/references/wire-tolerances.md` is the INDEX of every deliberate A2UI wire-tolerance
// arm (a place the wire accepts something beyond the canonical shape). This gate is the
// docs-grammar-style STRUCTURAL check (census-pin, the S8 ADR-numbering-contiguity precedent in
// `site/lib/docs-grammar.test.ts`) that keeps the INDEX honest against the real source:
//
//   1. every row's cited `file:anchor` exists verbatim at the cited location (source-text anchor
//      match — proves the INDEX isn't describing a moved/renamed/deleted arm);
//   2. the row COUNT in this file's `ROWS` census matches the row count in the doc's own table
//      (keeps the two representations from drifting apart);
//   3. a MARKER sweep over the files that use the fleet's "Postel" term-of-art for this arm class
//      (renderer.ts / checks.ts / catalog.ts) pins today's occurrence count per file — a NEW
//      Postel-tagged comment added to any of those files without a matching INDEX-doc update
//      changes the count and reddens this gate.
//
// Calibration note (why "Postel" and not a stronger convention): the codebase does not (yet) have
// a single reserved keyword every tolerance arm is required to carry — `selectCatalog` (S1) says
// "fail-closed", the version-envelope translation (V1) says "FRAMING", and the E7 narrowing says
// neither. Those three rows are pinned by their OWN unique anchor text (test #1 above) instead of
// the marker sweep. "Postel" is the term the three arms that DO share vocabulary (A1/A2/A3, C1, E7)
// already use, so a marker-count drift on those three files is a real, if partial, tripwire — not a
// complete one. Widening this coverage (a lint rule / reserved comment tag every NEW arm must carry)
// is exactly the module-move phase this build defers to GH #477.

import { describe, it, expect } from 'vitest'
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime
import { readFileSync, existsSync } from 'node:fs'
declare const process: { cwd(): string }

const ROOT = process.cwd()
const INDEX_DOC = `${ROOT}/.claude/docs/references/wire-tolerances.md`

interface Row {
  /** The INDEX doc's row id (the table's leftmost `#` column, e.g. `A1`). */
  id: string
  /** Repo-relative path to the file the row cites. */
  file: string
  /** A verbatim substring proving the arm lives where the row says it does. */
  anchor: string
}

// Census-pin (S8 precedent): the SAME seven rows as wire-tolerances.md's "The arms" table. Keep in
// sync BY HAND — a row added/removed here without touching the doc (or vice versa) is caught by the
// count assertion below.
const ROWS: Row[] = [
  {
    id: 'A1',
    file: 'packages/agent-ui/a2ui/src/renderer/renderer.ts',
    anchor: 'Tolerance: a bare string is the action name',
  },
  {
    id: 'A2',
    file: 'packages/agent-ui/a2ui/src/renderer/renderer.ts',
    anchor: "isObject(spec.event) && typeof spec.event.name === 'string'",
  },
  {
    id: 'A3',
    file: 'packages/agent-ui/a2ui/src/renderer/renderer.ts',
    anchor: 'Canonical `action` (ADR-0011); `name` is the tolerated synonym',
  },
  {
    id: 'C1',
    file: 'packages/agent-ui/a2ui/src/renderer/checks.ts',
    anchor: 'CONDITION wrapper:',
  },
  {
    id: 'S1',
    file: 'packages/agent-ui/a2ui/tools/agent/chat-validation.ts',
    anchor: 'ADR-0169 cl.3',
  },
  {
    id: 'V1',
    file: 'packages/agent-ui/a2ui/src/catalog/a2ui-basic/upstream-fixtures.test.ts',
    anchor: 'framing-only `v0.9` → `v1.0` envelope translation',
  },
  {
    id: 'E7',
    file: 'packages/agent-ui/a2ui/src/catalog/conformance.ts',
    anchor: 'ADR-0169 E7 row',
  },
]

// The E7 row's SECOND citation — the catalog.json declaration site the conformance check reads.
const E7_DECLARATION = {
  file: 'packages/agent-ui/a2ui/src/catalog/a2ui-basic/catalog.json',
  anchor: '"rejectFunctionCall": true',
}

describe('wire-tolerance INDEX — every row resolves to a real, cited location', () => {
  for (const row of ROWS) {
    it(`${row.id}: ${row.file} carries the cited anchor`, () => {
      const path = `${ROOT}/${row.file}`
      expect(existsSync(path), `${row.file} exists`).toBe(true)
      const text = readFileSync(path, 'utf8')
      expect(text.includes(row.anchor), `${row.file} contains "${row.anchor}"`).toBe(true)
    })
  }

  it('E7: the catalog.json declaration site carries its own anchor', () => {
    const path = `${ROOT}/${E7_DECLARATION.file}`
    expect(existsSync(path), `${E7_DECLARATION.file} exists`).toBe(true)
    const text = readFileSync(path, 'utf8')
    expect(text.includes(E7_DECLARATION.anchor), `${E7_DECLARATION.file} contains "${E7_DECLARATION.anchor}"`).toBe(
      true,
    )
  })
})

describe('wire-tolerance INDEX — row count matches the doc table', () => {
  it('every ROWS id has a matching table row in wire-tolerances.md, and the counts are equal', () => {
    expect(existsSync(INDEX_DOC), 'wire-tolerances.md exists').toBe(true)
    const doc = readFileSync(INDEX_DOC, 'utf8')

    for (const row of ROWS) {
      expect(doc.includes(`| ${row.id} |`), `wire-tolerances.md has a "| ${row.id} |" table row`).toBe(true)
    }

    // The doc's table body rows are the lines starting "| <id> |" where <id> matches this census's
    // id shape (a letter + digit, e.g. A1/C1/S1/V1/E7) — excludes the header/separator rows.
    const idPattern = /^\| ([A-Z]\d) \|/gm
    const docRowIds = [...doc.matchAll(idPattern)].map((m) => m[1])
    expect(docRowIds.sort()).toEqual(ROWS.map((r) => r.id).sort())
  })
})

// ── the Postel marker sweep ──────────────────────────────────────────────────────────────────────

/** Counts case-sensitive whole-word "Postel" occurrences — the fleet's shared term-of-art for this
 *  arm class (ADR-0011/ADR-0029's own doc comments). Exported at module scope so the negative
 *  control below can exercise the SAME counting logic against a synthetic string. */
function countPostelMarkers(text: string): number {
  return (text.match(/\bPostel\b/g) ?? []).length
}

// Today's real counts (2026-08-06) — a Postel-tagged comment added to any of these three files
// without updating BOTH this expectation and wire-tolerances.md turns this describe block red.
const POSTEL_MARKER_COUNTS: Record<string, number> = {
  'packages/agent-ui/a2ui/src/renderer/renderer.ts': 1,
  'packages/agent-ui/a2ui/src/renderer/checks.ts': 3,
  'packages/agent-ui/a2ui/src/catalog/catalog.ts': 2,
}

describe('wire-tolerance INDEX — Postel marker census (the widening tripwire)', () => {
  for (const [file, expected] of Object.entries(POSTEL_MARKER_COUNTS)) {
    it(`${file}: exactly ${expected} "Postel" marker(s)`, () => {
      const text = readFileSync(`${ROOT}/${file}`, 'utf8')
      expect(countPostelMarkers(text), `Postel-marker count in ${file}`).toBe(expected)
    })
  }

  // Negative control: proves the counting logic itself catches a widened arm, WITHOUT touching any
  // real swept file (this build's new-files-only fence forbids editing renderer.ts et al.). A
  // synthetic snippet carrying one MORE "Postel" mention than today's real renderer.ts must not
  // silently pass the same assertion shape the real-file tests above use.
  it('negative control: an extra Postel marker changes the count (the gate would bite)', () => {
    const real = readFileSync(`${ROOT}/packages/agent-ui/a2ui/src/renderer/renderer.ts`, 'utf8')
    const realCount = countPostelMarkers(real)
    expect(realCount).toBe(POSTEL_MARKER_COUNTS['packages/agent-ui/a2ui/src/renderer/renderer.ts'])

    const widened = `${real}\n// A fourth tolerance arm, Postel's law again, added with no INDEX row.\n`
    const widenedCount = countPostelMarkers(widened)

    expect(widenedCount).not.toBe(realCount) // the sweep DOES notice
    expect(widenedCount).not.toBe(POSTEL_MARKER_COUNTS['packages/agent-ui/a2ui/src/renderer/renderer.ts'])
  })
})
