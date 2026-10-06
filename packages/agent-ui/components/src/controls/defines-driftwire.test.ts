// defines-driftwire.test.ts: the ADR-0233 fleet gate for each descriptor's optional `defines:` block, the
// sub-element tags its entry module self-defines besides its own (a card's three regions, tabs' tab and panel,
// drill's panel). Imports the SAME `deriveDefines` crawl the module graph is read with elsewhere, derives every
// fleet control's sub-tags from the real source, and requires the declared block to equal it, so the list the
// generated registry carries (and the A2UI built-in loader serves aliases from) cannot name a tag the module
// never defines, nor miss one it does. A red here: edit the descriptor's `defines:` block to the derived list,
// then run `node scripts/generate-controls.mjs`.

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import {
  parseDescriptor,
  scalarSeq,
  splitFrontmatter,
  validateComponentDescriptor,
  type ParsedDescriptor,
} from '../descriptor/component-descriptor.ts'
import { deriveDefines, descriptorPath, entryModule, fleetFromDescriptors, type ControlsReader, type FleetEntry } from '../descriptor/control-graph.ts'
declare const process: { cwd(): string }

const CONTROLS = `${process.cwd()}/packages/agent-ui/components/src/controls`
const read: ControlsReader = (p) => (existsSync(`${CONTROLS}/${p}`) ? (readFileSync(`${CONTROLS}/${p}`, 'utf8') as string) : undefined)

// Fleet discovery: the family-coherence shape (every `{folder}/{name}.md` outside `_` folders).
const mdPaths: string[] = (readdirSync(CONTROLS) as string[])
  .filter((d) => !d.startsWith('_') && statSync(`${CONTROLS}/${d}`).isDirectory())
  .flatMap((d) => (readdirSync(`${CONTROLS}/${d}`) as string[]).filter((f) => f.endsWith('.md')).map((f) => `${d}/${f}`))
const FLEET = fleetFromDescriptors(mdPaths, read)

const parse = (source: string): ParsedDescriptor => parseDescriptor(splitFrontmatter(source).fence)
const badDefines = (d: ParsedDescriptor): string[] => validateComponentDescriptor(d).filter((f) => f.code === 'BAD_DEFINES').map((f) => f.path)

/** The one drift check the fleet assertion and the negative controls share: declared versus derived. */
function definesDrift(declared: readonly string[], derived: readonly string[]): { phantom: string[]; missing: string[] } {
  return {
    phantom: declared.filter((t) => !derived.includes(t)),
    missing: derived.filter((t) => !declared.includes(t)),
  }
}

describe('defines-driftwire: anti-vacuous fleet coverage', () => {
  it('discovers the fleet and finds the three families that define sub-elements', () => {
    expect(FLEET.length).toBeGreaterThan(50)
    const families = FLEET.filter((e) => deriveDefines(e, FLEET, read).length > 0).map((e) => e.tag)
    expect(families).toEqual(['ui-card', 'ui-drill', 'ui-tabs'])
  })
})

describe.each(FLEET.map((e) => [e.tag, e] as const))('%s defines', (_tag, entry: FleetEntry) => {
  const desc = parse(read(descriptorPath(entry)) as string)

  it('declares no BAD_DEFINES defect', () => {
    expect(badDefines(desc)).toEqual([])
  })

  it('declared defines equal the sub-element tags the module graph defines, sorted (edit the descriptor block)', () => {
    const declared = scalarSeq(desc, 'defines')
    const derived = deriveDefines(entry, FLEET, read)
    expect(definesDrift(declared, derived)).toEqual({ phantom: [], missing: [] })
    expect(declared).toEqual(derived)
  })
})

describe('defines-driftwire: negative controls (the drift check bites)', () => {
  const card = FLEET.find((e) => e.tag === 'ui-card') as FleetEntry
  const cardDesc = parse(read(descriptorPath(card)) as string)

  it('a planted phantom sub-tag in the descriptor is caught', () => {
    const declared = [...scalarSeq(cardDesc, 'defines'), 'ui-card-media'].sort()
    expect(definesDrift(declared, deriveDefines(card, FLEET, read))).toEqual({ phantom: ['ui-card-media'], missing: [] })
  })

  it('a planted new sub-element module the descriptor does not declare is caught', () => {
    const planted: ControlsReader = (p) => {
      if (p === entryModule(card)) return `${read(p)}\nimport './card-media.ts'\n`
      if (p === 'card/card-media.ts') return "if (!customElements.get('ui-card-media')) customElements.define('ui-card-media', class {})\n"
      return read(p)
    }
    expect(definesDrift(scalarSeq(cardDesc, 'defines'), deriveDefines(card, FLEET, planted))).toEqual({ phantom: [], missing: ['ui-card-media'] })
  })

  it('a declared sub-tag whose module the entry stopped importing is caught', () => {
    const planted: ControlsReader = (p) => (p === entryModule(card) ? (read(p) as string).replace("import './card-footer.ts'", '') : read(p))
    expect(definesDrift(scalarSeq(cardDesc, 'defines'), deriveDefines(card, FLEET, planted))).toEqual({ phantom: ['ui-card-footer'], missing: [] })
  })
})

describe('BAD_DEFINES: the defines grammar (the uses grammar, under its own code)', () => {
  const fence = (defines: string): ParsedDescriptor => parseDescriptor(`tag: ui-demo\nextends: UIElement\n${defines}`)

  it('accepts a block sequence of tags, the empty list, and an absent field', () => {
    expect(badDefines(fence('defines:\n  - ui-demo-part\n  - ui-demo-row # trailing comment'))).toEqual([])
    expect(badDefines(fence('defines: []'))).toEqual([])
    expect(badDefines(parseDescriptor('tag: ui-demo\nextends: UIElement'))).toEqual([])
  })

  it('rejects an inline flow list, a bare scalar and an empty map', () => {
    expect(badDefines(fence('defines: [ui-demo-part, ui-demo-row]'))).toEqual(['defines'])
    expect(badDefines(fence('defines: ui-demo-part'))).toEqual(['defines'])
    expect(badDefines(fence('defines:'))).toEqual(['defines'])
  })

  it('rejects a mapping item and a non-ui tag', () => {
    expect(badDefines(fence('defines:\n  - name: ui-demo-part'))).toEqual(['defines[0]'])
    expect(badDefines(fence('defines:\n  - demo-part'))).toEqual(['defines[0]'])
  })

  it('rejects a duplicate and the descriptor naming its own tag', () => {
    expect(badDefines(fence('defines:\n  - ui-demo-part\n  - ui-demo-part'))).toEqual(['defines[1]'])
    expect(badDefines(fence('defines:\n  - ui-demo'))).toEqual(['defines[0]'])
  })

  it('a malformed defines block is not a BAD_USES, and a malformed uses block is not a BAD_DEFINES', () => {
    const codes = (d: ParsedDescriptor): string[] => validateComponentDescriptor(d).map((f) => f.code).filter((c) => c === 'BAD_USES' || c === 'BAD_DEFINES')
    expect(codes(fence('defines: [ui-a]'))).toEqual(['BAD_DEFINES'])
    expect(codes(fence('uses: [ui-a]'))).toEqual(['BAD_USES'])
  })
})
