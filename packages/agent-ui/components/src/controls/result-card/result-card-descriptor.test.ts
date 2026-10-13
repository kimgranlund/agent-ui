import { describe, it, expect } from 'vitest'
import { UIResultCardElement } from './result-card.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
  collectUsedStates,
  collectStyledSlots,
  scalarSeq,
} from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// result-card.md descriptor: structural validity, contract<->props and contract<->source trip-wires
// (the game-hud-descriptor.test.ts shape; ADR-0244 ResultCard fork sheet).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/result-card`
const md = readFileSync(`${DIR}/result-card.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/result-card.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/result-card.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['outcome', 'title', 'summary', 'stats', 'inline']

describe('result-card.md descriptor: structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-result-card')
  })

  it('carries the descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-result-card, extends=UIElement, tier=pattern, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-result-card\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports zero structural failures, attributes in the pinned order', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('events, slots, keyboard and customStates are all empty: no events of its own, no action prop', () => {
    expect(scalarSeq(parsed, 'events')).toEqual([])
    expect(scalarSeq(parsed, 'slots')).toEqual([])
    expect(scalarSeq(parsed, 'keyboard')).toEqual([])
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
    expect(parsed.attributes.find((a) => a.name === 'action')).toBeUndefined()
  })

  it('the first body paragraph is the one inventory sentence (the dogfood budget pin)', () => {
    const afterHeading = body.slice(body.indexOf('# ui-result-card') + '# ui-result-card'.length).trim()
    expect(afterHeading.split(/\n\s*\n/)[0]).toBe('`ui-result-card` is a settled outcome card for a game end or a finished booking.')
  })
})

describe('result-card.md descriptor: contract<->props trip-wire', () => {
  it('the full bijection is clean', () => {
    expect(compareDescriptorToProps(parsed.attributes, UIResultCardElement.props)).toEqual([])
  })

  it('outcome is the reflected enum win, lose, draw, done with default done', () => {
    const outcome = parsed.attributes.find((a) => a.name === 'outcome')
    expect(outcome?.values).toEqual(['win', 'lose', 'draw', 'done'])
    expect(outcome?.default).toBe('done')
    expect(outcome?.reflect).toBe(true)
  })

  it('title is observed as result-title and not reflected', () => {
    const title = parsed.attributes.find((a) => a.name === 'title')
    expect(title?.attribute).toBe('result-title')
    expect(title?.reflect).toBe(false)
  })

  it('inline is the reflected boolean sizing opt-out (ADR-0223)', () => {
    const inline = parsed.attributes.find((a) => a.name === 'inline')
    expect(inline?.type).toBe('boolean')
    expect(inline?.reflect).toBe(true)
  })

  it('negative control: a removed or added attribute fails the trip-wire (isolated on `inline`)', () => {
    const inlineOnly = { inline: UIResultCardElement.props.inline }
    expect(compareDescriptorToProps([], inlineOnly)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.inline' }),
    )
    const addBogus = [{ name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, inlineOnly)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})

describe('result-card.md descriptor: contract<->source trip-wire', () => {
  it('customStates and slots tell the truth about result-card.ts and result-card.css', () => {
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('every part result-card.ts builds is documented in parts[]', () => {
    const built = new Set([
      ...[...ts.matchAll(/part\('(?:div|span|p)', '([\w-]+)'\)/g)].map((m) => m[1]),
      ...[...ts.matchAll(/dataset\.part = '([\w-]+)'/g)].map((m) => m[1]),
    ])
    expect(built.size).toBeGreaterThan(0)
    const documented = new Set([...fence.matchAll(/^\s+- name: ([\w-]+)\s*$/gm)].map((m) => m[1]))
    for (const name of built) expect(documented, `part ${name} is built but not documented`).toContain(name)
  })
})
