import { describe, it, expect } from 'vitest'
import { UIDrillElement } from './drill.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  type ParsedAttribute,
} from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// ADR-0195 — drill.md descriptor. Two layers, mirroring drawer-descriptor.test.ts/split-descriptor.test.ts:
//   • (a) STRUCTURAL — the YAML frontmatter parses and is schema-valid.
//   • (b) CONTRACT↔PROPS — the descriptor's `attributes[]` is a faithful BIJECTION with the live
//     UIDrillElement.props (the ...surfaceProps spread elevation/brightness + path + view-transitions).

const DRILL = `${process.cwd()}/packages/agent-ui/components/src/controls/drill`
const md = readFileSync(`${DRILL}/drill.md`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

const ATTR_NAMES = ['elevation', 'brightness', 'path', 'viewTransitions']

describe('drill.md descriptor — frontmatter parses + schema-valid', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-drill')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag is ui-drill, extends UIContainerElement, tier is pattern, and face is NOT form-associated', () => {
    expect(/^tag:\s*ui-drill\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIContainerElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous
    const failures = validateComponentDescriptor(parsed)
    expect(failures).toEqual([])
  })
})

describe('drill.md descriptor — the bindable path (controlled/uncontrolled) + the change event', () => {
  it('records `path` as json/attribute:false/default undefined (the ui-split.sizes precedent)', () => {
    const path = parsed.attributes.find((a) => a.name === 'path')
    expect(path?.type).toBe('json')
    expect(path?.default).toBe('undefined')
    expect(path?.reflect).toBe(false)
  })

  it('records the ONE `change` event, ⊂ the closed seven — no new event name', () => {
    const events = (parsed.sequences.get('events') ?? []).map((i) => i.get('name'))
    expect(events).toEqual(['change'])
  })

  it('declares the header/back/heading PARTS (not user slots)', () => {
    const parts = (parsed.sequences.get('parts') ?? []).map((i) => i.get('name'))
    expect(parts).toEqual(['header', 'back', 'heading'])
  })

  it('declares `view-transitions` as a reflected boolean, default false', () => {
    const vt = parsed.attributes.find((a) => a.name === 'viewTransitions')
    expect(vt?.type).toBe('boolean')
    expect(vt?.default).toBe('false')
    expect(vt?.reflect).toBe(true)
  })
})

describe('drill.md descriptor — contract↔props trip-wire', () => {
  it('attributes[] is a faithful bijection with UIDrillElement.props (0 drift)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UIDrillElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default)', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) =>
      a.name === 'viewTransitions' ? { ...a, reflect: false } : { ...a },
    )
    expect(compareDescriptorToProps(flipReflect, UIDrillElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.viewTransitions.reflect' }),
    )
  })

  it('a removed or added attribute FAILS the trip-wire (negative control — bijection both ways)', () => {
    const dropped = parsed.attributes.filter((a) => a.name !== 'path')
    expect(compareDescriptorToProps(dropped, UIDrillElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.path' }),
    )
    const added: ParsedAttribute[] = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(added, UIDrillElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})
