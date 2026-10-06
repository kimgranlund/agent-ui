// uses-driftwire.test.ts: the ADR-0233 fleet gate for each descriptor's `uses:` field. Imports the SAME
// `deriveUses` crawl `scripts/codemod-uses.mjs` writes with, derives every fleet control's uses from the real
// import graph, and requires the declared block to equal it (the props-gen-driftwire pairing: generator and
// gate share one implementation, so they cannot drift into two). Fix a red here with
// `node scripts/codemod-uses.mjs`, never by hand-editing a list.

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import {
  parseDescriptor,
  scalarSeq,
  splitFrontmatter,
  validateComponentDescriptor,
  type ParsedDescriptor,
} from '../descriptor/component-descriptor.ts'
import { deriveUses, descriptorPath, entryModule, fleetFromDescriptors, type ControlsReader, type FleetEntry } from '../descriptor/control-graph.ts'
declare const process: { cwd(): string }

const CONTROLS = `${process.cwd()}/packages/agent-ui/components/src/controls`
const read: ControlsReader = (p) => (existsSync(`${CONTROLS}/${p}`) ? (readFileSync(`${CONTROLS}/${p}`, 'utf8') as string) : undefined)

// Fleet discovery: the family-coherence shape (every `{folder}/{name}.md` outside `_` folders).
const mdPaths: string[] = (readdirSync(CONTROLS) as string[])
  .filter((d) => !d.startsWith('_') && statSync(`${CONTROLS}/${d}`).isDirectory())
  .flatMap((d) => (readdirSync(`${CONTROLS}/${d}`) as string[]).filter((f) => f.endsWith('.md')).map((f) => `${d}/${f}`))
const FLEET = fleetFromDescriptors(mdPaths, read)

const parse = (source: string): ParsedDescriptor => parseDescriptor(splitFrontmatter(source).fence)
const badUses = (d: ParsedDescriptor): string[] => validateComponentDescriptor(d).filter((f) => f.code === 'BAD_USES').map((f) => f.path)

/** The one drift check the fleet assertion and the negative controls share: declared versus derived. */
function usesDrift(declared: readonly string[], derived: readonly string[]): { phantom: string[]; missing: string[] } {
  return {
    phantom: declared.filter((t) => !derived.includes(t)),
    missing: derived.filter((t) => !declared.includes(t)),
  }
}

describe('uses-driftwire: anti-vacuous fleet coverage', () => {
  it('discovers the fleet, every entry module exists, and the graph has edges', () => {
    expect(FLEET.length).toBeGreaterThan(50)
    for (const e of FLEET) expect(read(entryModule(e)), entryModule(e)).not.toBeUndefined()
    const edges = FLEET.reduce((n, e) => n + deriveUses(e, FLEET, read).length, 0)
    expect(edges).toBeGreaterThan(0)
  })
})

describe.each(FLEET.map((e) => [e.tag, e] as const))('%s uses', (_tag, entry: FleetEntry) => {
  const desc = parse(read(descriptorPath(entry)) as string)

  it('declares a uses block sequence with no BAD_USES defect', () => {
    expect(desc.sequences.has('uses'), `${descriptorPath(entry)} has no uses block; run node scripts/codemod-uses.mjs`).toBe(true)
    expect(badUses(desc)).toEqual([])
  })

  it('declared uses equal the import graph, sorted (run node scripts/codemod-uses.mjs)', () => {
    const declared = scalarSeq(desc, 'uses')
    const derived = deriveUses(entry, FLEET, read)
    expect(usesDrift(declared, derived)).toEqual({ phantom: [], missing: [] })
    expect(declared).toEqual(derived)
  })
})

describe('uses-driftwire: negative controls (the drift check bites)', () => {
  const table = FLEET.find((e) => e.tag === 'ui-table') as FleetEntry
  const tableDesc = parse(read(descriptorPath(table)) as string)

  it('a planted phantom edge in the descriptor is caught', () => {
    const declared = [...scalarSeq(tableDesc, 'uses'), 'ui-tooltip'].sort()
    expect(usesDrift(declared, deriveUses(table, FLEET, read)).phantom).toEqual(['ui-tooltip'])
  })

  it('a planted missing edge (a new import the descriptor does not declare) is caught', () => {
    const planted: ControlsReader = (p) => (p === entryModule(table) ? `${read(p)}\nimport './../tooltip/tooltip.ts'\n` : read(p))
    expect(usesDrift(scalarSeq(tableDesc, 'uses'), deriveUses(table, FLEET, planted)).missing).toEqual(['ui-tooltip'])
  })
})

describe('BAD_USES: the uses grammar', () => {
  const fence = (uses: string): ParsedDescriptor => parseDescriptor(`tag: ui-demo\nextends: UIElement\n${uses}`)

  it('accepts a block sequence of tags, the empty list, and an absent field', () => {
    expect(badUses(fence('uses:\n  - ui-button\n  - ui-icon # trailing comment'))).toEqual([])
    expect(badUses(fence('uses: []'))).toEqual([])
    expect(badUses(parseDescriptor('tag: ui-demo\nextends: UIElement'))).toEqual([])
  })

  it('rejects an inline flow list (it parses as a scalar)', () => {
    expect(badUses(fence('uses: [ui-button, ui-icon]'))).toEqual(['uses'])
  })

  it('rejects a bare scalar and an empty map', () => {
    expect(badUses(fence('uses: ui-button'))).toEqual(['uses'])
    expect(badUses(fence('uses:'))).toEqual(['uses'])
  })

  it('rejects a mapping item and a non-ui tag', () => {
    expect(badUses(fence('uses:\n  - name: ui-button'))).toEqual(['uses[0]'])
    expect(badUses(fence('uses:\n  - button'))).toEqual(['uses[0]'])
    expect(badUses(fence('uses:\n  - ui-Button'))).toEqual(['uses[0]'])
  })

  it('rejects a duplicate and the descriptor naming its own tag', () => {
    expect(badUses(fence('uses:\n  - ui-icon\n  - ui-icon'))).toEqual(['uses[1]'])
    expect(badUses(fence('uses:\n  - ui-demo'))).toEqual(['uses[0]'])
  })
})
