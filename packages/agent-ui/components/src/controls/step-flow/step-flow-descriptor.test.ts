import { describe, it, expect } from 'vitest'
import { UIStepFlowElement } from './step-flow.ts'
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

// step-flow.md descriptor: structural validity, contract<->props and contract<->source trip-wires
// (the confirm-receipt-descriptor.test.ts shape; T-0198).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/step-flow`
const md = readFileSync(`${DIR}/step-flow.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/step-flow.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/step-flow.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['steps', 'step', 'draft', 'finishAction', 'finishLabel', 'inline']

describe('step-flow.md descriptor: structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-step-flow')
  })

  it('carries the descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-step-flow, extends=UIElement, tier=pattern, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-step-flow\s*$/m.test(fence)).toBe(true)
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
    const afterHeading = body.slice(body.indexOf('# ui-step-flow') + '# ui-step-flow'.length).trim()
    expect(afterHeading.split(/\n\s*\n/)[0]).toBe(
      '`ui-step-flow` walks the user through its scenes one at a time, with Back and Next of its own and a last scene that commits.',
    )
  })

  it('the Accessibility section states the self-commit Tab order', () => {
    expect(body).toMatch(/On the self-commit scene Back takes focus after the scene's commit\s+Button/)
  })
})

describe('step-flow.md descriptor: contract<->props trip-wire', () => {
  it('the full bijection is clean', () => {
    expect(compareDescriptorToProps(parsed.attributes, UIStepFlowElement.props)).toEqual([])
  })

  it('step is the reflected number with default 1', () => {
    const step = parsed.attributes.find((a) => a.name === 'step')
    expect(step?.type).toBe('number')
    expect(step?.default).toBe('1')
    expect(step?.reflect).toBe(true)
  })

  it('the camelCase props have kebab attributes', () => {
    const attr = (name: string) => parsed.attributes.find((a) => a.name === name)?.attribute
    expect(attr('finishAction')).toBe('finish-action')
    expect(attr('finishLabel')).toBe('finish-label')
  })

  it('inline is the reflected boolean sizing opt-out (ADR-0223)', () => {
    const inline = parsed.attributes.find((a) => a.name === 'inline')
    expect(inline?.type).toBe('boolean')
    expect(inline?.reflect).toBe(true)
  })

  it('negative control: a removed or added attribute fails the trip-wire (isolated on `inline`)', () => {
    const inlineOnly = { inline: UIStepFlowElement.props.inline }
    expect(compareDescriptorToProps([], inlineOnly)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.inline' }),
    )
    const addBogus = [{ name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, inlineOnly)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})

describe('step-flow.md descriptor: contract<->source trip-wire', () => {
  it('customStates and slots tell the truth about step-flow.ts and step-flow.css', () => {
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('every part step-flow.ts builds is documented in parts[], and every documented part is built', () => {
    const built = new Set([
      ...[...ts.matchAll(/part(?:<\w+>)?\('(?:div|span|button)', '([\w-]+)'\)/g)].map((m) => m[1]),
      ...[...ts.matchAll(/dataset\.part = '([\w-]+)'/g)].map((m) => m[1]),
    ])
    expect(built.size).toBeGreaterThanOrEqual(10)
    const partsBlock = fence.slice(fence.indexOf('\nparts:'), fence.indexOf('\ncustomStates:'))
    const documented = new Set([...partsBlock.matchAll(/^\s+- name: ([\w-]+)\s*$/gm)].map((m) => m[1]))
    expect([...built].sort()).toEqual([...documented].sort())
  })
})
