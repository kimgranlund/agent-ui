import { describe, it, expect } from 'vitest'
import { UIToastRegionElement } from './toast-region.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
  collectUsedStates,
  collectStyledSlots,
} from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// toast-region-descriptor.test.ts — feed-family.lld.md LLD-C8/LLD-C10. `ui-toast-region` takes NO
// configuration (attributes: [] — the ui-form-provider precedent), so the bijection trip-wire is
// checked against the EMPTY live props table (0 attributes ≡ 0 live props).

const TOAST = `${process.cwd()}/packages/agent-ui/components/src/controls/toast`
const md = readFileSync(`${TOAST}/toast-region.md`, 'utf8') as string
const ts = readFileSync(`${TOAST}/toast-region.ts`, 'utf8') as string
const css = readFileSync(`${TOAST}/toast-region.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

describe('toast-region.md descriptor — frontmatter parses + schema-valid', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-toast-region')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag is ui-toast-region, extends UIElement, tier is layout, and face is NOT form-associated', () => {
    expect(/^tag:\s*ui-toast-region\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*layout\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (attributes: [] parses as an empty sequence)', () => {
    expect(parsed.sequences.get('attributes')).toEqual([]) // anti-vacuous: the empty sequence actually parsed, not silently absent
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('toast-region.md descriptor — the show() method + parts/slots shape', () => {
  it('declares show() as the sole public property beyond the platform popover attribute', () => {
    const properties = (parsed.sequences.get('properties') ?? []).map((i) => i.get('name'))
    expect(properties).toEqual(['show'])
  })

  it('declares no control-owned parts (the host IS the popover) and one default slot for ui-toast children', () => {
    expect(parsed.sequences.get('parts')).toEqual([])
    const slots = (parsed.sequences.get('slots') ?? []).map((i) => i.get('name'))
    expect(slots).toEqual(['default'])
  })

  it('declares no events of its own (each contained ui-toast owns select/close)', () => {
    expect(parsed.sequences.get('events')).toEqual([])
  })
})

describe('toast-region.md descriptor — contract↔props trip-wire (the empty bijection)', () => {
  it('attributes[] is empty and matches the empty live UIToastRegionElement.props (0 drift)', () => {
    expect(parsed.attributes).toEqual([])
    expect(compareDescriptorToProps(parsed.attributes, UIToastRegionElement.props)).toEqual([])
  })

  it('negative control: a live prop with no descriptor row would be caught (added to a COPY of the live props)', () => {
    const withBogusLiveProp = { ...UIToastRegionElement.props, bogus: { type: { from: () => '', to: () => null }, default: '' } }
    expect(compareDescriptorToProps(parsed.attributes, withBogusLiveProp)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.bogus' }),
    )
  })
})

describe('toast-region.md descriptor — contract↔source trip-wire (customStates/slots tell the truth)', () => {
  it('toast-region.ts uses no internals.states and toast-region.css uses no :state() selector — customStates is correctly empty', () => {
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('toast-region.css declares no [slot=x] selector (the default slot is unstyled — children lay out via the popover flex column)', () => {
    expect([...collectStyledSlots(css)]).toEqual([])
  })
})
