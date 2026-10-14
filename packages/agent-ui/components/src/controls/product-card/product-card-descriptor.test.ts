import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import './product-card.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToSource,
  collectUsedStates,
  scalarSeq,
} from '../../descriptor/component-descriptor.ts'
declare const process: { cwd(): string }

// product-card-descriptor.test.ts: structural validity plus contract to source (ADR-0004). No
// compareDescriptorToProps here: product-card is a CONVERTED control (ADR-0173), so its props are
// generated from this descriptor and the fleet drift gate (descriptor/props-gen-driftwire.test.ts) holds
// them byte-identical.

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/product-card`
const md = readFileSync(`${DIR}/product-card.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/product-card.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/product-card.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

const PARTS = [
  'media', 'image', 'icon', 'body', 'title', 'subtitle', 'rating', 'rating-stars', 'rating-value',
  'rating-text', 'rating-count', 'badge', 'price-row', 'price', 'price-old', 'price-old-text', 'price-note', 'action',
]

describe('product-card.md descriptor', () => {
  it('has a frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-product-card')
  })

  it('tag, tier, extends and face', () => {
    expect(/^tag:\s*ui-product-card\s*$/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports zero structural failures', () => {
    expect(parsed.attributes.length).toBe(17)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('parts lists every data-part the control builds', () => {
    const section = fence.split('\nparts:')[1].split('\ncustomStates:')[0]
    const declared = [...section.matchAll(/^ {2}- name: ([\w-]+)$/gm)].map((m) => m[1])
    expect(declared).toEqual(PARTS)
    const built = new Set([...ts.matchAll(/part<\w+>\('[\w-]+', '([\w-]+)'\)/g)].map((m) => m[1]))
    expect(built).toEqual(new Set(PARTS))
  })

  it('events: exactly one, action', () => {
    const events = fence.split('\nevents:')[1].split('\nslots:')[0]
    expect([...events.matchAll(/^ {2}- name: (\w+)$/gm)].map((m) => m[1])).toEqual(['action'])
  })

  it('customStates tell the truth about the source (none used, none declared)', () => {
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })
})
