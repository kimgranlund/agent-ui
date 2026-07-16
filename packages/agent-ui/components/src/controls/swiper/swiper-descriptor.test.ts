import { describe, it, expect } from 'vitest'
import { UISwiperElement } from './swiper.ts'
import { UISwiperItemElement } from './swiper-item.ts'
import { UISwiperPaginationElement } from './swiper-pagination.ts'
import { UISwiperPaddlesElement } from './swiper-paddles.ts'
import { UISwiperLabelElement } from './swiper-label.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
  scalarSeq,
  type ParsedAttribute,
} from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// swiper-descriptor.test.ts — the five {name}.md descriptors (ADR-0004, swiper-family.lld.md §10). Three
// layers per element (the ui-tabs precedent): (a) STRUCTURAL — validateComponentDescriptor is schema-valid;
// (b) CONTRACT↔PROPS — attributes[] is a faithful bijection with the live static props; (c) CONTRACT↔SOURCE —
// customStates/slots tell the truth about the .ts/.css.

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/swiper`
const swiperTs = readFileSync(`${DIR}/swiper.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/swiper.css`, 'utf8') as string

const read = (f: string): string => readFileSync(`${DIR}/${f}`, 'utf8') as string

// ── ui-swiper (the primary fence) ────────────────────────────────────────────────────────────────────────

const swiperMd = read('swiper.md')
const { fence: swiperFence, body: swiperBody } = splitFrontmatter(swiperMd)
const swiperParsed = parseDescriptor(swiperFence)
const SWIPER_ATTR_NAMES = [
  'elevation', 'brightness', 'orientation', 'slides-in-view', 'align', 'loop', 'duration', 'easing',
  'pagination', 'paddles', 'active',
]

describe('swiper.md descriptor — structural + contract↔props + contract↔source', () => {
  it('has a leading frontmatter fence and documents all five elements', () => {
    expect(swiperFence.length).toBeGreaterThan(0)
    expect(swiperBody).toContain('# ui-swiper')
  })

  it('carries the ADR-0004 field set; tag ui-swiper; tier pattern; extends UIContainerElement; NOT form-associated', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(swiperParsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
    expect(/^tag:\s*ui-swiper\s*$/m.test(swiperFence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(swiperFence)).toBe(true)
    expect(/^extends:\s*UIContainerElement\b/m.test(swiperFence)).toBe(true)
    expect(/formAssociated:\s*false/.test(swiperFence)).toBe(true)
  })

  it('declares the track/live parts + the region roleDescription (the fleet-first ariaRoleDescription API)', () => {
    const partNames = swiperParsed.sequences.get('parts')?.map((p) => p.get('name'))
    expect(partNames).toEqual(['track', 'live'])
    expect(swiperFence).toMatch(/roleDescription:\s*carousel/)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    expect(swiperParsed.attributes.map((a) => a.name)).toEqual(SWIPER_ATTR_NAMES) // anti-vacuous
    expect(validateComponentDescriptor(swiperParsed)).toEqual([])
  })

  it('attributes[] is a faithful bijection with finalize(UISwiperElement).props (0 drift)', () => {
    expect(compareDescriptorToProps(swiperParsed.attributes, UISwiperElement.props)).toEqual([])
  })

  it('the bindable `active` is a reflected string, default \'\' (ADR-0019, LLD-C7)', () => {
    const active = swiperParsed.attributes.find((a) => a.name === 'active')
    expect(active?.type).toBe('string')
    expect(active?.reflect).toBe(true)
    expect(active?.default).toBe('')
  })

  it('a drifted attribute FAILS the trip-wire (negative control)', () => {
    const flipReflect: ParsedAttribute[] = swiperParsed.attributes.map((a) => (a.name === 'active' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UISwiperElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.active.reflect' }),
    )
    const dropOne = swiperParsed.attributes.filter((a) => a.name !== 'loop')
    expect(compareDescriptorToProps(dropOne, UISwiperElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.loop' }),
    )
  })

  it('customStates {ready} are used in swiper.ts/.css (0 source drift)', () => {
    expect(scalarSeq(swiperParsed, 'customStates')).toEqual(['ready'])
    expect(compareDescriptorToSource(swiperParsed, { ts: swiperTs, css })).toEqual([])
  })

  it('a state used in source but undocumented FAILS (negative control)', () => {
    const dropped = parseDescriptor(swiperFence.replace(/^  - ready.*$/m, ''))
    expect(compareDescriptorToSource(dropped, { ts: swiperTs, css })).toContainEqual(
      expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.ready' }),
    )
  })
})

// ── ui-swiper-item ────────────────────────────────────────────────────────────────────────────────────────

const itemMd = read('swiper-item.md')
const { fence: itemFence } = splitFrontmatter(itemMd)
const itemParsed = parseDescriptor(itemFence)
const itemTs = readFileSync(`${DIR}/swiper-item.ts`, 'utf8') as string

describe('swiper-item.md descriptor', () => {
  it('tag ui-swiper-item; tier layout; extends UIElement; attributes=[key]', () => {
    expect(/^tag:\s*ui-swiper-item\s*$/m.test(itemFence)).toBe(true)
    expect(/^tier:\s*layout\b/m.test(itemFence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(itemFence)).toBe(true)
    expect(itemParsed.attributes.map((a) => a.name)).toEqual(['key'])
  })

  it('validateComponentDescriptor is schema-valid + the props bijection holds (0 drift)', () => {
    expect(validateComponentDescriptor(itemParsed)).toEqual([])
    expect(compareDescriptorToProps(itemParsed.attributes, UISwiperItemElement.props)).toEqual([])
  })

  it('declares NO customStates (labelAs sets ARIA facts, not a :state() hook) — 0 source drift against its OWN sheet', () => {
    const itemCss = read('swiper-item.css')
    expect(scalarSeq(itemParsed, 'customStates')).toEqual([])
    expect(compareDescriptorToSource(itemParsed, { ts: itemTs, css: itemCss })).toEqual([])
  })
})

// ── ui-swiper-pagination ─────────────────────────────────────────────────────────────────────────────────

const paginationMd = read('swiper-pagination.md')
const { fence: paginationFence } = splitFrontmatter(paginationMd)
const paginationParsed = parseDescriptor(paginationFence)
const paginationTs = readFileSync(`${DIR}/swiper-pagination.ts`, 'utf8') as string

describe('swiper-pagination.md descriptor', () => {
  it('tag ui-swiper-pagination; tier pattern; extends UIElement; attributes=[type]', () => {
    expect(/^tag:\s*ui-swiper-pagination\s*$/m.test(paginationFence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(paginationFence)).toBe(true)
    expect(paginationParsed.attributes.map((a) => a.name)).toEqual(['type'])
  })

  it('validateComponentDescriptor is schema-valid + the props bijection holds (0 drift)', () => {
    expect(validateComponentDescriptor(paginationParsed)).toEqual([])
    expect(compareDescriptorToProps(paginationParsed.attributes, UISwiperPaginationElement.props)).toEqual([])
  })

  it('declares the dot/fraction parts; 0 source drift against its OWN sheet (no customStates — ready lives in swiper.css)', () => {
    const paginationCss = read('swiper-pagination.css')
    expect(paginationParsed.sequences.get('parts')?.map((p) => p.get('name'))).toEqual(['dot', 'fraction'])
    expect(compareDescriptorToSource(paginationParsed, { ts: paginationTs, css: paginationCss })).toEqual([])
  })
})

// ── ui-swiper-paddles ────────────────────────────────────────────────────────────────────────────────────

const paddlesMd = read('swiper-paddles.md')
const { fence: paddlesFence } = splitFrontmatter(paddlesMd)
const paddlesParsed = parseDescriptor(paddlesFence)
const paddlesTs = readFileSync(`${DIR}/swiper-paddles.ts`, 'utf8') as string

describe('swiper-paddles.md descriptor', () => {
  it('tag ui-swiper-paddles; tier pattern; extends UIElement; attributes=[] (empty by design)', () => {
    expect(/^tag:\s*ui-swiper-paddles\s*$/m.test(paddlesFence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(paddlesFence)).toBe(true)
    expect(paddlesParsed.attributes).toEqual([])
  })

  it('validateComponentDescriptor is schema-valid + the empty props bijection holds', () => {
    expect(validateComponentDescriptor(paddlesParsed)).toEqual([])
    expect(compareDescriptorToProps(paddlesParsed.attributes, UISwiperPaddlesElement.props)).toEqual([])
  })

  it('declares the prev/next parts; 0 source drift against its OWN sheet (no customStates)', () => {
    const paddlesCss = read('swiper-paddles.css')
    expect(paddlesParsed.sequences.get('parts')?.map((p) => p.get('name'))).toEqual(['prev', 'next'])
    expect(compareDescriptorToSource(paddlesParsed, { ts: paddlesTs, css: paddlesCss })).toEqual([])
  })
})

// ── ui-swiper-label ──────────────────────────────────────────────────────────────────────────────────────

const labelMd = read('swiper-label.md')
const { fence: labelFence } = splitFrontmatter(labelMd)
const labelParsed = parseDescriptor(labelFence)
const labelTs = readFileSync(`${DIR}/swiper-label.ts`, 'utf8') as string

describe('swiper-label.md descriptor', () => {
  it('tag ui-swiper-label; tier display; extends UIElement; attributes=[] (empty by design)', () => {
    expect(/^tag:\s*ui-swiper-label\s*$/m.test(labelFence)).toBe(true)
    expect(/^tier:\s*display\b/m.test(labelFence)).toBe(true)
    expect(labelParsed.attributes).toEqual([])
  })

  it('validateComponentDescriptor is schema-valid + the empty props bijection holds', () => {
    expect(validateComponentDescriptor(labelParsed)).toEqual([])
    expect(compareDescriptorToProps(labelParsed.attributes, UISwiperLabelElement.props)).toEqual([])
  })

  it('declares a default slot; 0 source drift against its OWN sheet (no customStates, no parts)', () => {
    const labelCss = read('swiper-label.css')
    expect(labelParsed.sequences.get('slots')?.map((s) => s.get('name'))).toEqual(['default'])
    expect(compareDescriptorToSource(labelParsed, { ts: labelTs, css: labelCss })).toEqual([])
  })
})
