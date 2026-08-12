// suites-driftwire.test.ts — the GH #616 byte-identity drift gate (the components package's
// `props-gen-driftwire.test.ts` / `generate-props.mjs` pairing, ported to this pack): regenerates every
// `packages/agent-ui/a2ui/conformance/suites/*.yaml` file IN-MEMORY from the real, committed
// `fixtures.jsonl` via `buildSuites`, and diffs against the COMMITTED bytes on disk. The generator and
// this gate import the SAME `generate-suites.ts` implementation, so they cannot drift into two. RED the
// moment a `suites/*.yaml` file is hand-edited (a negative control below proves the byte-compare
// genuinely bites) or a fixture/suite mapping falls out of sync with `fixtures.jsonl` (SUITE_MEMBERSHIP
// coverage check).

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSuites, SUITE_MEMBERSHIP } from './generate-suites.ts'
import { readFixtures } from './run.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const SUITES_DIR = join(HERE, '../../conformance/suites')

const fixtures = readFixtures()
const fresh = buildSuites(fixtures)

describe('generate-suites — anti-vacuous coverage (fixtures.jsonl ↔ SUITE_MEMBERSHIP)', () => {
  it('SUITE_MEMBERSHIP claims every one of the 16 committed fixtures exactly once', () => {
    const claimed = Object.values(SUITE_MEMBERSHIP).flat()
    expect(claimed.length).toBe(16)
    expect(new Set(claimed).size).toBe(claimed.length) // no fixture claimed twice
    expect(new Set(claimed)).toEqual(new Set(fixtures.map((f) => f.name))) // no orphan on either side
  })

  it('produces exactly the suite files present on disk, and no others', () => {
    const onDisk = readdirSync(SUITES_DIR)
      .filter((f) => f.endsWith('.yaml'))
      .sort()
    expect(Object.keys(fresh).sort()).toEqual(onDisk)
  })
})

describe.each(Object.keys(SUITE_MEMBERSHIP))(
  '%s — byte-identical to a fresh generation (the committed suite file cannot drift)',
  (file) => {
    const committed = readFileSync(join(SUITES_DIR, file), 'utf8') as string

    it(`the committed file matches the generator byte-for-byte (regenerate: node --experimental-strip-types packages/agent-ui/a2ui/tools/conformance/generate-suites.ts)`, () => {
      expect(committed).toBe(fresh[file])
    })

    it('negative control: a hand-edit to the committed file is genuinely caught (the equality check bites)', () => {
      expect(committed + '\n# hand-edited').not.toBe(fresh[file])
    })
  },
)
