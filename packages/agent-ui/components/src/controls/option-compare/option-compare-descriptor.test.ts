import { describe, it, expect } from 'vitest'
import { UIOptionCompareElement } from './option-compare.ts'
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

// option-compare.md descriptor: structural validity, contract<->props and contract<->source trip-wires
// (the option-deck-descriptor.test.ts shape; T-0393, the Option compare forks 10 to 16).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/option-compare`
const md = readFileSync(`${DIR}/option-compare.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/option-compare.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/option-compare.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['options', 'rows', 'best', 'value', 'actionName', 'heading', 'inline']

describe('option-compare.md descriptor: structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-option-compare')
  })

  it('carries the descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-option-compare, extends=UIElement, tier=pattern, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-option-compare\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports zero structural failures, attributes in the pinned order', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('events are [select, action] with the string key and the {action, context: {value}} details', () => {
    const events = parsed.sequences.get('events') ?? []
    expect(events.map((e) => e.get('name'))).toEqual(['select', 'action'])
    expect(events.map((e) => e.get('detail'))).toEqual(['string', '{action: string, context: {value: string}}'])
    expect(scalarSeq(parsed, 'slots')).toEqual([])
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
  })

  it('actionName observes the kebab attribute, and inline is the reflected ADR-0223 opt-out', () => {
    const byName = new Map(parsed.attributes.map((a) => [a.name, a]))
    expect(byName.get('actionName')?.attribute).toBe('action-name')
    expect(byName.get('inline')?.reflect).toBe(true)
  })

  it('the first body paragraph is the one inventory sentence (the dogfood budget pin)', () => {
    const afterHeading = body.slice(body.indexOf('# ui-option-compare') + '# ui-option-compare'.length).trim()
    expect(afterHeading.split(/\n\s*\n/)[0]).toBe(
      '`ui-option-compare` sets two to four options side by side as columns over aligned attribute rows, with a best mark, and the whole column is the pick.',
    )
  })
})

describe('option-compare.md descriptor: contract<->props trip-wire', () => {
  it('the full bijection is clean', () => {
    expect(compareDescriptorToProps(parsed.attributes, UIOptionCompareElement.props)).toEqual([])
  })

  it('negative control: a removed or added attribute fails the trip-wire (isolated on `best`)', () => {
    const only = { best: UIOptionCompareElement.props.best }
    expect(compareDescriptorToProps([], only)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.best' }),
    )
    const addBogus = [{ name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, only)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})

describe('option-compare.md descriptor: contract<->source trip-wire', () => {
  it('customStates and slots tell the truth about option-compare.ts and option-compare.css', () => {
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('every part option-compare.ts builds is documented in parts[]', () => {
    const built = new Set([
      ...[...ts.matchAll(/part(?:<\w+>)?\('(?:div|span|p)', '([\w-]+)'\)/g)].map((m) => m[1]),
      ...[...ts.matchAll(/dataset\.part = '([\w-]+)'/g)].map((m) => m[1]),
    ])
    expect(built.size).toBeGreaterThan(10)
    // Read from the parts: block alone, so an attribute of the same name (heading) cannot stand in for its part.
    const partsBlock = fence.slice(fence.indexOf('\nparts:'), fence.indexOf('\ncustomStates:'))
    const documented = new Set([...partsBlock.matchAll(/^\s+- name: ([\w-]+)\s*$/gm)].map((m) => m[1]))
    for (const name of built) expect(documented, `part ${name} is built but not documented`).toContain(name)
  })
})
