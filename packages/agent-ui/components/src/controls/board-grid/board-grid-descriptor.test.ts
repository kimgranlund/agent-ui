import { describe, it, expect } from 'vitest'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToSource,
  collectUsedStates,
  collectStyledSlots,
  scalarSeq,
} from '../../descriptor/component-descriptor.ts'
import { generatePropsModule } from '../../descriptor/generate-props.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// board-grid.md descriptor: structural + contract<->source (ADR-0004; ADR-0243). The contract<->props layer
// is the GENERATOR here, not the s10 hand bijection (ADR-0173 cl.4c/OF4, the source-list precedent):
// board-grid.ts imports `board-grid.props.gen.ts`, generated from this same descriptor, so the bijection is
// true by construction. The drift leg below regenerates in memory and diffs against the committed file
// (the props-gen-driftwire.test.ts shape), so a stale or hand-edited generated file reds here.

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/board-grid`
const md = readFileSync(`${DIR}/board-grid.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/board-grid.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/board-grid.css`, 'utf8') as string
const gen = readFileSync(`${DIR}/board-grid.props.gen.ts`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['rows', 'cols', 'cells', 'label', 'actionName', 'inline']

describe('board-grid.md descriptor: structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-board-grid')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-board-grid, extends=UIElement, tier=pattern, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-board-grid\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('events are [action] and slots are [] (ADR-0243 BoardGrid rows)', () => {
    expect((parsed.sequences.get('events') ?? []).map((e) => e.get('name'))).toEqual(['action'])
    expect(scalarSeq(parsed, 'slots')).toEqual([])
  })

  it('rows/cols are numbers, actionName carries the action-name attribute, inline reflects', () => {
    const at = (name: string) => parsed.attributes.find((a) => a.name === name)
    expect(at('rows')?.type).toBe('number')
    expect(at('cols')?.type).toBe('number')
    expect(at('cells')?.codec).toEqual({ import: './board-grid-model.ts', name: 'cellsProp' })
    expect(at('actionName')?.attribute).toBe('action-name')
    expect(at('inline')?.reflect).toBe(true)
  })
})

describe('board-grid.props.gen.ts: byte-identical to a fresh generation', () => {
  const fresh = generatePropsModule(md)

  it('the generator succeeds against the committed descriptor', () => {
    expect(fresh.ok, fresh.ok ? '' : JSON.stringify(fresh.failures)).toBe(true)
  })

  it('the committed file matches the generator byte-for-byte (regenerate: node scripts/generate-props.mjs board-grid)', () => {
    expect(gen).toBe(fresh.code)
  })

  it('negative control: a hand-edit to the generated file is caught', () => {
    expect(gen + '\n// hand-edited').not.toBe(fresh.code)
  })
})

describe('board-grid.md descriptor: contract<->source trip-wire', () => {
  it('customStates/slots tell the truth about board-grid.ts + board-grid.css (0 source-drift)', () => {
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE: a synthetic source using an undocumented state FAILS the source-wire (STATE_UNDOCUMENTED)', () => {
    const syntheticCss = css + '\n:scope:state(bogus) { color: red; } /* synthetic */'
    const result = compareDescriptorToSource(parsed, { ts, css: syntheticCss })
    expect(result).toContainEqual(expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.bogus' }))
  })

  it('NEGATIVE: a synthetic css styling an undocumented slot FAILS the source-wire (SLOT_UNDOCUMENTED)', () => {
    const syntheticCss = css + "\n:scope > [slot='leading'] { display: none; } /* synthetic */"
    const result = compareDescriptorToSource(parsed, { ts, css: syntheticCss })
    expect(result).toContainEqual(expect.objectContaining({ code: 'SLOT_UNDOCUMENTED', path: 'slots.leading' }))
  })

  it('every [data-part] the source builds is a declared part', () => {
    const declared = (parsed.sequences.get('parts') ?? []).map((p) => p.get('name'))
    const built = [...new Set([...ts.matchAll(/setAttribute\('data-part', '([a-z-]+)'\)/g)].map((m) => m[1]))]
    expect(built.length).toBeGreaterThan(0)
    expect(built.sort()).toEqual([...declared].sort())
  })
})
