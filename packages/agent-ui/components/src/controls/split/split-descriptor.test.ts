import { describe, it, expect } from 'vitest'
import { UISplitElement } from './split.ts'
import { UISplitPaneElement } from './split-pane.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
  collectUsedStates,
  collectStyledSlots,
} from '../../descriptor/component-descriptor.ts'
import type { ParsedAttribute } from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// LLD-C6 — split.md + split-pane.md descriptors (ADR-0004). Both fences, all three layers each: (a)
// STRUCTURAL schema-validity, (b) CONTRACT↔PROPS bijection against the live `static props`, (c)
// CONTRACT↔SOURCE (customStates/slots — split-pane declares/uses none; split.md declares `dragging`
// [TKT-0015] against split.ts/.css's real `:state(dragging)` usage — neither declares/uses a named slot).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/split`
const splitMd = readFileSync(`${DIR}/split.md`, 'utf8') as string
const splitTs = readFileSync(`${DIR}/split.ts`, 'utf8') as string
const splitCss = readFileSync(`${DIR}/split.css`, 'utf8') as string
const paneMd = readFileSync(`${DIR}/split-pane.md`, 'utf8') as string
const paneTs = readFileSync(`${DIR}/split-pane.ts`, 'utf8') as string
const paneCss = readFileSync(`${DIR}/split-pane.css`, 'utf8') as string

const split = parseDescriptor(splitFrontmatter(splitMd).fence)
const pane = parseDescriptor(splitFrontmatter(paneMd).fence)

const SPLIT_ATTRS = ['axis', 'sizes']
const PANE_ATTRS = ['initial', 'min', 'max', 'collapsible']

describe('split.md — frontmatter parses + schema-valid', () => {
  it('has a leading frontmatter fence and a prose body naming ui-split', () => {
    const { fence, body } = splitFrontmatter(splitMd)
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-split')
  })

  it('carries the ADR-0004 descriptor field set', () => {
    const required = ['tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots', 'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors']
    for (const field of required) expect(split.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
  })

  it('tag=ui-split, tier=layout, extends=UIContainerElement, formAssociated=false', () => {
    expect(/^tag:\s*ui-split\s*$/m.test(splitMd)).toBe(true)
    expect(/^tier:\s*layout\b/m.test(splitMd)).toBe(true)
    expect(/^extends:\s*UIContainerElement\b/m.test(splitMd)).toBe(true)
    expect(/formAssociated:\s*false/.test(splitMd)).toBe(true)
  })

  it('validateComponentDescriptor reports zero structural failures', () => {
    expect(split.attributes.map((a) => a.name)).toEqual(SPLIT_ATTRS) // anti-vacuous
    expect(validateComponentDescriptor(split)).toEqual([])
  })
})

describe('split.md — contract↔props trip-wire', () => {
  it('attributes[] is a faithful bijection with finalize(UISplitElement).props (0 drift)', () => {
    expect(split.attributes.map((a) => a.name)).toEqual(SPLIT_ATTRS)
    expect(compareDescriptorToProps(split.attributes, UISplitElement.props)).toEqual([])
  })

  it('sizes is type=json, default=undefined, reflect=false (the array/structured-value classification)', () => {
    const sizes = split.attributes.find((a) => a.name === 'sizes')
    expect(sizes?.type).toBe('json')
    expect(sizes?.default).toBe('undefined')
    expect(sizes?.reflect).toBe(false)
  })

  it('axis is a reflected 2-member enum defaulting horizontal', () => {
    const axis = split.attributes.find((a) => a.name === 'axis')
    expect(axis?.values).toEqual(['horizontal', 'vertical'])
    expect(axis?.default).toBe('horizontal')
    expect(axis?.reflect).toBe(true)
  })

  it('negative control: a drifted attribute FAILS the trip-wire', () => {
    const flipped: ParsedAttribute[] = split.attributes.map((a) => (a.name === 'axis' ? { ...a, default: 'vertical' } : { ...a }))
    expect(compareDescriptorToProps(flipped, UISplitElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.axis.default' }),
    )
  })

  it('negative control: a removed or added attribute FAILS the bijection', () => {
    const dropped = split.attributes.filter((a) => a.name !== 'sizes')
    expect(compareDescriptorToProps(dropped, UISplitElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.sizes' }),
    )
    const added: ParsedAttribute[] = [...split.attributes, { name: 'gap', type: 'string', default: '', reflect: true }]
    expect(compareDescriptorToProps(added, UISplitElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.gap' }),
    )
  })
})

describe('split.md — contract↔source trip-wire', () => {
  it('declares customStates=[dragging] (TKT-0015) and no named slots — 0 drift against source', () => {
    expect([...collectUsedStates(splitTs, splitCss)]).toEqual(['dragging'])
    expect([...collectStyledSlots(splitCss)]).toEqual([])
    expect(compareDescriptorToSource(split, { ts: splitTs, css: splitCss })).toEqual([])
  })
})

// ── split-pane.md ────────────────────────────────────────────────────────────────────────────────────

describe('split-pane.md — frontmatter parses + schema-valid', () => {
  it('has a leading frontmatter fence and a prose body naming ui-split-pane', () => {
    const { fence, body } = splitFrontmatter(paneMd)
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-split-pane')
  })

  it('tag=ui-split-pane, tier=layout, extends=UIContainerElement, formAssociated=false', () => {
    expect(/^tag:\s*ui-split-pane\s*$/m.test(paneMd)).toBe(true)
    expect(/^tier:\s*layout\b/m.test(paneMd)).toBe(true)
    expect(/^extends:\s*UIContainerElement\b/m.test(paneMd)).toBe(true)
    expect(/formAssociated:\s*false/.test(paneMd)).toBe(true)
  })

  it('validateComponentDescriptor reports zero structural failures', () => {
    expect(pane.attributes.map((a) => a.name)).toEqual(PANE_ATTRS)
    expect(validateComponentDescriptor(pane)).toEqual([])
  })
})

describe('split-pane.md — contract↔props trip-wire', () => {
  it('attributes[] is a faithful bijection with finalize(UISplitPaneElement).props (0 drift)', () => {
    expect(pane.attributes.map((a) => a.name)).toEqual(PANE_ATTRS)
    expect(compareDescriptorToProps(pane.attributes, UISplitPaneElement.props)).toEqual([])
  })

  it('initial is type=number, default=null, reflect=false (unreflected seed)', () => {
    const initial = pane.attributes.find((a) => a.name === 'initial')
    expect(initial?.type).toBe('number')
    expect(initial?.default).toBe('null')
    expect(initial?.reflect).toBe(false)
  })

  it('min/max are reflected strings; collapsible is a reflected boolean', () => {
    for (const name of ['min', 'max']) {
      const attr = pane.attributes.find((a) => a.name === name)
      expect(attr?.type).toBe('string')
      expect(attr?.default).toBe('')
      expect(attr?.reflect).toBe(true)
    }
    const collapsible = pane.attributes.find((a) => a.name === 'collapsible')
    expect(collapsible?.type).toBe('boolean')
    expect(collapsible?.default).toBe('false')
    expect(collapsible?.reflect).toBe(true)
  })

  it('negative control: a drifted attribute FAILS the trip-wire', () => {
    const flipped: ParsedAttribute[] = pane.attributes.map((a) => (a.name === 'collapsible' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipped, UISplitPaneElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.collapsible.reflect' }),
    )
  })

  it('negative control: a removed attribute FAILS the bijection', () => {
    const dropped = pane.attributes.filter((a) => a.name !== 'min')
    expect(compareDescriptorToProps(dropped, UISplitPaneElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.min' }),
    )
  })
})

describe('split-pane.md — contract↔source trip-wire', () => {
  it('declares no customStates and no named slots — source uses none (0 drift)', () => {
    expect([...collectUsedStates(paneTs, paneCss)]).toEqual([])
    expect([...collectStyledSlots(paneCss)]).toEqual([])
    expect(compareDescriptorToSource(pane, { ts: paneTs, css: paneCss })).toEqual([])
  })
})
