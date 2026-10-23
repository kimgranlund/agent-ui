import { describe, it, expect } from 'vitest'
import { UIOptionDeckElement } from './option-deck.ts'
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

// option-deck.md descriptor: structural validity, contract<->props and contract<->source trip-wires
// (the result-card-descriptor.test.ts shape; T-0193 OptionDeck fork sheet).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/option-deck`
const md = readFileSync(`${DIR}/option-deck.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/option-deck.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/option-deck.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['options', 'value', 'actionName', 'allowRandom', 'randomLabel', 'heading', 'subheading', 'disabled', 'inline']

describe('option-deck.md descriptor: structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-option-deck')
  })

  it('carries the descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-option-deck, extends=UIElement, tier=pattern, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-option-deck\s*$/m.test(fence)).toBe(true)
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

  it('actionName, allowRandom and randomLabel observe kebab attributes', () => {
    const byName = new Map(parsed.attributes.map((a) => [a.name, a]))
    expect(byName.get('actionName')?.attribute).toBe('action-name')
    expect(byName.get('allowRandom')?.attribute).toBe('allow-random')
    expect(byName.get('randomLabel')?.attribute).toBe('random-label')
  })

  it('the first body paragraph is the one inventory sentence (the dogfood budget pin)', () => {
    const afterHeading = body.slice(body.indexOf('# ui-option-deck') + '# ui-option-deck'.length).trim()
    expect(afterHeading.split(/\n\s*\n/)[0]).toBe(
      '`ui-option-deck` is a deck of option cards for any lone single pick among a few options, where pressing a card is the commit.',
    )
  })
})

describe('option-deck.md descriptor: contract<->props trip-wire', () => {
  it('the full bijection is clean', () => {
    expect(compareDescriptorToProps(parsed.attributes, UIOptionDeckElement.props)).toEqual([])
  })

  it('negative control: a removed or added attribute fails the trip-wire (isolated on `disabled`)', () => {
    const only = { disabled: UIOptionDeckElement.props.disabled }
    expect(compareDescriptorToProps([], only)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.disabled' }),
    )
    const addBogus = [{ name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, only)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})

describe('option-deck.md descriptor: contract<->source trip-wire', () => {
  it('customStates and slots tell the truth about option-deck.ts and option-deck.css', () => {
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('every part option-deck.ts builds is documented in parts[]', () => {
    const built = new Set([
      ...[...ts.matchAll(/part(?:<\w+>)?\('(?:div|span|p|img|ui-icon)', '([\w-]+)'\)/g)].map((m) => m[1]),
      ...[...ts.matchAll(/dataset\.part = '([\w-]+)'/g)].map((m) => m[1]),
    ])
    expect(built.size).toBeGreaterThan(10)
    const documented = new Set([...fence.matchAll(/^\s+- name: ([\w-]+)\s*$/gm)].map((m) => m[1]))
    for (const name of built) expect(documented, `part ${name} is built but not documented`).toContain(name)
  })
})
