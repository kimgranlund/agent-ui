import { describe, it, expect } from 'vitest'
import { UIGlyphElement } from './glyph.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
} from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// glyph.md descriptor, the icon-descriptor three-layer pattern: structural, contract<->props, contract<->source.

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/glyph`
const md = readFileSync(`${DIR}/glyph.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/glyph.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/glyph.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['symbol', 'label']

describe('glyph.md descriptor: structural validity', () => {
  it('tag=ui-glyph, extends=UIElement, tier=display, not form-associated, with a prose body', () => {
    expect(body).toContain('# ui-glyph')
    expect(/^tag:\s*ui-glyph\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*display\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports zero structural failures', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('glyph.md descriptor: contract<->props and contract<->source', () => {
  it('attributes[] is a faithful bijection with UIGlyphElement.props', () => {
    expect(compareDescriptorToProps(parsed.attributes, UIGlyphElement.props)).toEqual([])
  })

  it('a drifted attribute fails the trip-wire (negative control)', () => {
    const flipReflect = parsed.attributes.map((a) => (a.name === 'symbol' ? { ...a, reflect: true } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UIGlyphElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.symbol.reflect' }),
    )
  })

  it('customStates and slots tell the truth about glyph.ts and glyph.css', () => {
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })
})
