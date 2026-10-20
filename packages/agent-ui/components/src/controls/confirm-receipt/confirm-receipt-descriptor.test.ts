import { describe, it, expect } from 'vitest'
import { UIConfirmReceiptElement } from './confirm-receipt.ts'
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

// confirm-receipt.md descriptor: structural validity, contract<->props and contract<->source trip-wires
// (the result-card-descriptor.test.ts shape; T-0195).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/confirm-receipt`
const md = readFileSync(`${DIR}/confirm-receipt.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/confirm-receipt.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/confirm-receipt.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['title', 'rows', 'data', 'items', 'total', 'status', 'refPath', 'confirmAction', 'backAction', 'inline']

describe('confirm-receipt.md descriptor: structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-confirm-receipt')
  })

  it('carries the descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-confirm-receipt, extends=UIElement, tier=pattern, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-confirm-receipt\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports zero structural failures, attributes in the pinned order', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('events are change then action, both in the closed set; slots and customStates are empty', () => {
    const events = fence.slice(fence.indexOf('\nevents:'), fence.indexOf('\nslots:'))
    expect([...events.matchAll(/- name: (\w+)/g)].map((m) => m[1])).toEqual(['change', 'action'])
    expect(scalarSeq(parsed, 'slots')).toEqual([])
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
  })

  it('the first body paragraph is the one inventory sentence (the dogfood budget pin)', () => {
    const afterHeading = body.slice(body.indexOf('# ui-confirm-receipt') + '# ui-confirm-receipt'.length).trim()
    expect(afterHeading.split(/\n\s*\n/)[0]).toBe(
      '`ui-confirm-receipt` reads a booking or an order back for the user to confirm, then settles into its receipt.',
    )
  })
})

describe('confirm-receipt.md descriptor: contract<->props trip-wire', () => {
  it('the full bijection is clean', () => {
    expect(compareDescriptorToProps(parsed.attributes, UIConfirmReceiptElement.props)).toEqual([])
  })

  it('status is the reflected enum pending, confirmed with default pending', () => {
    const status = parsed.attributes.find((a) => a.name === 'status')
    expect(status?.values).toEqual(['pending', 'confirmed'])
    expect(status?.default).toBe('pending')
    expect(status?.reflect).toBe(true)
  })

  it('title is observed as receipt-title; the camelCase props have kebab attributes', () => {
    const attr = (name: string) => parsed.attributes.find((a) => a.name === name)?.attribute
    expect(attr('title')).toBe('receipt-title')
    expect(attr('refPath')).toBe('ref-path')
    expect(attr('confirmAction')).toBe('confirm-action')
    expect(attr('backAction')).toBe('back-action')
  })

  it('inline is the reflected boolean sizing opt-out (ADR-0223)', () => {
    const inline = parsed.attributes.find((a) => a.name === 'inline')
    expect(inline?.type).toBe('boolean')
    expect(inline?.reflect).toBe(true)
  })

  it('negative control: a removed or added attribute fails the trip-wire (isolated on `inline`)', () => {
    const inlineOnly = { inline: UIConfirmReceiptElement.props.inline }
    expect(compareDescriptorToProps([], inlineOnly)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.inline' }),
    )
    const addBogus = [{ name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, inlineOnly)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})

describe('confirm-receipt.md descriptor: contract<->source trip-wire', () => {
  it('customStates and slots tell the truth about confirm-receipt.ts and confirm-receipt.css', () => {
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('every part confirm-receipt.ts builds is documented in parts[], and every documented part is built', () => {
    const built = new Set([
      ...[...ts.matchAll(/part(?:<\w+>)?\('(?:div|span|p|section|button)', '([\w-]+)'\)/g)].map((m) => m[1]),
      ...[...ts.matchAll(/line\('(row|total)'/g)].map((m) => m[1]),
      ...[...ts.matchAll(/dataset\.part = '([\w-]+)'/g)].map((m) => m[1]),
    ])
    expect(built.size).toBeGreaterThan(10)
    const partsBlock = fence.slice(fence.indexOf('\nparts:'), fence.indexOf('\ncustomStates:'))
    const documented = new Set([...partsBlock.matchAll(/^\s+- name: ([\w-]+)\s*$/gm)].map((m) => m[1]))
    expect([...built].sort()).toEqual([...documented].sort())
  })
})
