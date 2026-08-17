// site/lib/a2a-consumer-api.test.ts — the drift gate behind a2a-concepts.ts's Consumer API section (GH
// #1049). Three legs:
//
//   1. Real-source parse — the REAL @agent-ui/a2a barrel (index.ts) parses into the five documented
//      groups (protocol/rpc/channel/arena/corpus), each with real sources on disk. A group added/removed/
//      renamed in the barrel changes this count/shape — the page derives from the SAME parse, so it can
//      never drift from what the barrel actually re-exports.
//   2. Live runtime proof — the actual `@agent-ui/a2a` module's exported keys are non-trivial (anti-
//      vacuous: a build that silently strips the barrel down to nothing would fail here).
//   3. Negative controls (pure predicates, synthetic inputs — the site-coverage.test.ts
//      `undocumentedFolders`/controls-coverage.test.ts precedent): a comment-only block parses to NO
//      group (proves the parser doesn't fabricate a phantom entry), and a group naming a source that does
//      not exist on disk is CAUGHT by `missingBarrelSources`.
import { describe, it, expect } from 'vitest'
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime (sitemap.test.ts precedent)
import { existsSync } from 'node:fs'
import { parseA2aBarrelGroups, missingBarrelSources } from './a2a-consumer-api.ts'
import * as A2A from '@agent-ui/a2a'
import barrelRaw from '../../packages/agent-ui/a2a/src/index.ts?raw'

declare const process: { cwd(): string }
const ROOT = process.cwd()
const A2A_SRC = `${ROOT}/packages/agent-ui/a2a/src`

describe('parseA2aBarrelGroups — the real @agent-ui/a2a barrel', () => {
  const groups = parseA2aBarrelGroups(barrelRaw)

  it('anti-vacuous: parses a real, non-empty group set', () => {
    expect(groups.length).toBeGreaterThan(0)
  })

  it('finds exactly the five documented groups, in barrel order', () => {
    expect(groups.map((g) => g.name)).toEqual(['protocol/', 'rpc/', 'channel/', 'arena/', 'corpus/'])
  })

  it('every group carries at least one source, and every declared source resolves to a real file', () => {
    for (const group of groups) expect(group.sources.length).toBeGreaterThan(0)
    expect(missingBarrelSources(groups, (path) => existsSync(`${A2A_SRC}/${path}`))).toEqual([])
  })

  it('the header comment block (no export lines) is dropped, not fabricated into a group', () => {
    expect(groups.some((g) => g.note.includes('S8-owned: this file is edited ONLY'))).toBe(false)
  })
})

describe('the live @agent-ui/a2a runtime export surface (anti-vacuous — a stripped build would fail here)', () => {
  it('exports a real, non-trivial set of runtime values', () => {
    const keys = Object.keys(A2A)
    expect(keys.length).toBeGreaterThanOrEqual(15)
    // one known member per documented group — proves the live surface actually spans all five, not just one
    expect(keys).toContain('validateA2a') // protocol/
    expect(keys).toContain('RPC_ERROR_TABLE') // rpc/
    expect(keys).toContain('createLoopbackPair') // channel/
    expect(keys).toContain('checkIsolation') // arena/
    expect(keys).toContain('admittedRecords') // corpus/
  })
})

describe('the checks BITE (negative controls; pure predicates with synthetic inputs)', () => {
  it('parseA2aBarrelGroups: a comment-only block (no export line) parses to zero groups', () => {
    const synthetic = "// a package header\n// with two comment lines and NO export at all\n\n// unrelated trailing text"
    expect(parseA2aBarrelGroups(synthetic)).toEqual([])
  })

  it('parseA2aBarrelGroups: a real-shaped block DOES parse (the positive control for the negative above)', () => {
    const synthetic = "// widgets/ (SPEC-X) — the widget surface.\nexport * from './widgets/a.ts'\nexport * from './widgets/b.ts'"
    expect(parseA2aBarrelGroups(synthetic)).toEqual([
      { name: 'widgets/', note: 'widgets/ (SPEC-X) — the widget surface.', sources: ['./widgets/a.ts', './widgets/b.ts'] },
    ])
  })

  it('missingBarrelSources: a source naming a file that does not exist is caught, not silently accepted', () => {
    const fakeGroup = { name: 'fake/', note: 'a synthetic group', sources: ['./nope/does-not-exist.ts'] }
    expect(missingBarrelSources([fakeGroup], () => false)).toEqual(['./nope/does-not-exist.ts'])
    expect(missingBarrelSources([fakeGroup], () => true)).toEqual([]) // honors a truthy exists() too
  })
})
